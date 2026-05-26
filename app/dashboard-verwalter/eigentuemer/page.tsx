"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui"
import { useToast } from "@/components/Toast"

// Sprint W Phase 2 — Eigentümer-Verwaltung für (WEG-)Verwalter.
//
// Anlegen + Bearbeiten + Löschen von Eigentümern. Wohnungs-Zuordnung
// (eigentuemer_id + mea_promille auf wohnungen) ist Phase 3, hier nur
// die Eigentümer-Stammdaten. PDF-Reports sind Phase 4.

interface Eigentuemer {
  id: string
  name: string
  anschrift: string | null
  email: string | null
  telefon: string | null
  notizen: string | null
  erstellt_at: string
}

interface Wohnung {
  id: string
  strasse: string
  hausnummer: string
  whg_bezeichnung: string | null
  eigentuemer_id: string | null
  mea_promille: number | null
}

export default function EigentuemerPage() {
  const router = useRouter()
  const { show } = useToast()
  const [eigentuemer, setEigentuemer] = useState<Eigentuemer[]>([])
  const [wohnungen, setWohnungen] = useState<Wohnung[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [anschrift, setAnschrift] = useState("")
  const [email, setEmail] = useState("")
  const [telefon, setTelefon] = useState("")
  const [notizen, setNotizen] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }
    const [{ data: e }, { data: w }] = await Promise.all([
      supabase
        .from("eigentuemer")
        .select("*")
        .eq("verwalter_id", user.id)
        .order("name", { ascending: true })
        .returns<Eigentuemer[]>(),
      supabase
        .from("wohnungen")
        .select("id, strasse, hausnummer, whg_bezeichnung, eigentuemer_id, mea_promille")
        .eq("verwalter_id", user.id)
        .returns<Wohnung[]>(),
    ])
    setEigentuemer(e ?? [])
    setWohnungen(w ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  function resetForm() {
    setEditId(null)
    setName("")
    setAnschrift("")
    setEmail("")
    setTelefon("")
    setNotizen("")
  }

  function openEdit(e: Eigentuemer) {
    setEditId(e.id)
    setName(e.name)
    setAnschrift(e.anschrift ?? "")
    setEmail(e.email ?? "")
    setTelefon(e.telefon ?? "")
    setNotizen(e.notizen ?? "")
    setFormOpen(true)
  }

  async function save() {
    if (!name.trim()) { show("Name ist Pflicht", "error"); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }
      const payload = {
        verwalter_id: user.id,
        name: name.trim(),
        anschrift: anschrift.trim() || null,
        email: email.trim() || null,
        telefon: telefon.trim() || null,
        notizen: notizen.trim() || null,
      }
      const { error } = editId
        ? await supabase.from("eigentuemer").update(payload).eq("id", editId)
        : await supabase.from("eigentuemer").insert(payload)
      if (error) { show(`Speichern fehlgeschlagen: ${error.message}`, "error"); return }
      show(editId ? "Eigentümer aktualisiert" : "Eigentümer angelegt", "success")
      setFormOpen(false)
      resetForm()
      await load()
    } finally { setSaving(false) }
  }

  async function loeschen(id: string) {
    const wohnungenAnEigentuemer = wohnungen.filter(w => w.eigentuemer_id === id).length
    const msg = wohnungenAnEigentuemer > 0
      ? `Eigentümer wirklich löschen? ${wohnungenAnEigentuemer} Wohnung(en) werden auf "ohne Eigentümer" gesetzt.`
      : "Diesen Eigentümer wirklich löschen?"
    if (!confirm(msg)) return
    const supabase = createClient()
    const { error } = await supabase.from("eigentuemer").delete().eq("id", id)
    if (error) { show(`Löschen fehlgeschlagen: ${error.message}`, "error"); return }
    show("Eigentümer gelöscht", "success")
    await load()
  }

  async function zuordnen(wohnungId: string, eigentuemerId: string | null, meaInput: number | null) {
    const supabase = createClient()
    const { error } = await supabase
      .from("wohnungen")
      .update({ eigentuemer_id: eigentuemerId, mea_promille: meaInput })
      .eq("id", wohnungId)
    if (error) { show(`Zuordnung fehlgeschlagen: ${error.message}`, "error"); return }
    show("Wohnung aktualisiert", "success")
    await load()
  }

  if (loading) {
    return <main className="p-6 max-w-5xl mx-auto"><div className="text-sm text-ink-muted">Lädt…</div></main>
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Eigentümer</h1>
          <p className="text-xs text-ink-muted mt-1">
            Wohnungseigentümer für WEG-Reporting verwalten. Quartals-PDF-Reports kommen in Sprint W Phase 4.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setFormOpen(true) }}>+ Eigentümer anlegen</Button>
      </header>

      {/* Eigentümer-Liste */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Eigentümer ({eigentuemer.length})</h2>
        {eigentuemer.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-8 text-center">
            <div className="text-sm text-ink-muted">Noch keine Eigentümer angelegt.</div>
          </div>
        ) : (
          <div className="bg-white border border-line rounded-2xl divide-y divide-line">
            {eigentuemer.map(e => {
              const meineWohnungen = wohnungen.filter(w => w.eigentuemer_id === e.id)
              const meaTotal = meineWohnungen.reduce((s, w) => s + (w.mea_promille ?? 0), 0)
              return (
                <div key={e.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">{e.name}</div>
                    <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-3 flex-wrap">
                      {e.email && <span>📧 {e.email}</span>}
                      {e.telefon && <span>📞 {e.telefon}</span>}
                      <span>🏠 {meineWohnungen.length} Wohnung(en)</span>
                      {meaTotal > 0 && <span>📊 MEA {(meaTotal / 10).toFixed(1)}%</span>}
                    </div>
                    {e.notizen && <div className="text-xs text-ink-faint mt-1 italic">{e.notizen}</div>}
                  </div>
                  <button onClick={() => openEdit(e)} className="text-xs text-accent hover:underline px-2 py-1">Bearbeiten</button>
                  <button onClick={() => loeschen(e.id)} className="text-xs text-rose-600 hover:text-rose-800 px-2 py-1">Löschen</button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Wohnungs-Zuordnung */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Wohnungs-Zuordnung ({wohnungen.length})</h2>
        {wohnungen.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-6 text-center text-sm text-ink-muted">
            Noch keine Wohnungen angelegt.
          </div>
        ) : (
          <div className="bg-white border border-line rounded-2xl divide-y divide-line">
            {wohnungen.map(w => (
              <WohnungRow
                key={w.id}
                wohnung={w}
                eigentuemer={eigentuemer}
                onUpdate={zuordnen}
              />
            ))}
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => !saving && setFormOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-ink mb-1">{editId ? "Eigentümer bearbeiten" : "Eigentümer anlegen"}</h2>
            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm" placeholder="z.B. Frau Müller" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Anschrift</label>
                <input value={anschrift} onChange={e => setAnschrift(e.target.value)} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm" placeholder="Straße, PLZ, Ort" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Telefon</label>
                  <input value={telefon} onChange={e => setTelefon(e.target.value)} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Notizen</label>
                <textarea value={notizen} onChange={e => setNotizen(e.target.value)} rows={2} className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={saving}>Abbrechen</Button>
              <Button size="sm" onClick={save} disabled={saving || !name.trim()}>{saving ? "Speichert…" : (editId ? "Aktualisieren" : "Anlegen")}</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function WohnungRow({ wohnung, eigentuemer, onUpdate }: {
  wohnung: Wohnung
  eigentuemer: Eigentuemer[]
  onUpdate: (wohnungId: string, eigentuemerId: string | null, mea: number | null) => Promise<void>
}) {
  const [eigentuemerId, setEigentuemerId] = useState(wohnung.eigentuemer_id ?? "")
  const [meaPromille, setMeaPromille] = useState(wohnung.mea_promille?.toString() ?? "")

  async function commit() {
    const mea = meaPromille.trim() === "" ? null : parseInt(meaPromille)
    if (mea !== null && (isNaN(mea) || mea <= 0 || mea > 1000)) return
    await onUpdate(wohnung.id, eigentuemerId || null, mea)
  }

  return (
    <div className="p-3 flex items-center gap-3 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink truncate">
          {wohnung.strasse} {wohnung.hausnummer} {wohnung.whg_bezeichnung && `· ${wohnung.whg_bezeichnung}`}
        </div>
      </div>
      <select
        value={eigentuemerId}
        onChange={e => setEigentuemerId(e.target.value)}
        onBlur={commit}
        className="bg-white border border-line rounded-lg px-2 py-1 text-xs"
      >
        <option value="">— ohne Eigentümer —</option>
        {eigentuemer.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={meaPromille}
          onChange={e => setMeaPromille(e.target.value)}
          onBlur={commit}
          placeholder="MEA"
          className="w-20 bg-white border border-line rounded-lg px-2 py-1 text-xs"
          min={1}
          max={1000}
        />
        <span className="text-[10px] text-ink-faint">‰</span>
      </div>
    </div>
  )
}
