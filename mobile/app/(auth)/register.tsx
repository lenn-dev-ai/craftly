import { useState } from "react"
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from "react-native"
import { Link, useRouter } from "expo-router"
import { supabase } from "../../lib/supabase"
import type { Rolle } from "../../lib/auth-context"

const ROLLEN: Array<{ key: Rolle; label: string; desc: string }> = [
  { key: "mieter",     label: "Mieter",     desc: "Schäden melden, Status verfolgen" },
  { key: "handwerker", label: "Handwerker", desc: "Aufträge finden, Angebote abgeben" },
  { key: "verwalter",  label: "Verwalter",  desc: "Objekte verwalten, Pipeline steuern" },
]

export default function RegisterScreen() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [rolle, setRolle] = useState<Rolle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleRegister() {
    setError("")
    if (!email || !password || !name || !rolle) {
      setError("Bitte alle Felder ausfüllen und Rolle wählen.")
      return
    }
    if (password.length < 8) {
      setError("Passwort mindestens 8 Zeichen.")
      return
    }
    setLoading(true)
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    })
    if (signUpErr || !data.user) {
      setError("Registrierung fehlgeschlagen: " + (signUpErr?.message ?? "unbekannt"))
      setLoading(false)
      return
    }
    // Profile-Insert via Trigger oder manuell — wir machen es manuell
    const { error: profileErr } = await supabase.from("profiles").upsert({
      id: data.user.id,
      email,
      name,
      rolle,
    }, { onConflict: "id" })
    setLoading(false)
    if (profileErr) {
      setError("Profil anlegen fehlgeschlagen: " + profileErr.message)
      return
    }
    router.replace("/")
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 px-6 pt-20 pb-8">
        <Text className="text-3xl font-bold text-text mb-2">Repa<Text className="text-accent">ro</Text></Text>
        <Text className="text-sm text-muted mb-10">Account erstellen</Text>

        {error ? (
          <View className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/20">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        ) : null}

        <Field label="Name" value={name} onChangeText={setName} placeholder="Vor- und Nachname" />
        <Field label="E-Mail-Adresse" value={email} onChangeText={setEmail} placeholder="name@beispiel.de" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Passwort (min. 8 Zeichen)" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />

        <Text className="text-xs font-medium text-soft mb-2 mt-2">Ich bin…</Text>
        <View className="gap-2 mb-6">
          {ROLLEN.map(r => (
            <Pressable
              key={r.key}
              onPress={() => setRolle(r.key)}
              className={`border rounded-xl p-4 ${
                rolle === r.key
                  ? "bg-accent/10 border-accent"
                  : "bg-card border-border"
              }`}
            >
              <Text className={`font-semibold ${rolle === r.key ? "text-accent" : "text-text"}`}>
                {r.label}
              </Text>
              <Text className="text-xs text-muted mt-0.5">{r.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleRegister}
          disabled={loading}
          className="bg-accent rounded-xl py-4 active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center text-white font-semibold">Account erstellen</Text>
          )}
        </Pressable>

        <View className="flex-row justify-center gap-1 mt-6">
          <Text className="text-sm text-muted">Schon ein Account?</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text className="text-sm text-accent font-semibold">Anmelden</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  )
}

function Field(props: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  secureTextEntry?: boolean
  keyboardType?: "default" | "email-address" | "numeric"
  autoCapitalize?: "none" | "sentences" | "words"
}) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-medium text-soft mb-1.5">{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#B5AEA4"
        className="bg-card border border-border rounded-xl px-4 py-3.5 text-base text-text"
      />
    </View>
  )
}
