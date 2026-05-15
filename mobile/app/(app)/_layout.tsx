import { Stack, Redirect } from "expo-router"
import { View, ActivityIndicator } from "react-native"
import { useAuth } from "../../lib/auth-context"

export default function AppLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color="#3D8B7A" />
      </View>
    )
  }
  if (!session) return <Redirect href="/(auth)/login" />

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAF8F5" } }} />
  )
}
