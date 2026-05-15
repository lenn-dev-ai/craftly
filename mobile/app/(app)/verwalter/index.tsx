import { useCallback, useEffect, useState } from "react"
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from "react-native"
import { Header } from "../../../components/Header"
import { supabase } from "../../../lib/supabase"
import { useAuth } from "../../../lib/auth-context"

interface Pipeline {
  offen: number
  auktion: number
  inBearbeitung: number
  erledigtMonat: number
  befundeWartend: number
  offeneNachtraege: number
  kostenMonatEur: number
}

export default function VerwalterDashboard() {
  const { user, profile } = useAuth()
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const monatsStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [
      { count: offen },
      { count: auktion },
      { count: inBearb },
      { data: erledigteTickets },
      { count: befundeWartend },
      { data: nachtragRows },
    ] = await Promise.all([
      supabase.from("tickets").select("id", { count: "exact", head: true })
        .eq("verwalter_id", user.id).eq("status", "offen"),
      supabase.from("tickets").select("id", { count: "exact", head: true })
        .eq("verwalter_id", user.id).eq("status", "auktion"),
      supabase.from("tickets").select("id", { count: "exact", head: true })
        .eq("verwalter_id", user.id).eq("status", "in_bearbeitung"),
      supabase.from("tickets").select("kosten_final, created_at")
        .eq("verwalter_id", user.id).eq("status", "erledigt").gte("created_at", monatsStart),
      supabase.from("tickets").select("id", { count: "exact", head: true })
        .eq("verwalter_id", user.id).eq("ticket_typ", "diagnose")
        .neq("status", "erledigt").not("befund_text", "is", null),
      supabase.from("nachtraege").select("id, tickets!inner(verwalter_id)")
        .eq("status", "offen").eq("tickets.verwalter_id", user.id),
    ])

    const kostenMonat = (erledigteTickets as Array<{ kosten_final: number | null }> ?? [])
      .reduce((s, t) => s + (t.kosten_final ?? 0), 0)

    setPipeline({
      offen: offen ?? 0,
      auktion: auktion ?? 0,
      inBearbeitung: inBearb ?? 0,
      erledigtMonat: erledigteTickets?.length ?? 0,
      befundeWartend: befundeWartend ?? 0,
      offeneNachtraege: nachtragRows?.length ?? 0,
      kostenMonatEur: Math.round(kostenMonat),
    })
    setLoading(false)
    setRefreshing(false)
  }, [user])

  useEffect(() => { void load() }, [load])

  return (
    <View className="flex-1 bg-bg">
      <Header
        title="Übersicht"
        subtitle={profile?.name ? `Hallo, ${profile.name.split(" ")[0]}` : undefined}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3D8B7A" /></View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} tintColor="#3D8B7A" />}
        >
          {/* Pipeline-Action-Banner */}
          {pipeline && (pipeline.befundeWartend > 0 || pipeline.offeneNachtraege > 0) && (
            <View className="bg-admin/10 border border-admin/30 rounded-xl p-4 mb-4">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-admin mb-2">
                Wartet auf deine Entscheidung
              </Text>
              <View className="flex-row gap-4">
                {pipeline.befundeWartend > 0 && (
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-text">{pipeline.befundeWartend}</Text>
                    <Text className="text-xs text-muted">Diagnose-Befunde</Text>
                  </View>
                )}
                {pipeline.offeneNachtraege > 0 && (
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-text">{pipeline.offeneNachtraege}</Text>
                    <Text className="text-xs text-muted">Offene Nachträge</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* KPI Grid */}
          <View className="flex-row flex-wrap -mx-1">
            <Kpi label="Eingegangen" value={pipeline?.offen ?? 0} accent="warm" />
            <Kpi label="Auf Marktplatz" value={pipeline?.auktion ?? 0} accent="accent" />
            <Kpi label="In Arbeit" value={pipeline?.inBearbeitung ?? 0} accent="mieter" />
            <Kpi label="Kosten / Monat" value={`${pipeline?.kostenMonatEur.toLocaleString("de") ?? 0} €`} accent="muted" small />
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function Kpi({ label, value, accent, small }: { label: string; value: string | number; accent: string; small?: boolean }) {
  const accentCls = accent === "warm" ? "text-warm"
                  : accent === "accent" ? "text-accent"
                  : accent === "mieter" ? "text-mieter"
                  : "text-muted"
  return (
    <View className="w-1/2 px-1 mb-2">
      <View className="bg-card border border-border rounded-xl p-4">
        <Text className={`font-bold text-text ${small ? "text-xl" : "text-3xl"} tabular-nums`}>{value}</Text>
        <Text className={`text-xs font-medium mt-1 ${accentCls}`}>{label}</Text>
      </View>
    </View>
  )
}
