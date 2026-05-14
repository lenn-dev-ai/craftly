"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { CardListSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton"
import { Stethoscope, MapPin, Clock, AlertCircle, X } from "lucide-react"
import { GEWERK_LABELS } from "@/types"

// ============================================================
// Typen
// ============================================================

type Status = "offen" | "in_bearbeitung" | "erledigt" | "auktion"
type Dringlichkeit = "notfall" | "zeitnah" | "planbar"

interface DiagnoseTicket {
  id: string
  titel: string
  beschreibung: string | null
  gewerk: string | null
  dringlichkeit: Dringlichkeit | null
  status: Status
  einsatzort_adresse: string | null
  einsatzort_lat: number | null
  einsatzort_lng: number | null
  zugewiesener_hw: string | null
  befund_text: string | null
  projekt_angebot: number | null
  created_at: string
}

// ============================================================
// Page
// ============================================================

export default function DiagnosenPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<DiagnoseTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [befundFor, setBefundFor] = useState<DiagnoseTicket | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }
    setUserId(user.id)

    // Diagnose-Tickets:
    //  - Offene in der Nähe (RLS erlaubt status='auktion' für alle)
    //  - Mir zugewiesene (egal welcher Status)
    const { data } = await supabase
      .from("tickets")
      .select("id, titel, beschreibung, gewerk, dringlichkeit, status, einsatzort_adresse, einsatzort_lat, einsatzort_lng, zugewiesener_hw, befund_text, projekt_angebot, created_at")
      .eq("ticket_typ", "diagnose")
      .or(`status.eq.auktion,zugewiesener_hw.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .returns<DiagnoseTicket[]>()
    setTickets(data ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const offen = useMemo(
    () => tickets.filter(t => t.status === "auktion" && !t.zugewiesener_hw),
    [tickets],
  )
  const meineOhneBefund = useMemo(
    () => tickets.filter(t => t.zugewiesener_hw === userId && !t.befund_text && t.status !== "erledigt"),
    [tickets, userId],
  )
  const meineErledigt = useMemo(
    () => tickets.filter(t => t.zugewiesener_hw === userId && !!t.befund_text),
    [tickets, userId],
  )

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <PageHeaderSkeleton />
        <CardListSkeleton count={4} rows={2} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2D2A26]">Diagnose-Aufträge</h1>
        <p className="text-sm text-[#8C857B] mt-1">
          Fester Diagnose-Preis, kein Preis-Wettbewerb. Nach dem Termin gibst du Befund und Festpreis-Angebot ab.
        </p>
      </header>

      {/* Befund-Formular wenn aktiv */}
      {befundFor && (
        <BefundForm
          ticket={befundFor}
          onClose={() => setBefundFor(null)}
          onGespeichert={() => { setBefundFor(null); void load() }}
        />
      )}

      {/* Meine offenen Diagnosen — Befund noch nicht erstellt */}
      {meineOhneBefund.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wider mb-3">
            Befund erstellen ({meineOhneBefund.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {meineOhneBefund.map(t => (
              <TicketCard
                key={t.id}
                ticket={t}
                badge={<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#C4956A]/15 text-[#C4956A]">Befund offen</span>}
                action={
                  <button
                    onClick={() => setBefundFor(t)}
                    className="text-xs font-medium bg-[#3D8B7A] text-white px-3 py-1.5 rounded-lg hover:bg-[#2D6B5A] transition-colors w-full"
                  >
                    Befund + Angebot erstellen
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Offene Diagnose-Aufträge in der Nähe */}
      <section>
        <h2 className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wider mb-3">
          Verfügbare Diagnose-Termine ({offen.length})
        </h2>
        {offen.length === 0 ? (
          <div className="bg-white border border-[#EDE8E1] rounded-2xl p-8 text-center shadow-sm">
            <Stethoscope size={28} className="text-[#8C857B] mx-auto mb-2" />
            <div className="text-sm font-medium text-[#2D2A26] mb-1">
              Aktuell keine offenen Diagnose-Aufträge
            </div>
            <div className="text-xs text-[#8C857B]">
              Sobald Mieter Diagnose-Termine buchen, erscheinen sie hier.
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {offen.map(t => (
              <TicketCard
                key={t.id}
                ticket={t}
                action={
                  <button
                    onClick={() => router.push(`/dashboard-handwerker/ticket/${t.id}`)}
                    className="text-xs font-medium border border-[#3D8B7A] text-[#3D8B7A] px-3 py-1.5 rounded-lg hover:bg-[#3D8B7A]/5 transition-colors w-full"
                  >
                    Termin annehmen →
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Eigene erledigte Diagnosen (mit Befund) */}
      {meineErledigt.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wider mb-3">
            Erledigt — wartet auf Verwaltung ({meineErledigt.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {meineErledigt.map(t => (
              <TicketCard
                key={t.id}
                ticket={t}
                badge={<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#3D8B7A]/15 text-[#3D8B7A]">Befund abgegeben</span>}
                preisHinweis={t.projekt_angebot != null ? `Angebot: ${t.projekt_angebot.toLocaleString("de")} €` : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ============================================================
// Sub-Components
// ============================================================

function TicketCard({ ticket, badge, action, preisHinweis }: {
  ticket: DiagnoseTicket
  badge?: React.ReactNode
  action?: React.ReactNode
  preisHinweis?: string
}) {
  return (
    <article className="bg-white border border-[#EDE8E1] rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-[#2D2A26] flex-1 min-w-0 truncate">{ticket.titel}</h3>
        {badge}
      </div>
      {ticket.beschreibung && (
        <p className="text-xs text-[#6B665E] line-clamp-2 mb-2">{ticket.beschreibung}</p>
      )}
      <div className="space-y-1 text-xs text-[#6B665E] mb-3">
        {ticket.gewerk && (
          <div>Gewerk: <span className="text-[#2D2A26]">{GEWERK_LABELS[ticket.gewerk] ?? ticket.gewerk}</span></div>
        )}
        {ticket.einsatzort_adresse && (
          <div className="flex items-start gap-1">
            <MapPin size={11} className="mt-0.5 flex-shrink-0 text-[#8C857B]" />
            <span className="truncate">{ticket.einsatzort_adresse}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-[#8C857B]">
          <Clock size={11} />
          <span>{new Date(ticket.created_at).toLocaleDateString("de", { day: "2-digit", month: "long" })}</span>
        </div>
        {preisHinweis && (
          <div className="text-[#3D8B7A] font-semibold mt-1">{preisHinweis}</div>
        )}
      </div>
      {action}
    </article>
  )
}

// ============================================================
// Befund-Formular (Modal)
// ============================================================

function BefundForm({ ticket, onClose, onGespeichert }: {
  ticket: DiagnoseTicket
  onClose: () => void
  onGespeichert: () => void
}) {
  const [befundText, setBefundText] = useState("")
  const [aufwand, setAufwand] = useState("")
  const [angebot, setAngebot] = useState("")
  const [leistungInput, setLeistungInput] = useState("")
  const [leistungen, setLeistungen] = useState<string[]>([])
  const [fotos, setFotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function leistungHinzu() {
    const t = leistungInput.trim()
    if (!t) return
    setLeistungen(prev => [...prev, t])
    setLeistungInput("")
  }
  function leistungEntf(i: number) {
    setLeistungen(prev => prev.filter((_, idx) => idx !== i))
  }

  function fotosHinzu(files: FileList | null) {
    if (!files) return
    const neu = Array.from(files).filter(f =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type)
      && f.size <= 5 * 1024 * 1024,
    )
    setFotos(prev => [...prev, ...neu].slice(0, 5))
  }

  async function speichern() {
    setError("")
    if (!befundText.trim()) { setError("Befund-Text ist Pflicht."); return }
    if (fotos.length === 0) { setError("Mindestens 1 Foto hochladen."); return }
    const aufwandNum = parseFloat(aufwand.replace(",", "."))
    const angebotNum = parseFloat(angebot.replace(",", "."))
    if (!isFinite(aufwandNum) || aufwandNum <= 0) { setError("Aufwand muss > 0 sein."); return }
    if (!isFinite(angebotNum) || angebotNum <= 0) { setError("Angebot muss > 0 sein."); return }
    if (leistungen.length === 0) { setError("Mindestens 1 Leistungspunkt eintragen."); return }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("Nicht eingeloggt"); setSaving(false); return }

    // Foto-Upload in Storage (gleicher Bucket wie Mieter-Fotos)
    const { uploadSchadensFoto } = await import("@/lib/storage/schadens-foto")
    const fotoPfade: string[] = []
    for (const f of fotos) {
      const r = await uploadSchadensFoto(supabase, user.id, f)
      if ("pfad" in r) fotoPfade.push(r.pfad)
    }

    const res = await fetch("/api/diagnose/befund-abgeben", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticket_id: ticket.id,
        befund_text: befundText.trim(),
        befund_fotos: fotoPfade,
        befund_aufwand_stunden: aufwandNum,
        projekt_angebot: angebotNum,
        leistungsumfang: leistungen,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError("Speichern fehlgeschlagen: " + (json.error ?? res.statusText))
      setSaving(false)
      return
    }
    onGespeichert()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#EDE8E1] p-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#3D8B7A] mb-1">Befund + Angebot</div>
            <h2 className="text-base font-semibold text-[#2D2A26]">{ticket.titel}</h2>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="text-[#8C857B] hover:text-[#2D2A26]">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#C4574B]/10 border border-[#C4574B]/20 text-sm text-[#C4574B]">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-[#2D2A26] block mb-1.5">Befund *</label>
            <textarea
              value={befundText}
              onChange={e => setBefundText(e.target.value)}
              placeholder="Was hast du vor Ort festgestellt? Was ist defekt? Was muss konkret gemacht werden?"
              rows={4}
              className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3D8B7A]/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#2D2A26] block mb-1.5">Aufwand (Stunden) *</label>
              <input
                type="number" inputMode="decimal" step="0.5" min="0.5"
                value={aufwand}
                onChange={e => setAufwand(e.target.value)}
                placeholder="z. B. 2.5"
                className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#3D8B7A]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#2D2A26] block mb-1.5">Festpreis-Angebot (€) *</label>
              <input
                type="number" inputMode="decimal" step="1" min="1"
                value={angebot}
                onChange={e => setAngebot(e.target.value)}
                placeholder="z. B. 380"
                className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#3D8B7A]/40"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#2D2A26] block mb-1.5">Leistungsumfang *</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={leistungInput}
                onChange={e => setLeistungInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), leistungHinzu())}
                placeholder="z. B. Dichtung wechseln · Material inklusive"
                className="flex-1 bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3D8B7A]/40"
              />
              <button
                type="button"
                onClick={leistungHinzu}
                className="text-xs font-medium bg-[#3D8B7A] text-white px-3 rounded-xl hover:bg-[#2D6B5A] transition-colors"
              >
                +
              </button>
            </div>
            {leistungen.length > 0 && (
              <ul className="space-y-1">
                {leistungen.map((l, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#2D2A26] bg-[#FAF8F5] rounded-lg px-3 py-1.5">
                    <span className="flex-1">{l}</span>
                    <button onClick={() => leistungEntf(i)} className="text-[#8C857B] hover:text-[#C4574B]" aria-label="Entfernen">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[#2D2A26] block mb-1.5">
              Fotos * <span className="text-[#8C857B] font-normal">({fotos.length}/5, JPEG/PNG/WebP, max. 5 MB)</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={e => fotosHinzu(e.target.files)}
              className="block w-full text-xs text-[#6B665E] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#3D8B7A] file:text-white file:text-xs file:font-medium hover:file:bg-[#2D6B5A] file:cursor-pointer"
            />
            {fotos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {fotos.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-[#6B665E] bg-[#FAF8F5] rounded-lg px-3 py-1.5">
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-[#8C857B] tabular-nums">{Math.round(f.size / 1024)} KB</span>
                    <button onClick={() => setFotos(prev => prev.filter((_, idx) => idx !== i))} className="text-[#8C857B] hover:text-[#C4574B]" aria-label="Entfernen">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-[#EDE8E1] p-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-xs font-medium text-[#6B665E] hover:text-[#2D2A26] px-3 py-2"
          >
            Abbrechen
          </button>
          <button
            onClick={speichern}
            disabled={saving}
            className="text-xs font-bold bg-[#3D8B7A] text-white px-4 py-2 rounded-xl hover:bg-[#2D6B5A] transition-colors disabled:opacity-50"
          >
            {saving ? "Speichert…" : "Befund + Angebot speichern"}
          </button>
        </div>
      </div>
    </div>
  )
}
