"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/components/Toast"
import { SlidersHorizontal, Zap, Wallet, Clock, Star } from "lucide-react"

// Sprint BD — Verwalter-Präferenzen ("Leitplanken" für die KI-Vergabe).
// Einmal einstellen, danach arbeitet die KI innerhalb dieser Grenzen, und
// der Verwalter bleibt passiv.

interface PrefState {
  autoVergabeAktiv: boolean
  budgetEur: string // als String im Input, leer = kein Limit
  freigabeStunden: string // leer = nur manuell
}

export default function VerwalterEinstellungenPage() {
  const router = useRouter()
  const { show } = useToast()
  const [pref, setPref] = useState<PrefState>({ autoVergabeAktiv: true, budgetEur: "", freigabeStunden: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data, error: e } = await supabase
        .from("profiles")
        .select("auto_vergabe_aktiv, auto_vergabe_budget_eur, auto_freigabe_stunden")
        .eq("id", user.id)
        .single()
      if (!e && data) {
        const d = data as {
          auto_vergabe_aktiv?: boolean | null
          auto_vergabe_budget_eur?: number | null
          auto_freigabe_stunden?: number | null
        }
        setPref({
          autoVergabeAktiv: d.auto_vergabe_aktiv ?? true,
          budgetEur: d.auto_vergabe_budget_eur != null ? String(d.auto_vergabe_budget_eur) : "",
          freigabeStunden: d.auto_freigabe_stunden != null ? String(d.auto_freigabe_stunden) : "",
        })
      }
      setLoading(false)
    }
    void load()
  }, [router])

  async function save() {
    setSaving(true)
    setError("")
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const budget = pref.budgetEur.trim() === "" ? null : Number(pref.budgetEur)
      const stunden = pref.freigabeStunden.trim() === "" ? null : Number(pref.freigabeStunden)
      if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
        setError("Budget muss eine positive Zahl sein."); setSaving(false); return
      }
      if (stunden != null && (!Number.isInteger(stunden) || stunden < 0)) {
        setError("Freigabe-Frist muss eine ganze Stundenzahl sein."); setSaving(false); return
      }

      const { error: e } = await supabase
        .from("profiles")
        .update({
          auto_vergabe_aktiv: pref.autoVergabeAktiv,
          auto_vergabe_budget_eur: budget,
          auto_freigabe_stunden: stunden,
        })
        .eq("id", user.id)
      if (e) { setError("Konnte nicht speichern: " + e.message); setSaving(false); return }
      show("Einstellungen gespeichert.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-white border-b border-line">
        <div className="max-w-3xl mx-auto pl-14 pr-4 md:px-6 py-4">
          <h1 className="text-lg font-semibold text-ink flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-accent" /> KI-Vergabe
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Leg fest, wie eigenständig die KI Aufträge vergibt. Du stellst die Leitplanken
            einmal ein — danach läuft die Vergabe automatisch innerhalb deiner Grenzen.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
        {loading ? (
          <div className="text-center text-sm text-ink-muted py-16">Lädt …</div>
        ) : (
          <>
            {/* Master-Schalter */}
            <section className="bg-white border border-line rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Zap size={18} className="text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-ink">Automatische Vergabe</div>
                    <p className="text-xs text-ink-muted mt-1 max-w-md">
                      Wenn aktiv, sucht und beauftragt die KI den passendsten Handwerker selbst,
                      sobald ein Ticket entsteht. Ist sie aus, vergibst du jedes Ticket manuell.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pref.autoVergabeAktiv}
                  onClick={() => setPref(p => ({ ...p, autoVergabeAktiv: !p.autoVergabeAktiv }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                    pref.autoVergabeAktiv ? "bg-accent" : "bg-line"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      pref.autoVergabeAktiv ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </section>

            {/* Vertrauens-HW Hinweis (existiert bereits über Stamm-HW) */}
            <section className="bg-white border border-line rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Star size={18} className="text-warm flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-ink">Vertrauens-Handwerker</div>
                  <p className="text-xs text-ink-muted mt-1 max-w-md">
                    Deine Stamm-Handwerker werden bei jeder Vergabe automatisch zuerst angefragt.
                    Pflege sie unter{" "}
                    <a href="/dashboard-verwalter/stamm-handwerker" className="text-accent hover:underline">
                      Stamm-HW verwalten
                    </a>.
                  </p>
                </div>
              </div>
            </section>

            {/* Budget-Grenze */}
            <section className={`bg-white border border-line rounded-2xl p-5 transition-opacity ${pref.autoVergabeAktiv ? "" : "opacity-50 pointer-events-none"}`}>
              <div className="flex items-start gap-3">
                <Wallet size={18} className="text-accent flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">Budget-Grenze für Auto-Vergabe</div>
                  <p className="text-xs text-ink-muted mt-1 max-w-md">
                    Liegt der geschätzte Auftragswert über dieser Grenze, vergibt die KI <strong>nicht</strong>
                    {" "}automatisch — das Ticket bleibt für dich liegen. Leer = kein Limit.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={pref.budgetEur}
                      onChange={e => setPref(p => ({ ...p, budgetEur: e.target.value }))}
                      placeholder="z. B. 800"
                      className="w-32 text-sm bg-surface border border-line rounded-lg px-3 py-2 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
                    />
                    <span className="text-sm text-ink-muted">€</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Auto-Freigabe */}
            <section className={`bg-white border border-line rounded-2xl p-5 transition-opacity ${pref.autoVergabeAktiv ? "" : "opacity-50 pointer-events-none"}`}>
              <div className="flex items-start gap-3">
                <Clock size={18} className="text-accent flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">Mieter-Meldungen automatisch freigeben</div>
                  <p className="text-xs text-ink-muted mt-1 max-w-md">
                    Mieter-Meldungen (außer Notfälle) warten standardmäßig auf deine Freigabe.
                    Mit einer Frist gibt die KI sie nach Ablauf automatisch frei und startet die
                    Vergabe. Leer = nur manuelle Freigabe.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-ink-muted">nach</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={pref.freigabeStunden}
                      onChange={e => setPref(p => ({ ...p, freigabeStunden: e.target.value }))}
                      placeholder="z. B. 4"
                      className="w-24 text-sm bg-surface border border-line rounded-lg px-3 py-2 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
                    />
                    <span className="text-sm text-ink-muted">Stunden</span>
                  </div>
                </div>
              </div>
            </section>

            {error && (
              <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="text-sm font-semibold bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {saving ? "Speichert …" : "Speichern"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
