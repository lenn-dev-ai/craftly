"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, Angebot, Nachricht, UserProfile, Einladung } from "@/types"
import { Badge, PrioBadge, Avatar, Button, Card, Input, LoadingSpinner } from "@/components/ui"
import { Timer } from "@/components/ui/Timer"

function berechneValueScore(angebot: Angebot, alleAngebote: Angebot[]): number {
  if (alleAngebote.length === 0) return 0
  const preise = alleAngebote.map(a => a.preis)
  const minPreis = Math.min(...preise)
  const maxPreis = Math.max(...preise)
  const preisRange = maxPreis - minPreis || 1
  const preisScore = 1 - ((angebot.preis - minPreis) / preisRange)
  const bewertung = (angebot.handwerker as any)?.bewertung_avg || 3
  const qualScore = Math.min(bewertung / 5, 1)
  let terminScore = 0.5
  if (angebot.fruehester_termin) {
    const tage = Math.max(0, (new Date(angebot.fruehester_termin).getTime() - Date.now()) / 86400000)
    terminScore = Math.max(0, 1 - (tage / 30))
  }
  return Math.round((preisScore * 0.4 + qualScore * 0.3 + terminScore * 0.3) * 100)
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating || 0)
  const half = (rating || 0) - full >= 0.5
  return (
    <span className="text-xs tracking-wide">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? "text-amber-400" : (i === full && half) ? "text-amber-400/50" : "text-white/15"}>★</span>
      ))}
      <span className="ml-1 text-white/40">{(rating || 0).toFixed(1)}</span>
    </span>
  )
}

function ValueScoreRing({ score }: { score: number }) {
  const r = 22, c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = score >= 75 ? "#00D4AA" : score >= 50 ? "#F59E0B" : "#EF4444"
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xs font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">🥇 #1 Empfohlen</span>
  if (rank === 2) return <span className="text-xs font-bold bg-white/10 text-white/60 px-2 py-0.5 rounded-full border border-white/10">🥈 #2</span>
  if (rank === 3) return <span className="text-xs font-bold bg-amber-800/20 text-amber-600/80 px-2 py-0.5 rounded-full border border-amber-800/20">🥉 #3</span>
  return <span className="text-xs text-white/30 px-2 py-0.5">#{rank}</span>
}

function kiPreisempfehlung(titel: string): string {
  const t = (titel || "").toLowerCase()
  if (t.includes("heizung") || t.includes("therme")) return "800–2.500"
  if (t.includes("wasser") || t.includes("rohr") || t.includes("leck")) return "300–1.200"
  if (t.includes("elektr") || t.includes("strom")) return "150–600"
  if (t.includes("tür") || t.includes("schloss") || t.includes("fenster")) return "200–800"
  if (t.includes("schimmel") || t.includes("feucht")) return "500–2.000"
  return "250–600"
}

