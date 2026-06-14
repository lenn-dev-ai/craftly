"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui"
import { useToast } from "@/components/Toast"
import { formatGewerk } from "@/types"

// Sprint V Phase 2 — Stamm-HW-Verwaltung für Verwalter.
//
// Verwalter sieht alle eigenen Stamm-HW-Einträge und kann neue anlegen.
// Pro Eintrag: HW (aus eigenem Pool) + optional Objekt + optional Gewerk
// + Priorität + Frist-Stunden. Bei neuer Ticketmeldung greift die
// Routing-Logik aus lib/auction/stamm-routing.ts (sobald in
// /api/auction/start integriert).

interface Handwerker { id: string; name: string | null; firma: string | null; gewerk: string | null }
interface Objekt { id: string; bezeichnung: string | null; adresse: string | null }
interface StammEintrag {
  id: string
  handwerker_id: string
  objekt_id: string | null
  gewerk: string | null
  prio: number
  frist_stunden: number
  notizen: string | null
  erstellt_at: string
  handwerker?: { name: string | null; firma: string | null } | null
  objekt?: { bezeichnung: string | null } | null
}

const GEWERKE = [
  { value: "", label: "Alle Gewerke" },
  { value: "heizung_sanitaer", label: "Heizung / Sanitär" },
  { value: "elektro", label: "Elektro" },
  { value: "schreiner", label: "Schreiner" },
  { value: "maler", label: "Maler" },
  { value: "dachdecker", label: "Dachdecker" },
  { value: "bodenleger", label: "Bodenleger" },
  { value: "allgemein", label: "Allgemein" },
]

