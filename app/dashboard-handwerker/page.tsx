"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile } from "@/types"

/* -- Helper: Parse price range to midpoint -- */
function parsePreisRange(range: string): number {
  const parts = range.split("-").map(p => {
    const cleaned = p.trim().replace(/[^\d]/g, "")
    return parseInt(cleaned, 10)
  })
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return Math.round((parts[0] + parts[1]) / 2)
  }
  return 0
}

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

  /* Calculate profit metrics */
  const totalEarningsPotential = sortedAuktionen.reduce((sum, t) => {
    const range = kiPreisempfehlung(t)
    return sum + parsePreisRange(range)
  }, 0)

  const completedCount = meineAuftraege.filter(t => t.status === "erledigt").length
  const winRate = meineAuftraege.length > 0 ? Math.round((completedCount / meineAuftraege.length) * 100) : 0

  const hasGewerkSet = profile?.gewerk && profile.gewerk.trim().length > 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto p-6">

        {/* PROFIT HERO SECTION */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {profile?.firma || profile?.name || "Willkommen"}
          </h1>
          <p className="text-white/60 text-base mb-4">
            Maximiere deinen Stundensatz durch smarte Auktionen
          </p>

          {!hasGewerkSet && (
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3 mb-4 flex items-start gap-3">
              <span className="text-lg text-[#F59E0B]">⚠</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#F59E0B]">Gewerk hinterlegen</div>
                <div className="text-xs text-white/50 mt-1">Mehr passende Aufträge → Bessere Chancen → Höhere Verdienste</div>
              </div>
              <button onClick={() => router.push("/dashboard-handwerker/profil")}
                className="text-xs text-[#F59E0B] border border-[#F59E0B]/20 px-2 py-1 rounded hover:bg-[#F59E0B]/10 transition-colors flex-shrink-0">
                Profil
              </button>
            </div>
          )}
        </div>

        {/* PROFIT-FOCUSED KPI CARDS */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-2">Potentieller Verdienst</div>
            <div className="text-3xl font-bold text-[#00D4AA] mb-1">
              {totalEarningsPotential > 0 ? "bis zu " : ""}EUR {totalEarningsPotential > 0 ? totalEarningsPotential.toLocaleString("de") : "—"}
            </div>
            <div className="text-[10px] text-white/30">
              {sortedAuktionen.length} offene {sortedAuktionen.length === 1 ? "Auktion" : "Auktionen"}
            </div>
          </div>
          <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-2">Offene Auktionen</div>
            <div className="text-3xl font-bold text-[#00B4D8]">{auktionen.length}</div>
            <button onClick={() => setTab("auktionen")}
              className="text-[10px] text-[#00B4D8] hover:text-[#00B4D8]/80 mt-1 transition-colors">
              jetzt bieten →
            </button>
          </div>
          <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-2">Gewinnrate</div>
            <div className="text-3xl font-bold text-[#F59E0B]">
              {meineAuftraege.length > 0 ? winRate + "%" : "—"}
            </div>
            <div className="text-[10px] text-white/30">
              {meineAuftraege.length === 0 ? "Noch keine Daten" : `${completedCount}/${meineAuftraege.length} Aufträge`}
            </div>
          </div>
          <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-2">Verdient</div>
            <div className="text-3xl font-bold text-[#8B5CF6]">
              {completedCount > 0 ? completedCount * 500 + " EUR" : "Starte jetzt"}
            </div>
            <div className="text-[10px] text-white/30">
              {completedCount} {completedCount === 1 ? "Auftrag" : "Aufträge"} erledigt
            </div>
          </div>
        </div>

        {auktionen.length > 0 && (
          <div className="bg-gradient-to-r from-[#F59E0B]/10 to-[#00D4AA]/10 border border-[#F59E0B]/20 rounded-xl p-4 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-sm font-semibold text-white mb-1">
                  Mehr Zeitfenster = Mehr Anfragen = Mehr Verdienst
                </div>
                <div className="text-xs text-white/60">
                  Handwerker mit Kalender erhalten 3x mehr Anfragen und damit 3x mehr Verdienstmöglichkeiten
                </div>
              </div>
              <button onClick={() => router.push("/dashboard-handwerker/kalender")}
                className="text-xs text-[#F59E0B] border border-[#F59E0B]/30 px-3 py-1.5 rounded-lg hover:bg-[#F59E0B]/10 transition-colors flex-shrink-0 whitespace-nowrap">
                Kalender einrichten →
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-1 mb-6 bg-[#12121a] rounded-xl p-1 border border-white/5">
          {[
            { key: "auktionen" as const, label: "Ausschreibungen", count: auktionen.length },
            { key: "auftraege" as const, label: "Meine Aufträge", count: meineAuftraege.length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={"flex-1 py-2.5 rounded-lg text-sm font-medium transition-all " + (tab === t.key ? "bg-[#00D4AA]/15 text-[#00D4AA]" : "text-white/40 hover:text-white/60")}>
              {t.label}
              <span className={"ml-2 text-xs px-1.5 py-0.5 rounded-full " + (tab === t.key ? "bg-[#00D4AA]/20" : "bg-white/5")}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {tab === "auktionen" && (
          <>
            {sortedAuktionen.length === 0 ? (
              <div className="bg-[#12121a] border border-white/5 rounded-xl p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl text-[#00B4D8]">[~]</span>
                </div>
                <div className="text-white/60 text-sm font-medium mb-1">Bald verdienen!</div>
                <div className="text-white/30 text-xs mb-6">Folgende Schritte helfen dir, schneller Aufträge zu erhalten:</div>
                <div className="max-w-xs mx-auto space-y-3 text-left">
                  {[
                    { step: "1", text: "Profil = Mehr Matches", sub: "Mehr Matches → Mehr Geld" },
                    { step: "2", text: "Kalender = Mehr Sichtbarkeit", sub: "Mehr Sichtbarkeit → Mehr Anfragen" },
                    { step: "3", text: "Benachrichtigungen = Nie verpassen", sub: "Schnelle Reaktion → Höhere Chancen" },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#00D4AA]/15 text-[#00D4AA] flex items-center justify-center text-xs font-bold flex-shrink-0">{s.step}</div>
                      <div>
                        <div className="text-xs text-white/60 font-medium">{s.text}</div>
                        <div className="text-[10px] text-white/30">{s.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push("/dashboard-handwerker/profil")}
                  className="mt-6 text-xs text-[#00D4AA] border border-[#00D4AA]/20 px-4 py-2 rounded-lg hover:bg-[#00D4AA]/10 transition-colors">
                  Profil vervollständigen
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sortedAuktionen.map((t, idx) => {
                  const score = kiMatchScore(t, profile)
                  const match = kiMatchLabel(score)
                  const angeboteCount = (t.angebote as any[])?.length || 0
                  const preis = kiPreisempfehlung(t)
                  const preisNum = parsePreisRange(preis)
                  return (
                    <div key={t.id}
                      className="bg-[#12121a] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-[#00D4AA]/30 transition-all relative overflow-hidden group">
                      <PrioBar prio={t.prioritaet || "normal"} />
                      <div className="pl-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium mb-2 group-hover:text-[#00D4AA] transition-colors max-w-lg">
                              {t.titel}
                            </div>
                            {t.wohnung && (
                              <div className="text-xs text-white/30 mb-2">
                                {t.wohnung}{t.raum ? " • " + t.raum : ""}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 items-center">
                              {idx === 0 && score >= 70 && (
                                <span className="text-[10px] bg-[#00D4AA] text-black font-bold px-2 py-0.5 rounded-full">
                                  #1 MATCH
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: match.color + "15", color: match.color }}>
                                {score}% {match.text}
                              </span>
                              <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                                {angeboteCount} Angebot{angeboteCount !== 1 ? "e" : ""}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-[#00D4AA]">
                                EUR {preisNum.toLocaleString("de")}
                              </div>
                              <div className="text-[10px] text-white/30">Preisempfehlung</div>
                            </div>
                            {t.auktion_ende && <Timer end={t.auktion_ende} />}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          <div className="bg-[#00B4D8]/10 text-[#00B4D8] px-2 py-1 rounded-lg">
                            {kiGewinnchance(t)}
                          </div>
                          {t.prioritaet === "dringend" && (
                            <div className="bg-red-500/10 text-red-400 px-2 py-1 rounded-lg">
                              Eilauftrag
                            </div>
                          )}
                        </div>
                        <button onClick={() => router.push("/dashboard-handwerker/angebot/" + t.id)}
                          className="text-[10px] text-[#00D4AA] hover:text-[#00D4AA]/80 mt-3 transition-colors">
                          Angebot abgeben →
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === "auftraege" && (
          <>
            {meineAuftraege.length === 0 ? (
              <div className="bg-[#12121a] border border-white/5 rounded-xl p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl text-[#00B4D8]">[!]</span>
                </div>
                <div className="text-white/60 text-sm font-medium mb-1">Noch keine Aufträge erhalten</div>
                <div className="text-white/30 text-xs mb-4">Aufträge erscheinen hier, sobald du den Zuschlag für eine Ausschreibung erhältst.</div>
                {auktionen.length > 0 ? (
                  <button onClick={() => setTab("auktionen")}
                    className="text-xs text-[#00D4AA] border border-[#00D4AA]/20 px-4 py-2 rounded-lg hover:bg-[#00D4AA]/10 transition-colors">
                    {auktionen.length} offene Ausschreibungen ansehen
                  </button>
                ) : (
                  <div className="text-white/20 text-xs">Aktuell gibt es keine offenen Ausschreibungen.</div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {meineAuftraege.filter(t => t.status !== "erledigt").length > 0 && (
                  <>
                    <div className="text-xs text-white/30 uppercase tracking-wider mb-1">Aktiv</div>
                    {meineAuftraege.filter(t => t.status !== "erledigt").map(t => {
                      const steps = ["vergeben", "in_arbeit", "erledigt"]
                      const currentStep = steps.indexOf(t.status) >= 0 ? steps.indexOf(t.status) : 0
                      return (
                        <div key={t.id} onClick={() => router.push("/ticket/" + t.id)}
                          className="bg-[#12121a] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-[#00D4AA]/30 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">{t.titel}</div>
                            <span className={"text-[10px] px-2 py-0.5 rounded-full font-medium " + (t.status === "in_arbeit" ? "bg-amber-500/15 text-amber-400" : "bg-[#00D4AA]/15 text-[#00D4AA]")}>
                              {t.status === "in_arbeit" ? "In Arbeit" : t.status === "vergeben" ? "Vergeben" : t.status}
                            </span>
                          </div>
                          <div className="text-xs text-white/30 mb-3">
                            {t.wohnung || ""} | Erstellt: {new Date(t.created_at).toLocaleDateString("de")}
                          </div>
                          <div className="flex gap-1">
                            {steps.map((s, i) => (
                              <div key={s} className={"h-1 flex-1 rounded-full " + (i <= currentStep ? "bg-[#00D4AA]" : "bg-white/10")} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
                {meineAuftraege.filter(t => t.status === "erledigt").length > 0 && (
                  <>
                    <div className="text-xs text-white/30 uppercase tracking-wider mt-4 mb-1">Abgeschlossen</div>
                    {meineAuftraege.filter(t => t.status === "erledigt").map(t => (
                      <div key={t.id} onClick={() => router.push("/ticket/" + t.id)}
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
