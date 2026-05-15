"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import type { Ticket, UserProfile, Nachtrag, NachtragStufe } from "@/types"
import { FileEdit, Check, X, AlertCircle, Plus } from "lucide-react"

// ============================================================
// Nachtrags-Verwaltung in der Ticket-Detail-Ansicht.
// - Handwerker: Form zum Einreichen (Betrag + Begründung)
// - Verwalter: Liste mit Genehmigen/Ablehnen-Buttons für offene Nachträge
// - Beide: Side-by-Side Original-Befund vs alle Nachträge-Liste
// ============================================================

interface Props {
  ticket: Ticket
  currentUser: UserProfile | null
  onReload: () => void
}

const STUFE_LABEL: Record<NachtragStufe, { label: string; color: string; bg: string; border: string }> = {
  bagatell: { label: "Bagatell ≤ 10 %", color: "#3D8B7A", bg: "#E8F2EF", border: "#3D8B7A33" },
  wesentlich: { label: "Wesentlich ≤ 25 %", color: "#854F0B", bg: "#FAF1DE", border: "#C4956A55" },
  erheblich: { label: "Erheblich > 25 %", color: "#ffffff", bg: "#C4574B", border: "#C4574B" },
}

function fmtEur(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €"
}

function StufeBadge({ stufe }: { stufe: NachtragStufe }) {
  const c = STUFE_LABEL[stufe]
  return (
    <span
      className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      {c.label}
    </span>
  )
}

