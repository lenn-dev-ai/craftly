import { useCallback, useEffect, useState } from "react"
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from "react-native"
import { Header } from "../../../components/Header"
import { supabase } from "../../../lib/supabase"
import { useAuth } from "../../../lib/auth-context"

interface Ticket {
  id: string
  titel: string
  beschreibung: string | null
  status: string
  prioritaet: string | null
  ticket_typ: string | null
  befund_text: string | null
  projekt_angebot: number | null
  zugewiesener_hw: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  offen: "Eingegangen",
  auktion: "Wartet auf Handwerker",
  in_bearbeitung: "In Bearbeitung",
  erledigt: "Erledigt",
}

const STATUS_COLOR: Record<string, string> = {
  offen: "bg-mieter/10 text-mieter",
  auktion: "bg-warm/10 text-warm",
  in_bearbeitung: "bg-accent/10 text-accent",
  erledigt: "bg-muted/15 text-muted",
}

export default function MieterDashboard() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from("tickets")
      .select("id, titel, beschreibung, status, prioritaet, ticket_typ, befund_text, projekt_angebot, zugewiesener_hw, created_at")
      .eq("erstellt_von", user.id)
      .order("created_at", { ascending: false })
    setTickets((data as Ticket[]) ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [user])

  useEffect(() => { void load() }, [load])

  const offen = tickets.filter(t => t.status !== "erledigt")
  const erledigt = tickets.filter(t => t.status === "erledigt")

  return (
    <View className="flex-1 bg-bg">
      <Header
        title="Meine Vorgänge"
        subtitle={offen.length === 0
          ? "Alles in Ordnung"
          : `${offen.length} offen${offen.length === 1 ? "" : "e"}`}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3D8B7A" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} tintColor="#3D8B7A" />}
        >
          {tickets.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {offen.length > 0 && (
                <View className="mb-6">
                  <SectionLabel>Offene Vorgänge</SectionLabel>
                  <View className="gap-2">
                    {offen.map(t => <TicketCard key={t.id} t={t} />)}
                  </View>
                </View>
              )}
              {erledigt.length > 0 && (
                <View>
                  <SectionLabel>Erledigt ({erledigt.length})</SectionLabel>
                  <View className="gap-2">
                    {erledigt.slice(0, 5).map(t => <TicketCard key={t.id} t={t} faded />)}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* FAB — Schaden melden */}
      <View className="absolute bottom-8 right-6">
        <Pressable
          onPress={() => {/* TODO Phase 2: navigation zu /mieter/melden */}}
          className="bg-accent rounded-full w-14 h-14 items-center justify-center shadow-lg active:opacity-80"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 }}
        >
          <Text className="text-white text-3xl font-light leading-7">+</Text>
        </Pressable>
      </View>
    </View>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{children}</Text>
}

function TicketCard({ t, faded }: { t: Ticket; faded?: boolean }) {
  const statusCls = STATUS_COLOR[t.status] ?? "bg-muted/10 text-muted"
  const istDiag = t.ticket_typ === "diagnose"
  return (
    <View className={`bg-card border border-border rounded-xl p-4 ${faded ? "opacity-60" : ""}`}>
      <View className="flex-row items-start justify-between gap-2 mb-2">
        <Text className="text-base font-semibold text-text flex-1" numberOfLines={1}>{t.titel}</Text>
        {istDiag && (
          <Text className="text-[9px] font-bold uppercase tracking-wider text-admin bg-admin/10 border border-admin/20 px-1.5 py-0.5 rounded">
            Diagnose
          </Text>
        )}
      </View>
      <View className="flex-row items-center gap-2 mb-2">
        <Text className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${statusCls}`}>
          {STATUS_LABEL[t.status] ?? t.status}
        </Text>
        <Text className="text-[11px] text-muted">
          {new Date(t.created_at).toLocaleDateString("de", { day: "2-digit", month: "short" })}
        </Text>
      </View>
      {istDiag && t.status !== "erledigt" && (
        <Text className="text-xs text-accent">
          {!t.zugewiesener_hw
            ? "Wartet auf Handwerker"
            : !t.befund_text
              ? "Termin läuft"
              : `Befund + Festpreis (${t.projekt_angebot ?? "—"} €) — Verwalter entscheidet`}
        </Text>
      )}
      {t.beschreibung ? (
        <Text className="text-xs text-soft mt-1" numberOfLines={2}>{t.beschreibung}</Text>
      ) : null}
    </View>
  )
}

function EmptyState() {
  return (
    <View className="items-center py-16">
      <View className="w-16 h-16 rounded-2xl bg-card border border-border items-center justify-center mb-4">
        <Text className="text-3xl">🏠</Text>
      </View>
      <Text className="text-lg font-semibold text-text">Noch keine Meldungen</Text>
      <Text className="text-sm text-muted mt-1 text-center">
        Tippe den + Button um einen Schaden zu melden.
      </Text>
    </View>
  )
}
