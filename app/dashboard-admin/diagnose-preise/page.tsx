"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { CardListSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton"
import { Stethoscope, Plus, Trash2, Check } from "lucide-react"
import { GEWERK_LABELS } from "@/types"

interface PreisRow {
  id: string
  gewerk: string
  preis: number
  updated_at: string | null
}

export default function DiagnosePreisePage() {
  const [rows, setRows] = useState<PreisRow[]>([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<string>("")
  const [neuGewerk, setNeuGewerk] = useState("")
  const [neuPreis, setNeuPreis] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("diagnose_preise")
      .select("id, gewerk, preis, updated_at")
      .order("gewerk")
      .returns<PreisRow[]>()
    setRows(data ?? [])
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
    if (!window.confirm(`Diagnose-Preis für ${GEWERK_LABELS[row.gewerk] ?? row.gewerk} löschen?`)) return
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
      <div className="p-6 max-w-3xl mx-auto">
        <PageHeaderSkeleton />
        <CardListSkeleton count={5} rows={1} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2A26] flex items-center gap-2">
            <Stethoscope size={22} className="text-[#7C6CAB]" />
            Diagnose-Preise
          </h1>
          <p className="text-sm text-[#8C857B] mt-1">
            Festpreise pro Gewerk für Stufe 1 (Doctolib-Modell). Mieter sehen den Preis bei der Diagnose-Buchung,
            Handwerker können nur den Zeitslot anbieten — kein Preis-Wettbewerb.
          </p>
        </div>
        {toast && (
          <div className="text-xs text-[#3D8B7A] bg-[#3D8B7A]/10 border border-[#3D8B7A]/20 rounded-full px-3 py-1.5">
            {toast}
          </div>
        )}
      </header>

      {/* Liste */}
      <div className="bg-white border border-[#EDE8E1] rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#EDE8E1]">
              <th className="text-left text-[10px] font-semibold text-[#8C857B] uppercase tracking-wider px-4 py-2.5">Gewerk</th>
              <th className="text-left text-[10px] font-semibold text-[#8C857B] uppercase tracking-wider px-4 py-2.5">Preis</th>
              <th className="text-left text-[10px] font-semibold text-[#8C857B] uppercase tracking-wider px-4 py-2.5">Aktualisiert</th>
              <th className="text-right text-[10px] font-semibold text-[#8C857B] uppercase tracking-wider px-4 py-2.5">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-[#8C857B]">
                  Noch keine Diagnose-Preise hinterlegt. Migration evtl. nicht gerollt.
                </td>
              </tr>
            ) : rows.map(row => {
              const editVal = edits[row.id] ?? String(row.preis)
              const istGeaendert = parseFloat(editVal.replace(",", ".")) !== row.preis
              return (
                <tr key={row.id} className="border-b border-[#EDE8E1] last:border-0 hover:bg-[#FAF8F5]/50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-[#2D2A26]">
                      {GEWERK_LABELS[row.gewerk] ?? row.gewerk}
                    </div>
                    <div className="text-[10px] text-[#8C857B] font-mono">{row.gewerk}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number" inputMode="decimal" step="1" min="1"
                        value={editVal}
                        onChange={e => setEdits(prev => ({ ...prev, [row.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && void speichere(row)}
                        className="w-20 text-sm tabular-nums bg-[#FAF8F5] border border-[#EDE8E1] rounded-lg px-2 py-1 focus:outline-none focus:border-[#7C6CAB]/40"
                      />
                      <span className="text-sm text-[#8C857B]">€</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8C857B] tabular-nums">
                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString("de") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {istGeaendert && (
                        <button
                          onClick={() => void speichere(row)}
                          disabled={saving === row.id}
                          className="text-[#3D8B7A] hover:bg-[#3D8B7A]/10 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                          aria-label="Speichern"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => void loesche(row)}
                        className="text-[#8C857B] hover:text-[#C4574B] hover:bg-[#C4574B]/5 p-1.5 rounded-lg transition-colors"
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

      {/* Neuer Eintrag */}
      <div className="bg-white border border-[#EDE8E1] rounded-2xl shadow-sm p-4">
        <div className="text-xs font-semibold text-[#2D2A26] mb-2 uppercase tracking-wider">Neuen Diagnose-Preis anlegen</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={neuGewerk}
            onChange={e => setNeuGewerk(e.target.value)}
            placeholder="Gewerk-Key (z. B. dachdecker)"
            className="flex-1 min-w-[180px] text-sm bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#7C6CAB]/40"
          />
          <input
            type="number" inputMode="decimal" step="1" min="1"
            value={neuPreis}
            onChange={e => setNeuPreis(e.target.value)}
            placeholder="Preis in €"
            className="w-32 text-sm tabular-nums bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#7C6CAB]/40"
          />
          <button
            onClick={() => void lege_an()}
            className="inline-flex items-center gap-1 text-xs font-medium bg-[#7C6CAB] text-white px-3 py-2 rounded-xl hover:bg-[#5B4E8A] transition-colors"
          >
            <Plus size={12} /> Anlegen
          </button>
        </div>
        <p className="text-[10px] text-[#8C857B] mt-2 leading-snug">
          Gewerk-Keys müssen mit dem Wert in <code>tickets.gewerk</code> übereinstimmen
          (sanitaer/heizung/elektro/schreiner/dachdecker/maler/schlosser/allgemein …).
        </p>
      </div>
    </div>
  )
}
