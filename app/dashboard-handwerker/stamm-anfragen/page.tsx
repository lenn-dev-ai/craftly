"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Clock, CheckCircle2, XCircle } from "lucide-react"

// Sprint V Phase 3 — HW-Inbox für 1:1-Stamm-Anfragen.
//
// Zeigt offene (status='gesendet') Anfragen mit Frist-Countdown und
// inline-Buttons für Annehmen (Preis-Prompt) / Ablehnen (Grund-Prompt).
// Beide Buttons rufen die API in /api/stamm-anfragen/[id]/{annehmen,ablehnen}.

type StammAnfrage = {
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

function formatFrist(iso: string): { text: string; abgelaufen: boolean } {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return { text: "Abgelaufen", abgelaufen: true }
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return { text: `noch ${Math.round(h / 24)} Tage`, abgelaufen: false }
  if (h >= 1) return { text: `noch ${h}h ${m}min`, abgelaufen: false }
  return { text: `noch ${m}min`, abgelaufen: false }
}

export default function StammAnfragenPage() {
  const router = useRouter()
  const [anfragen, setAnfragen] = useState<StammAnfrage[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const { data } = await supabase
      .from("stamm_anfragen")
      .select("id, ticket_id, status, frist_bis, created_at, preis_vorschlag_cents, ablehn_grund, ticket:tickets(id, titel, beschreibung, gewerk, einsatzort_adresse, prioritaet)")
      .eq("handwerker_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<StammAnfrage[]>()
    setAnfragen(data || [])
    setLoading(false)
  }, [router])

  useEffect(() => { void load() }, [load])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-[#3D8B7A] rounded-full animate-spin" />
      </div>
    )
  }

  const offen = anfragen.filter(a => a.status === "gesendet")
  const erledigt = anfragen.filter(a => a.status !== "gesendet")

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink">Stamm-Anfragen</h1>
        <p className="text-sm text-ink-muted mt-1">
          1:1-Direktanfragen von Verwaltern, bei denen du als Stamm-HW hinterlegt bist.
        </p>
      </header>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
          Offen ({offen.length})
        </h2>
        {offen.length === 0 ? (
          <div className="bg-white rounded-2xl border border-line p-8 text-center text-sm text-ink-muted">
            Keine offenen Anfragen.
          </div>
        ) : (
          <ul className="space-y-3">
            {offen.map(a => {
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
          </ul>
        )}
      </section>

      {erledigt.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
            Vergangene ({erledigt.length})
          </h2>
          <ul className="space-y-2">
            {erledigt.map(a => (
              <li key={a.id} className="bg-white rounded-xl border border-line px-4 py-3 text-sm flex items-center gap-3">
                {a.status === "angenommen" ? (
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                ) : (
                  <XCircle size={14} className="text-rose-500 shrink-0" />
                )}
                <span className="font-medium text-ink truncate">{a.ticket?.titel ?? "Ticket"}</span>
                <span className="text-xs text-ink-muted ml-auto capitalize shrink-0">{a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
