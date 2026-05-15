"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Ticket, UserProfile, formatGewerk } from "@/types"
import DistanceBadge from "@/components/DistanceBadge"
import { Timer } from "@/components/ui/Timer"
import { haversineKm } from "@/lib/distance"

type Dringlichkeit = "notfall" | "zeitnah" | "planbar"

const DRINGLICHKEITS_BADGE: Record<Dringlichkeit, { label: string; cls: string }> = {
  notfall: { label: "🔴 Notfall", cls: "bg-danger/10 text-danger border border-danger/20" },
  zeitnah: { label: "🟡 Zeitnah", cls: "bg-warm/10 text-warm border border-warm/20" },
  planbar: { label: "🟢 Planbar", cls: "bg-accent/10 text-accent border border-accent/20" },
}

export default function HandwerkerDashboard() {
  const router = useRouter()
  const [auktionen, setAuktionen] = useState<Ticket[]>([])
  const [meineAuftraege, setMeineAuftraege] = useState<Ticket[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [zeigeAusserhalb, setZeigeAusserhalb] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const [{ data: prof }, { data: offene }, { data: meine }] = await Promise.all([
      supabase.from("profiles").select("id, email, name, rolle, firma, gewerk, lat, lng, radius_km, bewertung_avg, auftraege_anzahl, sichtbarkeit_stufe, verfuegbarkeit_score, angebotstreue, created_at").eq("id", user.id).single(),
      supabase.from("tickets").select("*, angebote(*)").eq("status", "auktion")
        .gt("auktion_ende", new Date().toISOString()).order("auktion_ende"),
      supabase.from("tickets").select("*").eq("zugewiesener_hw", user.id)
        .order("created_at", { ascending: false }),
    ])
    setProfile(prof)
    setAuktionen(offene || [])
    setMeineAuftraege(meine || [])
    setLoading(false)
  }, [router])

  useEffect(() => { void load() }, [load])

  // Realtime: neue Auktionen + Statusänderungen sofort sehen (F-3).
  // Wir lauschen unfiltered auf tickets — client-seitig filtern wir
  // schon nach Gewerk/Radius/zugewiesener_hw. Volumen ist OK weil
  // tickets-Tabelle keine hunderte Inserts/Sek hat.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("handwerker-tickets-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => { void load() },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-ink-muted">Lädt…</span>
      </div>
    </div>
  )

  const standortGesetzt = profile?.lat != null && profile?.lng != null
  const radiusKm = profile?.radius_km ?? 25
  const meinGewerk = profile?.gewerk?.toLowerCase()

  // Distanz-Map für effizientes Filtern + Sortieren
  const distanzVon = (t: Ticket): number => {
    if (!standortGesetzt || t.einsatzort_lat == null || t.einsatzort_lng == null) return Infinity
    return haversineKm(profile!.lat!, profile!.lng!, t.einsatzort_lat, t.einsatzort_lng)
  }

  // Gewerk-Match: Ticket-Gewerk gleicht Handwerker-Gewerk oder ist
  // 'allgemein' (offen für alle Gewerke). Ohne gepflegtes Gewerk auf
  // beiden Seiten zählt als Match.
  const passtZumGewerk = (t: Ticket): boolean => {
    if (!meinGewerk) return true
    const tg = t.gewerk?.toLowerCase()
    if (!tg || tg === "allgemein") return true
    return tg.includes(meinGewerk) || meinGewerk.includes(tg)
  }

  // Im-Radius-Filter: ohne Standort zeigen wir alles
  const imRadiusListe = standortGesetzt
    ? auktionen.filter(t => distanzVon(t) <= radiusKm)
    : auktionen
  const imRadius = imRadiusListe.length
  const ausserhalb = auktionen.length - imRadius

  // Anzeige-Liste: standardmäßig Im-Radius + Gewerk-Match, optional alle
  const sichtbareAuktionen = (standortGesetzt && !zeigeAusserhalb
    ? imRadiusListe
    : auktionen
  ).filter(passtZumGewerk)
  const ausgeblendetWegenGewerk =
    (standortGesetzt && !zeigeAusserhalb ? imRadiusListe : auktionen).length -
    sichtbareAuktionen.length

  // Sortierung:
  //  Primär: Smart-Score absteigend (wenn der Handwerker schon ein Bid hat)
  //  Sekundär: Distanz aufsteigend
  // Smart-Score-Vorgriff: liegt nur am eigenen Bid vor — falls noch keiner
  // existiert, sortieren wir reine Distanz.
  const auktionenSortiert = [...sichtbareAuktionen].sort((a, b) => {
    const aBid = a.angebote?.find(x => x.handwerker_id === profile?.id)
    const bBid = b.angebote?.find(x => x.handwerker_id === profile?.id)
    const sa = aBid?.smart_score ?? null
    const sb = bBid?.smart_score ?? null
    if (sa != null && sb != null && sa !== sb) return sb - sa
    return distanzVon(a) - distanzVon(b)
  })

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
      {/* Hero Greeting */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ink">
          Hallo, {profile?.firma || profile?.name || "Handwerker"}
        </h1>
        <p className="text-sm text-ink-muted mt-1.5">
          {profile?.gewerk && <span>{formatGewerk(profile.gewerk)}</span>}
          {/* React rendert die Number 0 als Text — daher explizit > 0
              prüfen, sonst sieht der HW "Heizung0Noch keine Bewertungen". */}
          {profile?.bewertung_avg != null && Number(profile.bewertung_avg) > 0 ? (
            <>
              {profile?.gewerk ? " · " : null}
              <span className="text-warm font-medium">★ {profile.bewertung_avg}</span>
            </>
          ) : (
            <>
              {profile?.gewerk ? " · " : null}
              <span>Noch keine Bewertungen</span>
            </>
          )}
          {standortGesetzt && profile?.radius_km && (
            <>
              {" · "}
              <span className="text-accent">📍 {profile.radius_km} km Radius</span>
            </>
          )}
        </p>
      </div>

      {/* Sichtbarkeits-Stufe — Gamification sichtbar (B2-W3) */}
      <SichtbarkeitsBadge profile={profile} />


      {/* Standort-Setup-Banner wenn nicht konfiguriert */}
      {!standortGesetzt && (
        <Link
          href="/dashboard-handwerker/profil"
          className="block mb-6 p-4 rounded-2xl border-2 border-warm/40 bg-warm-light hover:bg-[#F5E5D0] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warm/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">📍</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink">Standort einrichten</div>
              <div className="text-xs text-warm-dark mt-0.5">
                Damit du nur Aufträge in deiner Nähe siehst und die Fahrzeit fair berechnet wird
              </div>
            </div>
            <span className="text-warm-dark">→</span>
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
        <div className="bg-white rounded-2xl border border-line p-5">
          <div className="text-xs text-ink-muted font-medium mb-1 uppercase tracking-wide">
            Meine Aufträge
          </div>
          <div className="text-4xl font-bold text-ink tabular-nums">{meineAuftraege.length}</div>
          <div className="text-xs text-ink-muted mt-2">aktuell zugewiesen</div>
        </div>
        <div className="bg-white rounded-2xl border border-line p-5">
          <div className="text-xs text-ink-muted font-medium mb-1 uppercase tracking-wide">
            Bewertung
          </div>
          <div className="text-4xl font-bold text-warm tabular-nums">
            {profile?.bewertung_avg ? profile.bewertung_avg : "—"}
          </div>
          <div className="text-xs text-ink-muted mt-2">
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
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-ink">Aktuelle Ausschreibungen</h2>
          <div className="flex items-center gap-3 text-xs">
            {standortGesetzt && (
              zeigeAusserhalb ? (
                <button
                  onClick={() => setZeigeAusserhalb(false)}
                  className="text-accent hover:underline font-medium"
                >
                  Nur im Radius zeigen ({imRadius})
                </button>
              ) : ausserhalb > 0 ? (
                <button
                  onClick={() => setZeigeAusserhalb(true)}
                  className="text-ink-muted hover:text-ink font-medium"
                >
                  + {ausserhalb} außerhalb anzeigen
                </button>
              ) : (
                <span className="text-ink-muted">Nach Smart-Score sortiert</span>
              )
            )}
          </div>
        </div>

        {auktionenSortiert.length === 0 ? (
          <div className="bg-white rounded-2xl border border-line p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-surface flex items-center justify-center mb-3">
              <span className="text-2xl opacity-60">📋</span>
            </div>
            <div className="text-base font-semibold text-ink mb-1">Aktuell keine Ausschreibungen</div>
            <div className="text-sm text-ink-muted max-w-sm mx-auto">
              Sobald Verwalter neue Aufträge ausschreiben, erscheinen sie hier — du wirst auch per E-Mail informiert.
            </div>
            {ausgeblendetWegenGewerk > 0 && (
              <div className="text-xs text-ink-muted mt-4">
                {ausgeblendetWegenGewerk} weitere Auktion(en) passen nicht zu deinem Gewerk
                {profile?.gewerk && <> ({formatGewerk(profile.gewerk)})</>}.
                <Link href="/dashboard-handwerker/profil" className="ml-1 text-accent hover:underline">
                  Gewerk ändern
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {auktionenSortiert.map((t, i) => {
              const angeboteCount = (t.angebote as { id: string }[] | undefined)?.length || 0
              return (
                <div
                  key={t.id}
                  // animate-fade-in mit minimal staggered delay (max 5 sichtbar)
                  // — fühlt sich smooth an, lenkt nicht ab
                  style={i < 5 ? { animationDelay: `${i * 40}ms` } : undefined}
                  className="bg-white rounded-2xl border border-line p-5 cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group animate-fade-in"
                  onClick={() => router.push(`/dashboard-handwerker/angebot/${t.id}`)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-1 self-stretch rounded-full bg-accent/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-base font-semibold text-ink truncate">{t.titel}</h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {(() => {
                            const d = (t as Ticket & { dringlichkeit?: Dringlichkeit }).dringlichkeit
                            if (!d) return null
                            const badge = DRINGLICHKEITS_BADGE[d]
                            return (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                                {badge.label}
                              </span>
                            )
                          })()}
                          {t.auktion_ende && <Timer end={t.auktion_ende} />}
                        </div>
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
                          <span className="text-xs text-ink-muted">📍 {t.einsatzort_adresse}</span>
                        )}
                        {t.wohnung && (
                          <span className="text-xs text-ink-muted">{t.wohnung}</span>
                        )}
                        <span className="text-xs text-ink-muted">
                          · {angeboteCount} {angeboteCount === 1 ? "Angebot" : "Angebote"}
                        </span>
                      </div>

                      {t.beschreibung && (
                        <p className="text-sm text-ink-secondary line-clamp-2 mb-3">{t.beschreibung}</p>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-accent group-hover:translate-x-0.5 transition-transform">
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
            <h2 className="text-lg font-semibold text-ink">Meine laufenden Aufträge</h2>
            <Link href="/dashboard-handwerker/auftraege" className="text-sm text-accent hover:text-[#2D6B5A] font-medium">
              Alle anzeigen →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {meineAuftraege.slice(0, 5).map(t => (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-line p-4 cursor-pointer hover:border-accent/30 hover:shadow-sm transition-all"
                onClick={() => router.push(`/dashboard-handwerker/ticket/${t.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    t.status === "erledigt" ? "bg-accent" : "bg-warm"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{t.titel}</div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {new Date(t.created_at).toLocaleDateString("de")}
                      {t.einsatzort_adresse && ` · 📍 ${t.einsatzort_adresse}`}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    t.status === "erledigt"
                      ? "bg-accent/10 text-accent"
                      : t.status === "in_bearbeitung"
                      ? "bg-warm/10 text-warm"
                      : "bg-line text-ink-secondary"
                  }`}>
                    {t.status === "erledigt" ? "Erledigt"
                      : t.status === "in_bearbeitung" ? "In Arbeit"
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
      className="bg-white rounded-xl border border-line p-3 text-center hover:border-accent/30 hover:shadow-sm transition-all group"
    >
      <div className="text-base mb-1 text-accent">{icon}</div>
      <div className="text-xs font-medium text-ink-secondary group-hover:text-accent transition-colors">{label}</div>
    </Link>
  )
}

// Sichtbarkeits-Stufe + 3-Komponenten-Score (B2-W3).
// Macht die V1-Recompute-Logik für den HW selbst nachvollziehbar:
// er sieht warum er gold/silber/bronze ist und was er verbessern kann.
function SichtbarkeitsBadge({ profile }: { profile: UserProfile | null }) {
  if (!profile) return null
  const stufe = (profile.sichtbarkeit_stufe as "gold" | "silber" | "bronze" | null) ?? "bronze"
  const score = profile.verfuegbarkeit_score ?? 0
  const treue = profile.angebotstreue ?? 100

  const stufeConfig = {
    gold:   { bg: "bg-warm/15", text: "text-warm-dark", border: "border-warm/30", emoji: "🥇" },
    silber: { bg: "bg-[#8C857B]/15", text: "text-ink-secondary", border: "border-[#8C857B]/30", emoji: "🥈" },
    bronze: { bg: "bg-[#A37749]/15", text: "text-warm-dark", border: "border-[#A37749]/30", emoji: "🥉" },
  }[stufe]

  const naechsteStufe = stufe === "bronze" ? { name: "Silber", schwelle: 50 }
                       : stufe === "silber" ? { name: "Gold", schwelle: 75 }
                       : null
  const fehlend = naechsteStufe ? Math.max(0, naechsteStufe.schwelle - Number(score)) : 0

  return (
    <div className={`mb-6 rounded-2xl border ${stufeConfig.border} ${stufeConfig.bg} p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-3xl">{stufeConfig.emoji}</div>
        <div className="flex-1">
          <div className={`text-xs font-bold uppercase tracking-wider ${stufeConfig.text}`}>
            Sichtbarkeits-Stufe
          </div>
          <div className={`text-xl font-bold ${stufeConfig.text} capitalize`}>{stufe}</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold tabular-nums ${stufeConfig.text}`}>{Number(score).toFixed(0)}</div>
          <div className="text-[10px] text-ink-secondary">/ 100</div>
        </div>
      </div>
      <div className="text-xs text-ink-secondary space-y-1 mb-2">
        <div>💡 <span className="font-medium">Angebotstreue: {Number(treue).toFixed(0)} %</span> · höher = besserer Bonus bei jedem Bid</div>
        <div>⚡ Stufe wirkt als Multiplier (×1.05 Silber, ×1.10 Gold) auf jeden Smart-Score</div>
      </div>
      {naechsteStufe && fehlend > 0 && (
        <div className="text-xs text-accent font-medium">
          Noch {fehlend} Punkte zur {naechsteStufe.name}-Stufe — mehr Zeitslots oder Bewertungen sammeln
        </div>
      )}
      {!naechsteStufe && (
        <div className="text-xs text-accent font-medium">
          Höchste Stufe erreicht — weiter aktiv bleiben um sie zu halten
        </div>
      )}
    </div>
  )
}
