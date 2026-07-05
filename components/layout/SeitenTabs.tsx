"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// Nav-Konsolidierung (Feedback 05.07.): Zusammengehörige Verwalter-Seiten
// teilen sich einen Sidebar-Punkt und werden untereinander per Tabs
// verbunden — die Routen selbst bleiben bestehen (Deep-Links/Bookmarks).
export interface SeitenTab {
  href: string
  label: string
}

export default function SeitenTabs({ tabs }: { tabs: SeitenTab[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Unterseiten" className="flex gap-1 mb-4 border-b border-line">
      {tabs.map(tab => {
        const aktiv = pathname === tab.href || pathname.startsWith(tab.href + "/")
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={aktiv ? "page" : undefined}
            className={`px-3.5 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              aktiv
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink hover:bg-surface-muted"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
