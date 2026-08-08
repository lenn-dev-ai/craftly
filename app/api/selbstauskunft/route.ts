import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { badRequest, notFound, serverError } from "@/lib/api-response"
import { createServiceRoleClient } from "@/lib/supabase-server"
import {
  PFLICHT_DOKUMENTE,
  selbstauskunftSchema,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME_TYPES,
} from "@/lib/woonwoon/selbstauskunft-schema"

// WoonWoon: Selbstauskunft einreichen (öffentlich, Token-gated).
//
// Ablauf:
//   1. Felder validieren (zod) + Pflicht-Uploads prüfen
//   2. Token gegen anfragen auflösen (RPC, anon-Client)
//   3. Uploads in den privaten Bucket (Service-Role — anon hat kein Storage-Recht)
//   4. RPC selbstauskunft_einreichen() mit dem ANON-Client: die DB prüft das
//      Token selbst — der Token-Gate greift damit auch auf DB-Ebene, nicht
//      nur hier in der Route. Setzt zugleich den Status auf 'eingereicht'.
//
// Multipart-Form: Felder flach + Dateien unter "dok_gehaltsnachweis" / "dok_ausweis".

export const dynamic = "force-dynamic"

const BUCKET = "selbstauskunft-dokumente"

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function dateiEndung(file: File): string {
  const ausName = file.name.includes(".") ? file.name.split(".").pop() : null
  if (ausName && /^[a-z0-9]{1,5}$/i.test(ausName)) return ausName.toLowerCase()
  return file.type === "application/pdf" ? "pdf" : "bin"
}

export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest("Ungültiges Formular.")
  }

  const token = String(form.get("token") ?? "")
  if (!UUID_RE.test(token)) return badRequest("Ungültiger Zugangslink.")

  // --- 1) Felder einsammeln & validieren -------------------------------
  const roh: Record<string, unknown> = {}
  form.forEach((value, key) => {
    if (key === "token" || key.startsWith("dok_")) return
    if (typeof value === "string") roh[key] = value
  })
  // Checkboxen: nur gesetzt wenn angehakt → explizit auf boolean mappen
  roh.haustiere = form.get("haustiere") === "ja"
  roh.raucher = form.get("raucher") === "ja"
  roh.erklaerung_richtigkeit = form.get("erklaerung_richtigkeit") === "ja" ? true : undefined
  roh.datenschutz_einwilligung = form.get("datenschutz_einwilligung") === "ja" ? true : undefined

  const parsed = selbstauskunftSchema.safeParse(roh)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue?.message ?? "Bitte alle Pflichtfelder ausfüllen.", feld: issue?.path?.[0] ?? null },
      { status: 400 },
    )
  }

  // --- Pflicht-Uploads prüfen ------------------------------------------
  const dateien: { typ: string; file: File }[] = []
  for (const { typ, label } of PFLICHT_DOKUMENTE) {
    const file = form.get(`dok_${typ}`)
    if (!(file instanceof File) || file.size === 0) {
      return badRequest(`Bitte ${label} hochladen.`)
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      return badRequest(`${label}: Datei ist größer als 10 MB.`)
    }
    if (!UPLOAD_MIME_TYPES.includes(file.type as (typeof UPLOAD_MIME_TYPES)[number])) {
      return badRequest(`${label}: Bitte als PDF, JPG, PNG oder WebP hochladen.`)
    }
    dateien.push({ typ, file })
  }

  // --- 2) Token auflösen ------------------------------------------------
  const anon = anonClient()
  const { data: anfrage, error: tokenFehler } = await anon
    .rpc("anfrage_by_token", { p_token: token })
    .maybeSingle<{ objekt: string | null; interessent_name: string | null; status: string }>()

  if (tokenFehler) {
    console.error("[selbstauskunft] Token-Auflösung fehlgeschlagen:", tokenFehler.message)
    return serverError("Die Anfrage konnte nicht geprüft werden. Bitte später erneut versuchen.")
  }
  if (!anfrage) return notFound("Dieser Zugangslink ist ungültig oder abgelaufen.")
  if (anfrage.status !== "offen") {
    return NextResponse.json(
      { error: "Für diese Anfrage wurde bereits eine Selbstauskunft eingereicht." },
      { status: 409 },
    )
  }

  // --- 3) Uploads (Service-Role, privater Bucket) -----------------------
  const admin = createServiceRoleClient()
  const hochgeladen: {
    typ: string
    storage_pfad: string
    dateiname: string
    mime_type: string
    groesse_bytes: number
  }[] = []

  for (const { typ, file } of dateien) {
    const pfad = `${token}/${typ}-${Date.now()}.${dateiEndung(file)}`
    const { error: uploadFehler } = await admin.storage
      .from(BUCKET)
      .upload(pfad, file, { contentType: file.type, upsert: false })
    if (uploadFehler) {
      console.error(`[selbstauskunft] Upload ${typ} fehlgeschlagen:`, uploadFehler.message)
      return serverError("Der Datei-Upload ist fehlgeschlagen. Bitte erneut versuchen.")
    }
    hochgeladen.push({
      typ,
      storage_pfad: pfad,
      dateiname: file.name,
      mime_type: file.type,
      groesse_bytes: file.size,
    })
  }

  // --- 4) Atomar einreichen (RPC prüft Token erneut auf DB-Ebene) -------
  const d = parsed.data
  const { error: rpcFehler } = await anon.rpc("selbstauskunft_einreichen", {
    p_token: token,
    p_selbstauskunft: {
      vorname: d.vorname,
      nachname: d.nachname,
      geburtsdatum: d.geburtsdatum,
      email: d.email,
      telefon: d.telefon,
      strasse: d.strasse,
      plz: d.plz,
      ort: d.ort,
      beruf: d.beruf,
      arbeitgeber: d.arbeitgeber ?? null,
      netto_einkommen_eur: d.netto_einkommen_eur,
      anzahl_personen: d.anzahl_personen,
      haustiere: d.haustiere,
      raucher: d.raucher,
      einzug_ab: d.einzug_ab,
      mietdauer_monate: d.mietdauer_monate,
      paket: d.paket,
      // Nicht-Spalten-Felder → JSONB `daten`
      daten: {
        anrede: d.anrede ?? null,
        haustiere_details: d.haustiere_details ?? null,
        nachricht: d.nachricht ?? null,
        erklaerung_richtigkeit: true,
        datenschutz_einwilligung: true,
        feldkatalog_version: "v1",
      },
    },
    p_dokumente: hochgeladen,
  })

  if (rpcFehler) {
    // Verwaiste Uploads aufräumen (best effort)
    await admin.storage.from(BUCKET).remove(hochgeladen.map(h => h.storage_pfad)).catch(() => {})
    if (rpcFehler.message.includes("BEREITS_EINGEREICHT")) {
      return NextResponse.json(
        { error: "Für diese Anfrage wurde bereits eine Selbstauskunft eingereicht." },
        { status: 409 },
      )
    }
    if (rpcFehler.message.includes("TOKEN_UNGUELTIG")) {
      return notFound("Dieser Zugangslink ist ungültig oder abgelaufen.")
    }
    console.error("[selbstauskunft] Einreichen fehlgeschlagen:", rpcFehler.message)
    return serverError("Die Selbstauskunft konnte nicht gespeichert werden. Bitte erneut versuchen.")
  }

  return NextResponse.json({ ok: true })
}
