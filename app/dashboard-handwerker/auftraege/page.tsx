"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, Card, EmptyState } from "@/components/ui"

export default function AuftraegePage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("tickets").select("*")
        .eq("zugewiesener_hw", user.id).order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-gray-400">LÃ¤dt...</div></div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-medium">Meine AuftrÃ¤ge</h1>
        <p className="text-sm text-gray-500 mt-0.5">{tickets.length} zugewiesene AuftrÃ¤ge</p>
      </div>
      {tickets.length === 0 ? (
        <EmptyState icon="ð" title="Noch keine AuftrÃ¤ge" desc="Du wirst hier benachrichtigt sobald dir ein Auftrag vergeben wird." />
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map(t => (
            <Card key={t.id} className="cursor-pointer hover:border-[#1D9E75] transition-colors !p-3"
              onClick={() => router.push(`/ticket/${t.id}`)}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === "erledigt" ? "bg-green-500" : "bg-amber-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.titel}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t.wohnung && `${t.wohnung} Â· `}
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
