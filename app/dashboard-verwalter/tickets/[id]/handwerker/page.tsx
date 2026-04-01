"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile, Ticket, GEWERK_LABELS, Verfuegbarkeit, WOCHENTAGE } from "@/types"
import { Button, Card, Avatar, LoadingSpinner, Toast } from "@/components/ui"
import { berechnePreisfaktor, berechneRichtpreis } from "@/lib/preisfaktor"

type VergabeModus = "sofort" | "auktion" | "plan"

const MODUS_CONFIG: Record<VergabeModus, { label: string; color: string; bgColor: string; desc: string }> = {
  sofort: { label: "Sofort-Vergabe", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20", desc: "Schnellste Antwort wird bevorzugt" },
  auktion: { label: "Smart-Auktion", color: "text-[#00D4AA]", bgColor: "bg-[#00D4AA]/10 border-[#00D4AA]/20", desc: "Preis + Termin + Qualitaet im Wettbewerb" },
  plan: { label: "Planauftrag", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20", desc: "Guenstigster Preis bei flexibler Planung" },
}

export default function HandwerkerAuswahlPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [handwerker, setHandwerker] = useState<(UserProfile & { selected: boolean; verfuegbarkeiten?: Verfuegbarkeit[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState("")

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000) }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data: t } = await supabase.from("tickets")
        .select("*, einladungen(*, handwerker:profiles(*))")
        .eq("id", ticketId).single()
      if (!t) { router.push("/dashboard-verwalter"); return }
      setTicket(t)

      let query = supabase.from("profiles").select("*").eq("rolle", "handwerker")
      if (t.gewerk && t.gewerk !== "allgemein") {
        query = query.ilike("gewerk", `%${t.gewerk}%`)
      }
      const { data: hws } = await query.order("bewertung_avg", { ascending: false })

      const hwIds = (hws || []).map(hw => hw.id)
      const { data: alleVerf } = await supabase.from("verfuegbarkeiten").select("*").in("handwerker_id", hwIds).eq("aktiv", true)

      const verfMap = new Map<string, Verfuegbarkeit[]>()
      ;(alleVerf || []).forEach((v: Verfuegbarkeit) => {
        if (!verfMap.has(v.handwerker_id)) verfMap.set(v.handwerker_id, [])
        verfMap.get(v.handwerker_id)!.push(v)
      })

      const bereitsEingeladen = new Set((t.einladungen || []).map((e: any) => e.handwerker_id))
      setHandwerker((hws || []).map(hw => ({
        ...hw,
        selected: bereitsEingeladen.has(hw.id),
        verfuegbarkeiten: verfMap.get(hw.id) || [],
      })))
      setLoading(false)
    }
    load()
  }, [ticketId, router])

  async function loadOhneFilter() {
    const supabase = createClient()
    const { data: hws } = await supabase.from("profiles").select("*").eq("rolle", "handwerker").order("bewertung_avg", { ascending: false })
    const hwIds = (hws || []).map(hw => hw.id)
    const { data: alleVerf } = await supabase.from("verfuegbarkeiten").select("*").in("handwerker_id", hwIds).eq("aktiv", true)
    const verfMap = new Map<string, Verfuegbarkeit[]>()
    ;(alleVerf || []).forEach((v: Verfuegbarkeit) => {
      if (!verfMap.has(v.handwerker_id)) verfMap.set(v.handwerker_id, [])
      verfMap.get(v.handwerker_id)!.push(v)
    })
    const bereitsEingeladen = ticket ? new Set((ticket.einladungen || []).map((e: any) => e.handwerker_id)) : new Set()
    setHandwerker((hws || []).map(hw => ({
      ...hw,
      selected: bereitsEingeladen.has(hw.id),
      verfuegbarkeiten: verfMap.get(hw.id) || [],
    })))
  }

  function toggleHW(id: string) {
    setHandwerker(prev => prev.map(hw => hw.id === id ? { ...hw, selected: !hw.selected } : hw))
  }

  function selectAll() {
    setHandwerker(prev => prev.map(hw => ({ ...hw, selected: true })))
  }

  async function sendeEinladungen() {
    const selected = handwerker.filter(hw => hw.selected)
    if (selected.length === 0) { showToast("Bitte mindestens einen Handwerker auswaehlen."); return }
    setSending(true)
    const supabase = createClient()
    const pf = berechnePreisfaktor(
      (ticket?.prioritaet || "normal") as "normal" | "hoch" | "dringend",
      handwerker.length
    )
    const einladungen = selected.map(hw => ({
      ticket_id: ticketId,
      handwerker_id: hw.id,
      status: "offen",
      empfohlener_preis: berechneRichtpreis(hw.basis_preis || 50, pf.faktor),
    }))
    const { error } = await supabase.from("einladungen").upsert(einladungen, { onConflict: "ticket_id,handwerker_id" })
    if (error) { showToast("Fehler beim Senden: " + error.message); setSending(false); return }
    const modus = (ticket as any)?.vergabe_modus || "auktion"
    await supabase.from("tickets").update({ status: modus === "sofort" ? "in_bearbeitung" : "auktion" }).eq("id", ticketId)
    showToast(selected.length + " Einladung(en) gesendet!")
    setTimeout(() => router.push("/ticket/" + ticketId), 1500)
  }

  if (loading) return <LoadingSpinner />
  if (!ticket) return null

  const modus: VergabeModus = ((ticket as any)?.vergabe_modus as VergabeModus) || "auktion"
  const modusInfo = MODUS_CONFIG[modus]
  const pf = berechnePreisfaktor(ticket.prioritaet as "normal" | "hoch" | "dringend", handwerker.length)
  const selectedCount = handwerker.filter(hw => hw.selected).length
  const bereitsEingeladen = (ticket.einladungen || []).length > 0

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-300 mb-4 flex items-center gap-1">
        &larr; Zurueck
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-medium text-white">Handwerker auswaehlen</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {ticket.titel} -- {GEWERK_LABELS[ticket.gewerk || "allgemein"] || ticket.gewerk}
        </p>
      </div>

      {/* Vergabemodus Badge */}
      <div className={"mb-4 px-4 py-3 rounded-xl border " + modusInfo.bgColor}>
        <div className="flex items-center justify-between">
          <div>
            <span className={"text-sm font-semibold " + modusInfo.color}>{modusInfo.label}</span>
            <p className="text-xs text-gray-400 mt-0.5">{modusInfo.desc}</p>
          </div>
          {modus === "sofort" && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Eilauftrag</span>
          )}
          {modus === "plan" && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Flexibel</span>
          )}
        </div>
      </div>

      {/* Preisfaktor-Anzeige */}
      <Card className="mb-4 bg-[#12121a] border border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-200 mb-1">Dynamischer Marktpreis</div>
            <div className="text-xs text-gray-500">
              Dringlichkeit {pf.dringlichkeitsFaktor}x -- Verfuegbarkeit {pf.angebotsFaktor}x
            </div>
          </div>
          <div className="text-right">
            <span className={"text-xs font-medium px-2.5 py-1 rounded-full " + pf.color}>
              {pf.faktor}x {pf.label}
            </span>
          </div>
        </div>
      </Card>

      {/* Info */}
      <div className="bg-[#00D4AA]/5 border border-[#00D4AA]/10 rounded-xl px-4 py-3 mb-4">
        <p className="text-xs text-gray-400">
          {modus === "sofort"
            ? "Sofort-Vergabe: Der erste Handwerker, der annimmt, erhaelt den Auftrag. Hoehere Preise fuer schnelle Reaktion."
            : modus === "plan"
            ? "Planauftrag: Handwerker koennen in Ruhe kalkulieren. Guenstigere Preise bei flexiblem Zeitfenster."
            : "Smart-Auktion: Handwerker bieten mit Preis, Termin und Dauer. Der beste Value-Score gewinnt."}
        </p>
      </div>

      {/* Handwerker-Liste */}
      <Card className="mb-4 bg-[#12121a] border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-200">
            Handwerker ({handwerker.length}) -- {selectedCount} ausgewaehlt
          </h2>
          <button onClick={selectAll} className="text-xs text-[#00D4AA] hover:underline">
            Alle auswaehlen
          </button>
        </div>

        {handwerker.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F59E0B]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-[#F59E0B]">[?]</span>
            </div>
            <div className="text-white/60 text-sm font-medium mb-1">Keine Handwerker fuer dieses Gewerk gefunden</div>
            <div className="text-white/30 text-xs mb-4">
              Fuer "{GEWERK_LABELS[ticket.gewerk || "allgemein"] || ticket.gewerk}" sind aktuell keine Handwerker registriert.
            </div>
            <button onClick={loadOhneFilter}
              className="text-xs text-[#00D4AA] border border-[#00D4AA]/20 px-4 py-2 rounded-lg hover:bg-[#00D4AA]/10 transition-colors">
              Alle Handwerker anzeigen (ohne Gewerk-Filter)
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {handwerker.map(hw => {
              const richtpreis = berechneRichtpreis(hw.basis_preis || 50, pf.faktor)
              return (
                <div key={hw.id} onClick={() => toggleHW(hw.id)}
                  className={"flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all " + (
                    hw.selected ? "border-[#00D4AA]/40 bg-[#00D4AA]/5" : "border-white/5 bg-[#0a0a0f] hover:border-white/10"
                  )}>
                  <div className={"w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors " + (
                    hw.selected ? "bg-[#00D4AA] border-[#00D4AA]" : "border-gray-600 bg-transparent"
                  )}>
                    {hw.selected && <span className="text-black text-xs font-bold">ok</span>}
                  </div>
                  <Avatar name={hw.name || "?"} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className={"text-sm font-medium " + (hw.selected ? "text-[#00D4AA]" : "text-gray-200")}>
                      {hw.firma || hw.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {hw.bewertung_avg ? ("* " + hw.bewertung_avg) : "Neu"}
                      {" -- "}{hw.auftraege_anzahl || 0} Auftraege
                      {hw.gewerk && (" -- " + (GEWERK_LABELS[hw.gewerk] || hw.gewerk))}
                    </div>
                    {/* Verfuegbarkeits-Dots */}
                    {hw.verfuegbarkeiten && hw.verfuegbarkeiten.length > 0 ? (
                      <div className="flex items-center gap-0.5 mt-1">
                        <span className="text-[10px] text-gray-600 mr-1">Verf.:</span>
                        {[1,2,3,4,5,6,0].map(tag => {
                          const aktiv = hw.verfuegbarkeiten!.some(v => v.wochentag === tag)
                          return (
                            <div key={tag} title={WOCHENTAGE[tag] + (aktiv ? " verfuegbar" : "")}
                              className={"w-4 h-4 rounded text-[9px] flex items-center justify-center font-medium " + (
                                aktiv ? "bg-[#00D4AA]/20 text-[#00D4AA]" : "bg-white/5 text-gray-600"
                              )}>
                              {WOCHENTAGE[tag]}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-600 mt-1">Keine Verfuegbarkeit hinterlegt</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={"text-sm font-medium " + (hw.selected ? "text-[#00D4AA]" : "text-gray-300")}>
                      EUR {richtpreis}
                    </div>
                    <div className="text-xs text-gray-600">Richtpreis</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={sendeEinladungen} disabled={sending || selectedCount === 0}>
          {sending ? "Wird gesendet..." :
            bereitsEingeladen
              ? "Weitere " + selectedCount + " Handwerker einladen"
              : selectedCount + " Handwerker anfragen"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/ticket/" + ticketId)}>
          Ueberspringen
        </Button>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  )
}
