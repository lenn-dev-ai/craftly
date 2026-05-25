"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile } from "@/types"
import { Card, LoadingSpinner } from "@/components/ui"
import {
  calculateCommission,
  isEarlyAdopter,
  formatEUR,
} from "@/lib/pricing/commission"

type ProvisionRow = {
  ticket_id: string
  auftragswert: number
  provision_rate: number
  provision_betrag: number
  gesamt: number
  is_early_adopter: boolean
  created_at: string
}

// Audit-H4: Zeitraum-Filter für Reporting. Standard "Dieser Monat" wie
// bisher, plus Quartal, Jahr und gesamt.
type Zeitraum = "monat" | "quartal" | "jahr" | "alles"

const ZEITRAEUME: Array<{ key: Zeitraum; label: string }> = [
  { key: "monat", label: "Dieser Monat" },
  { key: "quartal", label: "Dieses Quartal" },
  { key: "jahr", label: "Dieses Jahr" },
  { key: "alles", label: "Gesamt" },
]

function zeitraumStart(z: Zeitraum): Date | null {
  const now = new Date()
  if (z === "monat") return new Date(now.getFullYear(), now.getMonth(), 1)
  if (z === "quartal") {
    const qStart = Math.floor(now.getMonth() / 3) * 3
    return new Date(now.getFullYear(), qStart, 1)
  }
  if (z === "jahr") return new Date(now.getFullYear(), 0, 1)
  return null // alles
}

