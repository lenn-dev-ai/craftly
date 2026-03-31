"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile, Ticket, GEWERK_LABELS, Verfuegbarkeit, WOCHENTAGE } from "@/types"
import { Button, Card, Avatar, LoadingSpinner, Toast } from "@/components/ui"
import { berechnePreisfaktor, berechneRichtpreis } from "@/lib/preisfaktor"

export default function HandwerkerAuswahlPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [handwerker, setHandwerker] = useState<(UserProfile & { selected: boolean; verfuegbarkeiten?: Verfuegbarkeit[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState("")

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

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

      let query = supabase.from("profiles")
        .select("*")
        .eq("rolle", "handwerker")
      if (t.gewerk && t.gewerk !== "allgemein") {
        query = query.ilike("gewerk", `%${t.gewerk}%`)
      }
      const { data: hws } = await query.order("bewertung_avg", { ascending: false })

      // Verfügbarkeiten aller Handwerker laden
      const hwIds = (hws || []).map(hw => hw.id)
      const { data: alleVerf } = await supabase
        .from("verfuegbarkeiten")
        .select("*")
        .in("handwerker_id", hwIds)
        .eq("aktiv", true)

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

  function toggleHW(id: string) {
    setHandwerker(prev => prev.map(hw =>
      hw.id === id ? { ...hw, selected: !hw.selected } : hw
    ))
  }

  function selectAll() {
    setHandwerker(prev => prev.map(hw => ({ ...hw, selected: true })))
  }

  async function sendeEinladungen() {
    const selected = handwerker.filter(hw => hw.selected)
    if (selected.length === 0) { showToast("Bitte mindestens einen Handwerker auswählen."); return }
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

    const { error } = await supabase.from("einladungen").upsert(einladungen, {
      onConflict: "ticket_id,handwerker_id",
    })

    if (error) {
      showToast("Fehler beim Senden: " + error.message)
      setSending(false)
      return
    }

    await supabase.from("tickets").update({ status: "auktion" }).eq("id", ticketId)

    showToast(`${selected.length} Einladung(en) gesendet!`)
    setTimeout(() => router.push(`/ticket/${ticketId}`), 1500)
  }

  if (loading) return <LoadingSpinner />
  if (!ticket) return null

  const pf = berechnePreisfaktor(
    ticket.prioritaet as "normal" | "hoch" | "dringend",
    handwerker.length
  )
  const selectedCount = handwerker.filter(hw => hw.selected).length
  const bereitsEingeladen = (ticket.einladungen || []).length > 0

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
        ← Zurück
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-medium">Handwerker auswählen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {ticket.titel} · {GEWERK_LABELS[ticket.gewerk || "allgemein"] || ticket.gewerk}
        </p>
      </div>

      {/* Preisfaktor-Anzeige */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium mb-1">Dynamischer Marktpreis</div>
            <div className="text-xs text-gray-500">
              Dringlichkeit {pf.dringlichkeitsFaktor}× · Verfügbarkeit {pf.angebotsFaktor}×
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${pf.color}`}>
              {pf.faktor}× {pf.label}
            </span>
          </div>
        </div>
      </Card>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
        <p className="text-xs text-blue-700">
          Wähle die Handwerker aus, die du anfragen möchtest. Jeder erhält einen
          Richtpreis basierend auf Dringlichkeit und Verfügbarkeit. Sie können
          annehmen, ein Gegenangebot machen oder ablehnen.
        </p>
      </div>

      {/* Handwerker-Liste */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">
            Handwerker ({handwerker.length}) · {selectedCount} ausgewählt
          </h2>
          <button onClick={selectAll} className="text-xs text-[#1D9E75] hover:underline">
            Alle auswählen
          </button>
        </div>

        {handwerker.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">
            Keine Handwerker für dieses Gewerk gefunden.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {handwerker.map(hw => {
              const richtpreis = berechneRichtpreis(hw.basis_preis || 50, pf.faktor)
              return (
                <div
                  key={hw.id}
                  onClick={() => toggleHW(hw.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    hw.selected
                      ? "border-[#1D9E75] bg-[#E1F5EE]"
                      : "border-gray-100 bg-gray-50 hover:border-gray-200"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    hw.selected ? "bg-[#1D9E75] border-[#1D9E75]" : "border-gray-300 bg-white"
                  }`}>
                    {hw.selected && <span className="text-white text-xs">✓</span>}
                  </div>

                  <Avatar name={hw.name || "?"} size="sm" />

                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${hw.selected ? "text-[#0F6E56]" : "text-gray-800"}`}>
                      {hw.firma || hw.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {hw.bewertung_avg ? `★ ${hw.bewertung_avg}` : "Neu"}
                      {" · "}{hw.auftraege_anzahl || 0} Aufträge
                      {hw.gewerk && ` · ${GEWERK_LABELS[hw.gewerk] || hw.gewerk}`}
                    </div>
                    {/* Verfügbarkeits-Dots */}
                    {hw.verfuegbarkeiten && hw.verfuegbarkeiten.length > 0 ? (
                      <div className="flex items-center gap-0.5 mt-1">
                        <span className="text-[10px] text-gray-400 mr-1">Verf.:</span>
                        {[1,2,3,4,5,6,0].map(tag => {
                          const aktiv = hw.verfuegbarkeiten!.some(v => v.wochentag === tag)
                          return (
                            <div
                              key={tag}
                              title={`${WOCHENTAGE[tag]}${aktiv ? " verfügbar" : ""}`}
                              className={`w-4 h-4 rounded text-[9px] flex items-center justify-center font-medium ${
                                aktiv
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-50 text-gray-300"
                              }`}
                            >
                              {WOCHENTAGE[tag]}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400 mt-1">Keine Verfügbarkeit hinterlegt</div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm font-medium ${hw.selected ? "text-[#0F6E56]" : ""}`}>
                      € {richtpreis}
                    </div>
                    <div className="text-xs text-gray-400">Richtpreis</div>
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
          {sending
            ? "Wird gesendet..."
            : bereitsEingeladen
            ? `Weitere ${selectedCount} Handwerker einladen`
            : `${selectedCount} Handwerker anfragen`}
        </Button>
        <Button variant="ghost" onClick={() => router.push(`/ticket/${ticketId}`)}>
          Überspringen
        </Button>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  )
}

