import { useCallback, useEffect, useState } from "react"
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from "react-native"
import { Header } from "../../../components/Header"
import { supabase } from "../../../lib/supabase"
import { useAuth } from "../../../lib/auth-context"

interface Auftrag {
  id: string
  titel: string
  gewerk: string | null
  einsatzort_adresse: string | null
  auktion_ende: string | null
  prioritaet: string | null
  ticket_typ: string | null
  status: string
}

interface Stats {
  meineAuftraege: number
  sichtbarkeitsStufe: string
  verfuegbarkeitScore: number
  angebotstreue: number
}

const PRIO_LABEL: Record<string, { label: string; cls: string }> = {
  dringend: { label: "🔴 Notfall",  cls: "text-danger" },
  hoch:     { label: "🟡 Zeitnah",  cls: "text-warm" },
  normal:   { label: "🟢 Planbar",  cls: "text-accent" },
}

export default function HandwerkerDashboard() {
  const { user, profile } = useAuth()
  const [auftraege, setAuftraege] = useState<Auftrag[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user || !profile) return
    const meinGewerk = profile.rolle === "handwerker"
      ? (profile as { gewerk?: string }).gewerk
      : null

    // Offene Auktionen für sein Gewerk
    let q = supabase
      .from("tickets")
      .select("id, titel, gewerk, einsatzort_adresse, auktion_ende, prioritaet, ticket_typ, status")
      .eq("status", "auktion")
      .order("auktion_ende", { ascending: true, nullsFirst: false })
      .limit(20)
    if (meinGewerk) q = q.or(`gewerk.eq.${meinGewerk},gewerk.eq.allgemein,gewerk.is.null`)

    const [{ data: auks }, { count: myCount }, { data: myProfile }] = await Promise.all([
      q,
      supabase.from("tickets").select("id", { count: "exact", head: true }).eq("zugewiesener_hw", user.id),
      supabase.from("profiles").select("sichtbarkeit_stufe, verfuegbarkeit_score, angebotstreue").eq("id", user.id).single(),
    ])

    setAuftraege((auks as Auftrag[]) ?? [])
    setStats({
      meineAuftraege: myCount ?? 0,
      sichtbarkeitsStufe: (myProfile as { sichtbarkeit_stufe?: string } | null)?.sichtbarkeit_stufe ?? "bronze",
      verfuegbarkeitScore: Number((myProfile as { verfuegbarkeit_score?: number } | null)?.verfuegbarkeit_score ?? 0),
      angebotstreue: Number((myProfile as { angebotstreue?: number } | null)?.angebotstreue ?? 100),
    })
    setLoading(false)
    setRefreshing(false)
  }, [user, profile])

  useEffect(() => { void load() }, [load])

  return (
    <View className="flex-1 bg-bg">
      <Header
        title={profile?.name?.split(" ")[0] ? `Hallo, ${profile.name.split(" ")[0]}` : "Aufträge"}
        subtitle={`${auftraege.length} verfügbar · ${stats?.meineAuftraege ?? 0} in Arbeit`}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3D8B7A" /></View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} tintColor="#3D8B7A" />}
        >
          {/* Sichtbarkeits-Badge */}
          {stats && <StufenBadge stats={stats} />}

          {/* Auftrags-Feed */}
          <Text className="text-xs font-bold uppercase tracking-wider text-muted mt-6 mb-3">
            Verfügbare Aufträge
          </Text>
          {auftraege.length === 0 ? (
            <View className="bg-card border border-border rounded-xl p-8 items-center">
              <Text className="text-muted">Aktuell keine Aufträge in deinem Gewerk.</Text>
            </View>
          ) : (
            <View className="gap-2">
              {auftraege.map(a => <AuftragCard key={a.id} a={a} />)}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

function StufenBadge({ stats }: { stats: Stats }) {
  const emoji = stats.sichtbarkeitsStufe === "gold" ? "🥇"
              : stats.sichtbarkeitsStufe === "silber" ? "🥈" : "🥉"
  return (
    <View className="bg-warm/15 border border-warm/30 rounded-xl p-4">
      <View className="flex-row items-center gap-3 mb-2">
        <Text className="text-3xl">{emoji}</Text>
        <View className="flex-1">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-warm">Sichtbarkeits-Stufe</Text>
          <Text className="text-lg font-bold text-text capitalize">{stats.sichtbarkeitsStufe}</Text>
        </View>
        <View>
          <Text className="text-xl font-bold text-text text-right">{stats.verfuegbarkeitScore.toFixed(0)}</Text>
          <Text className="text-[10px] text-soft text-right">/ 100</Text>
        </View>
      </View>
      <Text className="text-xs text-soft">
        Angebotstreue: <Text className="font-semibold text-text">{stats.angebotstreue.toFixed(0)} %</Text>
      </Text>
    </View>
  )
}

function AuftragCard({ a }: { a: Auftrag }) {
  const prio = a.prioritaet ? PRIO_LABEL[a.prioritaet] : null
  return (
    <View className="bg-card border border-border rounded-xl p-4">
      <View className="flex-row items-start justify-between gap-2 mb-1">
        <Text className="text-base font-semibold text-text flex-1" numberOfLines={1}>{a.titel}</Text>
        {a.ticket_typ === "diagnose" && (
          <Text className="text-[9px] font-bold uppercase tracking-wider text-admin bg-admin/10 border border-admin/20 px-1.5 py-0.5 rounded">
            Diagnose
          </Text>
        )}
      </View>
      <View className="flex-row items-center gap-2 mb-1">
        {prio && <Text className={`text-xs font-semibold ${prio.cls}`}>{prio.label}</Text>}
        {a.gewerk && <Text className="text-xs text-muted">· {a.gewerk}</Text>}
      </View>
      {a.einsatzort_adresse && (
        <Text className="text-xs text-soft" numberOfLines={1}>📍 {a.einsatzort_adresse}</Text>
      )}
    </View>
  )
}
