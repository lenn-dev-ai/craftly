"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Stethoscope, Check, X, ArrowRight, Clock, AlertCircle } from "lucide-react"
import type { Ticket, UserProfile } from "@/types"

// ============================================================
// Pipeline-Anzeige für Diagnose- und Projekt-Tickets.
// - Diagnose-Ticket: zeigt Pipeline-Status, Befund-Daten und für
//   Verwalter zwei Aktionen (Annehmen / In Auktion mit Vorkaufsrecht).
// - Projekt-Ticket: zeigt Verweis auf Quell-Diagnose + Preiskorridor
//   + Hinweis auf Vorkaufsrecht falls aktiv.
// ============================================================

interface Props {
  ticket: Ticket
  currentUser: UserProfile | null
  onReload: () => void
}

type Step = { key: string; label: string; status: "done" | "active" | "pending" }

function StepDot({ step }: { step: Step }) {
  const colors = {
    done: { bg: "bg-[#3D8B7A]", text: "text-white", icon: <Check size={12} /> },
    active: { bg: "bg-[#C4956A]", text: "text-white", icon: <Clock size={12} /> },
    pending: { bg: "bg-[#EDE8E1]", text: "text-[#8C857B]", icon: <span className="text-[10px] font-semibold">·</span> },
  }
  const c = colors[step.status]
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className={`w-7 h-7 rounded-full ${c.bg} ${c.text} flex items-center justify-center shadow-sm`}>
        {c.icon}
      </div>
      <div className={`mt-1.5 text-[10px] font-medium ${step.status === "pending" ? "text-[#8C857B]" : "text-[#2D2A26]"} max-w-[80px] text-center leading-tight`}>
        {step.label}
      </div>
    </div>
  )
}

