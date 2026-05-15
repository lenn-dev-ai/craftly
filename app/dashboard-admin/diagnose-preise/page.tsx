"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { CardListSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton"
import { Stethoscope, Plus, Trash2, Check } from "lucide-react"
import { GEWERK_LABELS } from "@/types"
import { useToast } from "@/components/Toast"

interface PreisRow {
  id: string
  gewerk: string
  preis: number
  updated_at: string | null
}

interface MarktStat {
  gewerk: string
  buchungen90d: number
  avgAufwand: number | null
  avgAngebot: number | null
}

export default function DiagnosePreisePage() {
  const { confirm } = useToast()
  const [rows, setRows] = useState<PreisRow[]>([])
  const [stats, setStats] = useState<Map<string, MarktStat>>(new Map())
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<string>("")
  const [neuGewerk, setNeuGewerk] = useState("")
  const [neuPreis, setNeuPreis] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    // Preise + Diagnose-Markt-Stats letzte 90 Tage parallel laden (V3)
    const seit = new Date(Date.now() - 90 * 86400_000).toISOString()
    const [{ data: preise }, { data: diagTickets }] = await Promise.all([
      supabase
        .from("diagnose_preise")
        .select("id, gewerk, preis, updated_at")
        .order("gewerk")
        .returns<PreisRow[]>(),
      supabase
        .from("tickets")
        .select("gewerk, befund_aufwand_stunden, projekt_angebot")
        .eq("ticket_typ", "diagnose")
        .gte("created_at", seit)
        .returns<Array<{ gewerk: string | null; befund_aufwand_stunden: number | null; projekt_angebot: number | null }>>(),
    ])
    setRows(preise ?? [])

    // Aggregat pro Gewerk berechnen
    const statsByGewerk = new Map<string, MarktStat>()
    for (const t of diagTickets ?? []) {
      if (!t.gewerk) continue
      const cur = statsByGewerk.get(t.gewerk) ?? {
        gewerk: t.gewerk, buchungen90d: 0, avgAufwand: null, avgAngebot: null,
      }
      cur.buchungen90d++
      // running avg
      if (t.befund_aufwand_stunden != null) {
        const n = (cur.avgAufwand != null ? 1 : 0) + 1
        cur.avgAufwand = ((cur.avgAufwand ?? 0) * (n - 1) + Number(t.befund_aufwand_stunden)) / n
      }
      if (t.projekt_angebot != null) {
        const n = (cur.avgAngebot != null ? 1 : 0) + 1
        cur.avgAngebot = ((cur.avgAngebot ?? 0) * (n - 1) + Number(t.projekt_angebot)) / n
      }
      statsByGewerk.set(t.gewerk, cur)
    }
    setStats(statsByGewerk)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function zeigeToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 2500)
  }

  async function speichere(row: PreisRow) {
    const neuerWert = parseFloat((edits[row.id] ?? String(row.preis)).replace(",", "."))
    if (!isFinite(neuerWert) || neuerWert <= 0) {
      zeigeToast("Ungültiger Preis")
      return
    }
    if (neuerWert === row.preis) {
      const copy = { ...edits }
      delete copy[row.id]
      setEdits(copy)
      return
    }
    setSaving(row.id)
    const supabase = createClient()
    const { error } = await supabase
      .from("diagnose_preise")
      .update({ preis: neuerWert })
      .eq("id", row.id)
    setSaving(null)
    if (error) {
      zeigeToast("Speichern fehlgeschlagen: " + error.message)
      return
    }
    zeigeToast(`${GEWERK_LABELS[row.gewerk] ?? row.gewerk} aktualisiert`)
    const copy = { ...edits }
    delete copy[row.id]
    setEdits(copy)
    void load()
  }

  async function loesche(row: PreisRow) {
    if (!await confirm(`Diagnose-Preis für ${GEWERK_LABELS[row.gewerk] ?? row.gewerk} löschen?`)) return
    const supabase = createClient()
    const { error } = await supabase.from("diagnose_preise").delete().eq("id", row.id)
    if (error) {
      zeigeToast("Löschen fehlgeschlagen: " + error.message)
      return
    }
    zeigeToast("Gelöscht")
    void load()
  }

  async function lege_an() {
    const key = neuGewerk.trim().toLowerCase()
    const wert = parseFloat(neuPreis.replace(",", "."))
    if (!key) { zeigeToast("Gewerk-Schlüssel fehlt"); return }
    if (!isFinite(wert) || wert <= 0) { zeigeToast("Ungültiger Preis"); return }
    const supabase = createClient()
    const { error } = await supabase
      .from("diagnose_preise")
      .insert({ gewerk: key, preis: wert })
    if (error) {
      zeigeToast(error.code === "23505" ? `Gewerk '${key}' existiert bereits` : "Fehler: " + error.message)
      return
    }
    setNeuGewerk("")
    setNeuPreis("")
    zeigeToast("Neuer Diagnose-Preis angelegt")
    void load()
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto pt-16 md:pt-8">
        <PageHeaderSkeleton />
        <CardListSkeleton count={5} rows={1} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pt-16 md:pt-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <Stethoscope size={22} className="text-rolle-admin" />
            Diagnose-Preise
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Festpreise pro Gewerk für Stufe 1 (Doctolib-Modell). Mieter sehen den Preis bei der Diagnose-Buchung,
            Handwerker können nur den Zeitslot anbieten — kein Preis-Wettbewerb.
          </p>
        </div>
        {toast && (
          <div className="text-xs text-accent bg-accent/10 border border-accent/20 rounded-full px-3 py-1.5">
            {toast}
          </div>
        )}
      </header>

      {/* Liste — overflow-x-auto fängt die 5-Spalten-Tabelle auf <sm ab,
          sonst sprengt sie den Viewport */}
      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5">Gewerk</th>
              <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5">Preis</th>
              <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5" title="Diagnose-Buchungen und avg Befund-Aufwand letzte 90 Tage">Markt (90d)</th>
              <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5">Aktualisiert</th>
              <th className="text-right text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-4 py-2.5">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-muted">
                  Noch keine Diagnose-Preise hinterlegt. Migration evtl. nicht gerollt.
                </td>
              </tr>
            ) : rows.map(row => {
              const editVal = edits[row.id] ?? String(row.preis)
              const istGeaendert = parseFloat(editVal.replace(",", ".")) !== row.preis
              const stat = stats.get(row.gewerk)
              return (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-ink">
                      {GEWERK_LABELS[row.gewerk] ?? row.gewerk}
                    </div>
                    <div className="text-[10px] text-ink-muted font-mono">{row.gewerk}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number" inputMode="decimal" step="1" min="1"
                        value={editVal}
                        onChange={e => setEdits(prev => ({ ...prev, [row.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && void speichere(row)}
                        className="w-20 text-sm tabular-nums bg-surface border border-line rounded-lg px-2 py-1 focus:outline-none focus:border-[#7C6CAB]/40"
                      />
                      <span className="text-sm text-ink-muted">€</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {!stat ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-ink tabular-nums font-medium">
                          {stat.buchungen90d} Buchung{stat.buchungen90d === 1 ? "" : "en"}
                        </div>
                        <div className="text-[10px] text-ink-muted tabular-nums">
                          {stat.avgAufwand != null ? `ø ${stat.avgAufwand.toFixed(1)} h` : ""}
                          {stat.avgAufwand != null && stat.avgAngebot != null ? " · " : ""}
                          {stat.avgAngebot != null ? `Projekt ø ${stat.avgAngebot.toFixed(0)} €` : ""}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted tabular-nums">
                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString("de") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {istGeaendert && (
                        <button
                          onClick={() => void speichere(row)}
                          disabled={saving === row.id}
                          className="text-accent hover:bg-accent/10 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                          aria-label="Speichern"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => void loesche(row)}
                        className="text-ink-muted hover:text-danger hover:bg-danger/5 p-1.5 rounded-lg transition-colors"
                        aria-label="Löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Neuer Eintrag */}
      <div className="bg-white border border-line rounded-2xl shadow-sm p-4">
        <div className="text-xs font-semibold text-ink mb-2 uppercase tracking-wider">Neuen Diagnose-Preis anlegen</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={neuGewerk}
            onChange={e => setNeuGewerk(e.target.value)}
            placeholder="Gewerk-Key (z. B. dachdecker)"
            className="flex-1 min-w-[180px] text-sm bg-surface border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-[#7C6CAB]/40"
          />
          <input
            type="number" inputMode="decimal" step="1" min="1"
            value={neuPreis}
            onChange={e => setNeuPreis(e.target.value)}
            placeholder="Preis in €"
            className="w-32 text-sm tabular-nums bg-surface border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-[#7C6CAB]/40"
          />
          <button
            onClick={() => void lege_an()}
            className="inline-flex items-center gap-1 text-xs font-medium bg-rolle-admin text-white px-3 py-2 rounded-xl hover:bg-[#5B4E8A] transition-colors"
          >
            <Plus size={12} /> Anlegen
          </button>
        </div>
        <p className="text-[10px] text-ink-muted mt-2 leading-snug">
          Gewerk-Keys müssen mit dem Wert in <code>tickets.gewerk</code> übereinstimmen
          (sanitaer/heizung/elektro/schreiner/dachdecker/maler/schlosser/allgemein …).
        </p>
      </div>
    </div>
  )
}
