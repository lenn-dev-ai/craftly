"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { AlertCircle, Activity, CheckCircle2, RefreshCw } from "lucide-react"

// Sprint AH+ — Admin-Hauptdashboard.
//
// Ersetzt die alte Page (Statistik-Cards, KI-Anomalien-Banner,
// "Tickets pro Woche"-Chart, Verteilungen) durch ein aktionables
// Mission-Control-Layout. Die alte Page bewahrt CC in commit-History
// via git revert auf den vorherigen Commit, falls jemals nötig.
//
// Endpoints (alle in Sprint AH gebaut):
//   - GET /api/admin/live
//   - GET /api/admin/action-items
//   - GET /api/admin/activity
//   - GET /api/admin/health

type LiveData = {
  users_online: number
  aktive_auktionen: number
  neue_tickets_letzte_stunde: number
  timestamp: string
}

type ActionItem = {
  type: string
  actor_id: string
  actor_name: string
  metric: number
  message: string
  oldest_event_at: string | null
}

type ActivityVal = { value: number; delta: number | null }
type ActivityData = {
  neue_tickets?: ActivityVal
  vergeben?: ActivityVal
  erledigt?: ActivityVal
  neue_hw?: ActivityVal
}

type HealthData = {
  db: { ok: boolean; latency_ms: number }
  resend: { ok: boolean }
  vapi: { ok: boolean }
  mapbox: { ok: boolean }
  timestamp: string
}

function useAdminFetch<T>(url: string, intervalMs: number): { data: T | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const fetcher = async () => {
    try {
      const res = await fetch(url, { cache: "no-store" })
      if (res.ok) setData(await res.json())
    } catch {}
  }
  useEffect(() => {
    fetcher()
    const id = setInterval(fetcher, intervalMs)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs])
  return { data, refresh: fetcher }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [adminGate, setAdminGate] = useState<"checking" | "ok" | "denied">("checking")
  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }
      const { data: prof } = await supabase.from("profiles").select("rolle").eq("id", user.id).single<{ rolle: string }>()
      if (prof?.rolle !== "admin") { setAdminGate("denied"); return }
      setAdminGate("ok")
    })()
  }, [router])

  const { data: live } = useAdminFetch<LiveData>("/api/admin/live", 30_000)
  const { data: actionItems } = useAdminFetch<{ items: ActionItem[] }>("/api/admin/action-items", 60_000)
  const { data: activity } = useAdminFetch<ActivityData>("/api/admin/activity", 5 * 60_000)
  const { data: health } = useAdminFetch<HealthData>("/api/admin/health", 60_000)

  if (adminGate === "checking") {
    return <div className="p-6 text-sm text-ink-muted">Lädt…</div>
  }
  if (adminGate === "denied") {
    return <div className="p-6 text-sm text-danger">Nur Admin-User dürfen diese Seite sehen.</div>
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Mission Control</h1>
          <p className="text-xs text-ink-muted mt-1">Live-Status · Action-Items · 24h-Aktivität · System-Health</p>
        </div>
        <div className="text-xs text-ink-muted flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
      </header>

      <section className="bg-white border border-line rounded-2xl p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Live</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <BigStat label="User online (5 min)" value={live?.users_online} />
          <BigStat label="Aktive Auktionen" value={live?.aktive_auktionen} />
          <BigStat label="Neue Tickets (1h)" value={live?.neue_tickets_letzte_stunde} />
        </div>
      </section>

      <section className="bg-white border border-line rounded-2xl p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3 flex items-center gap-2">
          <AlertCircle size={14} /> Brauchen Aktion
        </h2>
        {(actionItems?.items ?? []).length === 0 ? (
          <div className="text-sm text-ink-muted flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            Keine offenen Action-Items.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {(actionItems?.items ?? []).map((item, i) => (
              <li key={i} className="py-3 text-sm flex items-start gap-3">
                <span className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                  item.type === "auktion_ohne_angebot" ? "bg-amber-100 text-amber-900"
                  : item.type === "verwalter_ohne_vergabe" ? "bg-rose-100 text-rose-900"
                  : "bg-sky-100 text-sky-900"
                }`}>{item.type.replace(/_/g, " ")}</span>
                <div className="flex-1">
                  <div className="font-medium text-ink">{item.actor_name}</div>
                  <div className="text-xs text-ink-muted">{item.message}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-line rounded-2xl p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3 flex items-center gap-2">
          <Activity size={14} /> Letzte 24 Stunden
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <DeltaStat label="Neue Tickets"   data={activity?.neue_tickets} />
          <DeltaStat label="Vergeben"       data={activity?.vergeben} />
          <DeltaStat label="Erledigt"       data={activity?.erledigt} />
          <DeltaStat label="Neue HW"        data={activity?.neue_hw} />
        </div>
      </section>

      <section className="bg-white border border-line rounded-2xl p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">System</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <HealthDot label={`DB (${health?.db.latency_ms ?? "?"} ms)`} ok={health?.db.ok} />
          <HealthDot label="Resend"  ok={health?.resend.ok} />
          <HealthDot label="Vapi"    ok={health?.vapi.ok} />
          <HealthDot label="Mapbox"  ok={health?.mapbox.ok} />
        </div>
      </section>

      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <RefreshCw size={12} />
        Live alle 30 s · Action-Items alle 60 s · Aktivität alle 5 min
      </div>
    </main>
  )
}

function BigStat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <div className="text-3xl font-bold tabular-nums text-ink">
        {value ?? "—"}
      </div>
      <div className="text-xs text-ink-muted mt-0.5">{label}</div>
    </div>
  )
}

function DeltaStat({ label, data }: { label: string; data: ActivityVal | undefined }) {
  if (!data) return <div className="text-ink-muted text-sm">{label}: —</div>
  const arrow = data.delta == null ? "" : data.delta > 0 ? "↑" : data.delta < 0 ? "↓" : "="
  const color = data.delta == null ? "" : data.delta > 0 ? "text-emerald-600" : data.delta < 0 ? "text-rose-600" : "text-ink-muted"
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums text-ink">{data.value}</div>
      <div className="text-xs text-ink-muted mt-0.5">{label} {data.delta != null && <span className={color}>{arrow}{Math.abs(data.delta)}</span>}</div>
    </div>
  )
}

function HealthDot({ label, ok }: { label: string; ok: boolean | undefined }) {
  const color = ok === undefined ? "bg-slate-300" : ok ? "bg-emerald-500" : "bg-rose-500"
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-ink">{label}</span>
    </div>
  )
}
