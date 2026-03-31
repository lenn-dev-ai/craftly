"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile, Einladung, GEWERK_LABELS } from "@/types"
import { Badge, PrioBadge, MetricCard, Card, Button, EmptyState, LoadingSpinner, Toast, SectionHeader, PreisTag } from "@/components/ui"
import { berechnePreisfaktor, berechneRichtpreis } from "@/lib/preisfaktor"

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
      supabase.from("einladungen").select("*, ticket:tickets(*, objekte(*)), handwerker:profiles(*)")
        .eq("handwerker_id", user.id)
        .eq("status", "offen")
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

  async function handleAntwort(einladungId: string, ticketId: string, annehmen: boolean, preis?: number) {
    const supabase = createClient()

    if (!annehmen) {
      await supabase.from("einladungen").update({ status: "abgelehnt" }).eq("id", einladungId)
      showToast("Anfrage abgelehnt.")
      await load()
      return
    }

    const angebotsPreis = preis || 0
    if (angebotsPreis <= 0) { showToast("Bitte einen gültigen Preis eingeben."); return }

    const { error } = await supabase.from("angebote").insert({
      ticket_id: ticketId,
      handwerker_id: profile!.id,
      preis: angebotsPreis,
      status: "eingereicht",
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
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">
          Hallo, {profile?.firma || profile?.name}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-2">
          {profile?.gewerk && <span className="font-medium">{GEWERK_LABELS[profile.gewerk] || profile.gewerk}</span>}
          {profile?.gewerk && profile?.bewertung_avg ? <span>&middot;</span> : null}
          {profile?.bewertung_avg ? (
            <span className="font-semibold text-amber-500">&#9733; {profile.bewertung_avg}</span>
          ) : (
            <span>Noch keine Bewertungen</span>
          )}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-8 stagger">
        <MetricCard label="Neue Anfragen" value={einladungen.length} icon="📨" sub={einladungen.length > 0 ? "Aktion nötig" : undefined} />
        <MetricCard label="Aktive Aufträge" value={aktiveAuftraege} icon="🔨" />
        <MetricCard label="Abgeschlossen" value={erledigteAuftraege} icon="✅" />
      </div>

      {/* Einladungen */}
      <SectionHeader title="Neue Anfragen" />
      {einladungen.length === 0 ? (
        <EmptyState icon="📨" title="Keine neuen Anfragen" desc="Aktuell gibt es keine offenen Einladungen für dich." />
      ) : (
        <div className="flex flex-col gap-3 mb-8 stagger">
          {einladungen.map(e => (
            <EinladungCard key={e.id} einladung={e} onAntwort={handleAntwort} onOpen={() => router.push(`/ticket/${e.ticket_id}`)} />
          ))}
        </div>
      )}

      {/* Laufende Aufträge */}
      {meineAuftraege.length > 0 && (
        <>
          <SectionHeader title="Meine Aufträge" />
          <div className="flex flex-col gap-2.5 stagger">
            {meineAuftraege.map(t => (
              <Card key={t.id} className="!p-4" onClick={() => router.push(`/ticket/${t.id}`)}>
                <div className="flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.status === "erledigt" ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{t.titel}</div>
                    <div className="text-[12px] text-[var(--text-muted)] mt-0.5">{new Date(t.created_at).toLocaleDateString("de")}</div>
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
/* ─── Einladungs-Karte mit Preisfaktor ───────────── */
function EinladungCard({ einladung, onAntwort, onOpen }: {
  einladung: Einladung
  onAntwort: (einladungId: string, ticketId: string, annehmen: boolean, preis?: number) => void
  onOpen: () => void
}) {
  const [eigenPreis, setEigenPreis] = useState(String(einladung.empfohlener_preis || ""))
  const [showForm, setShowForm] = useState(false)
  const ticket = einladung.ticket

  // Dynamischen Preisfaktor berechnen
  const pf = berechnePreisfaktor(
    (ticket?.prioritaet as "normal" | "hoch" | "dringend") || "normal",
    3 // Default-Annahme für verfügbare HW
  )

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 cursor-pointer" onClick={onOpen}>
          <div className="text-sm font-bold text-[var(--text)]">{ticket?.titel}</div>
          <div className="text-[12px] text-[var(--text-muted)] mt-1 flex items-center gap-1.5 flex-wrap">
            {ticket?.wohnung && <span>{ticket.wohnung}</span>}
            {ticket?.gewerk && (
              <>
                <span>&middot;</span>
                <span className="font-medium">{GEWERK_LABELS[ticket.gewerk] || ticket.gewerk}</span>
              </>
            )}
            <span>&middot;</span>
            <span>{new Date(einladung.created_at).toLocaleDateString("de")}</span>
          </div>
          {ticket?.beschreibung && (
            <p className="text-[12px] text-[var(--text-muted)] mt-2 line-clamp-2 leading-relaxed">{ticket.beschreibung}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          {ticket && <PrioBadge prio={ticket.prioritaet} />}
        </div>
      </div>

      {/* Preisinfo mit dynamischem Faktor */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl px-4 py-3 mb-4 border border-emerald-100">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Empfohlener Preis</span>
            {pf.faktor > 1 && (
              <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${pf.color}`}>
                {pf.label} ({pf.faktor}x)
              </span>
            )}
          </div>
          <span className="text-lg font-extrabold text-emerald-700 tabular-nums">
            {einladung.empfohlener_preis} &euro;
          </span>
        </div>
      </div>

      {!showForm ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onAntwort(einladung.id, einladung.ticket_id, true, einladung.empfohlener_preis)}>
            Zum Richtpreis annehmen
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
            Gegenangebot
          </Button>
          <Button size="sm" variant="danger" onClick={() => onAntwort(einladung.id, einladung.ticket_id, false)}>
            Ablehnen
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">Mein Preis in &euro;</label>
            <input type="number" min="1" step="0.01" value={eigenPreis} onChange={e => setEigenPreis(e.target.value)}
              className="w-full px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm bg-[#12121a] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:ring-offset-1"
              placeholder="z.B. 420" />
          </div>
          <Button size="sm" onClick={() => onAntwort(einladung.id, einladung.ticket_id, true, Number(eigenPreis))}>
            Senden
          </Button>
          <button onClick={() => setShowForm(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] px-3 py-2.5 text-lg">
            &times;
          </button>
        </div>
      )}
    </Card>
  )
}
