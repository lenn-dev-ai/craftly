// Tab-Definitionen der konsolidierten Verwalter-Bereiche (Nav 05.07.).
// Ein Sidebar-Punkt = mehrere Routen, verbunden über SeitenTabs.
import type { SeitenTab } from "@/components/layout/SeitenTabs"

export const AUFTRAEGE_TABS: SeitenTab[] = [
  { href: "/dashboard-verwalter/tickets", label: "Alle Aufträge" },
  { href: "/dashboard-verwalter/marktplatz", label: "Vergabe läuft" },
]

export const HANDWERKER_TABS: SeitenTab[] = [
  { href: "/dashboard-verwalter/handwerker", label: "Verzeichnis" },
  { href: "/dashboard-verwalter/stamm-handwerker", label: "Stamm-Handwerker" },
]

export const OBJEKTE_TABS: SeitenTab[] = [
  { href: "/dashboard-verwalter/wohnungen", label: "Wohnungen" },
  { href: "/dashboard-verwalter/eigentuemer", label: "Eigentümer" },
]
