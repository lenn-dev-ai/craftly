"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Clock, CheckCircle2, XCircle } from "lucide-react"

// Sprint AN — geteilte Inbox-Komponente für offene 1:1-Direktanfragen.
// Deckt zwei Pfade ab (Sprint AO):
//   1. stamm_anfragen (Stamm-HW): Preis per Prompt, Frist aus frist_bis
//   2. einladungen (Direktvergabe ohne Stamm-HW): System-Preis fix, Frist
//      aus direktvergabe_angefragt_am + direktvergabe_timeout_min

export type StammAnfrage = {
  id: string
  ticket_id: string
  status: string
  frist_bis: string
  created_at: string
  preis_vorschlag_cents: number | null
  ablehn_grund: string | null
  ticket: {
    id: string
    titel: string
    beschreibung: string | null
    gewerk: string | null
    einsatzort_adresse: string | null
    prioritaet: string | null
  } | null
}

export function formatFrist(iso: string): { text: string; abgelaufen: boolean } {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return { text: "Abgelaufen", abgelaufen: true }
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return { text: `noch ${Math.round(h / 24)} Tage`, abgelaufen: false }
  if (h >= 1) return { text: `noch ${h}h ${m}min`, abgelaufen: false }
  return { text: `noch ${m}min`, abgelaufen: false }
}

// Countdown für einladungen-Direktvergabe: Startzeit + Timeout in Minuten.
function formatTimeout(angefragt_am: string | null, timeout_min: number | null): { text: string; abgelaufen: boolean } {
  if (!angefragt_am || timeout_min == null) return { text: "Keine Frist", abgelaufen: false }
  const endMs = new Date(angefragt_am).getTime() + timeout_min * 60_000
  const ms = endMs - Date.now()
  if (ms <= 0) return { text: "Abgelaufen", abgelaufen: true }
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return { text: `noch ${Math.round(h / 24)} Tage`, abgelaufen: false }
  if (h >= 1) return { text: `noch ${h}h ${m}min`, abgelaufen: false }
  return { text: `noch ${m}min`, abgelaufen: false }
}

// Sprint AO: Einladungs-Direktanfragen (kein Stamm-HW, aber direktvergabe-Kandidat).
export type EinladungDirektanfrage = {
  id: string
  ticket_id: string
  empfohlener_preis: number | null
  created_at: string
  ticket: {
    id: string
    titel: string
    beschreibung: string | null
    gewerk: string | null
    einsatzort_adresse: string | null
    prioritaet: string | null
    status: string | null
    direktvergabe_angefragt_am: string | null
    direktvergabe_timeout_min: number | null
  } | null
}

interface DirektanfragenInboxProps {
  // Begrenzt die angezeigten Karten (Dashboard zeigt z. B. nur 5, die
  // volle Stamm-Anfragen-Seite alle). Ohne limit: alle anzeigen.
  limit?: number
  // Eigener Leer-Zustand pro Einbindungsort (Dashboard vs. Stamm-Anfragen).
  emptyState?: React.ReactNode
  // Meldet die Gesamtzahl offener Anfragen an die Eltern-Seite (z. B. für
  // die KPI-Kachel im Dashboard).
  onCountChange?: (count: number) => void
}

