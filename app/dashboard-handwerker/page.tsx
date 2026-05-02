"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile } from "@/types"
import DistanceBadge from "@/components/DistanceBadge"
import { haversineKm } from "@/lib/distance"

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
  const dringend = secs < 3600
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium tabular-nums ${
      dringend ? "bg-[#C4574B]/10 text-[#C4574B] animate-pulse" : "bg-[#C4956A]/10 text-[#C4956A]"
    }`}>
      {h > 0 && `${fmt(h)}:`}{fmt(m)}:{fmt(s)}
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
        supabase.from("tickets").select("*").eq("zugewiesener_hw", user.id)
          .order("created_at", { ascending: false }),
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
        <span className="text-sm text-[#8C857B]">Lädt…</span>
      </div>
    </div>
  )

  const standortGesetzt = profile?.lat != null && profile?.lng != null

  // Auktionen nach Distanz sortieren wenn Standort gesetzt
  const auktionenSortiert = standortGesetzt
    ? [...auktionen].sort((a, b) => {
        const dA = a.einsatzort_lat && a.einsatzort_lng
          ? haversineKm(profile!.lat!, profile!.lng!, a.einsatzort_lat, a.einsatzort_lng)
          : 99999
        const dB = b.einsatzort_lat && b.einsatzort_lng
          ? haversineKm(profile!.lat!, profile!.lng!, b.einsatzort_lat, b.einsatzort_lng)
          : 99999
        return dA - dB
      })
    : auktionen

  // Auktionen im Radius zählen
  const imRadius = standortGesetzt && profile?.radius_km
    ? auktionen.filter(t => {
        if (!t.einsatzort_lat || !t.einsatzort_lng) return false
        return haversineKm(profile.lat!, profile.lng!, t.einsatzort_lat, t.einsatzort_lng) <= profile.radius_km!
      }).length
    : auktionen.length

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
      {/* Hero Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2D2A26]">
          Hallo, {profile?.firma || profile?.name || "Handwerker"}
        </h1>
        <p className="text-sm text-[#8C857B] mt-1.5">
          {profile?.gewerk && <span>{profile.gewerk}</span>}
          {profile?.gewerk && profile?.bewertung_avg && " · "}
          {profile?.bewertung_avg ? (
            <span className="text-[#C4956A] font-medium">★ {profile.bewertung_avg}</span>
          ) : (
            <span>Noch keine Bewertungen</span>
          )}
          {standortGesetzt && profile?.radius_km && (
            <>
              {" · "}
              <span className="text-[#3D8B7A]">📍 {profile.radius_km} km Radius</span>
            </>
          )}
        </p>
      </div>

      {/* Standort-Setup-Banner wenn nicht konfiguriert */}
      {!standortGesetzt && (
        <Link
          href="/dashboard-handwerker/profil"
          className="block mb-6 p-4 rounded-2xl border-2 border-[#C4956A]/40 bg-[#FAF1DE] hover:bg-[#F5E5D0] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C4956A]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">📍</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#2D2A26]">Standort einrichten</div>
              <div className="text-xs text-[#854F0B] mt-0.5">
                Damit du nur Aufträge in deiner Nähe siehst und die Fahrzeit fair berechnet wird
              </div>
            </div>
            <span className="text-[#854F0B]">→</span>
          </div>
        </Link>
      )}

      {/* Hero Metric: Verdienst-Potenzial */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-[#3D8B7A] to-[#2D6B5A] rounded-2xl p-5 text-white sm:col-span-1">
          <div className="text-xs font-medium text-white/80 mb-1 uppercase tracking-wide">
            Verfügbar im Radius
          </div>
          <div className="text-4xl font-bold tabular-nums">{imRadius}</div>
          <div className="text-xs text-white/70 mt-2">
            {imRadius === 1 ? "offene Ausschreibung" : "offene Ausschreibungen"}
            {standortGesetzt && imRadius < auktionen.length && (
              <span className="block mt-0.5">+{auktionen.length - imRadius} außerhalb</span>
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EDE8E1] p-5">
          <div className="text-xs text-[#8C857B] font-medium mb-1 uppercase tracking-wide">
            Meine Aufträge
          </div>
          <div className="text-4xl font-bold text-[#2D2A26] tabular-nums">{meineAuftraege.length}</div>
          <div className="text-xs text-[#8C857B] mt-2">aktuell zugewiesen</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EDE8E1] p-5">
          <div className="text-xs text-[#8C857B] font-medium mb-1 uppercase tracking-wide">
            Bewertung
          </div>
          <div className="text-4xl font-bold text-[#C4956A] tabular-nums">
            {profile?.bewertung_avg ? profile.bewertung_avg : "—"}
          </div>
          <div className="text-xs text-[#8C857B] mt-2">
            {profile?.auftraege_anzahl ? `aus ${profile.auftraege_anzahl} Aufträgen` : "Noch keine"}
          </div>
        </div>
      </div>

      {/* Quick Actions — minimaler */}
      <div className="grid grid-cols-4 gap-2 mb-10">
        <QuickAction href="/dashboard-handwerker/zeitslots" label="Zeitslots" icon="▦" />
        <QuickAction href="/dashboard-handwerker/kalender" label="Kalender" icon="▤" />
        <QuickAction href="/dashboard-handwerker/einnahmen" label="Einnahmen" icon="€" />
        <QuickAction href="/dashboard-handwerker/profil" label="Profil" icon="◎" />
      </div>

      {/* Auktionen — der Hauptcontent */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#2D2A26]">Aktuelle Ausschreibungen</h2>
          {auktionenSortiert.length > 0 && standortGesetzt && (
            <span className="text-xs text-[#8C857B]">Nach Distanz sortiert</span>
          )}
        </div>

        {auktionenSortiert.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EDE8E1] p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF8F5] flex items-center justify-center mb-3">
              <span className="text-2xl opacity-60">📋</span>
            </div>
            <div className="text-base font-semibold text-[#2D2A26] mb-1">Aktuell keine Ausschreibungen</div>
            <div className="text-sm text-[#8C857B] max-w-sm mx-auto">
              Sobald Verwalter neue Aufträge ausschreiben, erscheinen sie hier — du wirst auch per E-Mail informiert.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {auktionenSortiert.map(t => {
              const angeboteCount = (t.angebote as { id: string }[] | undefined)?.length || 0
              return (
                <div
                  key={t.id}
                  className="bg-white rounded-2xl border border-[#EDE8E1] p-5 cursor-pointer hover:border-[#3D8B7A]/40 hover:shadow-sm transition-all group"
                  onClick={() => router.push(`/dashboard-handwerker/angebot/${t.id}`)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-1 self-stretch rounded-full bg-[#3D8B7A]/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-base font-semibold text-[#2D2A26] truncate">{t.titel}</h3>
                        {t.auktion_ende && <Timer end={t.auktion_ende} />}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {standortGesetzt && t.einsatzort_lat && t.einsatzort_lng && (
                          <DistanceBadge
                            vonLat={profile?.lat}
                            vonLng={profile?.lng}
                            zuLat={t.einsatzort_lat}
                            zuLng={t.einsatzort_lng}
                            radiusKm={profile?.radius_km}
                            zeigeFahrzeit
                          />
                        )}
                        {t.einsatzort_adresse && !standortGesetzt && (
                          <span className="text-xs text-[#8C857B]">📍 {t.einsatzort_adresse}</span>
                        )}
                        {t.wohnung && (
                          <span className="text-xs text-[#8C857B]">{t.wohnung}</span>
                        )}
                        <span className="text-xs text-[#8C857B]">
                          · {angeboteCount} {angeboteCount === 1 ? "Angebot" : "Angebote"}
                        </span>
                      </div>

                      {t.beschreibung && (
                        <p className="text-sm text-[#6B665E] line-clamp-2 mb-3">{t.beschreibung}</p>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#3D8B7A] group-hover:translate-x-0.5 transition-transform">
                          Angebot abgeben →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Meine Aufträge */}
      {meineAuftraege.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#2D2A26]">Meine laufenden Aufträge</h2>
            <Link href="/dashboard-handwerker/auftraege" className="text-sm text-[#3D8B7A] hover:text-[#2D6B5A] font-medium">
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
                      {t.einsatzort_adresse && ` · 📍 ${t.einsatzort_adresse}`}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    t.status === "erledigt"
                      ? "bg-[#3D8B7A]/10 text-[#3D8B7A]"
                      : t.status === "in_bearbeitung" || t.status === "in_arbeit"
                      ? "bg-[#C4956A]/10 text-[#C4956A]"
                      : "bg-[#EDE8E1] text-[#6B665E]"
                  }`}>
                    {t.status === "erledigt" ? "Erledigt"
                      : t.status === "in_bearbeitung" || t.status === "in_arbeit" ? "In Arbeit"
                      : t.status}
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

function QuickAction({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-[#EDE8E1] p-3 text-center hover:border-[#3D8B7A]/30 hover:shadow-sm transition-all group"
    >
      <div className="text-base mb-1 text-[#3D8B7A]">{icon}</div>
      <div className="text-xs font-medium text-[#6B665E] group-hover:text-[#3D8B7A] transition-colors">{label}</div>
    </Link>
  )
}
