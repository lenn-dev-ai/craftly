import { UserProfile } from "@/types"

// Sichtbarkeits-Stufe + 3-Komponenten-Score (B2-W3).
// Macht die V1-Recompute-Logik für den HW selbst nachvollziehbar:
// er sieht warum er gold/silber/bronze ist und was er verbessern kann.
// Sprint AC — Bronze/Silber/Gold → Partner-Stufen.
// 3-zu-1-Audit-Konsens: aktuelle Mechanik wirkt zu "Lieferdienst" /
// "Marktplatz" und sollte als "Partner-Status" geframed werden — die
// Mechanik bleibt.
//
// DB-Felder `sichtbarkeit_stufe` (gold/silber/bronze) und
// `verfuegbarkeit_score` bleiben unverändert — nur die UI-Anzeige
// labelt um. Smart-Score-Multiplier-Logik in scoring-pipeline.ts
// ist unangetastet.
//
// Audit-Fix (2026-06-15, Quick-Win): bisher nur auf dem Dashboard-Start
// sichtbar — jetzt als shared Component extrahiert, damit sie auch auf
// /dashboard-handwerker/einnahmen erscheint (P1-Empfehlung aus dem
// Audit-Report: Score konsistent auf allen HW-Seiten zeigen, stärkt die
// Gamification-Wirkung).
export const PARTNER_LABELS = {
  gold:   { titel: "Premium-Partner",  faktor: "×1.15" },
  silber: { titel: "Top-Partner",      faktor: "×1.10" },
  bronze: { titel: "Vertrauter Partner", faktor: "×1.05" },
} as const

export function SichtbarkeitsBadge({ profile }: { profile: UserProfile | null }) {
  if (!profile) return null
  const stufe = (profile.sichtbarkeit_stufe as "gold" | "silber" | "bronze" | null) ?? "bronze"
  const score = profile.verfuegbarkeit_score ?? 0
  const treue = profile.angebotstreue ?? 100
  const label = PARTNER_LABELS[stufe]

  const naechsteStufe = stufe === "bronze" ? { name: PARTNER_LABELS.silber.titel, schwelle: 50 }
                       : stufe === "silber" ? { name: PARTNER_LABELS.gold.titel, schwelle: 75 }
                       : null
  const fehlend = naechsteStufe ? Math.max(0, naechsteStufe.schwelle - Number(score)) : 0

  return (
    <div className="mb-6 rounded-2xl border border-accent/20 bg-accent/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-accent">
            Partner-Status
          </div>
          <div className="text-xl font-bold text-ink">{label.titel}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-ink">{Number(score).toFixed(0)}</div>
          <div className="text-[10px] text-ink-muted">/ 100</div>
        </div>
      </div>
      <div className="text-xs text-ink-secondary space-y-1 mb-2">
        <div>
          <span className="font-medium">Antwort-Rate: {Number(treue).toFixed(0)} %</span>
          <span title="Anteil deiner abgegebenen Angebote, die du auch tatsächlich ausführst — höher = besserer Bonus" className="ml-1 text-ink-muted">ⓘ</span>
        </div>
        <div className="text-ink-muted">
          Dein Sichtbarkeits-Bonus: {label.faktor} bei jeder Auftrags-Bewertung
        </div>
      </div>
      {naechsteStufe && fehlend > 0 && (
        <div className="text-xs text-accent font-medium">
          Noch {fehlend} Punkte bis {naechsteStufe.name} — auf Einladungen schnell antworten, Bewertungen sammeln
        </div>
      )}
      {!naechsteStufe && (
        <div className="text-xs text-accent font-medium">
          Höchste Partner-Stufe erreicht — weiter aktiv bleiben um sie zu halten
        </div>
      )}
    </div>
  )
}
