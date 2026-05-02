"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, StatusDot, Button, Card, EmptyState, LoadingSpinner } from "@/components/ui"

export default function MieterTicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("tickets").select("*")
        .eq("erstellt_von", user.id).order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Meine Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Alle deine Meldungen</p>
        </div>
        <Button onClick={() => router.push("/dashboard-mieter/melden")}>+ Neuer Schaden</Button>
      </div>
      {tickets.length === 0 ? (
        <EmptyState icon="🎫" title="Noch keine Meldungen"
          desc="Melde deinen ersten Schaden."
          action={<Button onClick={() => router.push("/dashboard-mieter/melden")}>Jetzt melden</Button>} />
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map(t => (
            <Card key={t.id} className="cursor-pointer hover:border-[#3D8B7A] transition-colors !p-3"
              onClick={() => router.push(`/ticket/${t.id}`)}>
              <div className="flex items-center gap-3">
                <StatusDot status={t.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.titel}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t.wohnung && `${t.wohnung} · `}
                    {new Date(t.created_at).toLocaleDateString("de")}
                  </div>
                </div>
                <Badge status={t.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
