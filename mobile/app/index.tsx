import { useEffect } from "react"
import { Redirect } from "expo-router"
import { View, ActivityIndicator } from "react-native"
import { useAuth, type Rolle } from "../lib/auth-context"

// Root-Route: leitet abhängig von Auth-State + Rolle weiter.
// /             ─→ /(auth)/login    (kein Login)
//               ─→ /(app)/mieter    (rolle=mieter)
//               ─→ /(app)/handwerker
//               ─→ /(app)/verwalter
const ROLLE_HOME: Record<Rolle, string> = {
  mieter:     "/(app)/mieter",
  handwerker: "/(app)/handwerker",
  verwalter:  "/(app)/verwalter",
  admin:      "/(app)/verwalter", // Admin nutzt vorerst Verwalter-Sicht
}

export default function Index() {
  const { session, profile, loading } = useAuth()

  // Während Auth-Restore: Spinner
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color="#3D8B7A" />
      </View>
    )
  }

  if (!session) return <Redirect href="/(auth)/login" />

  // Eingelogged aber Profile lädt noch
  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color="#3D8B7A" />
      </View>
    )
  }

  const home = profile.rolle ? ROLLE_HOME[profile.rolle] : null
  if (!home) {
    return <Redirect href="/(auth)/login" />
  }
  return <Redirect href={home as never} />
}
