"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile } from "@/types"

/* -- KI Match-Score -- */
function kiMatchScore(ticket: any, profil: UserProfile | null): number {
  if (!profil) return 50
  let score = 50
  const titelLower = (ticket.titel || "").toLowerCase()
  const gewerkLower = (profil.gewerk || "").toLowerCase()
  if (gewerkLower && titelLower.includes(gewerkLower.split(",")[0].trim().split(" ")[0])) score += 30
  if (ticket.prioritaet === "dringend" || ticket.prioritaet === "hoch") score += 10
  if ((ticket.angebote as any[])?.length < 3) score += 10
  return Math.min(score, 99)
}

function kiMatchLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Top-Match", color: "#00D4AA" }
  if (score >= 60) return { text: "Guter Match", color: "#F59E0B" }
  return { text: "Passend", color: "#64748B" }
}

function kiGewinnchance(ticket: any): string {
  const anz = (ticket.angebote as any[])?.length || 0
  if (anz === 0) return "Sehr hoch - Erstes Angebot!"
  if (anz < 3) return "Hoch - Wenig Konkurrenz"
  if (anz < 5) return "Mittel"
  return "Niedrig - Viele Angebote"
}

function kiPreisempfehlung(ticket: any): string {
  const t = (ticket.titel || "").toLowerCase()
  if (t.includes("heizung") || t.includes("therme")) return "800 - 2.500"
  if (t.includes("wasser") || t.includes("rohr") || t.includes("leck")) return "300 - 1.200"
  if (t.includes("elektr") || t.includes("strom") || t.includes("steckdose")) return "150 - 600"
  if (t.includes("tuer") || t.includes("schloss") || t.includes("fenster")) return "200 - 800"
  if (t.includes("schimmel") || t.includes("feucht")) return "500 - 2.000"
  return "250 - 1.000"
}

/* -- Timer -- */
function Timer({ end }: { end: string }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000))
    setSecs(calc())
    const id = setInterval(() => setSecs(calc()), 1000)
    return () => clearInterval(id)
  }, [end])
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  const fmt = (n: number) => String(n).padStart(2, "0")
  if (secs === 0) return <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Abgelaufen</span>
  return (
    <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full font-mono">
      {fmt(h)}:{fmt(m)}:{fmt(s)}
    </span>
  )
}

/* -- Priority Bar -- */
function PrioBar({ prio }: { prio: string }) {
  const c = prio === "dringend" ? "#EF4444" : prio === "hoch" ? "#F59E0B" : "#00D4AA"
  return <div className="w-1 h-full rounded-full absolute left-0 top-0" style={{ backgroundColor: c }} />
}

