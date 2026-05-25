"use client"

import { useState } from "react"
import { ExternalLink } from "lucide-react"
import {
  getVerdict,
  STATUS_LABEL,
  OWNER_LABEL,
  type VerdictCat,
  type VerdictSev,
  type VerdictStatus,
  type VerdictOwner,
} from "@/lib/feedback-verdicts"

// P3.2: Eine Verdict-Karte pro feedback-Row. Migriert das Inline-CSS aus
// /feedback-dashboard.html auf Tailwind + Reparo-Brand-Farben.

export interface FeedbackRow {
  id: string
  user_id: string | null
  rolle: string | null
  kontext_url: string | null
  message: string
  viewed: boolean
  created_at: string
  user_name?: string | null
  user_email?: string | null
}

interface Props {
  row: FeedbackRow
  onMarkViewed: (id: string, viewed: boolean) => Promise<void>
}

const SEV_BORDER: Record<VerdictSev, string> = {
  blocker: "border-l-4 border-l-danger",
  high:    "border-l-4 border-l-warm",
  medium:  "border-l-4 border-l-rolle-mieter",
  low:     "border-l-4 border-l-line-strong",
}

const SEV_BADGE: Record<VerdictSev, string> = {
  blocker: "bg-danger text-white",
  high:    "bg-warm text-white",
  medium:  "bg-rolle-mieter text-white",
  low:     "bg-ink-faint/40 text-ink",
}

const CAT_BADGE: Record<VerdictCat, string> = {
  bug:      "bg-danger-light text-danger",
  ux:       "bg-rolle-mieter/15 text-rolle-mieter",
  feature:  "bg-accent/10 text-accent",
  question: "bg-purple-100 text-purple-700",
  positive: "bg-accent/15 text-accent",
  test:     "bg-surface-muted text-ink-muted",
  crash:    "bg-danger text-white",
}

const ROLLE_BADGE: Record<string, string> = {
  handwerker: "bg-rolle-handwerker/15 text-rolle-handwerker",
  mieter:     "bg-rolle-mieter/15 text-rolle-mieter",
  verwalter:  "bg-rolle-verwalter/15 text-rolle-verwalter",
  admin:      "bg-rolle-admin/15 text-rolle-admin",
}

const STATUS_BADGE: Record<VerdictStatus, string> = {
  done:         "bg-accent/15 text-accent",
  inprogress:   "bg-warm-light text-warm-dark",
  waiting:      "bg-rolle-mieter/15 text-rolle-mieter",
  needdecision: "bg-purple-100 text-purple-700",
  backlog:      "bg-surface-muted text-ink-secondary",
  blocker:      "bg-danger text-white",
}

const OWNER_BADGE: Record<VerdictOwner, string> = {
  cowork:     "bg-accent text-white",
  claudecode: "bg-purple-700 text-white",
  lennart:    "bg-warm text-white",
  erledigt:   "bg-ink-faint/40 text-ink",
  niemand:    "bg-surface-muted text-ink-muted",
}

function ago(t: Date): string {
  const sec = Math.floor((Date.now() - t.getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}d`
}

function trimUrl(u: string): string {
  return u
    .replace("https://reparo-app.netlify.app", "")
    .replace("http://localhost:3000", "[local]")
}

export default function FeedbackVerdictCard({ row, onMarkViewed }: Props) {
  const v = getVerdict(row.id, row.message)
  const [busy, setBusy] = useState(false)
  const ts = new Date(row.created_at)
  const datum = ts.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })
  const rolleBadge = row.rolle ? ROLLE_BADGE[row.rolle] ?? "bg-surface-muted text-ink-muted" : ""

  async function toggle() {
    setBusy(true)
    try {
      await onMarkViewed(row.id, !row.viewed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`bg-white rounded-xl border border-line shadow-sm p-4 ${SEV_BORDER[v.sev]} ${row.viewed ? "opacity-60" : ""}`}
    >
      {/* Head: Badges + Time */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {row.rolle && (
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${rolleBadge}`}>{row.rolle}</span>
          )}
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${CAT_BADGE[v.cat]}`}>{v.cat}</span>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${SEV_BADGE[v.sev]}`}>{v.sev}</span>
          {row.viewed && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-surface-muted text-ink-muted">viewed</span>
          )}
        </div>
        <span className="text-[11px] text-ink-faint whitespace-nowrap" title={ts.toISOString()}>
          {datum} · vor {ago(ts)}
        </span>
      </div>

      {/* Kontext + Message */}
      {row.kontext_url && (
        <div className="text-[11px] text-ink-muted font-mono mb-1.5 break-all">{trimUrl(row.kontext_url)}</div>
      )}
      <div className="text-sm text-ink whitespace-pre-wrap break-words">{row.message}</div>

      {/* Verdict-Block — Sprint R Phase 20 (Feedback 9a528680):
          flex-wrap-Zeilen brauchen explizites gap-y damit Label +
          Value bei Schmal-Viewport nicht überlappen, plus
          leading-snug damit die Text-Linie nicht zu eng ist. */}
      <div className="mt-3 rounded-lg border border-line bg-surface-muted/30 p-3 space-y-2 text-xs leading-snug">
        <div className="flex items-center gap-2 flex-wrap gap-y-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[v.status]}`}>
            {STATUS_LABEL[v.status]}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${OWNER_BADGE[v.owner]}`}>
            {OWNER_LABEL[v.owner]}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap gap-y-1">
          <span className="text-ink-muted text-[10px] uppercase tracking-wide w-20 shrink-0 leading-relaxed">Bereich</span>
          <span className="inline-flex px-1.5 py-0.5 rounded bg-surface text-ink-secondary font-mono text-[11px]">{v.area}</span>
        </div>
        <div className="flex gap-2 flex-wrap gap-y-1">
          <span className="text-ink-muted text-[10px] uppercase tracking-wide w-20 shrink-0 leading-relaxed">Zusammenfassung</span>
          <span className="text-ink flex-1 min-w-0">{v.summary}</span>
        </div>
        <div className="flex gap-2 flex-wrap gap-y-1">
          <span className="text-ink-muted text-[10px] uppercase tracking-wide w-20 shrink-0 leading-relaxed">Empfehlung</span>
          <span className="text-ink flex-1 min-w-0">{v.recommendation}</span>
        </div>
        {v.ref && (
          <div className="flex gap-2 flex-wrap gap-y-1">
            <span className="text-ink-muted text-[10px] uppercase tracking-wide w-20 shrink-0 leading-relaxed">Referenz</span>
            <span className="text-accent font-mono text-[11px]">{v.ref}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            row.viewed
              ? "border border-line text-ink-secondary hover:bg-surface-muted"
              : "bg-accent text-white hover:bg-accent-hover"
          } ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {busy ? "…" : row.viewed ? "Wieder unviewed" : "Als viewed markieren"}
        </button>
        {row.kontext_url && (
          <a
            href={row.kontext_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent"
          >
            <ExternalLink size={12} />
            Kontext öffnen
          </a>
        )}
      </div>
    </div>
  )
}
