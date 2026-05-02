"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile } from "@/types"
import { Card, LoadingSpinner } from "@/components/ui"
import { berechneProvision, summiereProvision, formatiereGeld } from "@/lib/provision"

export default function ReportingPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const [{ data: prof }, { data: ts }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("tickets").select("*, angebote(*)").eq("erstellt_von", user.id),
      ])
      setProfile(prof)
      setTickets(ts || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingSpinner />

  const erledigt = tickets.filter(t => t.status === "erledigt")

  // Provisions-Aggregat insgesamt
  const provGesamt = summiereProvision(tickets, profile?.created_at)

  // Diesen Monat
  const heute = new Date()
  const monatsstart = new Date(heute.getFullYear(), heute.getMonth(), 1)
  const dieserMonat = erledigt.filter(t => new Date(t.created_at) >= monatsstart)
  const provMonat = summiereProvision(dieserMonat, profile?.created_at)

  // Ersparnis durch Auktion (vs. teuerstes Angebot)
  const mitAngeboten = tickets.filter(t => t.angebote && t.angebote.length > 1)
  const ersparnis = mitAngeboten.reduce((s, t) => {
    const preise = (t.angebote || []).map(a => a.preis)
    return s + (Math.max(...preise) - Math.min(...preise))
  }, 0)

  const earlyAdopterInfo = profile ? berechneProvision(0, profile.created_at) : null
  const istEarlyAdopter = earlyAdopterInfo?.earlyAdopter ?? false
  const tageVerbleibend = earlyAdopterInfo?.earlyAdopterTageVerbleibend ?? 0

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D2A26]">Reporting</h1>
        <p className="text-sm text-[#8C857B] mt-1">Kosten- und Provisions-Übersicht</p>
      </div>

      {/* Early-Adopter-Banner */}
      {istEarlyAdopter && (
        <div className="mb-6 p-4 rounded-2xl bg-[#FAF1DE] border-2 border-[#C4956A]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C4956A]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🎁</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#854F0B]">
                Early-Adopter-Bonus aktiv: 0 % Provision
              </div>
              <div className="text-xs text-[#854F0B]/80 mt-0.5">
                Du sparst die 5 % Plattform-Provision für noch <strong>{tageVerbleibend} {tageVerbleibend === 1 ? "Tag" : "Tage"}</strong>.
                Danach werden 5 % vom Auftragswert fällig — Handwerker bekommt weiterhin den vollen Satz.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Tickets gesamt" value={tickets.length.toString()} />
        <Kpi label="Erledigt" value={erledigt.length.toString()} />
        <Kpi
          label="Auftragswerte"
          value={formatiereGeld(provGesamt.auftragswertGesamt)}
          sub="kumuliert"
        />
        <Kpi
          label="Provision diesen Monat"
          value={formatiereGeld(provMonat.provisionGesamt)}
          sub={istEarlyAdopter ? "0 % aktiv" : "5 % vom Auftragswert"}
          accent={istEarlyAdopter ? "warm" : "primary"}
        />
      </div>

      {/* Auktions-Ersparnis */}
      {ersparnis > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-[#3D8B7A]/5 border border-[#3D8B7A]/20">
          <div className="text-xs text-[#8C857B] uppercase tracking-wide font-medium mb-1">Auktions-Ersparnis</div>
          <div className="text-2xl font-bold text-[#3D8B7A] tabular-nums">{formatiereGeld(ersparnis)}</div>
          <div className="text-xs text-[#6B665E] mt-1">
            Differenz zwischen höchstem und gewähltem Angebot über alle Auktionen
          </div>
        </div>
      )}

      {/* Status-Verteilung */}
      <Card className="mb-4">
        <h2 className="text-sm font-medium mb-4 text-[#2D2A26]">Tickets nach Status</h2>
        {[
          { label: "Offen", count: tickets.filter(t => t.status === "offen").length, color: "#C4574B" },
          { label: "Auktion", count: tickets.filter(t => t.status === "auktion").length, color: "#5B6ABF" },
          { label: "In Bearbeitung", count: tickets.filter(t => t.status === "in_bearbeitung" || t.status === "in_arbeit").length, color: "#C4956A" },
          { label: "Erledigt", count: erledigt.length, color: "#3D8B7A" },
        ].map(({ label, count, color }) => (
          <div key={label} className="mb-3 last:mb-0">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-[#6B665E]">{label}</span>
              <span className="font-medium tabular-nums text-[#2D2A26]">{count}</span>
            </div>
            <div className="h-1.5 bg-[#FAF8F5] rounded-full overflow-hidden">
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
            <h2 className="text-sm font-medium text-[#2D2A26]">Abgeschlossene Aufträge</h2>
            <span className="text-xs text-[#8C857B]">
              Auftragswert · Provision · Gesamt
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {erledigt.slice(0, 20).map(t => {
              if (!t.kosten_final) {
                return (
                  <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-[#EDE8E1] last:border-0">
                    <div>
                      <div className="font-medium text-[#2D2A26]">{t.titel}</div>
                      <div className="text-xs text-[#8C857B]">{new Date(t.created_at).toLocaleDateString("de")}</div>
                    </div>
                    <span className="text-[#8C857B] text-xs">Kosten nicht erfasst</span>
                  </div>
                )
              }
              const p = berechneProvision(t.kosten_final, profile?.created_at)
              return (
                <div key={t.id} className="text-sm py-2 border-b border-[#EDE8E1] last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[#2D2A26] truncate">{t.titel}</div>
                      <div className="text-xs text-[#8C857B]">{new Date(t.created_at).toLocaleDateString("de")}</div>
                    </div>
                    <div className="text-right tabular-nums flex-shrink-0">
                      <div className="text-xs text-[#8C857B]">
                        {formatiereGeld(t.kosten_final)} + {formatiereGeld(p.betrag)}
                      </div>
                      <div className="text-sm font-semibold text-[#3D8B7A]">
                        = {formatiereGeld(p.netto)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {erledigt.length > 20 && (
            <p className="text-xs text-[#8C857B] mt-3 text-center">+ {erledigt.length - 20} weitere</p>
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
  const farbe = accent === "primary" ? "text-[#3D8B7A]" : accent === "warm" ? "text-[#C4956A]" : "text-[#2D2A26]"
  return (
    <div className="bg-white rounded-2xl border border-[#EDE8E1] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[#8C857B] font-medium mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${farbe}`}>{value}</div>
      {sub && <div className="text-xs text-[#B5AEA4] mt-1">{sub}</div>}
    </div>
  )
}
