import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { Session, User } from "@supabase/supabase-js"
import { supabase } from "./supabase"

export type Rolle = "mieter" | "handwerker" | "verwalter" | "admin"

interface UserProfile {
  id: string
  email: string | null
  name: string | null
  rolle: Rolle | null
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, name, rolle")
      .eq("id", userId)
      .single()
    setProfile((data as UserProfile) ?? null)
  }

  useEffect(() => {
    // Initialer Session-Check
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        void loadProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Live-Updates bei Sign-In/Out + Token-Refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        void loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => { sub.subscription.unsubscribe() }
  }, [])

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signOut: async () => { await supabase.auth.signOut() },
    refreshProfile: async () => {
      if (session?.user) await loadProfile(session.user.id)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth muss innerhalb AuthProvider verwendet werden")
  return ctx
}
