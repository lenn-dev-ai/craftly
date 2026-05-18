"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/components/Toast"
import { MessageSquare, RefreshCw } from "lucide-react"
import FeedbackVerdictCard, { type FeedbackRow } from "@/components/admin/FeedbackVerdictCard"
import { getVerdict } from "@/lib/feedback-verdicts"

// P3.3: Admin-Feedback-Dashboard (Next.js-Variante des
// /feedback-dashboard.html-Standalones). RLS regelt Admin-only-Read.
//
// - Stats-Bar (Total / Echte FB / Unviewed / Blocker / Wartet auf Lennart /
//   Bei Claude Code / Erledigt)
// - Filter-Chips (Status / Owner / Rolle)
// - Auto-Refresh-Toggle (60s, default an)
// - Manueller Refresh-Button + Live-Timestamp

type StatusFilter = "alle" | "unviewed" | "viewed"
type OwnerFilter = "alle" | "lennart" | "claudecode" | "cowork" | "erledigt"
type RolleFilter = "alle" | "mieter" | "verwalter" | "handwerker" | "admin"

const STATUS_FILTER: { value: StatusFilter; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "unviewed", label: "Unviewed" },
  { value: "viewed", label: "Viewed" },
]
const OWNER_FILTER: { value: OwnerFilter; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "lennart", label: "⚠️ Wartet auf dich" },
  { value: "claudecode", label: "Claude Code" },
  { value: "cowork", label: "Cowork" },
  { value: "erledigt", label: "Erledigt" },
]
const ROLLE_FILTER: { value: RolleFilter; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "mieter", label: "Mieter" },
  { value: "verwalter", label: "Verwalter" },
  { value: "handwerker", label: "Handwerker" },
  { value: "admin", label: "Admin" },
]