export default function StammHandwerkerPage() {
  const router = useRouter()
  const { show } = useToast()
  const [eintraege, setEintraege] = useState<StammEintrag[]>([])
  const [handwerker, setHandwerker] = useState<Handwerker[]>([])
  const [objekte, setObjekte] = useState<Objekt[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [formHwId, setFormHwId] = useState("")
  const [formObjektId, setFormObjektId] = useState("")
  const [formGewerk, setFormGewerk] = useState("")
  const [formPrio, setFormPrio] = useState(100)
  const [formFrist, setFormFrist] = useState(24)
  const [formNotizen, setFormNotizen] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }
    const [{ data: e }, { data: h }, { data: o }] = await Promise.all([
      supabase
        .from("stamm_handwerker")
        .select("id, handwerker_id, objekt_id, gewerk, prio, frist_stunden, notizen, erstellt_at, handwerker:profiles!handwerker_id(name, firma), objekt:objekte!objekt_id(bezeichnung)")
        .eq("verwalter_id", user.id)
        .order("prio", { ascending: false })
        .order("erstellt_at", { ascending: false })
        .returns<StammEintrag[]>(),
      supabase
        .from("profiles")
        .select("id, name, firma, gewerk")
        .eq("rolle", "handwerker")
        .order("name", { ascending: true })
        .returns<Handwerker[]>(),
      supabase
        .from("objekte")
        .select("id, bezeichnung, adresse")
        .eq("verwalter_id", user.id)
        .order("bezeichnung", { ascending: true })
        .returns<Objekt[]>(),
    ])
    setEintraege(e ?? [])
    setHandwerker(h ?? [])
    setObjekte(o ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function save() {
    if (!formHwId) { show("Bitte Handwerker wählen", "error"); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }
      const { error } = await supabase.from("stamm_handwerker").insert({
        verwalter_id: user.id,
        handwerker_id: formHwId,
        objekt_id: formObjektId || null,
        gewerk: formGewerk || null,
        prio: formPrio,
        frist_stunden: formFrist,
        notizen: formNotizen.trim() || null,
      })
      if (error) {
        show(`Speichern fehlgeschlagen: ${error.message}`, "error")
        return
      }
      show("Stamm-HW angelegt", "success")
      setFormOpen(false)
      setFormHwId("")
      setFormObjektId("")
      setFormGewerk("")
      setFormPrio(100)
      setFormFrist(24)
      setFormNotizen("")
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function loeschen(id: string) {
    if (!confirm("Diesen Stamm-HW-Eintrag wirklich löschen?")) return
    const supabase = createClient()
    const { error } = await supabase.from("stamm_handwerker").delete().eq("id", id)
    if (error) { show(`Löschen fehlgeschlagen: ${error.message}`, "error"); return }
    show("Eintrag gelöscht", "success")
    await load()
  }

  if (loading) {
    return <main className="p-6 max-w-5xl mx-auto"><div className="text-sm text-ink-muted">Lädt…</div></main>
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Stamm-Handwerker</h1>
          <p className="text-xs text-ink-muted mt-1">
            Hinterlege Stamm-HW pro Wohnung/Gewerk — bei neuen Tickets fragt das System diese zuerst, bevor der Marktplatz öffnet.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>+ Stamm-HW hinzufügen</Button>
      </header>

      {eintraege.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <div className="text-sm text-ink-muted">Noch keine Stamm-HW hinterlegt.</div>
          <div className="text-xs text-ink-muted mt-2">Bei neuen Tickets geht es direkt in den Marktplatz.</div>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl divide-y divide-line">
          {eintraege.map(e => (
            <div key={e.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink">
                  {e.handwerker?.firma || e.handwerker?.name || "Unbekannter HW"}
                </div>
                <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-3 flex-wrap">
                  <span>📍 {e.objekt?.bezeichnung || "alle Objekte"}</span>
                  <span>🔧 {e.gewerk ? formatGewerk(e.gewerk) : "alle Gewerke"}</span>
                  <span>⭐ Prio {e.prio}</span>
                  <span>⏱ {e.frist_stunden}h Frist</span>
                </div>
                {e.notizen && <div className="text-xs text-ink-muted mt-1 italic">{e.notizen}</div>}
              </div>
              <button
                onClick={() => loeschen(e.id)}
                className="text-xs text-rose-600 hover:text-rose-800 px-3 py-1"
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => !saving && setFormOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-ink mb-1">Stamm-HW hinzufügen</h2>
            <p className="text-xs text-ink-muted mb-4">Diese Person bekommt Tickets zuerst angeboten. Frist verstrichen → Marktplatz öffnet.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Handwerker *</label>
                <select value={formHwId} onChange={e => setFormHwId(e.target.value)} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm">
                  <option value="">— wählen —</option>
                  {handwerker.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.firma || h.name} {h.gewerk ? `(${formatGewerk(h.gewerk)})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Objekt</label>
                  <select value={formObjektId} onChange={e => setFormObjektId(e.target.value)} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm">
                    <option value="">Alle Objekte</option>
                    {objekte.map(o => (
                      <option key={o.id} value={o.id}>{o.bezeichnung || o.adresse}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Gewerk</label>
                  <select value={formGewerk} onChange={e => setFormGewerk(e.target.value)} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm">
                    {GEWERKE.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Priorität</label>
                  <input type="number" value={formPrio} onChange={e => setFormPrio(parseInt(e.target.value) || 100)} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm" />
                  <div className="text-[10px] text-ink-muted mt-1">Höher = wichtiger</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Frist (Stunden)</label>
                  <input type="number" value={formFrist} onChange={e => setFormFrist(parseInt(e.target.value) || 24)} min={1} max={168} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm" />
                  <div className="text-[10px] text-ink-muted mt-1">Bis Marktplatz öffnet</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Notizen (optional)</label>
                <input value={formNotizen} onChange={e => setFormNotizen(e.target.value)} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm" placeholder="z.B. Stammbetrieb seit 2020, immer freundlich" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={saving}>Abbrechen</Button>
              <Button size="sm" onClick={save} disabled={saving || !formHwId}>{saving ? "Speichert…" : "Speichern"}</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
