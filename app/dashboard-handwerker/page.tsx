"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile } from "@/types"

function Timer({ end }: { end: string }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000))
    setSecs(calc())
    const id = setInterval(() => setSecs(calc()), 1000)
    return () => clearInterval(id)
  }, [end])
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  const fmt = (n: number) => String(n).padStart(2, "0")
  if (secs === 0) return <span className="text-xs text-[#C4574B] font-medium">Abgelaufen</span>
  return (
    <span className="text-xs bg-[#C4956A]/10 text-[#C4956A] px-2.5 py-1 rounded-full font-medium">
      {fmt(h)}:{fmt(m)}:{fmt(s)}
    </span>
  )
}

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-[#8C857B]">Lädt...</span>
      </div>
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#2D2A26]">
          Hallo, {profile?.firma || profile?.name || "Handwerker"}
        </h1>
        <p className="text-sm text-[#8C857B] mt-1">
          {profile?.gewerk && <span className="text-[#6B665E]">{profile.gewerk}</span>}
          {profile?.gewerk && profile?.bewertung_avg && " · "}
          {profile?.bewertung_avg ? (
            <span className="text-[#C4956A]">★ {profile.bewertung_avg}</span>
          ) : (
            "Noch keine Bewertungen"
          )}
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-[#EDE8E1] p-5 hover:shadow-sm transition-shadow">
          <div className="text-xs text-[#8C857B] font-medium mb-1">Offene Ausschreibungen</div>
          <div className="text-3xl font-bold text-[#3D8B7A]">{auktionen.length}</div>
          <div className="text-xs text-[#8C857B] mt-1">in deiner Region</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EDE8E1] p-5 hover:shadow-sm transition-shadow">
          <div className="text-xs text-[#8C857B] font-medium mb-1">Meine Aufträge</div>
          <div className="text-3xl font-bold text-[#2D2A26]">{meineAuftraege.length}</div>
          <div className="text-xs text-[#8C857B] mt-1">zugewiesen</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EDE8E1] p-5 hover:shadow-sm transition-shadow">
          <div className="text-xs text-[#8C857B] font-medium mb-1">Bewertung</div>
          <div className="text-3xl font-bold text-[#C4956A]">
            {profile?.bewertung_avg ? `${profile.bewertung_avg}` : "—"}
          </div>
          <div className="text-xs text-[#8C857B] mt-1">
            {profile?.bewertung_avg ? `★ Durchschnitt` : "Noch keine"}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Link href="/dashboard-handwerker/zeitslots" className="bg-white rounded-xl border border-[#EDE8E1] p-4 text-center hover:border-[#3D8B7A]/30 hover:shadow-sm transition-all group">
          <div className="text-lg mb-1">▦</div>
          <div className="text-xs font-medium text-[#6B665E] group-hover:text-[#3D8B7A] transition-colors">Zeitslots</div>
        </Link>
        <Link href="/dashboard-handwerker/einnahmen" className="bg-white rounded-xl border border-[#EDE8E1] p-4 text-center hover:border-[#3D8B7A]/30 hover:shadow-sm transition-all group">
          <div className="text-lg mb-1">€</div>
          <div className="text-xs font-medium text-[#6B665E] group-hover:text-[#3D8B7A] transition-colors">Einnahmen</div>
        </Link>
        <Link href="/dashboard-handwerker/kalender" className="bg-white rounded-xl border border-[#EDE8E1] p-4 text-center hover:border-[#3D8B7A]/30 hover:shadow-sm transition-all group">
          <div className="text-lg mb-1">▤</div>
          <div className="text-xs font-medium text-[#6B665E] group-hover:text-[#3D8B7A] transition-colors">Kalender</div>
        </Link>
        <Link href="/dashboard-handwerker/profil" className="bg-white rounded-xl border border-[#EDE8E1] p-4 text-center hover:border-[#3D8B7A]/30 hover:shadow-sm transition-all group">
          <div className="text-lg mb-1">◎</div>
          <div className="text-xs font-medium text-[#6B665E] group-hover:text-[#3D8B7A] transition-colors">Profil</div>
        </Link>
      </div>

      {/* Auktionen */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#2D2A26]">Aktuelle Ausschreibungen</h2>
          {auktionen.length > 0 && (
            <span className="text-xs text-[#8C857B]">{auktionen.length} offen</span>
          )}
        </div>
        {auktionen.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EDE8E1] p-8 text-center">
            <div className="text-3xl mb-2">&#128203;</div>
            <div className="text-sm font-medium text-[#2D2A26] mb-1">Keine offenen Ausschreibungen</div>
            <div className="text-xs text-[#8C857B]">Sobald neue Auktionen starten, siehst du sie hier.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {auktionen.map(t => (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-[#EDE8E1] p-4 cursor-pointer hover:border-[#3D8B7A]/30 hover:shadow-sm transition-all"
                onClick={() => router.push(`/dashboard-handwerker/angebot/${t.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#3D8B7A] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#2D2A26] truncate">{t.titel}</div>
                    <div className="text-xs text-[#8C857B] mt-0.5">
                      {t.wohnung && `${t.wohnung} · `}
                      {(t.angebote as any[])?.length || 0} Angebote
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {t.auktion_ende && <Timer end={t.auktion_ende} />}
                    <span className="text-xs bg-[#3D8B7A]/8 text-[#3D8B7A] px-2.5 py-1 rounded-full font-medium border border-[#3D8B7A]/15">
                      Bieten
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meine Aufträge */}
      {meineAuftraege.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#2D2A26]">Meine laufenden Aufträge</h2>
            <Link href="/dashboard-handwerker/auftraege" className="text-xs text-[#3D8B7A] hover:text-[#2D7A6A] transition-colors font-medium">
              Alle anzeigen →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {meineAuftraege.slice(0, 5).map(t => (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-[#EDE8E1] p-4 cursor-pointer hover:border-[#3D8B7A]/30 hover:shadow-sm transition-all"
                onClick={() => router.push(`/ticket/${t.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    t.status === "erledigt" ? "bg-[#3D8B7A]" : "bg-[#C4956A]"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#2D2A26] truncate">{t.titel}</div>
                    <div className="text-xs text-[#8C857B] mt-0.5">
                      {new Date(t.created_at).toLocaleDateString("de")}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    t.status === "erledigt"
                      ? "bg-[#3D8B7A]/8 text-[#3D8B7A] border border-[#3D8B7A]/15"
                      : t.status === "in_bearbeitung"
                      ? "bg-[#C4956A]/10 text-[#C4956A] border border-[#C4956A]/15"
                      : "bg-[#EDE8E1] text-[#6B665E] border border-[#EDE8E1]"
                  }`}>
                    {t.status === "erledigt" ? "Erledigt" : t.status === "in_bearbeitung" ? "In Arbeit" : t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
