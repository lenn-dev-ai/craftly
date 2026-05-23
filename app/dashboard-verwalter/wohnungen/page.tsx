"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Card, Button } from "@/components/ui"
import { Home, Upload, Search, AlertCircle } from "lucide-react"

// Sprint I — Wohnungs-Listen-View. Anker für den Import-Wizard +
// einfache Bestands-Übersicht. Funktioniert erst nach Apply der
// Migration 20260605000060 (vorher fängt die Page den table-missing-
// Fehler ab und zeigt einen Hinweis).

type Wohnung = {
  id: string
  strasse: string
  hausnummer: string
  plz: string
  ort: string
  whg_bezeichnung: string
  mieter_name: string | null
  qm: number | null
  baujahr: number | null
}

export default function WohnungenPage() {
  const router = useRouter()
  const [wohnungen, setWohnungen] = useState<Wohnung[]>([])
  const [loading, setLoading] = useState(true)
  const [missingTable, setMissingTable] = useState(false)
  const [suche, setSuche] = useState("")

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const { data, error } = await supabase
      .from("wohnungen")
      .select("id, strasse, hausnummer, plz, ort, whg_bezeichnung, mieter_name, qm, baujahr")
      .eq("verwalter_id", user.id)
      .order("strasse", { ascending: true })
      .returns<Wohnung[]>()
    if (error) {
      if (/wohnungen.*does not exist|relation.*wohnungen/i.test(error.message)) {
        setMissingTable(true)
      }
      setLoading(false)
      return
    }
    setWohnungen(data ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { void load() }, [load])

  const gefiltert = wohnungen.filter(w => {
    if (!suche) return true
    const s = suche.toLowerCase()
    return (
      w.strasse.toLowerCase().includes(s) ||
      w.ort.toLowerCase().includes(s) ||
      w.plz.includes(s) ||
      w.whg_bezeichnung.toLowerCase().includes(s) ||
      (w.mieter_name?.toLowerCase().includes(s) ?? false)
    )
  })

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto pt-16 md:pt-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ink">Wohnungen</h1>
          <p className="text-sm text-ink-muted mt-1">
            {wohnungen.length} {wohnungen.length === 1 ? "Wohnung" : "Wohnungen"} im Bestand
          </p>
        </div>
        <Link
          href="/dashboard-verwalter/wohnungen/import"
          className="inline-flex items-center gap-2 text-sm font-semibold bg-rolle-verwalter text-white px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
        >
          <Upload className="w-4 h-4" /> Import (CSV / Excel)
        </Link>
      </div>

      {missingTable && (
        <Card className="p-6 mb-6 border-warm/30 bg-warm/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warm-dark flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-warm-dark mb-1">Schema-Migration ausstehend</h3>
              <p className="text-sm text-ink">
                Die <code className="bg-white px-1 rounded">wohnungen</code>-Tabelle existiert noch nicht.
                Apply der Migration <code className="bg-white px-1 rounded">20260605000060_sprint_i_wohnungen_table.sql</code> ist nötig
                (Supabase Studio SQL-Editor oder MCP). Solange läuft der Import-Wizard ins Leere.
              </p>
            </div>
          </div>
        </Card>
      )}

      {loading && (
        <div className="text-center py-12 text-sm text-ink-muted">Lädt…</div>
      )}

      {!loading && !missingTable && wohnungen.length === 0 && (
        <Card className="p-12 text-center">
          <Home className="w-12 h-12 mx-auto text-ink-muted mb-3" />
          <h3 className="text-lg font-semibold text-ink mb-1">Noch keine Wohnungen</h3>
          <p className="text-sm text-ink-muted mb-6">
            Lade deine Excel- oder CSV-Liste hoch — das System validiert, mappt Spalten und importiert in Batches.
          </p>
          <Button onClick={() => router.push("/dashboard-verwalter/wohnungen/import")}>
            <Upload className="w-4 h-4" /> Liste hochladen
          </Button>
        </Card>
      )}

      {!loading && wohnungen.length > 0 && (
        <>
          <div className="mb-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder="Suche nach Straße, Ort, Mieter…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line bg-white text-sm focus:outline-none focus:border-rolle-verwalter/40"
            />
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-line">
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-muted">
                    <th className="py-3 px-4">Adresse</th>
                    <th className="py-3 px-4">Wohnung</th>
                    <th className="py-3 px-4">Mieter</th>
                    <th className="py-3 px-4 text-right">m² / Bj.</th>
                  </tr>
                </thead>
                <tbody>
                  {gefiltert.map(w => (
                    <tr key={w.id} className="border-b border-line last:border-0 hover:bg-surface/50">
                      <td className="py-2.5 px-4">
                        <div className="text-ink font-medium">{w.strasse} {w.hausnummer}</div>
                        <div className="text-xs text-ink-muted">{w.plz} {w.ort}</div>
                      </td>
                      <td className="py-2.5 px-4 text-ink">{w.whg_bezeichnung}</td>
                      <td className="py-2.5 px-4 text-ink-muted">{w.mieter_name ?? "—"}</td>
                      <td className="py-2.5 px-4 text-right text-xs text-ink-muted tabular-nums">
                        {w.qm ? `${w.qm} m²` : "—"}
                        {w.baujahr && ` · Bj. ${w.baujahr}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {gefiltert.length === 0 && (
              <div className="py-8 text-center text-sm text-ink-muted">Keine Treffer für &bdquo;{suche}&ldquo;</div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
