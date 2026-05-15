import { useState } from "react"
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native"
import { Link, useRouter } from "expo-router"
import { supabase } from "../../lib/supabase"

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin() {
    setError("")
    if (!email || !password) {
      setError("E-Mail und Passwort sind Pflicht.")
      return
    }
    setLoading(true)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInErr) {
      setError("Login fehlgeschlagen: " + signInErr.message)
      return
    }
    // AuthContext bekommt das Update via onAuthStateChange.
    // Index-Route routet nach Rolle.
    router.replace("/")
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-bg"
    >
      <View className="flex-1 px-6 pt-24 pb-12 justify-between">
        <View>
          <Text className="text-3xl font-bold text-text mb-2">Repa<Text className="text-accent">ro</Text></Text>
          <Text className="text-sm text-muted mb-12">Hausverwaltung in deiner Tasche.</Text>

          <Text className="text-2xl font-bold text-text mb-6">Anmelden</Text>

          {error ? (
            <View className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/20">
              <Text className="text-sm text-danger">{error}</Text>
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="text-xs font-medium text-soft mb-1.5">E-Mail-Adresse</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@beispiel.de"
              placeholderTextColor="#B5AEA4"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              className="bg-card border border-border rounded-xl px-4 py-3.5 text-base text-text"
            />
          </View>

          <View className="mb-6">
            <Text className="text-xs font-medium text-soft mb-1.5">Passwort</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#B5AEA4"
              secureTextEntry
              autoComplete="password"
              className="bg-card border border-border rounded-xl px-4 py-3.5 text-base text-text"
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className="bg-accent rounded-xl py-4 active:opacity-80 disabled:opacity-50"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-center text-white font-semibold">Anmelden</Text>
            )}
          </Pressable>
        </View>

        <View className="flex-row justify-center gap-1">
          <Text className="text-sm text-muted">Noch kein Account?</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text className="text-sm text-accent font-semibold">Registrieren</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
