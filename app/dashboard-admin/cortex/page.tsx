"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { authFetch } from "@/lib/auth/clientFetch"

// Cortex-Cockpit (Sprint CI) — das Fenster ins System-Gehirn.
// Zeigt Memos (Entscheidungsjournal), Gedächtnis und Ereignisstrom.
// Lesezugriff via Admin-RLS-Policies; "Jetzt denken" stößt den
// Schlaf-Zyklus manuell an (Dual-Auth-Route, Admin-Pfad).

interface Entscheidung {
  id: string
  typ: string
  begruendung: string | null
  ergebnis: {
    handlungsbedarf?: Array<{ prioritaet: string; text: string }>
    memo_gesendet?: boolean
    fehler?: string
  }
  modell: string | null
  tokens_in: number | null
  tokens_out: number | null
  erstellt_at: string
}

interface Erinnerung {
  id: string
  typ: string
  inhalt: string
  wichtigkeit: number
  quelle: string | null
  erstellt_at: string
}

const TYP_FARBE: Record<string, string> = {
  episodisch: "bg-[#B07A3B]/10 text-[#B07A3B]",
  semantisch: "bg-accent/10 text-accent",
  prozedural: "bg-rolle-admin/10 text-rolle-admin",
}

export default function CortexPage() {
  const [entscheidungen, setEntscheidungen] = useState<Entscheidung[]>([])
  const [gedaechtnis, setGedaechtnis] = useState<Erinnerung[]>([])
  const [ereignisse, setEreignisse] = useState<{ offen: number; gesamt: number }>({ offen: 0, gesamt: 0 })
  const [loading, setLoading] = useState(true)
  const [denkt, setDenkt] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const laden = useCallback(async () => {
    const supabase = createClient()
    const [e, g, offen, gesamt] = await Promise.all([
      supabase.from("cortex_entscheidungen").select("*").order("erstellt_at", { ascending: false }).limit(10),
      supabase.from("cortex_gedaechtnis").select("id, typ, inhalt, wichtigkeit, quelle, erstellt_at").order("erstellt_at", { ascending: false }).limit(20),
      supabase.from("cortex_ereignisse").select("id", { count: "exact", head: true }).eq("verarbeitet", false),
      supabase.from("cortex_ereignisse").select("id", { count: "exact", head: true }),
    ])
    setEntscheidungen((e.data ?? []) as Entscheidung[])
    setGedaechtnis((g.data ?? []) as Erinnerung[])
    setEreignisse({ offen: offen.count ?? 0, gesamt: gesamt.count ?? 0 })
    setLoading(false)
  }, [])

  useEffect(() => { void laden() }, [laden])

  async function reflexeAusloesen() {
    setDenkt(true); setMeldung(null)
    try {
      const res = await authFetch("/api/cron/cortex-reflexe", { method: "POST" })
      const data = await res.json() as { ok?: boolean; uebersprungen?: string; reflexe?: Array<{ name: string; befunde: number }> }
      if (data.ok) {
        setMeldung(data.uebersprungen
          ? `Übersprungen: ${data.uebersprungen}`
          : `Reflexe ausgeführt: ${(data.reflexe ?? []).map(r => `${r.name} (${r.befunde})`).join(", ") || "keine Befunde"}.`)
      } else {
        setMeldung("Reflexe fehlgeschlagen.")
      }
    } catch (err) {
      setMeldung(`Fehler: ${err instanceof Error ? err.message : "unbekannt"}`)
    }
    setDenkt(false)
    void laden()
  }

  async function jetztDenken() {
    setDenkt(true); setMeldung(null)
    try {
      const res = await authFetch("/api/cron/cortex-schlaf", { method: "POST" })
      const data = await res.json() as { ok?: boolean; memoGesendet?: boolean; erkenntnisse?: number; fehler?: string; uebersprungen?: string }
      if (data.ok) {
        setMeldung(data.uebersprungen
          ? `Übersprungen: ${data.uebersprungen}`
          : `Zyklus abgeschlossen — ${data.erkenntnisse ?? 0} Erkenntnis(se), Memo ${data.memoGesendet ? "gesendet" : "nicht gesendet"}.`)
      } else {
        setMeldung(`Fehler: ${data.fehler ?? "unbekannt"}`)
      }
    } catch (err) {
      setMeldung(`Fehler: ${err instanceof Error ? err.message : "unbekannt"}`)
    }
    setDenkt(false)
    void laden()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto pt-16 md:pt-6">
      <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold text-ink">🧠 Cortex</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void reflexeAusloesen()}
            disabled={denkt}
            className="text-sm font-semibold border border-rolle-admin text-rolle-admin px-4 py-2 rounded-lg hover:bg-rolle-admin/5 transition-colors disabled:opacity-50"
          >
            Reflexe ausführen
          </button>
          <button
            onClick={() => void jetztDenken()}
            disabled={denkt}
            className="text-sm font-semibold bg-rolle-admin text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {denkt ? "Denkt …" : "Jetzt denken"}
          </button>
        </div>
      </div>
      <p className="text-sm text-ink-muted mb-1">
        Das System-Gehirn: beobachtet, merkt, meldet — führt nichts aus. Details: CORTEX.md
      </p>
      <p className="text-xs text-ink-muted mb-6">
        Ereignisstrom: {ereignisse.offen} unverarbeitet · {ereignisse.gesamt} gesamt · Schlaf-Zyklus nächtlich 03:30 UTC
      </p>

      {meldung && (
        <div className="mb-4 text-sm px-3 py-2 rounded-lg bg-accent/10 text-accent">{meldung}</div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Lädt …</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-base font-semibold text-ink mb-3">Memos & Entscheidungen</h2>
            {entscheidungen.length === 0 && <p className="text-sm text-ink-muted">Noch keine — &bdquo;Jetzt denken&ldquo; startet den ersten Zyklus.</p>}
            <div className="space-y-3">
              {entscheidungen.map(e => (
                <article key={e.id} className="bg-white border border-line rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-ink-muted mb-2 flex-wrap">
                    <span className="font-semibold uppercase tracking-wide text-ink-secondary">{e.typ}</span>
                    <span>· {new Date(e.erstellt_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    {e.modell && <span>· {e.modell}</span>}
                    {e.tokens_in != null && <span>· {e.tokens_in}/{e.tokens_out} Tokens</span>}
                    {e.ergebnis?.memo_gesendet && <span className="text-accent">· Memo gesendet ✓</span>}
                    {e.ergebnis?.fehler && <span className="text-danger">· Fehler</span>}
                  </div>
                  {e.begruendung && (
                    <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{e.begruendung}</p>
                  )}
                  {(e.ergebnis?.handlungsbedarf?.length ?? 0) > 0 && (
                    <ul className="mt-2 space-y-1">
                      {e.ergebnis.handlungsbedarf!.map((h, i) => (
                        <li key={i} className="text-sm text-ink">
                          <span className={`text-xs font-bold uppercase mr-1.5 ${h.prioritaet === "hoch" ? "text-danger" : h.prioritaet === "mittel" ? "text-[#B07A3B]" : "text-ink-muted"}`}>[{h.prioritaet}]</span>
                          {h.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-3">Gedächtnis ({gedaechtnis.length})</h2>
            {gedaechtnis.length === 0 && <p className="text-sm text-ink-muted">Noch leer.</p>}
            <div className="space-y-2">
              {gedaechtnis.map(g => (
                <div key={g.id} className="bg-white border border-line rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${TYP_FARBE[g.typ] ?? "bg-surface-muted text-ink-muted"}`}>
                    {g.typ} · W{g.wichtigkeit}
                  </span>
                  <p className="text-sm text-ink-secondary leading-relaxed">{g.inhalt}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
