"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Verfuegbarkeit, WOCHENTAGE } from "@/types"
import { Card, Button, LoadingSpinner, Toast } from "@/components/ui"

const DEFAULT_SLOTS = [
  { wochentag: 1, von: "08:00", bis: "17:00", aktiv: true },
  { wochentag: 2, von: "08:00", bis: "17:00", aktiv: true },
  { wochentag: 3, von: "08:00", bis: "17:00", aktiv: true },
  { wochentag: 4, von: "08:00", bis: "17:00", aktiv: true },
  { wochentag: 5, von: "08:00", bis: "17:00", aktiv: true },
  { wochentag: 6, von: "09:00", bis: "13:00", aktiv: false },
  { wochentag: 0, von: "00:00", bis: "00:00", aktiv: false },
]

const ZEITEN = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, "0")}:00`
)

export default function VerfuegbarkeitPage() {
  const router = useRouter()
  const [slots, setSlots] = useState<Partial<Verfuegbarkeit>[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null)
  const [userId, setUserId] = useState<string>("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      setUserId(user.id)

      const { data } = await supabase
        .from("verfuegbarkeiten")
        .select("*")
        .eq("handwerker_id", user.id)
        .order("wochentag")

      if (data && data.length > 0) {
        setSlots(data)
      } else {
        // Create defaults
        const defaults = DEFAULT_SLOTS.map(s => ({
          ...s,
          handwerker_id: user.id,
        }))
        const { data: created } = await supabase
          .from("verfuegbarkeiten")
          .insert(defaults)
          .select()
        setSlots(created || defaults)
      }
      setLoading(false)
    }
    load()
  }, [router])

  function updateSlot(wochentag: number, field: string, value: string | boolean) {
    setSlots(prev => prev.map(s =>
      s.wochentag === wochentag ? { ...s, [field]: value } : s
    ))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    for (const slot of slots) {
      const { error } = await supabase
        .from("verfuegbarkeiten")
        .upsert({
          handwerker_id: userId,
          wochentag: slot.wochentag,
          von: slot.von,
          bis: slot.bis,
          aktiv: slot.aktiv,
        }, { onConflict: "handwerker_id,wochentag" })

      if (error) {
        setToast({ msg: "Fehler: " + error.message, type: "error" })
        setSaving(false)
        return
      }
    }

    setToast({ msg: "Verfügbarkeit gespeichert!", type: "success" })
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  // Sort: Mo-Sa, So last
  const sortedSlots = [...slots].sort((a, b) => {
    const aDay = a.wochentag === 0 ? 7 : a.wochentag!
    const bDay = b.wochentag === 0 ? 7 : b.wochentag!
    return aDay - bDay
  })

  const aktiveTage = slots.filter(s => s.aktiv).length

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-medium mb-1">Meine Verfügbarkeit</h1>
      <p className="text-sm text-gray-500 mb-6">
        Lege fest, wann du für Aufträge verfügbar bist. Verwalter sehen diese Zeiten bei der Handwerker-Auswahl.
      </p>

      {/* Übersicht */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Wochenübersicht</div>
            <div className="text-xs text-gray-500 mt-0.5">{aktiveTage} von 7 Tagen aktiv</div>
          </div>
          <div className="flex gap-1">
            {sortedSlots.map(s => (
              <div
                key={s.wochentag}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                  s.aktiv
                    ? "bg-[#3D8B7A] text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {WOCHENTAGE[s.wochentag!]}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Tages-Details */}
      <div className="flex flex-col gap-2 mb-6">
        {sortedSlots.map(slot => (
          <Card key={slot.wochentag} className="!p-3">
            <div className="flex items-center gap-3">
              {/* Toggle */}
              <button
                onClick={() => updateSlot(slot.wochentag!, "aktiv", !slot.aktiv)}
                className={`w-10 h-6 rounded-full relative transition-colors ${
                  slot.aktiv ? "bg-[#3D8B7A]" : "bg-gray-200"
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  slot.aktiv ? "left-[18px]" : "left-0.5"
                }`} />
              </button>

              {/* Tag */}
              <div className={`w-8 text-sm font-medium ${slot.aktiv ? "text-gray-800" : "text-gray-400"}`}>
                {WOCHENTAGE[slot.wochentag!]}
              </div>

              {/* Zeiten */}
              {slot.aktiv ? (
                <div className="flex items-center gap-2 flex-1">
                  <select
                    value={slot.von || "08:00"}
                    onChange={e => updateSlot(slot.wochentag!, "von", e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    {ZEITEN.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <span className="text-gray-400 text-sm">bis</span>
                  <select
                    value={slot.bis || "17:00"}
                    onChange={e => updateSlot(slot.wochentag!, "bis", e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    {ZEITEN.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
              ) : (
                <div className="flex-1 text-sm text-gray-400">Nicht verfügbar</div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Google Calendar Hinweis */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">📅</span>
          <span className="text-sm font-medium text-blue-800">Google Calendar</span>
        </div>
        <p className="text-xs text-blue-600">
          Bald verfügbar: Verbinde deinen Google Kalender, um Termine automatisch zu synchronisieren
          und Konflikte zu vermeiden.
        </p>
      </div>

      {/* Speichern */}
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Wird gespeichert..." : "Verfügbarkeit speichern"}
      </Button>

      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