function PipelineTimeline({ steps }: { steps: Step[] }) {
  return (
    <div className="flex items-start gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-start gap-2 flex-1">
          <StepDot step={s} />
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mt-3.5 ${s.status === "done" ? "bg-[#3D8B7A]" : "bg-[#EDE8E1]"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function fmtEur(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €"
}

export default function DiagnosePipeline({ ticket, currentUser, onReload }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<"annehmen" | "auktion" | null>(null)
  const [error, setError] = useState("")
  const [confirmAuktion, setConfirmAuktion] = useState(false)

  const isVerwalter = currentUser?.rolle === "verwalter" || currentUser?.rolle === "admin"
  const isErsteller = currentUser?.id === ticket.erstellt_von
  const typ = ticket.ticket_typ ?? "standard"

  if (typ === "standard") return null

  // === PROJEKT-TICKET: Anzeige der Diagnose-Quelle + Vorkaufsrecht ===
  if (typ === "projekt") {
    const vorkaufsrechtAktiv = !!ticket.vorkaufsrecht_bis &&
      new Date(ticket.vorkaufsrecht_bis).getTime() > Date.now()
    const korridor = ticket.preiskorridor_min != null && ticket.preiskorridor_max != null
      ? { min: ticket.preiskorridor_min, max: ticket.preiskorridor_max }
      : null

    return (
      <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#7C6CAB]/15 flex items-center justify-center">
            <Stethoscope size={16} className="text-[#7C6CAB]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#7C6CAB] uppercase tracking-wider">Projekt aus Diagnose</div>
            <div className="text-sm text-[#6B665E]">Erst Befund vor Ort, dann konkretes Angebot.</div>
          </div>
        </div>

        {korridor && (
          <div className="bg-[#FAF8F5] rounded-xl p-3 mb-3">
            <div className="text-[10px] font-semibold text-[#8C857B] uppercase tracking-wider mb-1">Fairer Preisbereich</div>
            <div className="text-sm font-mono tabular-nums text-[#2D2A26]">
              {fmtEur(korridor.min)} – {fmtEur(korridor.max)}
            </div>
          </div>
        )}

        {vorkaufsrechtAktiv && (
          <div className="flex items-start gap-2 text-xs text-[#854F0B] bg-[#FAF1DE] border border-[#C4956A]/30 rounded-xl p-3">
            <Clock size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Vorkaufsrecht aktiv bis {new Date(ticket.vorkaufsrecht_bis!).toLocaleString("de-DE", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-[#6B665E] mt-0.5">Der Diagnose-Handwerker hat Vorrang vor anderen Bietern.</div>
            </div>
          </div>
        )}

        {ticket.diagnosegebuehr_angerechnet && (
          <div className="flex items-center gap-2 text-xs text-[#3D8B7A] mt-3">
            <Check size={12} />
            <span>Diagnosegebühr wurde auf den Auftragswert angerechnet</span>
          </div>
        )}

        {ticket.diagnose_ticket_id && (
          <button
            onClick={() => router.push(`/dashboard-${currentUser?.rolle ?? "verwalter"}/ticket/${ticket.diagnose_ticket_id}`)}
            className="mt-3 text-xs text-[#3D8B7A] hover:underline inline-flex items-center gap-1"
          >
            Zum Diagnose-Ticket <ArrowRight size={12} />
          </button>
        )}
      </div>
    )
  }

  // === DIAGNOSE-TICKET ===
  const hatHw = !!ticket.zugewiesener_hw
  const hatBefund = !!ticket.befund_text
  const istErledigt = ticket.status === "erledigt"

  const steps: Step[] = [
    {
      key: "gebucht",
      label: "Gebucht",
      status: "done",
    },
    {
      key: "angenommen",
      label: "Handwerker",
      status: hatHw ? "done" : "active",
    },
    {
      key: "befund",
      label: "Befund",
      status: hatBefund ? "done" : hatHw ? "active" : "pending",
    },
    {
      key: "entscheidung",
      label: "Entscheidung",
      status: istErledigt ? "done" : hatBefund ? "active" : "pending",
    },
  ]

  async function annehmen() {
    setError("")
    setBusy("annehmen")
    const res = await fetch("/api/diagnose/projekt-annehmen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnose_ticket_id: ticket.id }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      setError(json.error ?? "Annehmen fehlgeschlagen")
      return
    }
    if (json.projektTicketId) {
      router.push(`/dashboard-${currentUser?.rolle ?? "verwalter"}/ticket/${json.projektTicketId}`)
    } else {
      onReload()
    }
  }

  async function inAuktion() {
    setError("")
    setBusy("auktion")
    const res = await fetch("/api/diagnose/projekt-zur-auktion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnose_ticket_id: ticket.id, dringlichkeit: "zeitnah" }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    setConfirmAuktion(false)
    if (!res.ok) {
      setError(json.error ?? "Auktion-Start fehlgeschlagen")
      return
    }
    if (json.projektTicketId) {
      router.push(`/dashboard-${currentUser?.rolle ?? "verwalter"}/ticket/${json.projektTicketId}`)
    } else {
      onReload()
    }
  }

  const korridor = ticket.preiskorridor_min != null && ticket.preiskorridor_max != null
    ? { min: ticket.preiskorridor_min, max: ticket.preiskorridor_max }
    : null
  const angebot = ticket.projekt_angebot ?? null
  const imKorridor = angebot != null && korridor != null && angebot >= korridor.min && angebot <= korridor.max

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#7C6CAB]/15 flex items-center justify-center">
          <Stethoscope size={16} className="text-[#7C6CAB]" />
        </div>
        <div>
          <div className="text-xs font-semibold text-[#7C6CAB] uppercase tracking-wider">Diagnose-Termin</div>
          <div className="text-sm text-[#6B665E]">
            {istErledigt
              ? "Diagnose abgeschlossen — Projekt läuft separat."
              : hatBefund
                ? "Befund + Festpreis-Angebot eingetroffen."
                : hatHw
                  ? "Handwerker zugewiesen — wartet auf Befund vor Ort."
                  : "Wartet auf einen Handwerker."}
          </div>
        </div>
      </div>

      <PipelineTimeline steps={steps} />

      {/* Befund-Anzeige */}
      {hatBefund && (
        <div className="mt-5 space-y-3">
          <div className="bg-[#FAF8F5] rounded-xl p-3 border border-[#EDE8E1]">
            <div className="text-[10px] font-semibold text-[#8C857B] uppercase tracking-wider mb-1">Befund</div>
            <p className="text-sm text-[#2D2A26] whitespace-pre-wrap">{ticket.befund_text}</p>
          </div>

          {ticket.leistungsumfang && ticket.leistungsumfang.length > 0 && (
            <div className="bg-[#FAF8F5] rounded-xl p-3 border border-[#EDE8E1]">
              <div className="text-[10px] font-semibold text-[#8C857B] uppercase tracking-wider mb-2">Leistungsumfang</div>
              <ul className="space-y-1">
                {ticket.leistungsumfang.map((l, i) => (
                  <li key={i} className="text-sm text-[#2D2A26] flex items-start gap-2">
                    <Check size={12} className="text-[#3D8B7A] mt-1 flex-shrink-0" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {ticket.befund_aufwand_stunden != null && (
              <div className="bg-[#FAF8F5] rounded-xl p-3 border border-[#EDE8E1]">
                <div className="text-[10px] font-semibold text-[#8C857B] uppercase tracking-wider mb-1">Aufwand</div>
                <div className="text-base font-mono tabular-nums text-[#2D2A26]">{ticket.befund_aufwand_stunden} h</div>
              </div>
            )}
            {angebot != null && (
              <div className={`rounded-xl p-3 border ${imKorridor ? "bg-[#3D8B7A]/5 border-[#3D8B7A]/30" : "bg-[#FAF1DE] border-[#C4956A]/30"}`}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: imKorridor ? "#3D8B7A" : "#854F0B" }}>
                  Festpreis-Angebot
                </div>
                <div className={`text-base font-mono tabular-nums font-bold ${imKorridor ? "text-[#3D8B7A]" : "text-[#854F0B]"}`}>
                  {fmtEur(angebot)}
                </div>
              </div>
            )}
          </div>

          {korridor && (
            <div className="text-xs text-[#6B665E]">
              <span className="text-[#8C857B]">Fairer Bereich: </span>
              <span className="font-mono tabular-nums text-[#2D2A26]">{fmtEur(korridor.min)} – {fmtEur(korridor.max)}</span>
              {imKorridor
                ? <span className="ml-2 text-[#3D8B7A] font-semibold">✓ im Korridor</span>
                : angebot != null && <span className="ml-2 text-[#854F0B] font-semibold">⚠ außerhalb</span>}
            </div>
          )}
        </div>
      )}

      {/* Aktionen für Verwalter */}
      {isVerwalter && isErsteller && hatBefund && !istErledigt && (
        <div className="mt-5 pt-5 border-t border-[#EDE8E1] space-y-2">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#C4574B]/10 border border-[#C4574B]/20 text-sm text-[#C4574B]">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!confirmAuktion ? (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={annehmen}
                disabled={!!busy}
                className="flex-1 min-w-[200px] text-sm font-semibold bg-[#3D8B7A] text-white px-4 py-2.5 rounded-xl hover:bg-[#2D6B5A] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Check size={14} />
                {busy === "annehmen" ? "Wird vergeben…" : "Angebot annehmen"}
              </button>
              <button
                onClick={() => setConfirmAuktion(true)}
                disabled={!!busy}
                className="text-sm font-medium border border-[#EDE8E1] text-[#6B665E] hover:text-[#2D2A26] hover:border-[#8C857B] px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                In Auktion mit Vorkaufsrecht
              </button>
            </div>
          ) : (
            <div className="bg-[#FAF1DE] border border-[#C4956A]/30 rounded-xl p-4">
              <div className="text-sm font-semibold text-[#854F0B] mb-1">Auktion mit Vorkaufsrecht starten?</div>
              <p className="text-xs text-[#6B665E] mb-3 leading-relaxed">
                Es wird ein neues Projekt-Ticket angelegt und an passende Handwerker im Umkreis ausgeschrieben.
                Der Diagnose-Handwerker hat 24 Stunden Vorrang — bietet er innerhalb dieser Frist, gewinnt er
                automatisch. Andere Handwerker können danach übernehmen.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={inAuktion}
                  disabled={!!busy}
                  className="text-xs font-semibold bg-[#C4956A] text-white px-3 py-2 rounded-lg hover:bg-[#A37749] transition-colors disabled:opacity-50"
                >
                  {busy === "auktion" ? "Wird gestartet…" : "Ja, in Auktion"}
                </button>
                <button
                  onClick={() => setConfirmAuktion(false)}
                  disabled={!!busy}
                  className="text-xs font-medium text-[#6B665E] hover:text-[#2D2A26] px-3 py-2 inline-flex items-center gap-1"
                >
                  <X size={12} /> Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hinweis für Verwalter wenn noch kein Befund */}
      {isVerwalter && isErsteller && !hatBefund && !istErledigt && (
        <div className="mt-5 pt-5 border-t border-[#EDE8E1]">
          <div className="text-xs text-[#6B665E] leading-relaxed">
            Sobald der Handwerker den Befund eingereicht hat, kannst du das Festpreis-Angebot
            annehmen oder in eine Auktion mit Vorkaufsrecht überführen.
          </div>
        </div>
      )}
    </div>
  )
}
