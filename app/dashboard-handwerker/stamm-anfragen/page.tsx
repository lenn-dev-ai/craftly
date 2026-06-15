"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import DirektanfragenInbox, { StatusIcon, type StammAnfrage } from "@/components/handwerker/DirektanfragenInbox"

// Sprint V Phase 3 — HW-Inbox für 1:1-Stamm-Anfragen.
//
// Sprint AN: Die "Offen"-Ansicht (Annehmen/Ablehnen mit Frist-Countdown) ist
// jetzt Teil der geteilten Komponente DirektanfragenInbox, die seit Sprint AN
// auch als primärer Content auf /dashboard-handwerker erscheint (siehe
// SPRINT-AN-SPEC.md). Diese Seite bleibt für die volle Historie ("Offen" +
// "Vergangene") und ist über das Sidebar-Menü weiterhin erreichbar.

export default function StammAnfragenPage() {
  const router = useRouter()
  const [erledigt, setErledigt] = useState<StammAnfrage[]>([])
  const [loading, setLoading] = useState(true)
  const [offenCount, setOffenCount] = useState(0)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const { data } = await supabase
      .from("stamm_anfragen")
      .select("id, ticket_id, status, frist_bis, created_at, preis_vorschlag_cents, ablehn_grund, ticket:tickets(id, titel, beschreibung, gewerk, einsatzort_adresse, prioritaet)")
      .eq("handwerker_id", user.id)
      .neq("status", "gesendet")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<StammAnfrage[]>()
    setErledigt(data || [])
    setLoading(false)
  }, [router])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-[#3D8B7A] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink">Stamm-Anfragen</h1>
        <p className="text-sm text-ink-muted mt-1">
          1:1-Direktanfragen von Verwaltern, bei denen du als Stamm-HW hinterlegt bist.
        </p>
      </header>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
          Offen ({offenCount})
        </h2>
        <DirektanfragenInbox onCountChange={setOffenCount} />
      </section>

      {erledigt.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
            Vergangene ({erledigt.length})
          </h2>
          <ul className="space-y-2">
            {erledigt.map(a => (
              <li key={a.id} className="bg-white rounded-xl border border-line px-4 py-3 text-sm flex items-center gap-3">
                <StatusIcon status={a.status} />
                <span className="font-medium text-ink truncate">{a.ticket?.titel ?? "Ticket"}</span>
                <span className="text-xs text-ink-muted ml-auto capitalize shrink-0">{a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