export default function NachtragsBox({ ticket, currentUser, onReload }: Props) {
  const [nachtraege, setNachtraege] = useState<Nachtrag[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("nachtraege")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: false })
      .returns<Nachtrag[]>()
    setNachtraege(data ?? [])
    setLoading(false)
  }, [ticket.id])

  useEffect(() => { void load() }, [load])

  const isVerwalter = currentUser?.rolle === "verwalter" || currentUser?.rolle === "admin"
  const isHandwerker = currentUser?.rolle === "handwerker"
  const istZugewiesenerHw = isHandwerker && currentUser?.id === ticket.zugewiesener_hw
  // FIX-4: bei Mieter-Tickets ist erstellt_von der Mieter — der zuständige
  // Verwalter muss aber Nachträge genehmigen können. Beide IDs zulassen.
  const istErsteller = currentUser?.id === ticket.erstellt_von || currentUser?.id === ticket.verwalter_id
  const offen = nachtraege.filter(n => n.status === "offen")

  const ursprungspreis = ticket.projekt_angebot && ticket.projekt_angebot > 0
    ? ticket.projekt_angebot
    : (ticket.kosten_final ?? 0)
  const summeGenehmigt = nachtraege
    .filter(n => n.status === "genehmigt")
    .reduce((s, n) => s + n.nachtrag_betrag, 0)

  return (
    <div className="bg-white border border-line rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-warm/15 flex items-center justify-center">
            <FileEdit size={16} className="text-warm" />
          </div>
          <div>
            <div className="text-xs font-semibold text-warm uppercase tracking-wider">Nachträge</div>
            <div className="text-sm text-ink-secondary">
              {nachtraege.length === 0
                ? "Festpreis-Angebot — keine Nachträge"
                : `${nachtraege.length} Nachtrag${nachtraege.length === 1 ? "" : "e"} · ${nachtraege.filter(n => n.status === "genehmigt").length} genehmigt`}
            </div>
          </div>
        </div>
        {istZugewiesenerHw && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold bg-warm text-white px-3 py-1.5 rounded-lg hover:bg-[#A37749] transition-colors inline-flex items-center gap-1"
          >
            <Plus size={12} /> Nachtrag einreichen
          </button>
        )}
      </div>

      {/* Einreichen-Formular */}
      {showForm && istZugewiesenerHw && (
        <NachtragForm
          ticketId={ticket.id}
          ursprungspreis={ursprungspreis}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); onReload() }}
        />
      )}

      {/* Side-by-Side: Original vs Nachträge */}
      <div className="grid md:grid-cols-2 gap-3 mt-4">
        {/* Original-Befund */}
        <div className="bg-surface rounded-xl p-3 border border-line">
          <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Ursprung (Festpreis)</div>
          <div className="text-base font-mono tabular-nums text-ink font-bold mb-1">{fmtEur(ursprungspreis)}</div>
          {ticket.befund_text && (
            <p className="text-xs text-ink-secondary leading-relaxed line-clamp-4">{ticket.befund_text}</p>
          )}
        </div>

        {/* Nachträge-Summe + aktuelle Gesamt */}
        <div className="bg-surface rounded-xl p-3 border border-line">
          <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Nachträge genehmigt</div>
          <div className="text-base font-mono tabular-nums text-ink font-bold mb-1">
            {summeGenehmigt > 0 ? `+${fmtEur(summeGenehmigt)}` : "—"}
          </div>
          <div className="text-xs text-ink-secondary">
            Aktueller Auftragswert:
            <span className="text-ink font-semibold tabular-nums ml-1">
              {fmtEur(ursprungspreis + summeGenehmigt)}
            </span>
          </div>
        </div>
      </div>

      {/* Nachträge-Liste */}
      {loading ? (
        <div className="text-xs text-ink-muted mt-4">Lädt…</div>
      ) : nachtraege.length > 0 && (
        <div className="mt-5 space-y-2">
          {nachtraege.map(n => (
            <NachtragZeile
              key={n.id}
              nachtrag={n}
              kannEntscheiden={isVerwalter && istErsteller && n.status === "offen"}
              onEntscheidung={async () => { await load(); onReload() }}
            />
          ))}
        </div>
      )}

      {/* Hinweis */}
      {offen.length > 0 && isVerwalter && istErsteller && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-warm-light border border-warm/30 text-xs text-warm-dark">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            {offen.length === 1 ? "Ein Nachtrag wartet" : `${offen.length} Nachträge warten`} auf deine Entscheidung.
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sub-Komponenten
// ============================================================

function NachtragZeile({
  nachtrag,
  kannEntscheiden,
  onEntscheidung,
}: {
  nachtrag: Nachtrag
  kannEntscheiden: boolean
  onEntscheidung: () => Promise<void>
}) {
  const [busy, setBusy] = useState<"genehmigt" | "abgelehnt" | null>(null)
  const [error, setError] = useState("")

  async function entscheide(entscheidung: "genehmigt" | "abgelehnt") {
    setError("")
    setBusy(entscheidung)
    const res = await fetch("/api/nachtraege/genehmigen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nachtrag_id: nachtrag.id, entscheidung }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      setError(json.error ?? "Fehler")
      return
    }
    await onEntscheidung()
  }

  const statusColor = nachtrag.status === "genehmigt"
    ? "bg-accent/10 text-accent border-accent/30"
    : nachtrag.status === "abgelehnt"
      ? "bg-danger/10 text-danger border-danger/30"
      : "bg-warm-light text-warm-dark border-warm/30"

  return (
    <div className="border border-line rounded-xl p-3 bg-white">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StufeBadge stufe={nachtrag.stufe} />
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor}`}>
            {nachtrag.status}
          </span>
        </div>
        <div className="text-base font-mono tabular-nums font-bold text-ink flex-shrink-0">
          +{fmtEur(nachtrag.nachtrag_betrag)}
        </div>
      </div>

      <p className="text-sm text-ink whitespace-pre-wrap mb-2 leading-relaxed">{nachtrag.begruendung}</p>

      <div className="flex items-center justify-between gap-3 text-[11px] text-ink-muted">
        <span>
          {new Date(nachtrag.created_at).toLocaleString("de-DE", {
            day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
          })}
        </span>
        <span className="font-mono tabular-nums">
          {Number(nachtrag.aufpreis_prozent).toFixed(1)} % Aufpreis
        </span>
      </div>

      {error && (
        <div className="mt-2 text-xs text-danger">{error}</div>
      )}

      {kannEntscheiden && (
        <div className="mt-3 pt-3 border-t border-line flex gap-2">
          <button
            onClick={() => entscheide("genehmigt")}
            disabled={!!busy}
            className="flex-1 text-xs font-semibold bg-accent text-white px-3 py-2 rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <Check size={12} />
            {busy === "genehmigt" ? "Genehmigt…" : "Genehmigen"}
          </button>
          <button
            onClick={() => entscheide("abgelehnt")}
            disabled={!!busy}
            className="flex-1 text-xs font-semibold border border-[#C4574B] text-danger px-3 py-2 rounded-lg hover:bg-danger/5 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <X size={12} />
            {busy === "abgelehnt" ? "Lehnt ab…" : "Ablehnen"}
          </button>
        </div>
      )}
    </div>
  )
}

function NachtragForm({
  ticketId,
  ursprungspreis,
  onClose,
  onSaved,
}: {
  ticketId: string
  ursprungspreis: number
  onClose: () => void
  onSaved: () => void
}) {
  const [betrag, setBetrag] = useState("")
  const [begruendung, setBegruendung] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const betragNum = parseFloat(betrag.replace(",", "."))
  const aufpreisProzent = isFinite(betragNum) && ursprungspreis > 0
    ? (betragNum / ursprungspreis) * 100
    : 0
  const vorschauStufe: NachtragStufe | null = !isFinite(aufpreisProzent) || aufpreisProzent <= 0
    ? null
    : aufpreisProzent <= 10
      ? "bagatell"
      : aufpreisProzent <= 25
        ? "wesentlich"
        : "erheblich"

  async function speichern() {
    setError("")
    if (!isFinite(betragNum) || betragNum <= 0) { setError("Betrag muss > 0 sein"); return }
    if (begruendung.trim().length < 10) { setError("Begründung zu kurz (mind. 10 Zeichen)"); return }

    setSaving(true)
    const res = await fetch("/api/nachtraege/einreichen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticket_id: ticketId,
        nachtrag_betrag: betragNum,
        begruendung: begruendung.trim(),
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(json.error ?? "Speichern fehlgeschlagen")
      return
    }
    onSaved()
  }

  return (
    <div className="mt-4 p-4 bg-surface border border-line rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-ink">Neuer Nachtrag</div>
        <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Schließen">
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink block mb-1">Nachtrag in €</label>
          <input
            type="number" inputMode="decimal" step="1" min="1"
            value={betrag}
            onChange={e => setBetrag(e.target.value)}
            placeholder="z. B. 80"
            className="w-full text-sm tabular-nums bg-white border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C4956A]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink block mb-1">Vorschau</label>
          <div className="text-sm py-1.5">
            {vorschauStufe
              ? <StufeBadge stufe={vorschauStufe} />
              : <span className="text-xs text-ink-muted">—</span>}
            {vorschauStufe === "bagatell" && (
              <div className="text-[10px] text-accent mt-1">Wird automatisch genehmigt</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-ink block mb-1">Begründung (mind. 10 Zeichen)</label>
        <textarea
          value={begruendung}
          onChange={e => setBegruendung(e.target.value)}
          rows={3}
          placeholder="z. B. Zusätzliche Dichtung war zerbrochen, musste mit ausgetauscht werden."
          className="w-full text-sm bg-white border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C4956A]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="text-xs font-medium text-ink-secondary hover:text-ink px-3 py-1.5"
        >
          Abbrechen
        </button>
        <button
          onClick={speichern}
          disabled={saving}
          className="text-xs font-bold bg-warm text-white px-4 py-1.5 rounded-lg hover:bg-[#A37749] transition-colors disabled:opacity-50"
        >
          {saving ? "Speichert…" : "Einreichen"}
        </button>
      </div>
    </div>
  )
}
