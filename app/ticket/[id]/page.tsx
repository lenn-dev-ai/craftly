"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, Angebot, Nachricht, UserProfile, Einladung } from "@/types"
import { Badge, PrioBadge, Avatar, Button, Card, Input, LoadingSpinner } from "@/components/ui"
import { Timer } from "@/components/ui/Timer"

export default function TicketDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([])
  const [chatText, setChatText] = useState("")
  const [angebotForm, setAngebotForm] = useState({ preis: "", termin: "", nachricht: "" })
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
      ticket_id: id, handwerker_id: currentUser.id,
      preis: Number(angebotForm.preis),
      fruehester_termin: angebotForm.termin || null,
      nachricht: angebotForm.nachricht || null,
      status: "eingereicht",
    })
    setAngebotForm({ preis: "", termin: "", nachricht: "" })
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

  const hasEinladungen = einladungen.length > 0
  const isVerwalter = currentUser?.rolle === "verwalter" || currentUser?.rolle === "admin"
  const isHandwerker = currentUser?.rolle === "handwerker"
  const hatBereitsAngebot = ticket.angebote?.some(a => a.handwerker_id === currentUser?.id)
  const sortiertAngebote = [...(ticket.angebote || [])].sort((a, b) => a.preis - b.preis)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
        ← Zurück
      </button>

      {/* Header */}
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <h1 className="text-lg font-medium">{ticket.titel}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {ticket.wohnung && <span className="text-xs text-gray-500">{ticket.wohnung}</span>}
              <Badge status={ticket.status} />
              <PrioBadge prio={ticket.prioritaet} />
              {ticket.status === "auktion" && ticket.auktion_ende && <Timer end={ticket.auktion_ende} />}
            </div>
          </div>
          {isVerwalter && ticket.status === "offen" && (
          <Card className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-800">Handwerker einladen</h3>
              <Button size="sm" onClick={() => router.push(`/dashboard-verwalter/tickets/${id}/handwerker`)}>
                Handwerker auswählen
              </Button>
            </div>
            {einladungen.length > 0 ? (
              <div className="space-y-2">
                {einladungen.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.handwerker?.name || "?"} size="sm" />
                      <div>
                        <div className="text-sm font-medium">{e.handwerker?.name}</div>
                        <div className="text-xs text-gray-500">{e.handwerker?.firma}</div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      e.status === "angebot" ? "bg-green-50 text-green-700" :
                      e.status === "abgelehnt" ? "bg-red-50 text-red-700" :
                      "bg-amber-50 text-amber-700"
                    }`}>
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
          <p className="text-sm text-gray-600 leading-relaxed">{ticket.beschreibung}</p>
        )}
      </Card>

      {/* Kosten-Eingabe beim Abschließen */}
      {showKosten && (
        <Card className="mb-4 border-[#1D9E75]">
          <h2 className="text-sm font-medium mb-2">Ticket abschließen</h2>
          <p className="text-xs text-gray-500 mb-3">Trage die tatsächlichen Kosten ein, bevor du das Ticket abschließt.</p>
          <Input label="Endkosten in €" type="number" placeholder="z.B. 450"
            value={kostenFinal} onChange={e => setKostenFinal(e.target.value)} />
          <div className="flex gap-2 mt-3">
            <Button onClick={abschliessen}>Abschließen & Speichern</Button>
            <button onClick={() => setShowKosten(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3">Abbrechen</button>
          </div>
        </Card>
      )}

      {/* Angebote (Verwalter-Ansicht) */}
      {isVerwalter && (
        <Card className="mb-4">
          <h2 className="text-sm font-medium mb-3">
            Angebote {sortiertAngebote.length > 0 && `(${sortiertAngebote.length})`}
          </h2>
          {sortiertAngebote.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">Noch keine Angebote eingegangen.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sortiertAngebote.map((a, i) => (
                <div key={a.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    i === 0 ? "border-[#1D9E75] bg-[#E1F5EE]" : "border-gray-100 bg-gray-50"}`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={a.handwerker?.name || "?"} size="sm" />
                    <div>
                      <div className={`text-sm font-medium ${i === 0 ? "text-[#0F6E56]" : ""}`}>
                        {a.handwerker?.firma || a.handwerker?.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {a.handwerker?.bewertung_avg ? `★ ${a.handwerker.bewertung_avg} · ` : ""}
                        {a.fruehester_termin ? new Date(a.fruehester_termin).toLocaleDateString("de") : "Termin flexibel"}
                      </div>
                      {a.nachricht && <div className="text-xs text-gray-500 mt-0.5 italic">"{a.nachricht}"</div>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-base font-medium ${i === 0 ? "text-[#0F6E56]" : ""}`}>€ {a.preis.toLocaleString("de")}</div>
                    {ticket.status !== "erledigt" && ticket.status !== "in_bearbeitung" && (
                      <Button size="sm" className="mt-1" onClick={() => vergeben(a.id, a.handwerker_id)}>
                        Vergeben
                      </Button>
                    )}
                    {a.status === "angenommen" && (
                      <span className="text-xs text-[#0F6E56] font-medium">✓ Beauftragt</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Angebot abgeben (Handwerker) */}
      {isHandwerker && ticket.status === "auktion" && !hatBereitsAngebot && (
        <Card className="mb-4">
          <h2 className="text-sm font-medium mb-3">Angebot einreichen</h2>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Preis in €" type="number" placeholder="380" value={angebotForm.preis}
                onChange={e => setAngebotForm(f => ({ ...f, preis: e.target.value }))} />
              <Input label="Frühester Termin" type="date" value={angebotForm.termin}
                onChange={e => setAngebotForm(f => ({ ...f, termin: e.target.value }))} />
            </div>
            <Input label="Kurze Nachricht (optional)" placeholder="z.B. Spezialist für Gasheizungen"
              value={angebotForm.nachricht} onChange={e => setAngebotForm(f => ({ ...f, nachricht: e.target.value }))} />
            <Button onClick={submitAngebot} disabled={submittingBid || !angebotForm.preis}>
              {submittingBid ? "Wird eingereicht..." : "Angebot abgeben"}
            </Button>
          </div>
        </Card>
      )}

      {isHandwerker && hatBereitsAngebot && (
        <Card className="mb-4">
          <div className="text-center py-3">
            <div className="text-[#1D9E75] font-medium text-sm mb-1">Angebot eingereicht ✓</div>
            <div className="text-xs text-gray-500">Du wirst benachrichtigt wenn du ausgewählt wirst.</div>
          </div>
        </Card>
      )}

      {/* Chat */}
      <Card>
        <h2 className="text-sm font-medium mb-3">Chat</h2>
        <div ref={chatRef} className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-3 pr-1">
          {nachrichten.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Noch keine Nachrichten. Starte das Gespräch.</p>
          ) : nachrichten.map(m => {
            const isMe = m.absender_id === currentUser?.id
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-xs ${isMe ? "" : "flex gap-2 items-end"}`}>
                  {!isMe && <Avatar name={m.absender?.name || "?"} size="sm" />}
                  <div>
                    {!isMe && <div className="text-xs text-gray-400 mb-1">{m.absender?.name}</div>}
                    <div className={`text-sm px-3 py-2 rounded-xl leading-relaxed ${
                      isMe ? "bg-[#1D9E75] text-white" : "bg-gray-100 text-gray-800"}`}>
                      {m.text}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2">
          <input value={chatText} onChange={e => setChatText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
            placeholder="Nachricht schreiben..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" />
          <Button onClick={sendChat} disabled={sending || !chatText.trim()} size="sm">
            Senden
          </Button>
        </div>
      </Card>
    </div>
  )
}