function AuktionCountdown({ end }: { end: string }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000))
    setSecs(calc())
    const id = setInterval(() => setSecs(calc()), 1000)
    return () => clearInterval(id)
  }, [end])
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  const fmt = (n: number) => String(n).padStart(2, "0")
  const totalDuration = Math.max(1, (new Date(end).getTime() - Date.now()) / 1000 + secs)
  const progress = Math.min(100, Math.max(0, ((totalDuration - secs) / totalDuration) * 100))
  const expired = secs === 0
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 border ${expired ? "bg-red-500/5 border-red-500/20" : "bg-gradient-to-r from-[#00D4AA]/5 via-[#00B4D8]/5 to-[#00D4AA]/5 border-[#00D4AA]/20"}`}>
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#00D4AA]/15 flex items-center justify-center">
            <span className="text-lg font-bold text-[#00D4AA]">AI</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-[#00D4AA]">KI-Optimierte Smart-Auktion</span>
              {!expired && <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />}
            </div>
            <div className="text-xs text-white/40">Handwerker bieten in Echtzeit — bestes Preis-Leistungs-Verhältnis gewinnt</div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {expired ? (
            <div className="text-lg font-bold text-red-400">Abgelaufen</div>
          ) : (
            <>
              <div className="font-mono text-3xl font-bold tracking-wider">
                <span className="text-[#00D4AA]">{fmt(h)}</span>
                <span className="text-white/20 mx-0.5">:</span>
                <span className="text-[#00B4D8]">{fmt(m)}</span>
                <span className="text-white/20 mx-0.5">:</span>
                <span className="text-white/60">{fmt(s)}</span>
              </div>
              <div className="text-[10px] text-white/30 mt-1">verbleibend</div>
            </>
          )}
        </div>
      </div>
      {!expired && (
        <div className="mt-4 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] rounded-full transition-all duration-1000" style={{ width: `${100 - progress}%` }} />
        </div>
      )}
    </div>
  )
}

export default function TicketDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([])
  const [chatText, setChatText] = useState("")
  const [angebotForm, setAngebotForm] = useState({ preis: "", termin: "", dauer: "", nachricht: "" })
  const [sending, setSending] = useState(false)
  const [submittingBid, setSubmittingBid] = useState(false)
  const [einladungen, setEinladungen] = useState<Einladung[]>([])
  const [loading, setLoading] = useState(true)
  const [kostenFinal, setKostenFinal] = useState("")
  const [showKosten, setShowKosten] = useState(false)
  const [vergebenConfirm, setVergebenConfirm] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const [{ data: profile }, { data: t }, { data: msgs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("tickets").select("*, objekte(*), angebote(*, handwerker:profiles(*))").eq("id", id).single(),
      supabase.from("nachrichten").select("*, absender:profiles(*)").eq("ticket_id", id).order("created_at"),
    ])
    setCurrentUser(profile)
    setTicket(t)
    setNachrichten(msgs || [])
    const { data: einl } = await supabase.from("einladungen").select("*, handwerker:handwerker_id(id,name,firma,gewerk,bewertung_avg)").eq("ticket_id", id)
    setEinladungen(einl || [])
    setLoading(false)
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100)
  }

  useEffect(() => { load() }, [id])

  async function sendChat() {
    if (!chatText.trim() || !currentUser) return
    setSending(true)
    const supabase = createClient()
    await supabase.from("nachrichten").insert({ ticket_id: id, absender_id: currentUser.id, text: chatText.trim() })
    setChatText("")
    await load()
    setSending(false)
  }

  async function submitAngebot() {
    if (!angebotForm.preis || !currentUser) return
    setSubmittingBid(true)
    const supabase = createClient()
    await supabase.from("angebote").insert({
      ticket_id: id, handwerker_id: currentUser.id,
      preis: Number(angebotForm.preis), fruehester_termin: angebotForm.termin || null,
      geschaetzte_dauer: angebotForm.dauer || null, nachricht: angebotForm.nachricht || null,
      status: "eingereicht",
    })
    setAngebotForm({ preis: "", termin: "", dauer: "", nachricht: "" })
    await load()
    setSubmittingBid(false)
  }

  async function vergeben(angebotId: string, handwerkerId: string) {
    const supabase = createClient()
    await supabase.from("tickets").update({ status: "in_bearbeitung", zugewiesener_hw: handwerkerId }).eq("id", id)
    await supabase.from("angebote").update({ status: "angenommen" }).eq("id", angebotId)
    await supabase.from("angebote").update({ status: "abgelehnt" }).eq("ticket_id", id).neq("id", angebotId)
    setVergebenConfirm(null)
    await load()
  }

  async function abschliessen() {
    const supabase = createClient()
    const updates: Record<string, unknown> = { status: "erledigt" }
    if (kostenFinal) updates.kosten_final = Number(kostenFinal)
    await supabase.from("tickets").update(updates).eq("id", id)
    setShowKosten(false)
    await load()
  }

  if (loading) return <LoadingSpinner />
  if (!ticket) return <div className="p-6 text-sm text-gray-500">Ticket nicht gefunden.</div>

  const isVerwalter = currentUser?.rolle === "verwalter" || currentUser?.rolle === "admin"
  const isHandwerker = currentUser?.rolle === "handwerker"
  const hatBereitsAngebot = ticket.angebote?.some(a => a.handwerker_id === currentUser?.id)
  const alleAngebote = ticket.angebote || []
  const sortiertAngebote = [...alleAngebote]
    .map((a, _, arr) => ({ ...a, valueScore: berechneValueScore(a, arr) }))
    .sort((a, b) => b.valueScore - a.valueScore)

  const avgPreis = alleAngebote.length > 0 ? Math.round(alleAngebote.reduce((s, a) => s + a.preis, 0) / alleAngebote.length) : 0
  const minPreis = alleAngebote.length > 0 ? Math.min(...alleAngebote.map(a => a.preis)) : 0
  const maxPreis = alleAngebote.length > 0 ? Math.max(...alleAngebote.map(a => a.preis)) : 0
  const savings = maxPreis > 0 ? Math.round(((maxPreis - minPreis) / maxPreis) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-12">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Navigation */}
        <button onClick={() => router.back()} className="text-sm text-white/40 hover:text-white/70 mb-6 flex items-center gap-2 transition-colors">
          ← Zurück
        </button>

        {/* Ticket Header */}
        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-white mb-2">{ticket.titel}</h1>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge status={ticket.status} />
                <PrioBadge prio={ticket.prioritaet} />
                {ticket.wohnung && <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded-lg">{ticket.wohnung}</span>}
                {ticket.vergabemodus === "auktion" && (
                  <span className="text-xs text-[#00B4D8] bg-[#00B4D8]/10 px-2 py-1 rounded-lg border border-[#00B4D8]/20">Smart-Auktion</span>
                )}
              </div>
              {ticket.beschreibung && <p className="text-sm text-white/50 leading-relaxed">{ticket.beschreibung}</p>}
            </div>
            {isVerwalter && ticket.status === "in_bearbeitung" && !showKosten && (
              <Button size="sm" onClick={() => setShowKosten(true)}>Abschließen</Button>
            )}
          </div>
          {/* Ticket meta */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-white/30">
            <span>Erstellt: {new Date(ticket.created_at).toLocaleDateString("de", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
            {ticket.gewerk && <span>Gewerk: {ticket.gewerk}</span>}
            {ticket.vergabemodus && <span>Modus: {ticket.vergabemodus === "auktion" ? "Smart-Auktion" : ticket.vergabemodus === "direkt" ? "Sofort-Vergabe" : "Planauftrag"}</span>}
          </div>
        </div>

        {/* === AUCTION HERO === */}
        {ticket.status === "auktion" && ticket.auktion_ende && (
          <div className="mb-6">
            <AuktionCountdown end={ticket.auktion_ende} />
            {/* Auction Stats */}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-[#12121a] border border-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#00D4AA]">{sortiertAngebote.length}</div>
                <div className="text-[10px] text-white/40 mt-1">Angebote</div>
              </div>
              <div className="bg-[#12121a] border border-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#00B4D8]">
                  {minPreis > 0 ? `${minPreis}–${maxPreis}` : "—"}
                </div>
                <div className="text-[10px] text-white/40 mt-1">Preisspanne EUR</div>
              </div>
              <div className="bg-[#12121a] border border-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#F59E0B]">{savings > 0 ? `${savings}%` : "—"}</div>
                <div className="text-[10px] text-white/40 mt-1">Potenzielle Ersparnis</div>
              </div>
            </div>
          </div>
        )}

        {/* Kosten-Eingabe beim Abschließen */}
        {showKosten && (
          <Card className="mb-6 border-[#00D4AA]/30 bg-[#12121a]">
            <h2 className="text-sm font-semibold text-white mb-2">Ticket abschließen</h2>
            <p className="text-xs text-white/40 mb-3">Trage die tatsächlichen Kosten ein, bevor du das Ticket abschließt.</p>
            <Input label="Endkosten in EUR" type="number" placeholder="z.B. 450" value={kostenFinal} onChange={e => setKostenFinal(e.target.value)} />
            <div className="flex gap-2 mt-3">
              <Button onClick={abschliessen}>Abschließen</Button>
              <button onClick={() => setShowKosten(false)} className="text-sm text-white/40 hover:text-white/60 px-3">Abbrechen</button>
            </div>
          </Card>
        )}

        {/* Erledigte Ticket Info */}
        {ticket.status === "erledigt" && (
          <div className="bg-[#00D4AA]/5 border border-[#00D4AA]/20 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00D4AA]/20 flex items-center justify-center text-[#00D4AA] font-bold">✓</div>
              <div>
                <div className="text-sm font-semibold text-[#00D4AA]">Auftrag abgeschlossen</div>
                {ticket.kosten_final && <div className="text-xs text-white/40 mt-0.5">Endkosten: {ticket.kosten_final.toLocaleString("de")} EUR</div>}
              </div>
            </div>
          </div>
        )}

        {/* Zugewiesener Handwerker Info */}
        {ticket.status === "in_bearbeitung" && ticket.zugewiesener_hw && (
          <div className="bg-[#00B4D8]/5 border border-[#00B4D8]/20 rounded-2xl p-5 mb-6">
            <div className="text-xs text-white/40 mb-3 font-medium">BEAUFTRAGTER HANDWERKER</div>
            {(() => {
              const hw = alleAngebote.find(a => a.handwerker_id === ticket.zugewiesener_hw)
              if (!hw) return null
              return (
                <div className="flex items-center gap-3">
                  <Avatar name={(hw.handwerker as any)?.name || "?"} size="md" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{(hw.handwerker as any)?.name}</div>
                    <div className="text-xs text-white/40">{(hw.handwerker as any)?.firma}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#00D4AA]">{hw.preis} EUR</div>
                    <div className="text-[10px] text-white/30">Angenommener Preis</div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Handwerker einladen (Verwalter, offen) */}
        {isVerwalter && ticket.status === "offen" && (
          <Card className="mb-6 bg-[#12121a] border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white">Handwerker einladen</h3>
              <Button size="sm" onClick={() => router.push("/dashboard-verwalter/tickets/" + id + "/handwerker")}>Handwerker auswählen</Button>
            </div>
            {einladungen.length > 0 ? (
              <div className="space-y-2">
                {einladungen.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.handwerker?.name || "?"} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-white">{e.handwerker?.name}</div>
                        <div className="text-xs text-white/40">{e.handwerker?.firma}</div>
                      </div>
                    </div>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (
                      e.status === "angebot" ? "bg-[#00D4AA]/10 text-[#00D4AA]" :
                      e.status === "abgelehnt" ? "bg-red-500/10 text-red-400" :
                      "bg-amber-500/10 text-amber-400"
                    )}>
                      {e.status === "angebot" ? "Angebot erhalten" : e.status === "abgelehnt" ? "Abgelehnt" : "Eingeladen"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40">Noch keine Handwerker eingeladen.</p>
            )}
          </Card>
        )}

        {/* === ANGEBOTE — VERWALTER VIEW === */}
        {isVerwalter && sortiertAngebote.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Eingegangene Angebote
                <span className="ml-2 text-sm font-normal text-white/40">({sortiertAngebote.length})</span>
              </h2>
              {avgPreis > 0 && (
                <span className="text-xs text-white/30 bg-white/5 px-3 py-1 rounded-lg">
                  Ø {avgPreis.toLocaleString("de")} EUR
                </span>
              )}
            </div>

            <div className="space-y-4">
              {sortiertAngebote.map((a, idx) => {
                const rank = idx + 1
                const hw = a.handwerker as any
                const isTop = rank === 1 && sortiertAngebote.length > 1
                const isAngenommen = a.status === "angenommen"
                const isAbgelehnt = a.status === "abgelehnt"
                return (
                  <div key={a.id} className={`rounded-2xl border transition-all ${
                    isAngenommen ? "bg-[#00D4AA]/5 border-[#00D4AA]/30" :
                    isAbgelehnt ? "bg-white/[0.01] border-white/5 opacity-50" :
                    isTop ? "bg-gradient-to-r from-[#00D4AA]/5 to-[#00B4D8]/5 border-[#00D4AA]/25 shadow-lg shadow-[#00D4AA]/5" :
                    "bg-[#12121a] border-white/5 hover:border-white/10"
                  }`}>
                    <div className="p-5">
                      {/* Top row: rank + HW info + score */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar name={hw?.name || "?"} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-white">{hw?.name || "Handwerker"}</span>
                              <RankBadge rank={rank} />
                              {isAngenommen && <span className="text-xs bg-[#00D4AA]/15 text-[#00D4AA] px-2 py-0.5 rounded-full font-medium">✓ Beauftragt</span>}
                            </div>
                            <div className="text-xs text-white/40">{hw?.firma || "Firma"}</div>
                            <div className="flex items-center gap-3 mt-1">
                              <StarRating rating={hw?.bewertung_avg || 0} />
                              {hw?.auftraege_anzahl > 0 && (
                                <span className="text-[10px] text-white/30">{hw.auftraege_anzahl} Aufträge</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ValueScoreRing score={a.valueScore} />
                      </div>

                      {/* Price + Details row */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white/[0.03] rounded-xl p-3">
                          <div className="text-[10px] text-white/30 mb-1">Preis</div>
                          <div className="text-lg font-bold text-[#00D4AA]">{a.preis.toLocaleString("de")} EUR</div>
                        </div>
                        <div className="bg-white/[0.03] rounded-xl p-3">
                          <div className="text-[10px] text-white/30 mb-1">Frühester Termin</div>
                          <div className="text-sm font-medium text-white">
                            {a.fruehester_termin ? new Date(a.fruehester_termin).toLocaleDateString("de", { day: "2-digit", month: "2-digit" }) : "Flexibel"}
                          </div>
                        </div>
                        <div className="bg-white/[0.03] rounded-xl p-3">
                          <div className="text-[10px] text-white/30 mb-1">Geschätzte Dauer</div>
                          <div className="text-sm font-medium text-white">{(a as any).geschaetzte_dauer ? (a as any).geschaetzte_dauer + " Tage" : "—"}</div>
                        </div>
                      </div>

                      {/* Message */}
                      {a.nachricht && (
                        <div className="bg-white/[0.02] rounded-lg p-3 mb-4 border-l-2 border-[#00B4D8]/30">
                          <div className="text-xs text-white/50 italic">„{a.nachricht}“</div>
                        </div>
                      )}

                      {/* Action */}
                      {a.status === "eingereicht" && isVerwalter && (
                        <div className="flex items-center gap-3">
                          {vergebenConfirm === a.id ? (
                            <>
                              <span className="text-xs text-white/40">Wirklich an {hw?.name} vergeben?</span>
                              <Button size="sm" onClick={() => vergeben(a.id, a.handwerker_id)}>Ja, vergeben</Button>
                              <button onClick={() => setVergebenConfirm(null)} className="text-xs text-white/40 hover:text-white/60">Abbrechen</button>
                            </>
                          ) : (
                            <Button size="sm" onClick={() => setVergebenConfirm(a.id)}>
                              {isTop ? "✓ Auftrag vergeben" : "Auftrag vergeben"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty angebote state for Verwalter */}
        {isVerwalter && sortiertAngebote.length === 0 && ticket.status === "auktion" && (
          <Card className="mb-6 bg-[#12121a] border border-white/5">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-[#00B4D8]">[~]</span>
              </div>
              <div className="text-sm text-white/60 font-medium mb-1">Warten auf Angebote</div>
              <div className="text-xs text-white/30">Handwerker können jetzt bieten — Angebote erscheinen hier automatisch.</div>
            </div>
          </Card>
        )}

        {/* === HANDWERKER BID FORM === */}
        {isHandwerker && !hatBereitsAngebot && ticket.status === "auktion" && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-[#00D4AA]/8 to-[#00B4D8]/8 border border-[#00D4AA]/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#00D4AA]/15 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#00D4AA]">#</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Dein Angebot abgeben</h2>
                  <div className="text-xs text-white/40">
                    {alleAngebote.length} andere{alleAngebote.length === 1 ? "s Angebot" : " Angebote"} bereits eingegangen
                  </div>
                </div>
              </div>

              {/* KI Preisempfehlung */}
              <div className="bg-[#00B4D8]/10 border border-[#00B4D8]/20 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#00B4D8] bg-[#00B4D8]/20 px-2 py-0.5 rounded">AI</span>
                  <span className="text-xs font-medium text-[#00B4D8]">KI-Preisempfehlung</span>
                </div>
                <div className="text-lg font-bold text-white">EUR {kiPreisempfehlung(ticket.titel)}</div>
                <div className="text-[10px] text-white/30 mt-1">Basierend auf vergleichbaren Aufträgen in deiner Region</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Input label="Dein Preis (EUR) *" type="number" placeholder="z.B. 450"
                  value={angebotForm.preis} onChange={e => setAngebotForm({ ...angebotForm, preis: e.target.value })} />
                <Input label="Frühester Termin" type="date"
                  value={angebotForm.termin} onChange={e => setAngebotForm({ ...angebotForm, termin: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Input label="Geschätzte Dauer (Tage)" type="number" placeholder="z.B. 2"
                  value={angebotForm.dauer} onChange={e => setAngebotForm({ ...angebotForm, dauer: e.target.value })} />
                <Input label="Nachricht (Optional)" type="text" placeholder="z.B. Material inklusive"
                  value={angebotForm.nachricht} onChange={e => setAngebotForm({ ...angebotForm, nachricht: e.target.value })} />
              </div>

              <Button onClick={submitAngebot} disabled={submittingBid || !angebotForm.preis} className="w-full">
                {submittingBid ? "Wird eingereicht..." : "Angebot einreichen →"}
              </Button>
            </div>
          </div>
        )}

        {/* Handwerker: eigenes Angebot anzeigen */}
        {isHandwerker && hatBereitsAngebot && (
          <Card className="mb-6 bg-[#00D4AA]/5 border border-[#00D4AA]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00D4AA]/20 flex items-center justify-center text-[#00D4AA] font-bold text-sm">✓</div>
              <div>
                <div className="text-sm font-medium text-[#00D4AA]">Dein Angebot wurde eingereicht</div>
                {(() => {
                  const meinAngebot = alleAngebote.find(a => a.handwerker_id === currentUser?.id)
                  if (!meinAngebot) return null
                  return (
                    <div className="text-xs text-white/40 mt-0.5">
                      {meinAngebot.preis.toLocaleString("de")} EUR
                      {meinAngebot.status === "angenommen" && <span className="ml-2 text-[#00D4AA] font-medium">— Angenommen!</span>}
                      {meinAngebot.status === "abgelehnt" && <span className="ml-2 text-red-400 font-medium">— Leider nicht ausgewählt</span>}
                    </div>
                  )
                })()}
              </div>
            </div>
          </Card>
        )}

        {/* === CHAT === */}
        <Card className="bg-[#12121a] border border-white/5">
          <h2 className="text-sm font-semibold text-white mb-3">Nachrichten</h2>
          <div ref={chatRef} className="bg-[#0a0a0f] rounded-xl p-4 h-64 overflow-y-auto mb-3 flex flex-col gap-3">
            {nachrichten.length === 0 ? (
              <div className="text-xs text-white/30 text-center py-8">Noch keine Nachrichten</div>
            ) : nachrichten.map(m => {
              const isMe = m.absender_id === currentUser?.id
              const zeit = new Date(m.created_at).toLocaleTimeString("de", { hour: "2-digit", minute: "2-digit" })
              const datum = new Date(m.created_at).toLocaleDateString("de", { day: "2-digit", month: "2-digit" })
              const rolle = (m.absender as any)?.rolle
              return (
                <div key={m.id} className={"flex " + (isMe ? "justify-end" : "justify-start")}>
                  <div className={"max-w-xs " + (isMe ? "" : "flex gap-2 items-end")}>
                    {!isMe && <Avatar name={m.absender?.name || "?"} size="sm" />}
                    <div>
                      <div className={"text-[10px] mb-0.5 flex items-center gap-1.5 " + (isMe ? "justify-end" : "")}>
                        <span className="font-medium text-white/40">{isMe ? "Du" : (m.absender?.name || "Unbekannt")}</span>
                        {rolle && <span className="text-[9px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">{rolle}</span>}
                        <span className="text-white/20">{datum} {zeit}</span>
                      </div>
                      <div className={"text-sm px-3 py-2 rounded-xl leading-relaxed " + (
                        isMe ? "bg-[#00D4AA] text-black" : "bg-white/5 text-white/80"
                      )}>
                        {m.text}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Nachricht..." value={chatText} onChange={e => setChatText(e.target.value)}
              onKeyPress={e => e.key === "Enter" && sendChat()} />
            <Button onClick={sendChat} disabled={sending}>{sending ? "..." : "Senden"}</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