export default function HandwerkerDashboard() {
  const router = useRouter()
  const [auktionen, setAuktionen] = useState<Ticket[]>([])
  const [meineAuftraege, setMeineAuftraege] = useState<Ticket[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"auktionen" | "auftraege">("auktionen")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const [{ data: prof }, { data: offene }, { data: meine }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("tickets").select("*, angebote(*)").eq("status", "auktion")
          .gt("auktion_ende", new Date().toISOString()).order("auktion_ende"),
        supabase.from("tickets").select("*").eq("zugewiesener_hw", user.id).order("created_at", { ascending: false }),
      ])
      setProfile(prof)
      setAuktionen(offene || [])
      setMeineAuftraege(meine || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
        <span className="text-sm text-white/40">Smart-Match wird geladen...</span>
      </div>
    </div>
  )

  const sortedAuktionen = [...auktionen].sort((a, b) => kiMatchScore(b, profile) - kiMatchScore(a, profile))

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto p-6">

        {/* Header + Profile Summary */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">
              {profile?.firma || profile?.name || "Handwerker"}
            </h1>
            <p className="text-white/40 text-sm mt-1">
              {profile?.gewerk || "Gewerk nicht hinterlegt"}
              {profile?.bewertung_avg ? (" | " + profile.bewertung_avg + "/5 Sterne") : ""}
            </p>
          </div>
          <button onClick={() => router.push("/dashboard-handwerker/profil")}
            className="text-xs text-[#00D4AA] border border-[#00D4AA]/20 px-3 py-1.5 rounded-lg hover:bg-[#00D4AA]/10 transition-colors">
            Profil bearbeiten
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: "Match-Score", value: profile?.bewertung_avg ? Math.round(Number(profile.bewertung_avg) * 18) + "%" : "72%", color: "#00D4AA" },
            { label: "Offene Auktionen", value: String(auktionen.length), color: "#00B4D8" },
            { label: "Aktive Auftraege", value: String(meineAuftraege.filter(t => t.status !== "erledigt").length), color: "#F59E0B" },
            { label: "Abgeschlossen", value: String(meineAuftraege.filter(t => t.status === "erledigt").length), color: "#8B5CF6" },
          ].map((kpi, i) => (
            <div key={i} className="bg-[#12121a] border border-white/5 rounded-xl p-4">
              <div className="text-xs text-white/40 mb-1">{kpi.label}</div>
              <div className="text-2xl font-semibold" style={{ color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* KI Smart-Match Banner */}
        {auktionen.length > 0 && (
          <div className="bg-gradient-to-r from-[#00D4AA]/10 to-[#00B4D8]/10 border border-[#00D4AA]/20 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00D4AA]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">*</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-[#00D4AA]">KI Smart-Match aktiv</div>
              <div className="text-xs text-white/50 mt-0.5">
                {sortedAuktionen.filter(t => kiMatchScore(t, profile) >= 70).length} Ausschreibungen passen besonders gut zu deinem Profil.
                Sortiert nach Match-Score fuer maximale Gewinnchance.
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-[#12121a] rounded-xl p-1 border border-white/5">
          {[
            { key: "auktionen" as const, label: "Ausschreibungen", count: auktionen.length },
            { key: "auftraege" as const, label: "Meine Auftraege", count: meineAuftraege.length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={"flex-1 py-2.5 rounded-lg text-sm font-medium transition-all " +
                (tab === t.key
                  ? "bg-[#00D4AA]/15 text-[#00D4AA]"
                  : "text-white/40 hover:text-white/60")}>
              {t.label}
              <span className={"ml-2 text-xs px-1.5 py-0.5 rounded-full " +
                (tab === t.key ? "bg-[#00D4AA]/20" : "bg-white/5")}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* AUKTIONEN TAB */}
        {tab === "auktionen" && (
          <>
            {sortedAuktionen.length === 0 ? (
              <div className="bg-[#12121a] border border-white/5 rounded-xl p-12 text-center">
                <div className="text-3xl mb-3 opacity-50">[~]</div>
                <div className="text-white/50 text-sm">Aktuell keine offenen Ausschreibungen</div>
                <div className="text-white/30 text-xs mt-1">Neue Auftraege erscheinen hier automatisch</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sortedAuktionen.map((t, idx) => {
                  const score = kiMatchScore(t, profile)
                  const match = kiMatchLabel(score)
                  const angeboteCount = (t.angebote as any[])?.length || 0

                  return (
                    <div key={t.id}
                      onClick={() => router.push("/ticket/" + t.id)}
                      className="bg-[#12121a] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-[#00D4AA]/30 transition-all relative overflow-hidden group">

                      <PrioBar prio={t.prioritaet || "normal"} />

                      <div className="pl-4">
                        {/* Top row: Match badge + Timer */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {idx === 0 && score >= 70 && (
                              <span className="text-[10px] bg-[#00D4AA] text-black font-bold px-2 py-0.5 rounded-full">
                                #1 MATCH
                              </span>
                            )}
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: match.color + "15", color: match.color }}>
                              {score}% {match.text}
                            </span>
                            <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                              {angeboteCount} Angebot{angeboteCount !== 1 ? "e" : ""}
                            </span>
                          </div>
                          {t.auktion_ende && <Timer end={t.auktion_ende} />}
                        </div>

                        {/* Title + Location */}
                        <div className="text-sm font-medium mb-1 group-hover:text-[#00D4AA] transition-colors">
                          {t.titel}
                        </div>
                        <div className="text-xs text-white/30 mb-3">
                          {t.wohnung || "Keine Adresse"}
                          {t.raum ? (" | " + t.raum) : ""}
                        </div>

                        {/* KI Insights Row */}
                        <div className="flex flex-wrap gap-2">
                          <div className="text-[10px] bg-[#00D4AA]/10 text-[#00D4AA] px-2 py-1 rounded-lg">
                            Preisrahmen: {kiPreisempfehlung(t)} EUR
                          </div>
                          <div className="text-[10px] bg-[#00B4D8]/10 text-[#00B4D8] px-2 py-1 rounded-lg">
                            Chance: {kiGewinnchance(t)}
                          </div>
                          {t.prioritaet === "dringend" && (
                            <div className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded-lg">
                              Eilauftrag - Schnelle Reaktion erwartet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* AUFTRAEGE TAB */}
        {tab === "auftraege" && (
          <>
            {meineAuftraege.length === 0 ? (
              <div className="bg-[#12121a] border border-white/5 rounded-xl p-12 text-center">
                <div className="text-3xl mb-3 opacity-50">[!]</div>
                <div className="text-white/50 text-sm">Noch keine Auftraege erhalten</div>
                <div className="text-white/30 text-xs mt-1">Biete auf Ausschreibungen um Auftraege zu erhalten</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Active */}
                {meineAuftraege.filter(t => t.status !== "erledigt").length > 0 && (
                  <>
                    <div className="text-xs text-white/30 uppercase tracking-wider mb-1">Aktiv</div>
                    {meineAuftraege.filter(t => t.status !== "erledigt").map(t => {
                      const steps = ["vergeben", "in_arbeit", "erledigt"]
                      const currentStep = steps.indexOf(t.status) >= 0 ? steps.indexOf(t.status) : 0

                      return (
                        <div key={t.id}
                          onClick={() => router.push("/ticket/" + t.id)}
                          className="bg-[#12121a] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-[#00D4AA]/30 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">{t.titel}</div>
                            <span className={"text-[10px] px-2 py-0.5 rounded-full font-medium " +
                              (t.status === "in_arbeit"
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-[#00D4AA]/15 text-[#00D4AA]")}>
                              {t.status === "in_arbeit" ? "In Arbeit" : t.status === "vergeben" ? "Vergeben" : t.status}
                            </span>
                          </div>
                          <div className="text-xs text-white/30 mb-3">
                            {t.wohnung || ""} | Erstellt: {new Date(t.created_at).toLocaleDateString("de")}
                          </div>
                          {/* Mini Progress */}
                          <div className="flex gap-1">
                            {steps.map((s, i) => (
                              <div key={s} className={"h-1 flex-1 rounded-full " +
                                (i <= currentStep ? "bg-[#00D4AA]" : "bg-white/10")} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Completed */}
                {meineAuftraege.filter(t => t.status === "erledigt").length > 0 && (
                  <>
                    <div className="text-xs text-white/30 uppercase tracking-wider mt-4 mb-1">Abgeschlossen</div>
                    {meineAuftraege.filter(t => t.status === "erledigt").map(t => (
                      <div key={t.id}
                        onClick={() => router.push("/ticket/" + t.id)}
                        className="bg-[#12121a] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-white/10 transition-all opacity-60">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">{t.titel}</div>
                          <span className="text-[10px] bg-[#8B5CF6]/15 text-[#8B5CF6] px-2 py-0.5 rounded-full">
                            Erledigt
                          </span>
                        </div>
                        <div className="text-xs text-white/30 mt-1">
                          {t.wohnung || ""} | {new Date(t.created_at).toLocaleDateString("de")}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
