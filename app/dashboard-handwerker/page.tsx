"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile } from "@/types"
import { Badge, MetricCard, Card, EmptyState, LoadingSpinner } from "@/components/ui"
import { Timer } from "@/components/ui/Timer"

export default function HandwerkerDashboard() {
  const router = useRouter()
  const [auktionen, setAuktionen] = useState<Ticket[]>([])
  const [meineAuftraege, setMeineAuftraege] = useState<Ticket[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const [{ data: prof }, { data: offene }, { data: meine }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("tickets").select("*, angebote(*)").eq("status", "auktion")
          .gt("auktion_ende", new Date().toISOString()).order("auktion_ende"),
        supabase.from("tickets").select("*").eq("zugewiesener_hw", user.id).order("created_at", { ascending: false }),
      ])
      setProfile(prof)
      setAuktionen(offene || [])
      setMeineAuftraege(meine || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-medium">
          Hallo, {profile?.firma || profile?.name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile?.gewerk && `${profile.gewerk} · `}
          {profile?.bewertung_avg ? `★ ${profile.bewertung_avg}` : "Noch keine Bewertungen"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <MetricCard label="Offene Ausschreibungen" value={auktionen.length} />
        <MetricCard label="Meine Aufträge" value={meineAuftraege.length} />
        <MetricCard label="Bewertung" value={profile?.bewertung_avg ? `${profile.bewertung_avg} ★` : "—"} />
      </div>

      <h2 className="text-sm font-medium text-gray-700 mb-3">Aktuelle Ausschreibungen in deiner Region</h2>
      {auktionen.length === 0 ? (
        <EmptyState icon="📋" title="Keine offenen Ausschreibungen" desc="Aktuell laufen keine Auktionen." />
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {auktionen.map(t => (
            <Card key={t.id} className="cursor-pointer hover:border-[#1D9E75] transition-colors !p-3"
              onClick={() => router.push(`/ticket/${t.id}`)}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.titel}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t.wohnung && `${t.wohnung} · `}
                    {(t.angebote as any[])?.length || 0} Angebote eingegangen
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.auktion_ende && <Timer end={t.auktion_ende} />}
                  <Badge status={t.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {meineAuftraege.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Meine laufenden Aufträge</h2>
          <div className="flex flex-col gap-2">
            {meineAuftraege.map(t => (
              <Card key={t.id} className="cursor-pointer hover:border-[#1D9E75] transition-colors !p-3"
                onClick={() => router.push(`/ticket/${t.id}`)}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === "erledigt" ? "bg-green-500" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.titel}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString("de")}</div>
                  </div>
                  <Badge status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
