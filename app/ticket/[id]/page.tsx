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
      ticket_id: id,
      handwerker_id: currentUser.id,
      preis: Number(angebotForm.preis),
      fruehester_termin: angebotForm.termin || null,
      geschaetzte_dauer: angebotForm.dauer || null,
      nachricht: angebotForm.nachricht || null,
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
    await load()
  }

  const [kostenFinal, setKostenFinal] = useState("")
  const [showKosten, setShowKosten] = useState(false)

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
    .map(a => ({ ...a, valueScore: berechneValueScore(a, alleAngebote) }))
    .sort((a, b) => b.valueScore - a.valueScore)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-300 mb-4 flex items-center gap-1">
        &larr; Zurück
      </button>

      {/* Header */}
      <Card className="mb-4 bg-[#12121a] border border-white/5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <h1 className="text-lg font-medium text-white">{ticket.titel}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {ticket.wohnung && <span className="text-xs text-gray-400">{ticket.wohnung}</span>}
              <Badge status={ticket.status} />
              <PrioBadge prio={ticket.prioritaet} />
              {ticket.status === "auktion" && ticket.auktion_ende && <Timer end={ticket.auktion_ende} />}
            </div>
          </div>

          {isVerwalter && ticket.status === "offen" && (
            <Card className="mt-4 bg-[#0a0a0f] border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-200">Handwerker einladen</h3>
                <Button size="sm" onClick={() => router.push("/dashboard-verwalter/tickets/" + id + "/handwerker")}>
                  Handwerker auswählen
                </Button>
              </div>
              {einladungen.length > 0 ? (
                <div className="space-y-2">
                  {einladungen.map(e => (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <Avatar name={e.handwerker?.name || "?"} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-gray-200">{e.handwerker?.name}</div>
                          <div className="text-xs text-gray-500">{e.handwerker?.firma}</div>
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
                <p className="text-sm text-gray-500">Noch keine Handwerker eingeladen.</p>
              )}
            </Card>
          )}

          {isVerwalter && ticket.status === "in_bearbeitung" && !showKosten && (
            <Button size="sm" onClick={() => setShowKosten(true)}>Abschließen</Button>
          )}
        </div>
        {ticket.beschreibung && (
          <p className="text-sm text-gray-400 leading-relaxed">{ticket.beschreibung}</p>
        )}
      </Card>

      {/* Auktions-Info */}
      {ticket.status === "auktion" && (
        <Card className="mb-4 bg-gradient-to-r from-[#00D4AA]/5 to-[#00B4D8]/5 border border-[#00D4AA]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00D4AA]/20 flex items-center justify-center">
                <span className="text-sm font-bold text-[#00D4AA]">AI</span>
              </div>
              <div>
                <div className="text-sm font-medium text-[#00D4AA]">Smart-Auktion läuft</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {sortiertAngebote.length} Angebot{sortiertAngebote.length !== 1 ? "e" : ""} eingegangen
                  {ticket.auktion_ende && (" — Endet " + new Date(ticket.auktion_ende).toLocaleDateString("de", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}
                </div>
              </div>
            </div>
            {ticket.auktion_ende && <Timer end={ticket.auktion_ende} />}
          </div>
        </Card>
      )}

      {/* Kosten-Eingabe beim Abschließen */}
      {showKosten && (
        <Card className="mb-4 border-[#00D4AA] bg-[#12121a]">
          <h2 className="text-sm font-medium text-gray-200 mb-2">Ticket abschließen</h2>
          <p className="text-xs text-gray-500 mb-3">Trage die tatsächlichen Kosten ein, bevor du das Ticket abschließt.</p>
          <Input label="Endkosten in EUR" type="number" placeholder="z.B. 450"
            value={kostenFinal} onChange={e => setKostenFinal(e.target.value)} />
          <div className="flex gap-2 mt-3">
            <Button onClick={abschliessen}>Abschließen & Speichern</Button>
            <button onClick={() => setShowKosten(false)} className="text-sm text-gray-500 hover:text-gray-300 px-3">Abbrechen</button>
          </div>
        </Card>
      )}

      {/* Angebote Section */}
      {isVerwalter && (
        <Card className="mb-4 bg-[#12121a] border border-white/5">
          <h2 className="text-sm font-medium text-gray-200 mb-4">Eingegangene Angebote ({sortiertAngebote.length})</h2>
          {sortiertAngebote.length === 0 ? (
            <p className="text-xs text-gray-500">Noch keine Angebote eingegangen.</p>
          ) : (
            <div className="space-y-3">
              {sortiertAngebote.map(a => (
                <div key={a.id} className="flex items-start justify-between p-3 bg-[#0a0a0f] rounded-lg border border-white/5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar name={(a.handwerker as any)?.name || "?"} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-white">{(a.handwerker as any)?.name}</div>
                        <div className="text-xs text-gray-500">{(a.handwerker as any)?.firma}</div>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#00D4AA]">{a.preis} EUR</span>
                        <span className="text-xs bg-[#00D4AA]/10 text-[#00D4AA] px-2 py-1 rounded">Score: {a.valueScore}%</span>
                      </div>
                    </div>
                    {a.fruehester_termin && <div className="text-xs text-gray-400">Ab: {new Date(a.fruehester_termin).toLocaleDateString("de")}</div>}
                    {a.nachricht && <div className="text-xs text-gray-400 mt-1 italic">\"{a.nachricht}\"</div>}
                  </div>
                  {a.status === "eingereicht" && (
                    <Button size="sm" onClick={() => vergeben(a.id, a.handwerker_id)}>Vergeben</Button>
                  )}
                  {a.status === "angenommen" && <span className="text-xs text-[#00D4AA] font-medium">Angenommen</span>}
                  {a.status === "abgelehnt" && <span className="text-xs text-gray-500 font-medium">Abgelehnt</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Handwerker Angebot Section */}
      {isHandwerker && !hatBereitsAngebot && ticket.status === "auktion" && (
        <Card className="mb-4 bg-[#12121a] border border-white/5">
          <h2 className="text-sm font-medium text-gray-200 mb-3">Dein Angebot</h2>
          <div className="space-y-3">
            <Input label="Preis (EUR)" type="number" placeholder="z.B. 450"
              value={angebotForm.preis} onChange={e => setAngebotForm({ ...angebotForm, preis: e.target.value })} />
            <Input label="Frühester Termin" type="date"
              value={angebotForm.termin} onChange={e => setAngebotForm({ ...angebotForm, termin: e.target.value })} />
            <Input label="Geschätzte Dauer (Tage)" type="number" placeholder="z.B. 2"
              value={angebotForm.dauer} onChange={e => setAngebotForm({ ...angebotForm, dauer: e.target.value })} />
            <Input label="Nachricht (Optional)" type="text" placeholder="z.B. Material inklusive"
              value={angebotForm.nachricht} onChange={e => setAngebotForm({ ...angebotForm, nachricht: e.target.value })} />
            <Button onClick={submitAngebot} disabled={submittingBid}>{submittingBid ? "Wird eingereicht..." : "Angebot einreichen"}</Button>
          </div>
        </Card>
      )}

      {/* Chat Section */}
      <Card className="bg-[#12121a] border border-white/5">
        <h2 className="text-sm font-medium text-gray-200 mb-3">Nachrichten</h2>
        <div ref={chatRef} className="bg-[#0a0a0f] rounded-lg p-4 h-64 overflow-y-auto mb-3 flex flex-col gap-3">
          {nachrichten.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-8">Noch keine Nachrichten</div>
          ) : nachrichten.map(m => {
            const isMe = m.absender_id === currentUser?.id
            const zeit = new Date(m.created_at).toLocaleTimeString("de", { hour: "2-digit", minute: "2-digit" })
            const datum = new Date(m.created_at).toLocaleDateString("de", { day: "2-digit", month: "2-digit" })
            return (
              <div key={m.id} className={"flex " + (isMe ? "justify-end" : "justify-start")}>
                <div className={"max-w-xs " + (isMe ? "" : "flex gap-2 items-end")}>
                  {!isMe && <Avatar name={m.absender?.name || "?"} size="sm" />}
                  <div>
                    <div className={"text-[10px] mb-0.5 flex items-center gap-1.5 " + (isMe ? "justify-end" : "")}>
                      <span className="font-medium text-gray-400">{isMe ? "Du" : (m.absender?.name || "Unbekannt")}</span>
                      <span className="text-gray-600">{datum} {zeit}</span>
                    </div>
                    <div className={"text-sm px-3 py-2 rounded-xl leading-relaxed " + (
                      isMe ? "bg-[#00D4AA] text-black" : "bg-white/5 text-gray-200"
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
          <Input placeholder="Nachricht..." value={chatText}
            onChange={e => setChatText(e.target.value)}
            onKeyPress={e => e.key === "Enter" && sendChat()} />
          <Button onClick={sendChat} disabled={sending}>{sending ? "..." : "Senden"}</Button>
        </div>
      </Card>
    </div>
  )
}
