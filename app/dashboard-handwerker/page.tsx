"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile, Einladung, GEWERK_LABELS } from "@/types"
import { Badge, PrioBadge, MetricCard, Card, Button, EmptyState, LoadingSpinner, Toast, SectionHeader } from "@/components/ui"
import { berechnePreisfaktor } from "@/lib/preisfaktor"

const MODUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  sofort: { label: "Sofort", color: "#FF6363", icon: "!" },
  auktion: { label: "Auktion", color: "#00D4AA", icon: "#" },
  plan: { label: "Plan", color: "#00B4D8", icon: "~" },
}

export default function HandwerkerDashboard() {
  const router = useRouter()
  const [einladungen, setEinladungen] = useState<Einladung[]>([])
  const [meineAuftraege, setMeineAuftraege] = useState<Ticket[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState("")

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000) }

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const [{ data: prof }, { data: einl }, { data: meine }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("einladungen").select("*, ticket:tickets(*, objekte(*))")
        .eq("handwerker_id", user.id).eq("status", "offen")
        .order("created_at", { ascending: false }),
      supabase.from("tickets").select("*")
        .eq("zugewiesener_hw", user.id)
        .order("created_at", { ascending: false }),
    ])
    setProfile(prof)
    setEinladungen(einl || [])
    setMeineAuftraege(meine || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [router])

  async function handleAntwort(einladungId: string, ticketId: string, annehmen: boolean, preis?: number, termin?: string, dauer?: string) {
    const supabase = createClient()
    if (!annehmen) {
      await supabase.from("einladungen").update({ status: "abgelehnt" }).eq("id", einladungId)
      showToast("Anfrage abgelehnt.")
      await load(); return
    }
    if (!preis || preis <= 0) { showToast("Bitte einen gueltigen Preis eingeben."); return }
    const { error } = await supabase.from("angebote").insert({
      ticket_id: ticketId, handwerker_id: profile!.id,
      preis: preis, status: "eingereicht",
      verfuegbar_ab: termin || null,
      geschaetzte_dauer: dauer || null,
    })
    if (error) { showToast("Fehler: " + error.message); return }
    await supabase.from("einladungen").update({ status: "angebot" }).eq("id", einladungId)
    showToast("Angebot eingereicht!")
    await load()
  }

  if (loading) return <LoadingSpinner />

  const erledigteAuftraege = meineAuftraege.filter(t => t.status === "erledigt").length
  const aktiveAuftraege = meineAuftraege.filter(t => t.status !== "erledigt").length

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Hallo, {profile?.firma || profile?.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
          {profile?.gewerk && <span className="font-medium text-gray-400">{GEWERK_LABELS[profile.gewerk] || profile.gewerk}</span>}
          {profile?.gewerk && profile?.bewertung_avg ? <span className="text-gray-600">-</span> : null}
          {profile?.bewertung_avg ? (
            <span className="font-semibold text-amber-400">Bewertung {profile.bewertung_avg}</span>
          ) : (
            <span className="text-gray-500">Noch keine Bewertungen</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="text-2xl font-bold text-white">{einladungen.length}</div>
          <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-wider">Neue Anfragen</div>
          {einladungen.length > 0 && <div className="text-[10px] text-[#FF6363] mt-1 font-medium">Aktion noetig</div>}
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="text-2xl font-bold text-white">{aktiveAuftraege}</div>
          <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-wider">Aktive Auftraege</div>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="text-2xl font-bold text-white">{erledigteAuftraege}</div>
          <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-wider">Abgeschlossen</div>
        </div>
      </div>

      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Neue Anfragen</h2>
      {einladungen.length === 0 ? (
        <EmptyState icon="M" title="Keine neuen Anfragen" desc="Aktuell gibt es keine offenen Einladungen fuer dich." />
      ) : (
        <div className="flex flex-col gap-3 mb-8">
          {einladungen.map(e => (
            <EinladungCard key={e.id} einladung={e} onAntwort={handleAntwort}
              onOpen={() => router.push(`/ticket/${e.ticket_id}`)} />
          ))}
        </div>
      )}

      {meineAuftraege.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 mt-8">Meine Auftraege</h2>
          <div className="flex flex-col gap-2.5">
            {meineAuftraege.map(t => (
              <Card key={t.id} className="!p-4 cursor-pointer hover:border-[#00D4AA]/30 transition-colors"
                onClick={() => router.push(`/ticket/${t.id}`)}>
                <div className="flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    t.status === "erledigt" ? "bg-[#00D4AA]" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{t.titel}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {new Date(t.created_at).toLocaleDateString("de")}
                    </div>
                  </div>
                  <Badge status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  )
}

function EinladungCard({ einladung, onAntwort, onOpen }: {
  einladung: Einladung
  onAntwort: (id: string, ticketId: string, annehmen: boolean, preis?: number, termin?: string, dauer?: string) => void
  onOpen: () => void
}) {
  const [eigenPreis, setEigenPreis] = useState(String(einladung.empfohlener_preis || ""))
  const [termin, setTermin] = useState("")
  const [dauer, setDauer] = useState("2-4 Stunden")
  const [showForm, setShowForm] = useState(false)
  const ticket = einladung.ticket

  const modus = (ticket as any)?.vergabemodus || "auktion"
  const modusInfo = MODUS_INFO[modus] || MODUS_INFO.auktion

  const pf = berechnePreisfaktor(
    (ticket?.prioritaet as "normal" | "hoch" | "dringend") || "normal", 3
  )

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 cursor-pointer" onClick={onOpen}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: modusInfo.color + "15", color: modusInfo.color }}>
              {modusInfo.icon} {modusInfo.label}
            </span>
            {ticket && <PrioBadge prio={ticket.prioritaet} />}
          </div>
          <div className="text-sm font-bold text-white">{ticket?.titel}</div>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
            {ticket?.wohnung && <span>{ticket.wohnung}</span>}
            {ticket?.gewerk && (
              <><span className="text-gray-600">-</span>
              <span className="font-medium text-gray-400">{GEWERK_LABELS[ticket.gewerk] || ticket.gewerk}</span></>
            )}
            <span className="text-gray-600">-</span>
            <span>{new Date(einladung.created_at).toLocaleDateString("de")}</span>
          </div>
          {ticket?.beschreibung && (
            <p className="text-[11px] text-gray-500 mt-2 line-clamp-2 leading-relaxed">{ticket.beschreibung}</p>
          )}
        </div>
      </div>

      {/* Preis-Info */}
      <div className="rounded-xl px-4 py-3 mb-4 border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-[#00D4AA] uppercase tracking-wider">Empfohlener Preis</span>
            {pf.faktor > 1 && (
              <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${pf.color}`}>
                {pf.label} ({pf.faktor}x)
              </span>
            )}
          </div>
          <span className="text-lg font-extrabold text-white tabular-nums">
            {einladung.empfohlener_preis} EUR
          </span>
        </div>
      </div>

      {!showForm ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowForm(true)}>
            Angebot abgeben
          </Button>
          <Button size="sm" variant="danger"
            onClick={() => onAntwort(einladung.id, einladung.ticket_id, false)}>
            Ablehnen
          </Button>
        </div>
      ) : (
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
          <h4 className="text-xs font-bold text-white mb-3 uppercase tracking-wider">Mein Angebot</h4>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Preis (EUR)</label>
              <input type="number" min="1" step="0.01" value={eigenPreis}
                onChange={e => setEigenPreis(e.target.value)}
                className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-sm bg-[#0a0a0f] text-white focus:outline-none focus:border-[#00D4AA]/40"
                placeholder="z.B. 420" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Fruehester Termin</label>
              <input type="date" value={termin} onChange={e => setTermin(e.target.value)}
                className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-sm bg-[#0a0a0f] text-white focus:outline-none focus:border-[#00D4AA]/40" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Geschaetzte Dauer</label>
              <select value={dauer} onChange={e => setDauer(e.target.value)}
                className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-sm bg-[#0a0a0f] text-white focus:outline-none focus:border-[#00D4AA]/40">
                <option value="< 1 Stunde">Unter 1 Stunde</option>
                <option value="1-2 Stunden">1-2 Stunden</option>
                <option value="2-4 Stunden">2-4 Stunden</option>
                <option value="Halber Tag">Halber Tag</option>
                <option value="Ganzer Tag">Ganzer Tag</option>
                <option value="Mehrere Tage">Mehrere Tage</option>
              </select>
            </div>
          </div>

          {termin && (
            <div className="text-[11px] text-gray-500 mb-3 p-2 bg-white/[0.02] rounded-lg">
              Ihr Angebot: <span className="text-white font-semibold">{eigenPreis} EUR</span> -
              Termin ab <span className="text-white font-semibold">{new Date(termin).toLocaleDateString("de")}</span> -
              Dauer ca. <span className="text-white font-semibold">{dauer}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm"
              onClick={() => onAntwort(einladung.id, einladung.ticket_id, true, Number(eigenPreis), termin, dauer)}>
              Angebot senden
            </Button>
            <button onClick={() => setShowForm(false)}
              className="text-gray-500 hover:text-white px-3 py-1.5 text-sm transition-colors">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
