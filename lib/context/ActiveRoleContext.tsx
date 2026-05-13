"use client"

// Aktive Rolle für Admin-Wechsel zwischen Verwalter- und Handwerker-Sicht.
// `istAdmin` kommt aus profiles.rolle === 'admin' (geladen im Layout-Wrapper).
// Persistierung über URL-Query ?rolle=... — kein localStorage, kein
// Server-State. Beim Sharing der URL übernimmt der Empfänger die Sicht.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"

export type ActiveRolle = "verwaltung" | "handwerker"

interface ActiveRoleContextType {
  rolle: ActiveRolle
  setRolle: (r: ActiveRolle) => void
  istAdmin: boolean
}

const ActiveRoleContext = createContext<ActiveRoleContextType>({
  rolle: "verwaltung",
  setRolle: () => {},
  istAdmin: false,
})

export function ActiveRoleProvider({
  children,
  istAdmin,
  defaultRolle = "verwaltung",
}: {
  children: ReactNode
  istAdmin: boolean
  defaultRolle?: ActiveRolle
}) {
  const [rolle, setRolleState] = useState<ActiveRolle>(defaultRolle)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const param = params.get("rolle")
    if (param === "verwaltung" || param === "handwerker") {
      setRolleState(param)
    }
  }, [])

  const setRolle = useCallback((r: ActiveRolle) => {
    setRolleState(r)
    const url = new URL(window.location.href)
    url.searchParams.set("rolle", r)
    window.history.replaceState({}, "", url.toString())
  }, [])

  return (
    <ActiveRoleContext.Provider value={{ rolle, setRolle, istAdmin }}>
      {children}
    </ActiveRoleContext.Provider>
  )
}

export function useActiveRole(): ActiveRoleContextType {
  return useContext(ActiveRoleContext)
}