export default function FeedbackPage() {
  const toast = useToast()
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle")
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("alle")
  const [rolleFilter, setRolleFilter] = useState<RolleFilter>("alle")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  // H10: bei wiederholtem Error den Toast-Spam vermeiden + Auto-Refresh
  // pausieren. lastErrorMessage merkt sich die letzte gesehene Meldung,
  // sodass derselbe Fehler in der 60-s-Polling-Schleife nicht wieder und
  // wieder als Toast aufpoppt.
  const lastErrorMessage = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("feedback")
      .select(`
        id, user_id, rolle, kontext_url, message, viewed, created_at,
        user:profiles!feedback_user_id_profiles_fkey ( name, email )
      `)
      .order("created_at", { ascending: false })
      .limit(200)
    if (error) {
      // H10: nur ersten Fehler toasten, dann Auto-Refresh stoppen.
      // Identische Folge-Fehler werden geschluckt; unterschiedliche
      // Fehlertexte kommen weiter durch.
      if (lastErrorMessage.current !== error.message) {
        toast.show(
          "Laden fehlgeschlagen: " + error.message +
          " — Auto-Refresh pausiert, manuell aktualisieren.",
          "error",
        )
        lastErrorMessage.current = error.message
      }
      setAutoRefresh(false)
      setLoading(false)
      return
    }
    lastErrorMessage.current = null
    setRows(
      (data ?? []).map((f: Record<string, unknown>) => {
        const u = f.user as { name?: string | null; email?: string | null } | null
        return {
          id: f.id as string,
          user_id: f.user_id as string | null,
          rolle: f.rolle as string | null,
          kontext_url: f.kontext_url as string | null,
          message: f.message as string,
          viewed: !!f.viewed,
          created_at: f.created_at as string,
          user_name: u?.name ?? null,
          user_email: u?.email ?? null,
        }
      }),
    )
    setLastRefresh(new Date())
    setLoading(false)
  }, [toast])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => { void load() }, 60_000)
    return () => clearInterval(id)
  }, [autoRefresh, load])

  async function markViewed(id: string, viewed: boolean) {
    const supabase = createClient()
    const { error } = await supabase.from("feedback").update({ viewed }).eq("id", id)
    if (error) {
      toast.show("Speichern fehlgeschlagen: " + error.message, "error")
      return
    }
    setRows(rs => rs.map(r => r.id === id ? { ...r, viewed } : r))
  }

  const stats = useMemo(() => {
    let total = 0, unviewed = 0, blocker = 0, lennart = 0, claudecode = 0, done = 0, echt = 0
    for (const f of rows) {
      total++
      if (!f.viewed) unviewed++
      const v = getVerdict(f.id, f.message)
      if (v.sev === "blocker") blocker++
      if (v.owner === "lennart") lennart++
      if (v.owner === "claudecode") claudecode++
      if (v.status === "done") done++
      if (v.cat !== "test") echt++
    }
    return { total, unviewed, blocker, lennart, claudecode, done, echt }
  }, [rows])

  const filtered = useMemo(() => rows.filter(f => {
    const v = getVerdict(f.id, f.message)
    if (statusFilter === "unviewed" && f.viewed) return false
    if (statusFilter === "viewed" && !f.viewed) return false
    if (rolleFilter !== "alle" && f.rolle !== rolleFilter) return false
    if (ownerFilter !== "alle" && v.owner !== ownerFilter) return false
    return true
  }), [rows, statusFilter, ownerFilter, rolleFilter])

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto pt-16 md:pt-8 space-y-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <MessageSquare size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Beta-Feedback</h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Live aus <code className="bg-surface-muted px-1 rounded">public.feedback</code> mit Cowork-Verdicts ·
              {lastRefresh && <> aktualisiert: {lastRefresh.toLocaleTimeString("de-DE")}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Aktualisieren
          </button>
          <button
            type="button"
            onClick={() => setAutoRefresh(v => !v)}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-line hover:bg-surface-muted"
          >
            Auto-Refresh: {autoRefresh ? "AN" : "AUS"}
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <Stat label="Total" value={stats.total} />
        <Stat label="Echte FB" value={stats.echt} />
        <Stat label="Unviewed" value={stats.unviewed} tone={stats.unviewed ? "warm" : "muted"} />
        <Stat label="Blocker" value={stats.blocker} tone={stats.blocker ? "danger" : "accent"} />
        <Stat label="Wartet auf dich" value={stats.lennart} tone={stats.lennart ? "warm" : "accent"} />
        <Stat label="Bei Claude Code" value={stats.claudecode} />
        <Stat label="Erledigt" value={stats.done} tone="accent" />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <ChipRow label="Status" options={STATUS_FILTER} value={statusFilter} onChange={setStatusFilter} />
        <ChipRow label="Owner" options={OWNER_FILTER} value={ownerFilter} onChange={setOwnerFilter} />
        <ChipRow label="Rolle" options={ROLLE_FILTER} value={rolleFilter} onChange={setRolleFilter} />
      </div>

      {/* List */}
      {loading && rows.length === 0 ? (
        <div className="text-sm text-ink-muted py-12 text-center">Lädt …</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-line rounded-xl p-8 text-center text-sm text-ink-muted">
          Keine Feedbacks für diese Filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <FeedbackVerdictCard key={r.id} row={r} onMarkViewed={markViewed} />
          ))}
        </div>
      )}

      {/* Doku-Note */}
      <div className="bg-warm-light border border-warm/30 rounded-xl p-3 text-xs text-warm-dark/90 leading-relaxed">
        <strong>Verdict-Quelle:</strong> Manuell von Cowork erstellt für bekannte Feedbacks
        (<code>lib/feedback-verdicts.ts</code>). Neue Einträge ohne manuelles Verdict
        bekommen einen Heuristik-Fallback mit Status &bdquo;Wartet&ldquo; — der Cowork-Loop
        klassifiziert sie beim nächsten Lauf (stündlich :17).
      </div>
    </div>
  )
}

function Stat({ label, value, tone = "ink" }: {
  label: string
  value: number
  tone?: "ink" | "accent" | "warm" | "danger" | "muted"
}) {
  const toneCls: Record<string, string> = {
    ink: "text-ink",
    accent: "text-accent",
    warm: "text-warm-dark",
    danger: "text-danger",
    muted: "text-ink-muted",
  }
  return (
    <div className="bg-white border border-line rounded-xl px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-medium truncate">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${toneCls[tone]}`}>{value}</div>
    </div>
  )
}

function ChipRow<T extends string>({ label, options, value, onChange }: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-ink-muted uppercase tracking-wide w-14 shrink-0">{label}</span>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              active
                ? "bg-accent text-white border-accent"
                : "bg-white text-ink-muted border-line hover:border-ink-muted/30"
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
