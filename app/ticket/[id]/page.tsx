"use client"
import { useCallback, useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, Angebot, Nachricht, UserProfile, Einladung, Bewertung } from "@/types"
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
        <span key={i} className={i < full ? "text-[#C4956A]" : (i === full && half) ? "text-[#C4956A]/50" : "text-[#EDE8E1]"}>★</span>
      ))}
      <span className="ml-1 text-[#8C857B]">{(rating || 0).toFixed(1)}</span>
    </span>
  )
}

function ValueScoreRing({ score }: { score: number }) {
  const r = 22, c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = score >= 75 ? "#3D8B7A" : score >= 50 ? "#C4956A" : "#C4574B"
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
  if (rank === 1) return <span className="text-xs font-bold bg-[#C4956A]/20 text-[#C4956A] px-2 py-0.5 rounded-full border border-[#C4956A]/30">🥇 #1 Empfohlen</span>
  if (rank === 2) return <span className="text-xs font-bold bg-[#FAF8F5] text-[#6B665E] px-2 py-0.5 rounded-full border border-[#EDE8E1]">🥈 #2</span>
  if (rank === 3) return <span className="text-xs font-bold bg-[#854F0B]/20 text-[#854F0B]/80 px-2 py-0.5 rounded-full border border-[#C4956A]/20">🥉 #3</span>
  return <span className="text-xs text-[#B5AEA4] px-2 py-0.5">#{rank}</span>
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
    <div className={`relative overflow-hidden rounded-2xl p-6 border ${expired ? "bg-[#C4574B]/5 border-[#C4574B]/20" : "bg-gradient-to-r from-[#3D8B7A]/5 via-[#5B6ABF]/5 to-[#3D8B7A]/5 border-[#3D8B7A]/20"}`}>
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#3D8B7A]/15 flex items-center justify-center">
            <span className="text-lg font-bold text-[#3D8B7A]">AI</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-[#3D8B7A]">KI-Optimierte Smart-Auktion</span>
              {!expired && <span className="w-2 h-2 rounded-full bg-[#3D8B7A] animate-pulse" />}
            </div>
            <div className="text-xs text-[#8C857B]">Handwerker bieten in Echtzeit — bestes Preis-Leistungs-Verhältnis gewinnt</div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {expired ? (
            <div className="text-lg font-bold text-[#C4574B]">Abgelaufen</div>
          ) : (
            <>
              <div className="font-mono text-3xl font-bold tracking-wider">
                <span className="text-[#3D8B7A]">{fmt(h)}</span>
                <span className="text-[#EDE8E1] mx-0.5">:</span>
                <span className="text-[#5B6ABF]">{fmt(m)}</span>
                <span className="text-[#EDE8E1] mx-0.5">:</span>
                <span className="text-[#6B665E]">{fmt(s)}</span>
              </div>
              <div className="text-[10px] text-[#B5AEA4] mt-1">verbleibend</div>
            </>
          )}
        </div>
      </div>
      {!expired && (
        <div className="mt-4 h-1.5 bg-[#FAF8F5] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#3D8B7A] to-[#5B6ABF] rounded-full transition-all duration-1000" style={{ width: `${100 - progress}%` }} />
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
  const [bewertungen, setBewertungen] = useState<Bewertung[]>([])
  const [loading, setLoading] = useState(true)
  const [kostenFinal, setKostenFinal] = useState("")
  const [showKosten, setShowKosten] = useState(false)
  const [vergebenConfirm, setVergebenConfirm] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
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
    const { data: bew } = await supabase.from("bewertungen").select("*").eq("ticket_id", id)
    setBewertungen(bew || [])
    setLoading(false)
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100)
  }, [id, router])

  useEffect(() => { load() }, [load])

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
    const angebot = (ticket?.angebote || []).find(a => a.id === angebotId)
    if (!angebot) return

    // 1) Ticket aktualisieren
    await supabase.from("tickets").update({
      status: "in_bearbeitung",
      zugewiesener_hw: handwerkerId,
      kosten_final: angebot.preis,
    }).eq("id", id)

    // 2) Angebote: dieses akzeptiert, Rest abgelehnt
    await supabase.from("angebote").update({ status: "angenommen" }).eq("id", angebotId)
    await supabase.from("angebote").update({ status: "abgelehnt" }).eq("ticket_id", id).neq("id", angebotId)

    // 3) Termin im Handwerker-Kalender (wenn fruehester_termin gesetzt)
    if (angebot.fruehester_termin) {
      await supabase.from("termine").insert({
        handwerker_id: handwerkerId,
        ticket_id: id,
        titel: ticket?.titel || "Auftrag",
        datum: angebot.fruehester_termin,
        von: "09:00",
        bis: "12:00",
        einsatzort_adresse: ticket?.einsatzort_adresse || null,
        einsatzort_lat: ticket?.einsatzort_lat ?? null,
        einsatzort_lng: ticket?.einsatzort_lng ?? null,
      })
    }

    // 4) System-Nachricht im Ticket-Chat
    const hw = angebot.handwerker as { firma?: string; name?: string } | undefined
    const hwName = hw?.firma || hw?.name || "Handwerker"
    const datumStr = angebot.fruehester_termin
      ? new Date(angebot.fruehester_termin).toLocaleDateString("de", { day: "2-digit", month: "long", year: "numeric" })
      : "demnächst"
    if (currentUser) {
      await supabase.from("nachrichten").insert({
        ticket_id: id,
        absender_id: currentUser.id,
        text: `✓ Auftrag vergeben: ${hwName} kommt am ${datumStr}. Preis: ${angebot.preis} €.`,
      })
    }

    setVergebenConfirm(null)
    await load()
  }

  async function abschliessen() {
    const supabase = createClient()
    const updates: Record<string, unknown> = { status: "erledigt" }
    if (kostenFinal) updates.kosten_final = Number(kostenFinal)
    await supabase.from("tickets").update(updates).eq("id", id)

    if (currentUser) {
      await supabase.from("nachrichten").insert({
        ticket_id: id,
        absender_id: currentUser.id,
        text: `✓ Auftrag abgeschlossen.${kostenFinal ? ` Endkosten: ${kostenFinal} €.` : ""}`,
      })
    }

    setShowKosten(false)
    await load()
  }

  async function bewertenSpeichern(sterne: number, kommentar: string) {
    if (!ticket?.zugewiesener_hw || !currentUser) return
    const supabase = createClient()
    const { error: insertErr } = await supabase.from("bewertungen").insert({
      ticket_id: id,
      handwerker_id: ticket.zugewiesener_hw,
      bewerter_id: currentUser.id,
      sterne,
      kommentar: kommentar || null,
    })
    if (insertErr) {
      alert("Bewertung konnte nicht gespeichert werden: " + insertErr.message)
      return
    }
    // Aggregate auf Profil aktualisieren
    const { data: alle } = await supabase
      .from("bewertungen")
      .select("sterne")
      .eq("handwerker_id", ticket.zugewiesener_hw)
    if (alle && alle.length > 0) {
      const avg = alle.reduce((s, b) => s + (b.sterne || 0), 0) / alle.length
      await supabase.from("profiles").update({
        bewertung_avg: Math.round(avg * 10) / 10,
        auftraege_anzahl: alle.length,
      }).eq("id", ticket.zugewiesener_hw)
    }
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
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2A26] pb-12">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Navigation */}
        <button onClick={() => router.back()} className="text-sm text-[#8C857B] hover:text-[#6B665E] mb-6 flex items-center gap-2 transition-colors">
          ← Zurück
        </button>

        {/* Ticket Header */}
        <div className="bg-white border border-[#EDE8E1] rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-[#2D2A26] mb-2">{ticket.titel}</h1>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge status={ticket.status} />
                <PrioBadge prio={ticket.prioritaet} />
                {ticket.wohnung && <span className="text-xs text-[#B5AEA4] bg-[#FAF8F5] px-2 py-1 rounded-lg">{ticket.wohnung}</span>}
                {ticket.vergabemodus === "auktion" && (
                  <span className="text-xs text-[#5B6ABF] bg-[#5B6ABF]/10 px-2 py-1 rounded-lg border border-[#5B6ABF]/20">Smart-Auktion</span>
                )}
              </div>
              {ticket.beschreibung && <p className="text-sm text-[#6B665E] leading-relaxed">{ticket.beschreibung}</p>}
            </div>
            {isVerwalter && ticket.status === "in_bearbeitung" && !showKosten && (
              <Button size="sm" onClick={() => setShowKosten(true)}>Abschließen</Button>
            )}
          </div>
          {/* Ticket meta */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#EDE8E1] text-xs text-[#B5AEA4]">
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
              <div className="bg-white border border-[#EDE8E1] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#3D8B7A]">{sortiertAngebote.length}</div>
                <div className="text-[10px] text-[#8C857B] mt-1">Angebote</div>
              </div>
              <div className="bg-white border border-[#EDE8E1] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#5B6ABF]">
                  {minPreis > 0 ? `${minPreis}–${maxPreis}` : "—"}
                </div>
                <div className="text-[10px] text-[#8C857B] mt-1">Preisspanne EUR</div>
              </div>
              <div className="bg-white border border-[#EDE8E1] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#C4956A]">{savings > 0 ? `${savings}%` : "—"}</div>
                <div className="text-[10px] text-[#8C857B] mt-1">Potenzielle Ersparnis</div>
              </div>
            </div>
          </div>
        )}

        {/* Kosten-Eingabe beim Abschließen */}
        {showKosten && (
          <Card className="mb-6 border-[#3D8B7A]/30 bg-white">
            <h2 className="text-sm font-semibold text-[#2D2A26] mb-2">Ticket abschließen</h2>
            <p className="text-xs text-[#8C857B] mb-3">Trage die tatsächlichen Kosten ein, bevor du das Ticket abschließt.</p>
            <Input label="Endkosten in EUR" type="number" placeholder="z.B. 450" value={kostenFinal} onChange={e => setKostenFinal(e.target.value)} />
            <div className="flex gap-2 mt-3">
              <Button onClick={abschliessen}>Abschließen</Button>
              <button onClick={() => setShowKosten(false)} className="text-sm text-[#8C857B] hover:text-[#6B665E] px-3">Abbrechen</button>
            </div>
          </Card>
        )}

        {/* Erledigte Ticket Info */}
        {ticket.status === "erledigt" && (
          <div className="bg-[#3D8B7A]/5 border border-[#3D8B7A]/20 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3D8B7A]/20 flex items-center justify-center text-[#3D8B7A] font-bold">✓</div>
              <div>
                <div className="text-sm font-semibold text-[#3D8B7A]">Auftrag abgeschlossen</div>
                {ticket.kosten_final && <div className="text-xs text-[#8C857B] mt-0.5">Endkosten: {ticket.kosten_final.toLocaleString("de")} EUR</div>}
              </div>
            </div>
          </div>
        )}

        {/* Bewertung-UI: nur Mieter, nur wenn erledigt + nicht schon bewertet */}
        {ticket.status === "erledigt"
          && currentUser?.id === ticket.erstellt_von
          && ticket.zugewiesener_hw
          && !bewertungen.some(b => b.bewerter_id === currentUser.id)
          && (
          <BewertungForm onSubmit={bewertenSpeichern} />
        )}

        {/* Bewertung-Bestätigung wenn bereits abgegeben */}
        {ticket.status === "erledigt"
          && currentUser?.id === ticket.erstellt_von
          && bewertungen.some(b => b.bewerter_id === currentUser.id) && (
          <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5 mb-6">
            <div className="text-sm font-semibold text-[#2D2A26] mb-1">Danke für deine Bewertung</div>
            {(() => {
              const meine = bewertungen.find(b => b.bewerter_id === currentUser?.id)
              if (!meine) return null
              return (
                <div className="text-xs text-[#8C857B]">
                  <span className="text-[#C4956A]">{"★".repeat(meine.sterne)}{"☆".repeat(5 - meine.sterne)}</span>
                  {meine.kommentar && <p className="mt-2 italic">„{meine.kommentar}“</p>}
                </div>
              )
            })()}
          </div>
        )}

        {/* Zugewiesener Handwerker Info */}
        {ticket.status === "in_bearbeitung" && ticket.zugewiesener_hw && (
          <div className="bg-[#5B6ABF]/5 border border-[#5B6ABF]/20 rounded-2xl p-5 mb-6">
            <div className="text-xs text-[#8C857B] mb-3 font-medium">BEAUFTRAGTER HANDWERKER</div>
            {(() => {
              const hw = alleAngebote.find(a => a.handwerker_id === ticket.zugewiesener_hw)
              if (!hw) return null
              return (
                <div className="flex items-center gap-3">
                  <Avatar name={(hw.handwerker as any)?.name || "?"} size="md" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#2D2A26]">{(hw.handwerker as any)?.name}</div>
                    <div className="text-xs text-[#8C857B]">{(hw.handwerker as any)?.firma}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#3D8B7A]">{hw.preis} EUR</div>
                    <div className="text-[10px] text-[#B5AEA4]">Angenommener Preis</div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Handwerker einladen (Verwalter, offen) */}
        {isVerwalter && ticket.status === "offen" && (
          <Card className="mb-6 bg-white border border-[#EDE8E1]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-[#2D2A26]">Handwerker einladen</h3>
              <Button size="sm" onClick={() => router.push("/dashboard-verwalter/tickets/" + id + "/handwerker")}>Handwerker auswählen</Button>
            </div>
            {einladungen.length > 0 ? (
              <div className="space-y-2">
                {einladungen.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-[#EDE8E1] last:border-0">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.handwerker?.name || "?"} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-[#2D2A26]">{e.handwerker?.name}</div>
                        <div className="text-xs text-[#8C857B]">{e.handwerker?.firma}</div>
                      </div>
                    </div>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (
                      e.status === "angebot" ? "bg-[#3D8B7A]/10 text-[#3D8B7A]" :
                      e.status === "abgelehnt" ? "bg-[#C4574B]/10 text-[#C4574B]" :
                      "bg-[#C4956A]/10 text-[#C4956A]"
                    )}>
                      {e.status === "angebot" ? "Angebot erhalten" : e.status === "abgelehnt" ? "Abgelehnt" : "Eingeladen"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#8C857B]">Noch keine Handwerker eingeladen.</p>
            )}
          </Card>
        )}

        {/* === ANGEBOTE — VERWALTER VIEW === */}
        {isVerwalter && sortiertAngebote.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#2D2A26]">
                Eingegangene Angebote
                <span className="ml-2 text-sm font-normal text-[#8C857B]">({sortiertAngebote.length})</span>
              </h2>
              {avgPreis > 0 && (
                <span className="text-xs text-[#B5AEA4] bg-[#FAF8F5] px-3 py-1 rounded-lg">
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
                    isAngenommen ? "bg-[#3D8B7A]/5 border-[#3D8B7A]/30" :
                    isAbgelehnt ? "bg-[#FAF8F5] border-[#EDE8E1] opacity-50" :
                    isTop ? "bg-gradient-to-r from-[#3D8B7A]/5 to-[#5B6ABF]/5 border-[#3D8B7A]/25 shadow-lg shadow-[#3D8B7A]/5" :
                    "bg-white border-[#EDE8E1] hover:border-[#EDE8E1]"
                  }`}>
                    <div className="p-5">
                      {/* Top row: rank + HW info + score */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar name={hw?.name || "?"} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-[#2D2A26]">{hw?.name || "Handwerker"}</span>
                              <RankBadge rank={rank} />
                              {isAngenommen && <span className="text-xs bg-[#3D8B7A]/15 text-[#3D8B7A] px-2 py-0.5 rounded-full font-medium">✓ Beauftragt</span>}
                            </div>
                            <div className="text-xs text-[#8C857B]">{hw?.firma || "Firma"}</div>
                            <div className="flex items-center gap-3 mt-1">
                              <StarRating rating={hw?.bewertung_avg || 0} />
                              {hw?.auftraege_anzahl > 0 && (
                                <span className="text-[10px] text-[#B5AEA4]">{hw.auftraege_anzahl} Aufträge</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ValueScoreRing score={a.valueScore} />
                      </div>

                      {/* Price + Details row */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-[#FAF8F5] rounded-xl p-3">
                          <div className="text-[10px] text-[#B5AEA4] mb-1">Preis</div>
                          <div className="text-lg font-bold text-[#3D8B7A]">{a.preis.toLocaleString("de")} EUR</div>
                        </div>
                        <div className="bg-[#FAF8F5] rounded-xl p-3">
                          <div className="text-[10px] text-[#B5AEA4] mb-1">Frühester Termin</div>
                          <div className="text-sm font-medium text-[#2D2A26]">
                            {a.fruehester_termin ? new Date(a.fruehester_termin).toLocaleDateString("de", { day: "2-digit", month: "2-digit" }) : "Flexibel"}
                          </div>
                        </div>
                        <div className="bg-[#FAF8F5] rounded-xl p-3">
                          <div className="text-[10px] text-[#B5AEA4] mb-1">Geschätzte Dauer</div>
                          <div className="text-sm font-medium text-[#2D2A26]">{(a as any).geschaetzte_dauer ? (a as any).geschaetzte_dauer + " Tage" : "—"}</div>
                        </div>
                      </div>

                      {/* Message */}
                      {a.nachricht && (
                        <div className="bg-[#FAF8F5] rounded-lg p-3 mb-4 border-l-2 border-[#5B6ABF]/30">
                          <div className="text-xs text-[#6B665E] italic">„{a.nachricht}“</div>
                        </div>
                      )}

                      {/* Action */}
                      {a.status === "eingereicht" && isVerwalter && (
                        <div className="flex items-center gap-3">
                          {vergebenConfirm === a.id ? (
                            <>
                              <span className="text-xs text-[#8C857B]">Wirklich an {hw?.name} vergeben?</span>
                              <Button size="sm" onClick={() => vergeben(a.id, a.handwerker_id)}>Ja, vergeben</Button>
                              <button onClick={() => setVergebenConfirm(null)} className="text-xs text-[#8C857B] hover:text-[#6B665E]">Abbrechen</button>
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
          <Card className="mb-6 bg-white border border-[#EDE8E1]">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-[#5B6ABF]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-[#5B6ABF]">[~]</span>
              </div>
              <div className="text-sm text-[#6B665E] font-medium mb-1">Warten auf Angebote</div>
              <div className="text-xs text-[#B5AEA4]">Handwerker können jetzt bieten — Angebote erscheinen hier automatisch.</div>
            </div>
          </Card>
        )}

        {/* === HANDWERKER BID FORM === */}
        {isHandwerker && !hatBereitsAngebot && ticket.status === "auktion" && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-[#3D8B7A]/8 to-[#5B6ABF]/8 border border-[#3D8B7A]/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#3D8B7A]/15 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#3D8B7A]">#</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#2D2A26]">Dein Angebot abgeben</h2>
                  <div className="text-xs text-[#8C857B]">
                    {alleAngebote.length} andere{alleAngebote.length === 1 ? "s Angebot" : " Angebote"} bereits eingegangen
                  </div>
                </div>
              </div>

              {/* KI Preisempfehlung */}
              <div className="bg-[#5B6ABF]/10 border border-[#5B6ABF]/20 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#5B6ABF] bg-[#5B6ABF]/20 px-2 py-0.5 rounded">AI</span>
                  <span className="text-xs font-medium text-[#5B6ABF]">KI-Preisempfehlung</span>
                </div>
                <div className="text-lg font-bold text-[#2D2A26]">EUR {kiPreisempfehlung(ticket.titel)}</div>
                <div className="text-[10px] text-[#B5AEA4] mt-1">Basierend auf vergleichbaren Aufträgen in deiner Region</div>
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
          <Card className="mb-6 bg-[#3D8B7A]/5 border border-[#3D8B7A]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3D8B7A]/20 flex items-center justify-center text-[#3D8B7A] font-bold text-sm">✓</div>
              <div>
                <div className="text-sm font-medium text-[#3D8B7A]">Dein Angebot wurde eingereicht</div>
                {(() => {
                  const meinAngebot = alleAngebote.find(a => a.handwerker_id === currentUser?.id)
                  if (!meinAngebot) return null
                  return (
                    <div className="text-xs text-[#8C857B] mt-0.5">
                      {meinAngebot.preis.toLocaleString("de")} EUR
                      {meinAngebot.status === "angenommen" && <span className="ml-2 text-[#3D8B7A] font-medium">— Angenommen!</span>}
                      {meinAngebot.status === "abgelehnt" && <span className="ml-2 text-[#C4574B] font-medium">— Leider nicht ausgewählt</span>}
                    </div>
                  )
                })()}
              </div>
            </div>
          </Card>
        )}

        {/* === CHAT === */}
        <Card className="bg-white border border-[#EDE8E1]">
          <h2 className="text-sm font-semibold text-[#2D2A26] mb-3">Nachrichten</h2>
          <div ref={chatRef} className="bg-[#FAF8F5] rounded-xl p-4 h-64 overflow-y-auto mb-3 flex flex-col gap-3">
            {nachrichten.length === 0 ? (
              <div className="text-xs text-[#B5AEA4] text-center py-8">Noch keine Nachrichten</div>
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
                        <span className="font-medium text-[#8C857B]">{isMe ? "Du" : (m.absender?.name || "Unbekannt")}</span>
                        {rolle && <span className="text-[9px] text-[#EDE8E1] bg-[#FAF8F5] px-1.5 py-0.5 rounded">{rolle}</span>}
                        <span className="text-[#EDE8E1]">{datum} {zeit}</span>
                      </div>
                      <div className={"text-sm px-3 py-2 rounded-xl leading-relaxed " + (
                        isMe ? "bg-[#3D8B7A] text-white" : "bg-[#FAF8F5] text-[#2D2A26]"
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

function BewertungForm({ onSubmit }: { onSubmit: (sterne: number, kommentar: string) => Promise<void> }) {
  const [sterne, setSterne] = useState(0)
  const [hover, setHover] = useState(0)
  const [kommentar, setKommentar] = useState("")
  const [saving, setSaving] = useState(false)

  async function speichern() {
    if (sterne === 0) return
    setSaving(true)
    await onSubmit(sterne, kommentar)
    setSaving(false)
  }

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-6 mb-6">
      <h3 className="text-base font-semibold text-[#2D2A26] mb-1">Wie zufrieden warst du?</h3>
      <p className="text-xs text-[#8C857B] mb-4">Deine Bewertung hilft anderen Mietern und beeinflusst das Ranking des Handwerkers.</p>

      <div className="flex items-center gap-1 mb-4" role="radiogroup" aria-label="Sterne-Bewertung">
        {[1, 2, 3, 4, 5].map(n => {
          const aktiv = n <= (hover || sterne)
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={sterne === n}
              aria-label={`${n} Stern${n === 1 ? "" : "e"}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setSterne(n)}
              className="text-3xl transition-transform hover:scale-110"
            >
              <span className={aktiv ? "text-[#C4956A]" : "text-[#EDE8E1]"}>★</span>
            </button>
          )
        })}
        {sterne > 0 && (
          <span className="ml-3 text-sm text-[#6B665E] font-medium">
            {sterne === 5 ? "Hervorragend" : sterne === 4 ? "Gut" : sterne === 3 ? "Okay" : sterne === 2 ? "Mittelmäßig" : "Schlecht"}
          </span>
        )}
      </div>

      <textarea
        value={kommentar}
        onChange={e => setKommentar(e.target.value)}
        placeholder="Kommentar (optional) — was war besonders gut, was hätte besser sein können?"
        rows={3}
        className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#8C857B]/60 focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors resize-none"
      />

      <button
        onClick={speichern}
        disabled={sterne === 0 || saving}
        className="mt-3 text-sm font-bold bg-[#3D8B7A] text-white px-5 py-2.5 rounded-xl hover:bg-[#2D6B5A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Speichert…" : "Bewertung absenden"}
      </button>
    </div>
  )
}
