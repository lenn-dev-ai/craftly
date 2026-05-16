"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card } from "@/components/ui"
import { useToast } from "@/components/Toast"
import { MessageSquare, ExternalLink, CheckCircle2 } from "lucide-react"

// Admin-Inbox für Beta-User-Feedback.
//
// RLS = nur Admin liest alles (siehe Migration). Mark-as-viewed
// läuft als direct-update mit Admin-RLS (kein Service-Role nötig).

interface FeedbackRow {
  id: string
  user_id: string | null
  rolle: string | null
  kontext_url: string | null
  message: string
  viewed: boolean
  created_at: string
  user_name: string | null
  user_email: string | null
}

type Filter = "neu" | "alle"

export default function FeedbackPage() {
  const toast = useToast()
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("neu")

  async function load() {
    setLoading(true)
    const supabase = createClient()
    let q = supabase
      .from("feedback")
      .select(`
        id, user_id, rolle, kontext_url, message, viewed, created_at,
        user:profiles!feedback_user_id_fkey ( name, email )
      `)
      .order("created_at", { ascending: false })
      .limit(200)
    if (filter === "neu") q = q.eq("viewed", false)
    const { data, error } = await q
    if (error) {
      toast.show("Laden fehlgeschlagen: " + error.message, "error")
      setLoading(false)
      return
    }
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
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [filter])

  async function markViewed(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("feedback").update({ viewed: true }).eq("id", id)
    if (error) {
      toast.show("Speichern fehlgeschlagen", "error")
      return
    }
    setRows(rs => rs.map(r => r.id === id ? { ...r, viewed: true } : r))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto pt-16 md:pt-8 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <MessageSquare size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Beta-Feedback</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Was User direkt aus der App schicken.
            </p>
          </div>
        </div>
        <div className="flex bg-surface-alt rounded-xl p-1 border border-line">
          {(["neu", "alle"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors " +
                (filter === f ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink")
              }
            >
              {f === "neu" ? "Neu" : "Alle"}
            </button>
          ))}
        </div>
      </header>

      {!loading && rows.length === 0 && (
        <Card className="bg-white border border-line">
          <div className="flex items-center gap-3 text-ink-muted text-sm">
            <CheckCircle2 size={18} className="text-accent" />
            {filter === "neu" ? "Keine ungesehenen Feedbacks." : "Noch kein Feedback eingegangen."}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map(r => {
          const ts = new Date(r.created_at)
          const datum = ts.toLocaleString("de-DE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })
          return (
            <Card
              key={r.id}
              className={
                "bg-white border " +
                (r.viewed ? "border-line opacity-70" : "border-accent/30 shadow-sm")
              }
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">
                    {r.user_name ?? "Anonym"}
                    {r.rolle && <span className="ml-2 text-xs font-normal text-ink-muted">({r.rolle})</span>}
                  </div>
                  <div className="text-xs text-ink-muted">{r.user_email ?? ""} · {datum}</div>
                </div>
                {!r.viewed && (
                  <button
                    type="button"
                    onClick={() => markViewed(r.id)}
                    className="text-xs text-accent hover:underline flex-shrink-0"
                  >
                    Als gesehen
                  </button>
                )}
              </div>
              <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed bg-surface-alt rounded-lg px-3 py-2">
                {r.message}
              </div>
              {r.kontext_url && (
                <a
                  href={r.kontext_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent"
                >
                  <ExternalLink size={12} />
                  {(() => {
                    try { return new URL(r.kontext_url).pathname }
                    catch { return r.kontext_url }
                  })()}
                </a>
              )}
            </Card>
          )
        })}
      </div>

      {loading && <div className="text-sm text-ink-muted">Lade…</div>}
    </div>
  )
}
