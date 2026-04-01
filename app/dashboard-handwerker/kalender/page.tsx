"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"

const TAGE = [
  { key: 1, label: "Mo" },
  { key: 2, label: "Di" },
  { key: 3, label: "Mi" },
  { key: 4, label: "Do" },
  { key: 5, label: "Fr" },
  { key: 6, label: "Sa" },
  { key: 0, label: "So" },
]

const SLOTS = [
  { label: "Morgens", sub: "08:00 - 12:00", von: "08:00", bis: "12:00" },
  { label: "Nachmittags", sub: "12:00 - 17:00", von: "12:00", bis: "17:00" },
  { label: "Abends", sub: "17:00 - 20:00", von: "17:00", bis: "20:00" },
]

type SlotState = Record<string, boolean>

function slotKey(tag: number, von: string): string {
  return tag + "_" + von
}

export default function KalenderPage() {
  const router = useRouter()
  const [slots, setSlots] = useState<SlotState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      setUserId(user.id)

      const { data: verf } = await supabase.from("verfuegbarkeiten")
        .select("*").eq("handwerker_id", user.id).eq("aktiv", true)

      const initial: SlotState = {}
      ;(verf || []).forEach((v: any) => {
        const key = slotKey(v.wochentag, v.von)
        initial[key] = true
      })
      setSlots(initial)
      setLoading(false)
    }
    load()
  }, [router])

  function toggle(tag: number, von: string) {
    const key = slotKey(tag, von)
    setSlots(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  async function save() {
    if (!userId) return
    setSaving(true)
    const supabase = createClient()

    await supabase.from("verfuegbarkeiten").delete().eq("handwerker_id", userId)

    const rows: any[] = []
    TAGE.forEach(tag => {
      SLOTS.forEach(slot => {
        if (slots[slotKey(tag.key, slot.von)]) {
          rows.push({
            handwerker_id: userId,
            wochentag: tag.key,
            von: slot.von,
            bis: slot.bis,
            aktiv: true,
          })
        }
      })
    })

    if (rows.length > 0) {
      await supabase.from("verfuegbarkeiten").insert(rows)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const activeCount = Object.values(slots).filter(Boolean).length

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
        <span className="text-sm text-white/40">Kalender laden...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Verfuegbarkeit</h1>
            <p className="text-white/40 text-sm mt-1">
              {activeCount} Zeitfenster ausgewaehlt -- Hausverwaltungen sehen deine Verfuegbarkeit
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className={"px-4 py-2 rounded-lg text-sm font-medium transition-all " + (
              saved
                ? "bg-[#00D4AA] text-black"
                : "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30 hover:bg-[#00D4AA]/25"
            )}
          >
            {saving ? "Speichern..." : saved ? "Gespeichert!" : "Speichern"}
          </button>
        </div>

        {/* KI Tipp */}
        <div className="bg-gradient-to-r from-[#00D4AA]/5 to-[#00B4D8]/5 border border-[#00D4AA]/20 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00D4AA]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[#00D4AA]">AI</span>
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-[#00D4AA]">KI-Empfehlung</div>
            <div className="text-xs text-white/50 mt-0.5">
              Handwerker mit hinterlegter Verfuegbarkeit erhalten bis zu 3x mehr Anfragen.
              {activeCount === 0 && " Trage mindestens 5 Zeitfenster ein fuer optimale Sichtbarkeit."}
              {activeCount > 0 && activeCount < 5 && " Noch " + (5 - activeCount) + " weitere Slots fuer optimale Sichtbarkeit."}
              {activeCount >= 5 && " Deine Sichtbarkeit ist optimal!"}
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-8 border-b border-white/5">
            <div className="p-3" />
            {TAGE.map(tag => (
              <div key={tag.key} className="p-3 text-center">
                <div className="text-xs font-medium text-white/60">{tag.label}</div>
              </div>
            ))}
          </div>

          {/* Slot Rows */}
          {SLOTS.map(slot => (
            <div key={slot.von} className="grid grid-cols-8 border-b border-white/5 last:border-0">
              <div className="p-3 flex flex-col justify-center">
                <div className="text-xs font-medium text-white/50">{slot.label}</div>
                <div className="text-[10px] text-white/25">{slot.sub}</div>
              </div>
              {TAGE.map(tag => {
                const key = slotKey(tag.key, slot.von)
                const active = !!slots[key]
                return (
                  <div key={key} className="p-2 flex items-center justify-center">
                    <button
                      onClick={() => toggle(tag.key, slot.von)}
                      className={"w-full h-12 rounded-lg border-2 transition-all " + (
                        active
                          ? "bg-[#00D4AA]/20 border-[#00D4AA]/40 hover:bg-[#00D4AA]/30"
                          : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                      )}
                    >
                      {active && <span className="text-[#00D4AA] text-sm font-bold">OK</span>}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#00D4AA]/20 border border-[#00D4AA]/40" />
            <span className="text-[10px] text-white/40">Verfuegbar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-white/[0.02] border border-white/5" />
            <span className="text-[10px] text-white/40">Nicht verfuegbar</span>
          </div>
        </div>
      </div>
    </div>
  )
}
