"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, StatusDot, Button, Card, EmptyState } from "@/components/ui"

export default function MieterDashboard() {
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

  const offen = tickets.filter(t => t.status !== "erledigt")

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-gray-400">LÃ¤dt...</div></div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Meine Ãbersicht</h1>
          <p className="text-sm text-gray-500 mt-0.5">Deine gemeldeten SchÃ¤den & Tickets</p>
        </div>
        <Button onClick={() => router.push("/dashboard-mieter/melden")}>+ Schaden melden</Button>
      </div>

      {offen.length === 0 && tickets.length === 0 && (
        <Card className="mb-4" style={{ background: "#E1F5EE", borderColor: "#1D9E75" }}>
          <div className="text-sm font-medium text-[#0F6E56]">Alles in Ordnung â</div>
          <div className="text-xs text-[#0F6E56] mt-1">Keine offenen SchÃ¤den gemeldet.</div>
        </Card>
      )}

      {offen.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Offene Meldungen</h2>
          <div className="flex flex-col gap-2 mb-5">
            {offen.map(t => (
              <Card key={t.id} className="cursor-pointer hover:border-[#1D9E75] transition-colors !p-3"
                onClick={() => router.push(`/ticket/${t.id}`)}>
                <div className="flex items-center gap-3">
                  <StatusDot status={t.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.titel}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Gemeldet: {new Date(t.created_at).toLocaleDateString("de")}</div>
                  </div>
                  <Badge status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tickets.filter(t => t.status === "erledigt").length > 0 && (
        <>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Erledigte Meldungen</h2>
          <div className="flex flex-col gap-2">
            {tickets.filter(t => t.status === "erledigt").map(t => (
              <Card key={t.id} className="!p-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <div className="flex-1 text-sm text-gray-500 truncate">{t.titel}</div>
                  <Badge status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tickets.length === 0 && (
        <EmptyState icon="ð " title="Noch keine Meldungen"
          desc="Melde einen Schaden und deine Verwaltung wird sofort benachrichtigt."
          action={<Button onClick={() => router.push("/dashboard-mieter/melden")}>Ersten Schaden melden</Button>} />
      )}
    </div>
  )
}
