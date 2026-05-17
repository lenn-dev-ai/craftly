"use client"
import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile, Ticket, formatGewerk } from "@/types"
import { LoadingSpinner, Toast } from "@/components/ui"
import { berechnePreisfaktor, berechneRichtpreis } from "@/lib/preisfaktor"
import { haversineKm, schaetzeFahrzeitMin, formatiereDistanz, formatiereFahrzeit } from "@/lib/distance"
import { analysiereRoute, routenLabel, routenFarbe, type Termin as RouteTermin } from "@/lib/route-optimizer"
import { AUKTIONS_CONFIGS } from "@/lib/auction/auction-manager"
import type { Dringlichkeit } from "@/lib/auction/smart-score"
import DistanceBadge from "@/components/DistanceBadge"

type SortKey = "effektiv" | "stundensatz" | "distanz" | "bewertung" | "score"

type HandwerkerPlus = UserProfile & {
  selected: boolean
  // berechnet
  distanzKm: number | null
  fahrzeitMin: number | null
  routenScore: number | null
  effektivPreis: number | null
  istFavorit: boolean
}

export default function HandwerkerAuswahlPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [handwerker, setHandwerker] = useState<HandwerkerPlus[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("effektiv")
  const [dringlichkeit, setDringlichkeit] = useState<Dringlichkeit>("planbar")

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000) }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      // FIX-7: handwerker:profiles(*) hätte email/telefon mit ausgeliefert.
      // Nur Public-Felder selektieren (für die HW-Liste relevant).
      const { data: t } = await supabase.from("tickets")
        .select("*, einladungen(*, handwerker:profiles(id, name, firma, gewerk, bewertung_avg, auftraege_anzahl))")
        .eq("id", ticketId).single()
      if (!t) { router.push("/dashboard-verwalter"); return }
      setTicket(t)
      // Vorbelegung der Dringlichkeit: aus DB übernehmen.
      // Seit LT-2 ist prioritaet eh planbar/zeitnah/notfall — kein
      // Mapping mehr nötig. Legacy-Werte (normal/hoch/dringend) werden
      // hier defensiv noch akzeptiert (alte Bookmarks/Backups).
      const tt = t as { dringlichkeit?: Dringlichkeit; prioritaet?: string }
      if (tt.dringlichkeit) {
        setDringlichkeit(tt.dringlichkeit)
      } else if (tt.prioritaet === "notfall" || tt.prioritaet === "dringend") {
        setDringlichkeit("notfall")
      } else if (tt.prioritaet === "zeitnah" || tt.prioritaet === "hoch") {
        setDringlichkeit("zeitnah")
      }

      // FIX-7: nur Public-Profilfelder + die für Smart-Score nötigen Geo/
      // Preis-Daten. Email/Telefon sind nicht im HW-Auswahl-UI sichtbar.
      // (rolle/email/created_at brauchen wir nicht im UI, sind aber im
      // UserProfile-Type drin → Type-Cast unten zu HandwerkerPlus.)
      let query = supabase.from("profiles")
        .select("id, name, firma, gewerk, bewertung_avg, auftraege_anzahl, basis_stundensatz, basis_preis, fahrtkosten_pro_km, startort_lat, startort_lng, lat, lng, radius_km, sichtbarkeit_stufe, verfuegbarkeit_score, plz_bereich")
        .eq("rolle", "handwerker")
      if (t.gewerk && t.gewerk !== "allgemein") {
        query = query.ilike("gewerk", `%${t.gewerk}%`)
      }
      const { data: hws } = await query.order("bewertung_avg", { ascending: false })
      const liste = hws || []
      const hwIds = liste.map(hw => hw.id)

      // Lade Tages-Termine + Privat-Termine für jeden Handwerker (heute)
      const heute = new Date().toISOString().slice(0, 10)
      const [{ data: alleTermine }, { data: allePrivat }] = await Promise.all([
        supabase.from("termine").select("*").in("handwerker_id", hwIds).eq("datum", heute),
        supabase.from("private_termine").select("*").in("handwerker_id", hwIds).eq("datum", heute),
      ])
      const termineMap = new Map<string, RouteTermin[]>()
      for (const tt of alleTermine || []) {
        const r: RouteTermin = {
          von: tt.von?.slice(0, 5) || "08:00",
          bis: tt.bis?.slice(0, 5) || "10:00",
          lat: tt.einsatzort_lat,
          lng: tt.einsatzort_lng,
          adresse: tt.einsatzort_adresse || "",
          typ: "auftrag",
          titel: tt.titel,
        }
        if (r.lat == null || r.lng == null) continue
        const arr = termineMap.get(tt.handwerker_id) || []
        arr.push(r)
        termineMap.set(tt.handwerker_id, arr)
      }
      for (const pt of allePrivat || []) {
        const r: RouteTermin = {
          von: pt.von?.slice(0, 5) || "12:00",
          bis: pt.bis?.slice(0, 5) || "13:00",
          lat: pt.lat,
          lng: pt.lng,
          adresse: pt.adresse || "",
          typ: "privat",
          titel: pt.bezeichnung,
        }
        if (r.lat == null || r.lng == null) continue
        const arr = termineMap.get(pt.handwerker_id) || []
        arr.push(r)
        termineMap.set(pt.handwerker_id, arr)
      }

      const bereitsEingeladen = new Set((t.einladungen || []).map((e: { handwerker_id: string }) => e.handwerker_id))
      const ticketLat = t.einsatzort_lat
      const ticketLng = t.einsatzort_lng
      const dauerStunden = 2 // Default-Annahme; spaeter aus Ticket
      const dauerMin = dauerStunden * 60

      // FIX-7: Cast nötig weil select() jetzt nur Public-Felder holt,
      // aber HandwerkerPlus extends UserProfile (mit email/rolle/created_at).
      // Diese Felder werden im UI nicht gebraucht — Cast über unknown ist
      // sicher.
      const erweitert: HandwerkerPlus[] = (liste as unknown as UserProfile[]).map(hw => {
        let distanzKm: number | null = null
        let fahrzeitMin: number | null = null
        let routenScore: number | null = null
        let effektivPreis: number | null = null

        // Ausgangspunkt: Startort > Werkstatt-Lat
        const ausgangLat = hw.startort_lat ?? hw.lat
        const ausgangLng = hw.startort_lng ?? hw.lng

        if (ticketLat != null && ticketLng != null && ausgangLat != null && ausgangLng != null) {
          // Einfache Distanz Startort → Einsatzort als Fallback
          distanzKm = haversineKm(ausgangLat, ausgangLng, ticketLat, ticketLng)
          fahrzeitMin = schaetzeFahrzeitMin(distanzKm)

          // Route-Analyse mit Tagesterminen
          const termineHW = termineMap.get(hw.id) || []
          const stundensatz = hw.basis_stundensatz ?? hw.basis_preis ?? 50
          const fkmFallback = hw.fahrtkosten_pro_km ?? 0.5

          const analysen = analysiereRoute({
            termineDesTages: termineHW,
            startort: { lat: ausgangLat, lng: ausgangLng },
            neuerEinsatzort: { lat: ticketLat, lng: ticketLng },
            dauerMinuten: dauerMin,
            basisStundensatz: stundensatz,
            fahrtkostenProKm: fkmFallback,
          })
          if (analysen.length > 0) {
            const beste = analysen[0]
            routenScore = beste.routenScore
            effektivPreis = beste.effektivPreis
            fahrzeitMin = beste.fahrzeitVorher
          } else {
            // Keine Lücke → einfache Berechnung
            effektivPreis = Math.round((stundensatz + distanzKm * fkmFallback) * 100) / 100
            routenScore = distanzKm <= 5 ? 80 : distanzKm <= 15 ? 50 : 20
          }
        }

        return {
          ...hw,
          selected: bereitsEingeladen.has(hw.id),
          distanzKm,
          fahrzeitMin,
          routenScore,
          effektivPreis,
          istFavorit: false, // TODO: aus DB laden wenn Favoriten implementiert
        }
      })

      setHandwerker(erweitert)
      setLoading(false)
    }
    load()
  }, [ticketId, router])

  // F8: Effektivpreis multipliziert sich mit dem aktuellen surge_faktor
  // der gewählten Dringlichkeit. Damit ändert sich die Anzeige live,
  // wenn der Verwalter die Dringlichkeitsstufe umschaltet.
  const sortiert = useMemo<(HandwerkerPlus & { effektivPreisFinal: number | null })[]>(() => {
    const surge = AUKTIONS_CONFIGS[dringlichkeit].surgeFaktor
    const liste = handwerker.map(hw => ({
      ...hw,
      effektivPreisFinal: hw.effektivPreis != null
        ? Math.round(hw.effektivPreis * surge * 100) / 100
        : null,
    }))
    liste.sort((a, b) => {
      if (sortKey === "effektiv") {
        return (a.effektivPreisFinal ?? Infinity) - (b.effektivPreisFinal ?? Infinity)
      }
      if (sortKey === "stundensatz") {
        return (a.basis_stundensatz ?? a.basis_preis ?? Infinity) - (b.basis_stundensatz ?? b.basis_preis ?? Infinity)
      }
      if (sortKey === "distanz") {
        return (a.distanzKm ?? Infinity) - (b.distanzKm ?? Infinity)
      }
      if (sortKey === "bewertung") {
        return (b.bewertung_avg ?? 0) - (a.bewertung_avg ?? 0)
      }
      if (sortKey === "score") {
        return (b.routenScore ?? -1) - (a.routenScore ?? -1)
      }
      return 0
    })
    return liste
  }, [handwerker, sortKey, dringlichkeit])

  function toggleHW(id: string) {
    setHandwerker(prev => prev.map(hw => hw.id === id ? { ...hw, selected: !hw.selected } : hw))
  }

  function selectAll() {
    setHandwerker(prev => prev.map(hw => ({ ...hw, selected: true })))
  }

  async function sendeEinladungen() {
    const selected = handwerker.filter(hw => hw.selected)
    if (selected.length === 0) { showToast("Bitte mindestens einen Handwerker auswählen."); return }
    setSending(true)
    const supabase = createClient()
    // Legacy-Werte (normal/hoch/dringend) → neue mappen (defensive).
    const rawPrio = (ticket?.prioritaet as string | undefined) ?? "planbar"
    const legacyMap: Record<string, "planbar" | "zeitnah" | "notfall"> = {
      normal: "planbar", hoch: "zeitnah", dringend: "notfall",
      planbar: "planbar", zeitnah: "zeitnah", notfall: "notfall",
    }
    const pf = berechnePreisfaktor(
      legacyMap[rawPrio] ?? "planbar",
      handwerker.length
    )
    const einladungen = selected.map(hw => ({
      ticket_id: ticketId,
      handwerker_id: hw.id,
      status: "offen",
      empfohlener_preis: berechneRichtpreis(hw.basis_stundensatz ?? hw.basis_preis ?? 50, pf.faktor),
    }))
    const { error } = await supabase.from("einladungen").upsert(einladungen, { onConflict: "ticket_id,handwerker_id" })
    if (error) { showToast("Fehler beim Senden: " + error.message); setSending(false); return }

    // Auktions-Konfig aus gewählter Dringlichkeit
    const config = AUKTIONS_CONFIGS[dringlichkeit]
    const startIso = new Date().toISOString()
    const endeIso = config.auktionsDauerStunden > 0
      ? new Date(Date.now() + config.auktionsDauerStunden * 3600 * 1000).toISOString()
      : null

    await supabase.from("tickets").update({
      status: "auktion",
      dringlichkeit,
      surge_faktor: config.surgeFaktor,
      auktion_start: startIso,
      auktion_ende: endeIso,
    }).eq("id", ticketId)

    showToast(selected.length + " Einladung(en) gesendet!")
    setTimeout(() => router.push("/dashboard-verwalter/ticket/" + ticketId), 1500)
  }

  if (loading) return <LoadingSpinner />
  if (!ticket) return null

  const selectedCount = handwerker.filter(hw => hw.selected).length

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto pt-16 md:pt-8">
      <button onClick={() => router.back()} className="text-sm text-ink-secondary hover:text-ink mb-4 flex items-center gap-1">
        ← Zurück
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Handwerker auswählen</h1>
        <p className="text-sm text-ink-muted mt-1">
          {ticket.titel} — {formatGewerk(ticket.gewerk)}
        </p>
        {ticket.einsatzort_adresse && (
          <p className="text-xs text-ink-muted mt-1.5 flex items-center gap-1">
            📍 <span>{ticket.einsatzort_adresse}</span>
          </p>
        )}
      </div>

      {/* Dringlichkeits-Auswahl: steuert Radius, Auktions-Laufzeit, Surge */}
      <div className="bg-white rounded-2xl border border-line p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-ink-muted font-medium uppercase tracking-wide">
            Dringlichkeit der Auktion
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([
            {
              key: "notfall" as Dringlichkeit,
              titel: "🔴 Notfall",
              desc: "Sofort-Match · 10 km · +20 % Aufschlag",
              accent: "#C4574B",
            },
            {
              key: "zeitnah" as Dringlichkeit,
              titel: "🟡 Zeitnah",
              desc: "48 h · 15 km · +10 % Aufschlag",
              accent: "#C4956A",
            },
            {
              key: "planbar" as Dringlichkeit,
              titel: "🟢 Planbar",
              desc: "7 Tage · 25 km · Standard-Provision",
              accent: "#3D8B7A",
            },
          ]).map(opt => {
            const aktiv = dringlichkeit === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDringlichkeit(opt.key)}
                aria-pressed={aktiv}
                className={`text-left rounded-xl border p-3 transition-all ${
                  aktiv
                    ? "border-[#3D8B7A] bg-accent/5 shadow-sm"
                    : "border-line hover:border-accent/30"
                }`}
              >
                <div className="text-sm font-semibold text-ink mb-0.5" style={{ color: aktiv ? opt.accent : undefined }}>
                  {opt.titel}
                </div>
                <div className="text-[11px] text-ink-muted leading-snug">{opt.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sort-Bar */}
      <div className="bg-white rounded-2xl border border-line p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted font-medium">Sortieren:</span>
            <div className="flex flex-wrap gap-1">
              {([
                { k: "effektiv", l: "Effektivpreis" },
                { k: "stundensatz", l: "Stundensatz" },
                { k: "distanz", l: "Entfernung" },
                { k: "bewertung", l: "Bewertung" },
                { k: "score", l: "Routen-Score" },
              ] as { k: SortKey; l: string }[]).map(s => (
                <button
                  key={s.k}
                  onClick={() => setSortKey(s.k)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    sortKey === s.k
                      ? "bg-accent text-white"
                      : "bg-surface text-ink-secondary hover:bg-line"
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-ink-muted">{handwerker.length} verfügbar</span>
        </div>
      </div>

      {/* Handwerker-Liste */}
      {sortiert.length === 0 ? (
        <div className="bg-white rounded-2xl border border-line p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-warm-light flex items-center justify-center mb-3">
            <span className="text-xl">⚠</span>
          </div>
          <div className="text-sm font-medium text-ink mb-1">Keine Handwerker gefunden</div>
          <div className="text-xs text-ink-muted">
            Für „{formatGewerk(ticket.gewerk)}“ sind aktuell keine Handwerker registriert.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {sortiert.map(hw => {
            const stundensatz = hw.basis_stundensatz ?? hw.basis_preis
            const farben = hw.routenScore != null ? routenFarbe(hw.routenScore) : null
            const label = hw.routenScore != null ? routenLabel(hw.routenScore) : null

            return (
              <button
                key={hw.id}
                onClick={() => toggleHW(hw.id)}
                aria-pressed={hw.selected}
                className={`text-left bg-white rounded-2xl border p-5 transition-all ${
                  hw.selected
                    ? "border-[#3D8B7A] bg-accent/5 shadow-sm"
                    : "border-line hover:border-accent/30 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded border-2 mt-1 flex items-center justify-center flex-shrink-0 transition-colors ${
                    hw.selected ? "bg-accent border-[#3D8B7A]" : "border-line bg-white"
                  }`}>
                    {hw.selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header: Name + Bewertung */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-base font-semibold text-ink">{hw.firma || hw.name}</div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {hw.bewertung_avg ? <span className="text-warm">★ {hw.bewertung_avg}</span> : "Neu"}
                          {" · "}{hw.auftraege_anzahl || 0} Aufträge
                          {hw.gewerk && (" · " + formatGewerk(hw.gewerk))}
                        </div>
                      </div>
                      {label && farben && (
                        <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded border whitespace-nowrap ${farben.bg} ${farben.text} ${farben.border}`}>
                          {label}
                        </span>
                      )}
                    </div>

                    {/* Routen-Daten Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-line">
                      <Cell
                        label="Stundensatz"
                        value={stundensatz != null ? `€${stundensatz}` : "—"}
                        muted={stundensatz == null}
                      />
                      <Cell
                        label="Distanz"
                        value={hw.distanzKm != null ? formatiereDistanz(hw.distanzKm) : "—"}
                        muted={hw.distanzKm == null}
                      />
                      <Cell
                        label="Fahrzeit"
                        value={hw.fahrzeitMin != null ? formatiereFahrzeit(hw.fahrzeitMin) : "—"}
                        muted={hw.fahrzeitMin == null}
                      />
                      <Cell
                        label="Effektivpreis"
                        value={hw.effektivPreisFinal != null ? `€${hw.effektivPreisFinal.toFixed(2)}` : "—"}
                        muted={hw.effektivPreisFinal == null}
                        highlight={hw.effektivPreis != null && stundensatz != null && hw.effektivPreis - stundensatz < 2}
                      />
                    </div>

                    {/* DistanceBadge */}
                    {hw.distanzKm != null && ticket.einsatzort_lat != null && ticket.einsatzort_lng != null && (hw.startort_lat ?? hw.lat) != null && (
                      <div className="mt-3">
                        <DistanceBadge
                          vonLat={hw.startort_lat ?? hw.lat}
                          vonLng={hw.startort_lng ?? hw.lng}
                          zuLat={ticket.einsatzort_lat}
                          zuLng={ticket.einsatzort_lng}
                          radiusKm={hw.radius_km}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Footer Actions */}
      {sortiert.length > 0 && (
        <div className="sticky bottom-4 bg-white rounded-2xl border border-line shadow-md p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink font-medium">{selectedCount} ausgewählt</span>
            {selectedCount === 0 && (
              <button onClick={selectAll} className="text-xs text-accent hover:text-[#2D6B5A] font-medium">
                Alle markieren
              </button>
            )}
          </div>
          <button
            onClick={sendeEinladungen}
            disabled={sending || selectedCount === 0}
            className="text-sm font-bold bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {sending ? "Wird gesendet…" : `${selectedCount} einladen`}
          </button>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  )
}

function Cell({ label, value, muted, highlight }: {
  label: string; value: string; muted?: boolean; highlight?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] text-ink-muted uppercase tracking-wide font-medium">{label}</div>
      <div className={`text-sm font-semibold tabular-nums mt-0.5 ${
        muted ? "text-ink-faint" : highlight ? "text-accent" : "text-ink"
      }`}>
        {value}
      </div>
    </div>
  )
}