export default function ReportingPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [provisionen, setProvisionen] = useState<ProvisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [zeitraum, setZeitraum] = useState<Zeitraum>("monat")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const [{ data: prof }, { data: ts }, { data: provs }] = await Promise.all([
        supabase.from("profiles").select("id, email, name, rolle, early_adopter_bis, created_at").eq("id", user.id).single(),
        supabase.from("tickets").select("*, angebote(*)").eq("verwalter_id", user.id),
        supabase.from("provisionen").select("*").eq("verwalter_id", user.id),
      ])
      setProfile(prof)
      setTickets(ts || [])
      setProvisionen(provs || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingSpinner />

  // Audit-H4: Zeitraum-Filter auf tickets + provisionen anwenden
  const startZeit = zeitraumStart(zeitraum)
  const ticketsImZeitraum = startZeit
    ? tickets.filter(t => new Date(t.created_at) >= startZeit)
    : tickets
  const provisionenImZeitraum = startZeit
    ? provisionen.filter(p => new Date(p.created_at) >= startZeit)
    : provisionen
  const erledigt = ticketsImZeitraum.filter(t => t.status === "erledigt")

  // Aggregat aus DB-Snapshots — autoritative Quelle
  const auftragswertImZeitraum = provisionenImZeitraum.reduce((s, p) => s + Number(p.auftragswert || 0), 0)
  const provisionImZeitraum = provisionenImZeitraum.reduce((s, p) => s + Number(p.provision_betrag || 0), 0)
  const zeitraumLabel = ZEITRAEUME.find(z => z.key === zeitraum)?.label ?? "Gesamt"

  // Ersparnis durch Auktion (vs. teuerstes Angebot)
  const mitAngeboten = ticketsImZeitraum.filter(t => t.angebote && t.angebote.length > 1)
  const ersparnis = mitAngeboten.reduce((s, t) => {
    const preise = (t.angebote || []).map(a => a.preis)
    return s + (Math.max(...preise) - Math.min(...preise))
  }, 0)

  const istEarlyAdopter = isEarlyAdopter(profile)
  const tageVerbleibend = profile?.early_adopter_bis
    ? Math.max(0, Math.ceil((new Date(profile.early_adopter_bis).getTime() - Date.now()) / 86_400_000))
    : 0

  // Empty-State: ohne Tickets keine sinnvolle Auswertung (F-2)
  if (tickets.length === 0) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Reporting</h1>
          <p className="text-sm text-ink-muted mt-1">Kosten- und Provisions-Übersicht</p>
        </div>
        <div className="bg-white border border-line rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4" aria-hidden="true">📊</div>
          <h2 className="text-lg font-semibold text-ink mb-2">Noch keine Auswertung möglich</h2>
          <p className="text-sm text-ink-secondary max-w-sm mx-auto mb-5">
            Sobald die ersten Aufträge erledigt sind, siehst du hier Kosten pro
            Gewerk, Provisions-Aufschlüsselung und Trends.
          </p>
          <a
            href="/dashboard-verwalter/marktplatz"
            className="inline-block text-sm font-semibold bg-accent text-white px-4 py-2 rounded-xl hover:bg-accent-hover transition-colors"
          >
            Zum Handwerker-Marktplatz →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Reporting</h1>
          <p className="text-sm text-ink-muted mt-1">Kosten- und Provisions-Übersicht · {zeitraumLabel}</p>
        </div>
        {/* Audit-H4: Zeitraum-Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="reporting-zeitraum" className="text-xs text-ink-muted">Zeitraum:</label>
          <select
            id="reporting-zeitraum"
            value={zeitraum}
            onChange={e => setZeitraum(e.target.value as Zeitraum)}
            className="text-xs bg-white border border-line rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent/40"
          >
            {ZEITRAEUME.map(z => (
              <option key={z.key} value={z.key}>{z.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Early-Adopter-Banner */}
      {istEarlyAdopter && (
        <div className="mb-6 p-4 rounded-2xl bg-warm-light border-2 border-warm/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warm/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🎁</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-warm-dark">
                Early-Adopter-Bonus aktiv: 0 % Provision
              </div>
              <div className="text-xs text-warm-dark/80 mt-0.5">
                Du sparst die 5 % Plattform-Provision für noch <strong>{tageVerbleibend} {tageVerbleibend === 1 ? "Tag" : "Tage"}</strong>.
                Danach werden 5 % vom Auftragswert fällig — Handwerker bekommt weiterhin den vollen Satz.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI-Grid — alle Werte im gewählten Zeitraum (H4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label={`Tickets · ${zeitraumLabel}`} value={ticketsImZeitraum.length.toString()} />
        <Kpi label="davon erledigt" value={erledigt.length.toString()} />
        <Kpi
          label="Auftragswerte"
          value={formatEUR(auftragswertImZeitraum)}
          sub="kumuliert"
        />
        <Kpi
          label="Provision"
          value={formatEUR(provisionImZeitraum)}
          sub={istEarlyAdopter ? "0 % aktiv" : "5 % vom Auftragswert"}
          accent={istEarlyAdopter ? "warm" : "primary"}
        />
      </div>

      {/* Auktions-Ersparnis */}
      {ersparnis > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-accent/5 border border-accent/20">
          <div className="text-xs text-ink-muted uppercase tracking-wide font-medium mb-1">Auktions-Ersparnis</div>
          <div className="text-2xl font-bold text-accent tabular-nums">{formatEUR(ersparnis)}</div>
          <div className="text-xs text-ink-secondary mt-1">
            Differenz zwischen höchstem und gewähltem Angebot über alle Auktionen
          </div>
        </div>
      )}

      {/* Status-Verteilung */}
      <Card className="mb-4">
        <h2 className="text-sm font-medium mb-4 text-ink">Tickets nach Status</h2>
        {[
          { label: "Offen", count: tickets.filter(t => t.status === "offen").length, color: "#C4574B" },
          { label: "Auktion", count: tickets.filter(t => t.status === "auktion").length, color: "#5B6ABF" },
          { label: "In Bearbeitung", count: tickets.filter(t => t.status === "in_bearbeitung").length, color: "#C4956A" },
          { label: "Erledigt", count: erledigt.length, color: "#3D8B7A" },
        ].map(({ label, count, color }) => (
          <div key={label} className="mb-3 last:mb-0">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-ink-secondary">{label}</span>
              <span className="font-medium tabular-nums text-ink">{count}</span>
            </div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: tickets.length ? `${(count / tickets.length) * 100}%` : "0%",
                background: color
              }} />
            </div>
          </div>
        ))}
      </Card>

      {/* Abgeschlossene Aufträge mit Provisions-Aufschlüsselung */}
      {erledigt.length > 0 && (
        <Card className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-ink">Abgeschlossene Aufträge</h2>
            <span className="text-xs text-ink-muted">
              Auftragswert · Provision · Gesamt
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {erledigt.slice(0, 20).map(t => {
              // Bevorzugt DB-Snapshot, sonst on-the-fly
              const snap = provisionen.find(p => p.ticket_id === t.id)
              if (!t.kosten_final && !snap) {
                return (
                  <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-line last:border-0">
                    <div>
                      <div className="font-medium text-ink">{t.titel}</div>
                      <div className="text-xs text-ink-muted">{new Date(t.created_at).toLocaleDateString("de")}</div>
                    </div>
                    <span className="text-ink-muted text-xs">Kosten nicht erfasst</span>
                  </div>
                )
              }
              const auftragswert = snap?.auftragswert ?? t.kosten_final ?? 0
              const rate = snap?.provision_rate ?? (istEarlyAdopter ? 0 : 0.05)
              const calc = calculateCommission(auftragswert, rate)
              return (
                <div key={t.id} className="text-sm py-2 border-b border-line last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink truncate">{t.titel}</div>
                      <div className="text-xs text-ink-muted">{new Date(t.created_at).toLocaleDateString("de")}</div>
                    </div>
                    <div className="text-right tabular-nums flex-shrink-0">
                      <div className="text-xs text-ink-muted">
                        {formatEUR(auftragswert)} + {formatEUR(calc.provisionBetrag)}
                      </div>
                      <div className="text-sm font-semibold text-accent">
                        = {formatEUR(calc.gesamt)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {erledigt.length > 20 && (
            <p className="text-xs text-ink-muted mt-3 text-center">+ {erledigt.length - 20} weitere</p>
          )}
        </Card>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, accent }: {
  label: string; value: string; sub?: string
  accent?: "primary" | "warm"
}) {
  const farbe = accent === "primary" ? "text-accent" : accent === "warm" ? "text-warm" : "text-ink"
  return (
    <div className="bg-white rounded-2xl border border-line p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-medium mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${farbe}`}>{value}</div>
      {sub && <div className="text-xs text-ink-faint mt-1">{sub}</div>}
    </div>
  )
}