export default function DirektanfragenInbox({ limit, emptyState, onCountChange }: DirektanfragenInboxProps) {
  const router = useRouter()
  const [anfragen, setAnfragen] = useState<StammAnfrage[]>([])
  const [einladungen, setEinladungen] = useState<EinladungDirektanfrage[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [stammResult, einladungResult] = await Promise.all([
      supabase
        .from("stamm_anfragen")
        .select("id, ticket_id, status, frist_bis, created_at, preis_vorschlag_cents, ablehn_grund, ticket:tickets(id, titel, beschreibung, gewerk, einsatzort_adresse, prioritaet)")
        .eq("handwerker_id", user.id)
        .eq("status", "gesendet")
        .order("created_at", { ascending: false })
        .returns<StammAnfrage[]>(),
      // Sprint AO: Direktvergabe ohne Stamm-HW (einladungen, Ticket noch 'offen').
      // Client-seitiger Filter auf ticket.status weil PostgREST-Nested-Filters
      // in supabase-js v2 keine eq("ticket.status") auf !inner-Joins unterstützen.
      supabase
        .from("einladungen")
        .select("id, ticket_id, empfohlener_preis, created_at, ticket:tickets!inner(id, titel, beschreibung, gewerk, einsatzort_adresse, prioritaet, status, direktvergabe_angefragt_am, direktvergabe_timeout_min)")
        .eq("handwerker_id", user.id)
        .eq("status", "offen")
        .order("created_at", { ascending: false })
        .returns<EinladungDirektanfrage[]>(),
    ])

    setAnfragen(stammResult.data || [])
    // Nur ticket.status='offen' — schließt Mass-Invite-Fallback (status='auktion') aus.
    setEinladungen((einladungResult.data || []).filter(e => e.ticket?.status === "offen"))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    onCountChange?.(anfragen.length + einladungen.length)
  }, [anfragen.length, einladungen.length, onCountChange])

  // Realtime: neue Direktanfragen sofort sehen (Sprint AM Kernmoment soll
  // sich "live" anfühlen, analog zum tickets-Listener im Dashboard).
  useEffect(() => {
    const supabase = createClient()
    const stammChannel = supabase
      .channel("handwerker-stamm-anfragen-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stamm_anfragen" },
        () => { void load() },
      )
      .subscribe()
    const einladungChannel = supabase
      .channel("handwerker-einladungen-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "einladungen" },
        () => { void load() },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(stammChannel)
      supabase.removeChannel(einladungChannel)
    }
  }, [load])

  async function annehmen(id: string) {
    const preisRaw = window.prompt("Preis (€) für diese Reparatur:")
    if (!preisRaw) return
    const preis = Number(preisRaw.replace(",", "."))
    if (!Number.isFinite(preis) || preis <= 0) {
      alert("Ungültiger Preis")
      return
    }
    setBusyId(id)
    const res = await fetch(`/api/stamm-anfragen/${id}/annehmen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preis }),
    })
    setBusyId(null)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Fehler" }))
      alert(error || "Annehmen fehlgeschlagen")
      return
    }
    await load()
  }

  async function ablehnen(id: string) {
    const grund = window.prompt("Grund für die Ablehnung (optional):") || undefined
    setBusyId(id)
    const res = await fetch(`/api/stamm-anfragen/${id}/ablehnen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grund }),
    })
    setBusyId(null)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Fehler" }))
      alert(error || "Ablehnen fehlgeschlagen")
      return
    }
    await load()
  }

  // Sprint AO: Ablehnen für einladungen-Direktvergabe (löst Eskalation aus).
  async function ablehnenEinladung(einladungId: string) {
    const grund = window.prompt("Grund für die Ablehnung (optional):") || undefined
    setBusyId(einladungId)
    const res = await fetch(`/api/einladungen/${einladungId}/ablehnen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grund }),
    })
    setBusyId(null)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Fehler" }))
      alert(error || "Ablehnen fehlgeschlagen")
      return
    }
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-[#3D8B7A] rounded-full animate-spin" />
      </div>
    )
  }

  const totalCount = anfragen.length + einladungen.length

  if (totalCount === 0) {
    return emptyState !== undefined ? (
      <>{emptyState}</>
    ) : (
      <div className="bg-white rounded-2xl border border-line p-8 text-center text-sm text-ink-muted">
        Keine offenen Anfragen.
      </div>
    )
  }

  const stammListe = limit ? anfragen.slice(0, limit) : anfragen
  // Einladungen nehmen den verbleibenden Platz im limit-Fenster ein.
  const einladungListe = limit
    ? einladungen.slice(0, Math.max(0, limit - stammListe.length))
    : einladungen

  return (
    <ul className="space-y-3">
      {stammListe.map(a => {
        const frist = formatFrist(a.frist_bis)
        return (
          <li key={a.id} className="bg-white rounded-2xl border border-line p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/dashboard-handwerker/auftraege/${a.ticket_id}`}
                  className="text-base font-semibold text-ink hover:text-accent"
                >
                  {a.ticket?.titel ?? "Ticket"}
                </Link>
                {a.ticket?.beschreibung && (
                  <p className="text-sm text-ink-muted mt-1 line-clamp-2">
                    {a.ticket.beschreibung}
                  </p>
                )}
                <div className="mt-2 text-xs text-ink-muted flex flex-wrap gap-x-3 gap-y-1">
                  {a.ticket?.gewerk && <span>Gewerk: {a.ticket.gewerk}</span>}
                  {a.ticket?.einsatzort_adresse && <span>📍 {a.ticket.einsatzort_adresse}</span>}
                  {a.ticket?.prioritaet && <span>Priorität: {a.ticket.prioritaet}</span>}
                </div>
                <div className={`mt-2 text-xs flex items-center gap-1.5 ${frist.abgelaufen ? "text-danger" : "text-ink-muted"}`}>
                  <Clock size={12} />
                  Frist: {frist.text}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  disabled={busyId === a.id || frist.abgelaufen}
                  onClick={() => annehmen(a.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-[#3D8B7A] text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  Annehmen
                </button>
                <button
                  disabled={busyId === a.id}
                  onClick={() => ablehnen(a.id)}
                  className="px-3 py-1.5 text-xs font-medium border border-line text-ink-muted rounded-lg hover:bg-surface-muted disabled:opacity-40"
                >
                  Ablehnen
                </button>
              </div>
            </div>
          </li>
        )
      })}

      {/* Sprint AO: Einladungs-Direktanfragen (System-Preis, kein Preis-Prompt).
          "Annehmen" → Detailseite für den vollen Annehmen+Slots-Flow.
          "Ablehnen" → direkte API-Call mit optionalem Grund. */}
      {einladungListe.map(e => {
        const frist = formatTimeout(e.ticket?.direktvergabe_angefragt_am ?? null, e.ticket?.direktvergabe_timeout_min ?? null)
        const preis = e.empfohlener_preis
        return (
          <li key={e.id} className="bg-white rounded-2xl border border-line p-5 ring-1 ring-accent/10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/dashboard-handwerker/angebot/${e.ticket_id}`}
                  className="text-base font-semibold text-ink hover:text-accent"
                >
                  {e.ticket?.titel ?? "Ticket"}
                </Link>
                {e.ticket?.beschreibung && (
                  <p className="text-sm text-ink-muted mt-1 line-clamp-2">
                    {e.ticket.beschreibung}
                  </p>
                )}
                <div className="mt-2 text-xs text-ink-muted flex flex-wrap gap-x-3 gap-y-1">
                  {e.ticket?.gewerk && <span>Gewerk: {e.ticket.gewerk}</span>}
                  {e.ticket?.einsatzort_adresse && <span>📍 {e.ticket.einsatzort_adresse}</span>}
                  {e.ticket?.prioritaet && <span>Priorität: {e.ticket.prioritaet}</span>}
                  {preis != null && (
                    <span className="font-medium text-accent">
                      {preis.toLocaleString("de")} € Festpreis
                    </span>
                  )}
                </div>
                <div className={`mt-2 text-xs flex items-center gap-1.5 ${frist.abgelaufen ? "text-danger" : "text-ink-muted"}`}>
                  <Clock size={12} />
                  Frist: {frist.text}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  disabled={busyId === e.id || frist.abgelaufen}
                  onClick={() => router.push(`/dashboard-handwerker/angebot/${e.ticket_id}`)}
                  className="px-3 py-1.5 text-xs font-medium bg-[#3D8B7A] text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  Annehmen
                </button>
                <button
                  disabled={busyId === e.id}
                  onClick={() => ablehnenEinladung(e.id)}
                  className="px-3 py-1.5 text-xs font-medium border border-line text-ink-muted rounded-lg hover:bg-surface-muted disabled:opacity-40"
                >
                  Ablehnen
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Wiederverwendbares Status-Icon für die "Vergangene"-Liste (bleibt nur auf
// der vollen Stamm-Anfragen-Seite, s. SPRINT-AN-SPEC.md).
export function StatusIcon({ status }: { status: string }) {
  return status === "angenommen" ? (
    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
  ) : (
    <XCircle size={14} className="text-rose-500 shrink-0" />
  )
}
