"use client"
import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile, Ticket, GEWERK_LABELS } from "@/types"
import { LoadingSpinner, Toast } from "@/components/ui"
import { berechnePreisfaktor, berechneRichtpreis } from "@/lib/preisfaktor"
import { haversineKm, schaetzeFahrzeitMin, formatiereDistanz, formatiereFahrzeit } from "@/lib/distance"
import { analysiereRoute, routenLabel, routenFarbe, type Termin as RouteTermin } from "@/lib/route-optimizer"
import DistanceBadge from "@/components/DistanceBadge"

type SortKey = "effektiv" | "stundensatz" | "distanz" | "bewertung" | "score"

type HandwerkerPlus = UserProfile & {
  selected: boolean
  // berechnet
  distanzKm: number | null
  fahrzeitMin: number | null
  routenScore: number | null
  effektivPreis: number | null
  istFavorit: boolean
}

export default function HandwerkerAuswahlPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [handwerker, setHandwerker] = useState<HandwerkerPlus[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("effektiv")

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
      const liste = hws || []
      const hwIds = liste.map(hw => hw.id)

      // Lade Tages-Termine + Privat-Termine für jeden Handwerker (heute)
      const heute = new Date().toISOString().slice(0, 10)
      const [{ data: alleTermine }, { data: allePrivat }] = await Promise.all([
        supabase.from("termine").select("*").in("handwerker_id", hwIds).eq("datum", heute),
        supabase.from("private_termine").select("*").in("handwerker_id", hwIds).eq("datum", heute),
      ])
      const termineMap = new Map<string, RouteTermin[]>()
      for (const tt of alleTermine || []) {
        const r: RouteTermin = {
          von: tt.von?.slice(0, 5) || "08:00",
          bis: tt.bis?.slice(0, 5) || "10:00",
          lat: tt.einsatzort_lat,
          lng: tt.einsatzort_lng,
          adresse: tt.einsatzort_adresse || "",
          typ: "auftrag",
          titel: tt.titel,
        }
        if (r.lat == null || r.lng == null) continue
        const arr = termineMap.get(tt.handwerker_id) || []
        arr.push(r)
        termineMap.set(tt.handwerker_id, arr)
      }
      for (const pt of allePrivat || []) {
        const r: RouteTermin = {
          von: pt.von?.slice(0, 5) || "12:00",
          bis: pt.bis?.slice(0, 5) || "13:00",
          lat: pt.lat,
          lng: pt.lng,
          adresse: pt.adresse || "",
          typ: "privat",
          titel: pt.bezeichnung,
        }
        if (r.lat == null || r.lng == null) continue
        const arr = termineMap.get(pt.handwerker_id) || []
        arr.push(r)
        termineMap.set(pt.handwerker_id, arr)
      }

      const bereitsEingeladen = new Set((t.einladungen || []).map((e: { handwerker_id: string }) => e.handwerker_id))
      const ticketLat = t.einsatzort_lat
      const ticketLng = t.einsatzort_lng
      const dauerStunden = 2 // Default-Annahme; spaeter aus Ticket
      const dauerMin = dauerStunden * 60

      const erweitert: HandwerkerPlus[] = liste.map(hw => {
        let distanzKm: number | null = null
        let fahrzeitMin: number | null = null
        let routenScore: number | null = null
        let effektivPreis: number | null = null

        // Ausgangspunkt: Startort > Werkstatt-Lat
        const ausgangLat = hw.startort_lat ?? hw.lat
        const ausgangLng = hw.startort_lng ?? hw.lng

        if (ticketLat != null && ticketLng != null && ausgangLat != null && ausgangLng != null) {
          // Einfache Distanz Startort → Einsatzort als Fallback
          distanzKm = haversineKm(ausgangLat, ausgangLng, ticketLat, ticketLng)
          fahrzeitMin = schaetzeFahrzeitMin(distanzKm)

          // Route-Analyse mit Tagesterminen
          const termineHW = termineMap.get(hw.id) || []
          const stundensatz = hw.basis_stundensatz ?? hw.basis_preis ?? 50
          const fkmFallback = hw.fahrtkosten_pro_km ?? 0.5

          const analysen = analysiereRoute({
            termineDesTages: termineHW,
            startort: { lat: ausgangLat, lng: ausgangLng },
            neuerEinsatzort: { lat: ticketLat, lng: ticketLng },
            dauerMinuten: dauerMin,
            basisStundensatz: stundensatz,
            fahrtkostenProKm: fkmFallback,
          })
          if (analysen.length > 0) {
            const beste = analysen[0]
            routenScore = beste.routenScore
            effektivPreis = beste.effektivPreis
            fahrzeitMin = beste.fahrzeitVorher
          } else {
            // Keine Lücke → einfache Berechnung
            effektivPreis = Math.round((stundensatz + distanzKm * fkmFallback) * 100) / 100
            routenScore = distanzKm <= 5 ? 80 : distanzKm <= 15 ? 50 : 20
          }
        }

        return {
          ...hw,
          selected: bereitsEingeladen.has(hw.id),
          distanzKm,
          fahrzeitMin,
          routenScore,
          effektivPreis,
          istFavorit: false, // TODO: aus DB laden wenn Favoriten implementiert
        }
      })

      setHandwerker(erweitert)
      setLoading(false)
    }
    load()
  }, [ticketId, router])

  const sortiert = useMemo(() => {
    const liste = [...handwerker]
    liste.sort((a, b) => {
      if (sortKey === "effektiv") {
        return (a.effektivPreis ?? Infinity) - (b.effektivPreis ?? Infinity)
      }
      if (sortKey === "stundensatz") {
        return (a.basis_stundensatz ?? a.basis_preis ?? Infinity) - (b.basis_stundensatz ?? b.basis_preis ?? Infinity)
      }
      if (sortKey === "distanz") {
        return (a.distanzKm ?? Infinity) - (b.distanzKm ?? Infinity)
      }
      if (sortKey === "bewertung") {
        return (b.bewertung_avg ?? 0) - (a.bewertung_avg ?? 0)
      }
      if (sortKey === "score") {
        return (b.routenScore ?? -1) - (a.routenScore ?? -1)
      }
      return 0
    })
    return liste
  }, [handwerker, sortKey])

  function toggleHW(id: string) {
    setHandwerker(prev => prev.map(hw => hw.id === id ? { ...hw, selected: !hw.selected } : hw))
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
      empfohlener_preis: berechneRichtpreis(hw.basis_stundensatz ?? hw.basis_preis ?? 50, pf.faktor),
    }))
    const { error } = await supabase.from("einladungen").upsert(einladungen, { onConflict: "ticket_id,handwerker_id" })
    if (error) { showToast("Fehler beim Senden: " + error.message); setSending(false); return }
    await supabase.from("tickets").update({ status: "auktion" }).eq("id", ticketId)
    showToast(selected.length + " Einladung(en) gesendet!")
    setTimeout(() => router.push("/ticket/" + ticketId), 1500)
  }

  if (loading) return <LoadingSpinner />
  if (!ticket) return null

  const selectedCount = handwerker.filter(hw => hw.selected).length

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto pt-16 md:pt-8">
      <button onClick={() => router.back()} className="text-sm text-[#6B665E] hover:text-[#2D2A26] mb-4 flex items-center gap-1">
        ← Zurück
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D2A26]">Handwerker auswählen</h1>
        <p className="text-sm text-[#8C857B] mt-1">
          {ticket.titel} — {GEWERK_LABELS[ticket.gewerk || "allgemein"] || ticket.gewerk}
        </p>
        {ticket.einsatzort_adresse && (
          <p className="text-xs text-[#8C857B] mt-1.5 flex items-center gap-1">
            📍 <span>{ticket.einsatzort_adresse}</span>
          </p>
        )}
      </div>

      {/* Sort-Bar */}
      <div className="bg-white rounded-2xl border border-[#EDE8E1] p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8C857B] font-medium">Sortieren:</span>
            <div className="flex flex-wrap gap-1">
              {([
                { k: "effektiv", l: "Effektivpreis" },
                { k: "stundensatz", l: "Stundensatz" },
                { k: "distanz", l: "Entfernung" },
                { k: "bewertung", l: "Bewertung" },
                { k: "score", l: "Routen-Score" },
              ] as { k: SortKey; l: string }[]).map(s => (
                <button
                  key={s.k}
                  onClick={() => setSortKey(s.k)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    sortKey === s.k
                      ? "bg-[#3D8B7A] text-white"
                      : "bg-[#FAF8F5] text-[#6B665E] hover:bg-[#EDE8E1]"
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-[#8C857B]">{handwerker.length} verfügbar</span>
        </div>
      </div>

      {/* Handwerker-Liste */}
      {sortiert.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EDE8E1] p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FAF1DE] flex items-center justify-center mb-3">
            <span className="text-xl">⚠</span>
          </div>
          <div className="text-sm font-medium text-[#2D2A26] mb-1">Keine Handwerker gefunden</div>
          <div className="text-xs text-[#8C857B]">
            Für „{GEWERK_LABELS[ticket.gewerk || "allgemein"] || ticket.gewerk}“ sind aktuell keine Handwerker registriert.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {sortiert.map(hw => {
            const stundensatz = hw.basis_stundensatz ?? hw.basis_preis
            const farben = hw.routenScore != null ? routenFarbe(hw.routenScore) : null
            const label = hw.routenScore != null ? routenLabel(hw.routenScore) : null

            return (
              <button
                key={hw.id}
                onClick={() => toggleHW(hw.id)}
                aria-pressed={hw.selected}
                className={`text-left bg-white rounded-2xl border p-5 transition-all ${
                  hw.selected
                    ? "border-[#3D8B7A] bg-[#3D8B7A]/5 shadow-sm"
                    : "border-[#EDE8E1] hover:border-[#3D8B7A]/30 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded border-2 mt-1 flex items-center justify-center flex-shrink-0 transition-colors ${
                    hw.selected ? "bg-[#3D8B7A] border-[#3D8B7A]" : "border-[#EDE8E1] bg-white"
                  }`}>
                    {hw.selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header: Name + Bewertung */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-base font-semibold text-[#2D2A26]">{hw.firma || hw.name}</div>
                        <div className="text-xs text-[#8C857B] mt-0.5">
                          {hw.bewertung_avg ? <span className="text-[#C4956A]">★ {hw.bewertung_avg}</span> : "Neu"}
                          {" · "}{hw.auftraege_anzahl || 0} Aufträge
                          {hw.gewerk && (" · " + (GEWERK_LABELS[hw.gewerk] || hw.gewerk))}
                        </div>
                      </div>
                      {label && farben && (
                        <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded border whitespace-nowrap ${farben.bg} ${farben.text} ${farben.border}`}>
                          {label}
                        </span>
                      )}
                    </div>

                    {/* Routen-Daten Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#EDE8E1]">
                      <Cell
                        label="Stundensatz"
                        value={stundensatz != null ? `€${stundensatz}` : "—"}
                        muted={stundensatz == null}
                      />
                      <Cell
                        label="Distanz"
                        value={hw.distanzKm != null ? formatiereDistanz(hw.distanzKm) : "—"}
                        muted={hw.distanzKm == null}
                      />
                      <Cell
                        label="Fahrzeit"
                        value={hw.fahrzeitMin != null ? formatiereFahrzeit(hw.fahrzeitMin) : "—"}
                        muted={hw.fahrzeitMin == null}
                      />
                      <Cell
                        label="Effektivpreis"
                        value={hw.effektivPreis != null ? `€${hw.effektivPreis.toFixed(2)}` : "—"}
                        muted={hw.effektivPreis == null}
                        highlight={hw.effektivPreis != null && stundensatz != null && hw.effektivPreis - stundensatz < 2}
                      />
                    </div>

                    {/* DistanceBadge */}
                    {hw.distanzKm != null && ticket.einsatzort_lat != null && ticket.einsatzort_lng != null && (hw.startort_lat ?? hw.lat) != null && (
                      <div className="mt-3">
                        <DistanceBadge
                          vonLat={hw.startort_lat ?? hw.lat}
                          vonLng={hw.startort_lng ?? hw.lng}
                          zuLat={ticket.einsatzort_lat}
                          zuLng={ticket.einsatzort_lng}
                          radiusKm={hw.radius_km}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Footer Actions */}
      {sortiert.length > 0 && (
        <div className="sticky bottom-4 bg-white rounded-2xl border border-[#EDE8E1] shadow-md p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#2D2A26] font-medium">{selectedCount} ausgewählt</span>
            {selectedCount === 0 && (
              <button onClick={selectAll} className="text-xs text-[#3D8B7A] hover:text-[#2D6B5A] font-medium">
                Alle markieren
              </button>
            )}
          </div>
          <button
            onClick={sendeEinladungen}
            disabled={sending || selectedCount === 0}
            className="text-sm font-bold bg-[#3D8B7A] text-white px-5 py-2.5 rounded-xl hover:bg-[#2D6B5A] transition-colors disabled:opacity-50"
          >
            {sending ? "Wird gesendet…" : `${selectedCount} einladen`}
          </button>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  )
}

function Cell({ label, value, muted, highlight }: {
  label: string; value: string; muted?: boolean; highlight?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] text-[#8C857B] uppercase tracking-wide font-medium">{label}</div>
      <div className={`text-sm font-semibold tabular-nums mt-0.5 ${
        muted ? "text-[#B5AEA4]" : highlight ? "text-[#3D8B7A]" : "text-[#2D2A26]"
      }`}>
        {value}
      </div>
    </div>
  )
}
