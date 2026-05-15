import { View, Text, Pressable } from "react-native"
import { useAuth } from "../lib/auth-context"

interface Props {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: Props) {
  const { signOut, profile } = useAuth()
  return (
    <View className="px-6 pt-14 pb-4 bg-bg border-b border-border">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-text">{title}</Text>
          {subtitle ? <Text className="text-sm text-muted mt-0.5">{subtitle}</Text> : null}
        </View>
        <Pressable onPress={signOut} className="px-3 py-1.5 rounded-lg active:opacity-60">
          <Text className="text-xs text-muted">{profile?.name?.split(" ")[0] ?? "Abmelden"}</Text>
          <Text className="text-[10px] text-soft">Abmelden</Text>
        </Pressable>
      </View>
    </View>
  )
}
