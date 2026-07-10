"use client"

import { useRef, useState } from "react"
import { authFetch } from "@/lib/auth/clientFetch"

// "Frag Reparo" — das erste Nutzer-Gesicht des Cortex (Sprint CI).
// Kompakte Karte im Verwalter-Dashboard: Frage stellen, Antwort aus
// Portfolio-Daten + Cortex-Gedächtnis. Nur Auskunft — keine Aktionen.

interface Turn { rolle: "nutzer" | "cortex"; text: string }

const BEISPIELE_VERWALTER = [
  "Was hängt gerade und braucht mich?",
  "Wie viel habe ich diesen Monat ausgegeben?",
  "Welche Nachträge warten auf Entscheidung?",
]
const BEISPIELE_MIETER = [
  "Wann kommt der Handwerker?",
  "Wie ist der Stand meiner Meldung?",
  "Was passiert als Nächstes?",
]
const BEISPIELE_HANDWERKER = [
  "Was steht heute an?",
  "Welche Anfragen warten auf mich?",
  "Wie viel habe ich diesen Monat verdient?",
]

type CortexSicht = "verwalter" | "mieter" | "handwerker"

export default function FragReparo({ sicht = "verwalter" }: { sicht?: CortexSicht }) {
  const BEISPIELE =
    sicht === "mieter" ? BEISPIELE_MIETER
    : sicht === "handwerker" ? BEISPIELE_HANDWERKER
    : BEISPIELE_VERWALTER
  const untertitel =
    sicht === "mieter" ? "— deine Meldungen, direkt beantwortet"
    : sicht === "handwerker" ? "— dein Tag, auf einen Blick"
    : "— dein Portfolio, aus dem Kopf beantwortet"
  const [offen, setOffen] = useState(false)
  const [frage, setFrage] = useState("")
  const [verlauf, setVerlauf] = useState<Turn[]>([])
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const listeRef = useRef<HTMLDivElement>(null)

  async function fragen(text: string) {
    const f = text.trim()
    if (!f || laedt) return
    setFehler(null)
    setLaedt(true)
    setFrage("")
    const neuerVerlauf: Turn[] = [...verlauf, { rolle: "nutzer", text: f }]
    setVerlauf(neuerVerlauf)
    try {
      const res = await authFetch("/api/cortex/frage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frage: f, verlauf: verlauf.slice(-6), sicht }),
      })
      const data = await res.json() as { antwort?: string; error?: string }
      if (!res.ok || !data.antwort) {
        setFehler(data.error ?? "Antwort fehlgeschlagen.")
        setVerlauf(verlauf) // Nutzer-Turn zurücknehmen
      } else {
        setVerlauf([...neuerVerlauf, { rolle: "cortex", text: data.antwort }])
      }
    } catch {
      setFehler("Netzwerkfehler — bitte erneut versuchen.")
      setVerlauf(verlauf)
    }
    setLaedt(false)
    setTimeout(() => listeRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50)
  }

  return (
    <section className="bg-white border border-line rounded-2xl mb-6 overflow-hidden">
      <button
        onClick={() => setOffen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface-muted transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-lg">🧠</span>
          <span className="text-sm font-semibold text-ink">Frag Reparo</span>
          <span className="text-xs text-ink-muted hidden sm:inline">{untertitel}</span>
        </span>
        <span className="text-xs text-ink-muted">{offen ? "schließen" : "öffnen"}</span>
      </button>

      {offen && (
        <div className="border-t border-line px-5 py-4">
          {verlauf.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {BEISPIELE.map(b => (
                <button
                  key={b}
                  onClick={() => void fragen(b)}
                  disabled={laedt}
                  className="text-xs px-3 py-1.5 rounded-full border border-line text-ink-secondary hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {verlauf.length > 0 && (
            <div ref={listeRef} className="space-y-3 mb-3 max-h-80 overflow-y-auto pr-1">
              {verlauf.map((t, i) => (
                <div key={i} className={t.rolle === "nutzer" ? "text-right" : ""}>
                  <div className={`inline-block max-w-[85%] text-sm px-3.5 py-2 rounded-xl whitespace-pre-wrap leading-relaxed ${
                    t.rolle === "nutzer"
                      ? (sicht === "mieter" ? "bg-rolle-mieter text-white" : sicht === "handwerker" ? "bg-rolle-handwerker text-white" : "bg-rolle-verwalter text-white")
                      : "bg-surface-muted text-ink"
                  }`}>
                    {t.text}
                  </div>
                </div>
              ))}
              {laedt && <div className="text-xs text-ink-muted">🧠 denkt …</div>}
            </div>
          )}

          {fehler && <p className="text-xs text-danger mb-2">{fehler}</p>}

          <form
            onSubmit={e => { e.preventDefault(); void fragen(frage) }}
            className="flex gap-2"
          >
            <input
              value={frage}
              onChange={e => setFrage(e.target.value)}
              placeholder="Frag nach Aufträgen, Kosten, Objekten …"
              className="flex-1 text-sm border border-line rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-accent bg-white"
              maxLength={600}
            />
            <button
              type="submit"
              disabled={laedt || !frage.trim()}
              className="text-sm font-semibold bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Fragen
            </button>
          </form>
          <p className="text-[11px] text-ink-muted mt-2">
            Antwortet nur aus deinen Daten · führt nichts aus · max. 10 Fragen/Tag
          </p>
        </div>
      )}
    </section>
  )
}
