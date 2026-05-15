"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { CardListSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton"
import { Search, Star, MapPin, Phone, Mail, Briefcase } from "lucide-react"
import { GEWERK_LABELS } from "@/types"

interface Handwerker {
  id: string
  name: string | null
  firma: string | null
  email: string | null
  telefon: string | null
  gewerk: string | null
  plz_bereich: string | null
  bewertung_avg: number | null
  auftraege_anzahl: number | null
  basis_stundensatz: number | null
  basis_preis: number | null
  startort_lat: number | null
  startort_lng: number | null
  startort_adresse: string | null
  lat: number | null
  lng: number | null
  radius_km: number | null
  sichtbarkeit_stufe: "gold" | "silber" | "bronze" | null
}

const STUFEN_BADGE: Record<string, { label: string; cls: string }> = {
  gold:   { label: "Gold",   cls: "bg-warm text-white" },
  silber: { label: "Silber", cls: "bg-[#94A3B8] text-white" },
  bronze: { label: "Bronze", cls: "bg-[#78716C] text-white" },
}

export default function HandwerkerUebersicht() {
  const router = useRouter()
  const [handwerker, setHandwerker] = useState<Handwerker[]>([])
  const [loading, setLoading] = useState(true)
  const [suche, setSuche] = useState("")
  const [gewerkFilter, setGewerkFilter] = useState<string>("alle")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // SELECT * statt expliziter Spaltenliste — robust gegen noch-nicht-
      // gerollte Migrationen (z.B. sichtbarkeit_stufe). Sonst würde der
      // Query bei fehlender Spalte komplett 0 Treffer liefern.
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("rolle", "handwerker")
        .order("bewertung_avg", { ascending: false })
        .returns<Handwerker[]>()
      setHandwerker(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const gewerke = useMemo(() => {
    const set = new Set<string>()
    for (const h of handwerker) {
      if (h.gewerk) set.add(h.gewerk)
    }
    return Array.from(set).sort()
  }, [handwerker])

  const gefiltert = useMemo(() => {
    return handwerker.filter(h => {
      if (gewerkFilter !== "alle" && h.gewerk !== gewerkFilter) return false
      if (suche) {
        const s = suche.toLowerCase()
        return (
          (h.name || "").toLowerCase().includes(s) ||
          (h.firma || "").toLowerCase().includes(s) ||
          (h.gewerk || "").toLowerCase().includes(s) ||
          (h.plz_bereich || "").toLowerCase().includes(s) ||
          (h.startort_adresse || "").toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [handwerker, suche, gewerkFilter])

  const stats = useMemo(() => {
    const mitStandort = handwerker.filter(h => (h.startort_lat ?? h.lat) != null).length
    const bewertungen = handwerker.map(h => h.bewertung_avg ?? 0).filter(b => b > 0)
    const avgBewertung = bewertungen.length > 0
      ? bewertungen.reduce((s, b) => s + b, 0) / bewertungen.length
      : 0
    const gold = handwerker.filter(h => h.sichtbarkeit_stufe === "gold").length
    return {
      total: handwerker.length,
      mitStandort,
      avgBewertung,
      gold,
    }
  }, [handwerker])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto pt-16 md:pt-6">
        <PageHeaderSkeleton />
        <CardListSkeleton count={6} rows={2} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pt-16 md:pt-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Handwerker-Verzeichnis</h1>
        <p className="text-sm text-ink-muted mt-1">
          {handwerker.length} registrierte Profile · gefiltert: {gefiltert.length}
        </p>
      </div>

      {/* KPI-Reihe */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Handwerker gesamt" value={String(stats.total)} farbe="#C4956A" />
        <Kpi label="Mit Standort" value={String(stats.mitStandort)} farbe="#3D8B7A" />
        <Kpi
          label="Ø Bewertung"
          value={stats.avgBewertung > 0 ? `${stats.avgBewertung.toFixed(1)} / 5` : "—"}
          farbe="#5B6ABF"
        />
        <Kpi label="Gold-Status" value={String(stats.gold)} farbe="#C4956A" />
      </div>

      {/* Filter */}
      <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Name, Firma, Gewerk oder PLZ…"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-line rounded-xl focus:outline-none focus:border-accent/40 transition-colors"
              aria-label="Handwerker suchen"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterPill aktiv={gewerkFilter === "alle"} onClick={() => setGewerkFilter("alle")}>
              Alle
            </FilterPill>
            {gewerke.map(g => (
              <FilterPill
                key={g}
                aktiv={gewerkFilter === g}
                onClick={() => setGewerkFilter(g)}
              >
                {GEWERK_LABELS[g] ?? g}
              </FilterPill>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      {gefiltert.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-surface mx-auto mb-3 flex items-center justify-center">
            <Briefcase size={22} className="text-ink-muted" />
          </div>
          <div className="text-sm font-semibold text-ink mb-1">
            {handwerker.length === 0 ? "Noch keine Handwerker registriert" : "Keine Treffer"}
          </div>
          <div className="text-xs text-ink-muted">
            {handwerker.length === 0
              ? "Sobald sich Handwerker auf Reparo registrieren, erscheinen sie hier."
              : "Filter oder Suche anpassen."}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {gefiltert.map(h => (
            <HandwerkerCard
              key={h.id}
              h={h}
              onContact={() => h.email && window.open(`mailto:${h.email}`, "_self")}
              onAuftragNeu={() => router.push("/dashboard-verwalter/marktplatz")}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sub-Components
// ============================================================

function Kpi({ label, value, farbe }: { label: string; value: string; farbe: string }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
      <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center" style={{ background: farbe + "15" }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: farbe }} />
      </div>
      <div className="text-2xl font-bold text-ink tabular-nums">{value}</div>
      <div className="text-[10px] text-ink-muted mt-1 font-medium uppercase tracking-wider">{label}</div>
    </div>
  )
}

function FilterPill({ aktiv, onClick, children }: {
  aktiv: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
        aktiv
          ? "bg-accent text-white"
          : "bg-surface text-ink-secondary hover:bg-line"
      }`}
    >
      {children}
    </button>
  )
}

function HandwerkerCard({ h, onContact, onAuftragNeu }: {
  h: Handwerker
  onContact: () => void
  onAuftragNeu: () => void
}) {
  const stundensatz = h.basis_stundensatz ?? h.basis_preis
  const ort = h.startort_adresse || h.plz_bereich
  const gewerkLabel = h.gewerk ? (GEWERK_LABELS[h.gewerk] ?? h.gewerk) : null
  const stufe = h.sichtbarkeit_stufe ? STUFEN_BADGE[h.sichtbarkeit_stufe] : null

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Kopfzeile: Avatar + Name + Stufe */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C4956A] to-[#854F0B] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
          {(h.firma || h.name || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold text-ink truncate">{h.firma || h.name || "Unbenannt"}</div>
            {stufe && (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${stufe.cls}`}>
                {stufe.label}
              </span>
            )}
          </div>
          {h.firma && h.name && (
            <div className="text-xs text-ink-muted truncate">{h.name}</div>
          )}
        </div>
      </div>

      {/* Bewertung + Aufträge */}
      <div className="flex items-center gap-3 text-xs mb-3">
        {h.bewertung_avg != null && h.bewertung_avg > 0 ? (
          <span className="inline-flex items-center gap-1 text-warm font-semibold">
            <Star size={12} fill="currentColor" /> {h.bewertung_avg.toFixed(1)}
          </span>
        ) : (
          <span className="text-ink-muted">Noch keine Bewertung</span>
        )}
        {h.auftraege_anzahl != null && h.auftraege_anzahl > 0 && (
          <span className="text-ink-muted">· {h.auftraege_anzahl} {h.auftraege_anzahl === 1 ? "Auftrag" : "Aufträge"}</span>
        )}
        {stundensatz != null && (
          <span className="text-ink-muted ml-auto">· {stundensatz} €/h</span>
        )}
      </div>

      {/* Meta-Tabelle */}
      <div className="space-y-1.5 text-xs text-ink-secondary mb-4">
        {gewerkLabel && (
          <div className="flex items-center gap-2">
            <Briefcase size={12} className="text-ink-muted flex-shrink-0" />
            <span>{gewerkLabel}</span>
            {h.radius_km != null && (
              <span className="text-ink-muted">· Radius {h.radius_km} km</span>
            )}
          </div>
        )}
        {ort && (
          <div className="flex items-center gap-2">
            <MapPin size={12} className="text-ink-muted flex-shrink-0" />
            <span className="truncate">{ort}</span>
          </div>
        )}
        {h.email && (
          <div className="flex items-center gap-2">
            <Mail size={12} className="text-ink-muted flex-shrink-0" />
            <span className="truncate">{h.email}</span>
          </div>
        )}
        {h.telefon && (
          <div className="flex items-center gap-2">
            <Phone size={12} className="text-ink-muted flex-shrink-0" />
            <span>{h.telefon}</span>
          </div>
        )}
      </div>

      {/* Aktionen */}
      <div className="flex gap-2 pt-3 border-t border-line">
        {h.email && (
          <button
            onClick={onContact}
            className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-line text-ink-secondary hover:bg-surface hover:text-ink transition-colors"
          >
            Kontakt
          </button>
        )}
        <button
          onClick={onAuftragNeu}
          className="flex-1 text-xs font-medium px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Auftrag ausschreiben
        </button>
      </div>
    </div>
  )
}
