"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile } from "@/types"
import { Avatar, Card, Input, EmptyState, LoadingSpinner } from "@/components/ui"

export default function HandwerkerDBPage() {
  const router = useRouter()
  const [handwerker, setHandwerker] = useState<UserProfile[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("profiles").select("*").eq("rolle", "handwerker")
      setHandwerker(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const filtered = handwerker.filter(h =>
    !search || (h.name + h.firma + h.gewerk + h.plz_bereich).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-medium">Handwerker-Datenbank</h1>
        <p className="text-sm text-gray-500 mt-0.5">{handwerker.length} registrierte Betriebe</p>
      </div>

      <div className="mb-4">
        <Input placeholder="Suche nach Name, Gewerk, PLZ..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon="ð§" title="Keine Handwerker gefunden"
          desc={search ? "Kein Treffer fÃ¼r deine Suche." : "Noch keine Handwerker registriert."} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(h => (
            <Card key={h.id} className="!p-3">
              <div className="flex items-center gap-3">
                <Avatar name={h.firma || h.name} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{h.firma || h.name}</div>
                  <div className="text-xs text-gray-500">
                    {h.gewerk && `${h.gewerk} Â· `}
                    {h.plz_bereich && `PLZ ${h.plz_bereich} Â· `}
                    {h.bewertung_avg ? `â ${h.bewertung_avg}` : "Noch keine Bewertung"}
                    {h.auftraege_anzahl ? ` Â· ${h.auftraege_anzahl} AuftrÃ¤ge` : ""}
                  </div>
                </div>
                <div className="text-xs text-gray-400">{h.email}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
