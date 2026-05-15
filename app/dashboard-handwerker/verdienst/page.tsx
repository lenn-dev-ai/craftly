"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, Input, Select } from "@/components/ui"
import { GEWERK_LABELS } from "@/types"
import { Calculator } from "lucide-react"

// BIZ-2 Sprint 4: Statischer Verdienst-Rechner für Handwerker.
// Formel: (stundensatz × stunden_pro_woche × 4) × (1 - provisionRate)
// Provisions-Rate wird aktuell auf 5 % festgesetzt (siehe AGB) — Surge-
// Aufschläge bleiben außen vor (Mittelwert über alle Aufträge ist eh 5%).
// Early-Adopter-Bonus wird angezeigt, wenn aktiv.

const PROVISION_RATE_STANDARD = 0.05

export default function VerdienstPage() {
  const [stundensatz, setStundensatz] = useState(75)
  const [stundenProWoche, setStundenProWoche] = useState(20)
  const [gewerk, setGewerk] = useState("sanitaer")
  const [istEarlyAdopter, setIstEarlyAdopter] = useState(false)

  // Echten basis_stundensatz + early_adopter_bis aus Profil laden
  useEffect(() => {
    let aktiv = true
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !aktiv) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("basis_stundensatz, gewerk, early_adopter_bis")
        .eq("id", user.id)
        .single<{ basis_stundensatz: number | null; gewerk: string | null; early_adopter_bis: string | null }>()
      if (!aktiv || !profile) return
      if (profile.basis_stundensatz) setStundensatz(profile.basis_stundensatz)
      if (profile.gewerk) setGewerk(profile.gewerk)
      if (profile.early_adopter_bis && new Date(profile.early_adopter_bis).getTime() > Date.now()) {
        setIstEarlyAdopter(true)
      }
    })()
    return () => { aktiv = false }
  }, [])

  const provisionRate = istEarlyAdopter ? 0 : PROVISION_RATE_STANDARD
  const bruttoMonat = stundensatz * stundenProWoche * 4
  const provisionMonat = bruttoMonat * provisionRate
  const nettoMonat = bruttoMonat - provisionMonat
  const nettoJahr = nettoMonat * 12

  const fmt = (n: number) => Math.round(n).toLocaleString("de-DE")

  return (
    <div className="p-6 max-w-3xl mx-auto pt-16 md:pt-8 space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Calculator size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Was kannst du verdienen?</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Schnellkalkulation auf Basis deines Stundensatzes und deiner verfügbaren Zeit.
            </p>
          </div>
        </div>
      </header>

      <Card className="bg-white border border-line">
        <div className="space-y-4">
          <Select label="Gewerk" value={gewerk} onChange={e => setGewerk(e.target.value)}>
            {Object.entries(GEWERK_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Dein Stundensatz (EUR netto)"
                type="number"
                min={1}
                step={1}
                value={stundensatz}
                onChange={e => setStundensatz(Number(e.target.value) || 0)}
              />
              <p className="text-[11px] text-ink-faint mt-1.5">Brutto vor Reparo-Gebühr</p>
            </div>
            <div>
              <Input
                label="Stunden pro Woche"
                type="number"
                min={1}
                max={60}
                step={1}
                value={stundenProWoche}
                onChange={e => setStundenProWoche(Number(e.target.value) || 0)}
              />
              <p className="text-[11px] text-ink-faint mt-1.5">realistisch verfügbar für Reparo</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-white border border-line">
        <div className="space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted font-bold mb-1">Brutto pro Monat</div>
            <div className="text-2xl font-bold text-ink tabular-nums">{fmt(bruttoMonat)} €</div>
            <div className="text-[11px] text-ink-muted mt-0.5">{stundenProWoche} h × 4 Wochen × {stundensatz} €/h</div>
          </div>

          <div className="border-t border-line pt-4">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">
                Reparo-Gebühr ({Math.round(provisionRate * 100)} %)
              </div>
              {istEarlyAdopter && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-warm-dark bg-warm-light border border-warm/30 px-2 py-0.5 rounded">
                  Early-Adopter
                </span>
              )}
            </div>
            <div className="text-lg text-ink-secondary tabular-nums">
              − {fmt(provisionMonat)} €
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <div className="text-[10px] uppercase tracking-wider text-accent font-bold mb-1">
              Dein Auszahlung pro Monat
            </div>
            <div className="text-3xl font-bold text-accent tabular-nums">{fmt(nettoMonat)} €</div>
            <div className="text-xs text-ink-muted mt-1">≈ {fmt(nettoJahr)} € pro Jahr</div>
          </div>
        </div>
      </Card>

      <div className="bg-warm-light border border-warm/30 rounded-xl p-4">
        <div className="text-xs text-warm-dark leading-relaxed">
          <strong>Hinweis:</strong> Diese Schätzung ist eine grobe Hochrechnung.
          Der tatsächliche Monatsverdienst hängt von deiner Auslastung, der
          Vergabequote und den Surge-Aufschlägen (zeitnah/notfall) ab.
          Steuern und Versicherung sind nicht berücksichtigt.
        </div>
      </div>
    </div>
  )
}
