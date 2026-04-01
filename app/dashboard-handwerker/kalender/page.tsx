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
  const [initialSlots, setInitialSlots] = useState<SlotState>({})
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
      setInitialSlots(initial)
      setLoading(false)
    }
    load()
  }, [router])

  function toggle(tag: number, von: string) {
    const key = slotKey(tag, von)
    setSlots(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  function quickSelect(filter: string) {
    const newSlots = { ...slots }

    if (filter === "all") {
      TAGE.forEach(tag => {
        SLOTS.forEach(slot => {
          newSlots[slotKey(tag.key, slot.von)] = true
        })
      })
    } else if (filter === "reset") {
      TAGE.forEach(tag => {
        SLOTS.forEach(slot => {
          newSlots[slotKey(tag.key, slot.von)] = false
        })
      })
    } else if (filter === "weekday-mornings") {
      [1, 2, 3, 4, 5].forEach(tag => {
        newSlots[slotKey(tag, "08:00")] = true
      })
    } else if (filter === "weekday-full") {
      [1, 2, 3, 4, 5].forEach(tag => {
        SLOTS.forEach(slot => {
          newSlots[slotKey(tag, slot.von)] = true
        })
      })
    } else if (filter === "weekend") {
      [6, 0].forEach(tag => {
        SLOTS.forEach(slot => {
          newSlots[slotKey(tag, slot.von)] = true
        })
      })
    }

    setSlots(newSlots)
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

    setInitialSlots(slots)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const activeCount = Object.values(slots).filter(Boolean).length
  const changedCount = Object.keys(slots).filter(key => slots[key] !== initialSlots[key]).length
  const estimatedEarnings = activeCount * 1.5 * 350
  const earningsMin = Math.round(activeCount * 1 * 200)
  const earningsMax = Math.round(activeCount * 2 * 500)

  const earningsColor = activeCount === 0
    ? "text-red-500"
    : activeCount < 5
    ? "text-yellow-500"
    : "text-[#00D4AA]"

  const slotPercentage = Math.round((activeCount / 21) * 100)

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
        <span className="text-sm text-white/40">Kalender laden...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="max-w-4xl mx-auto p-6">
        {/* Profit-Focused Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dein Verdienstkalender</h1>
          <p className="text-white/60 text-sm">
            {activeCount} Zeitfenster aktiv \u2014 mehr Slots = mehr Verdienst
          </p>
        </div>

        {/* Earnings Forecast */}
        <div className="bg-gradient-to-r from-[#00D4AA]/10 to-[#00B4D8]/10 border border-[#00D4AA]/30 rounded-xl p-6 mb-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="text-sm text-white/60 mb-2">Geschaetzter Monatsverdienst</div>
              <div className={`text-4xl font-bold mb-2 ${earningsColor}`}>
                EUR {Math.round(estimatedEarnings).toLocaleString('de-DE')}
              </div>
              <div className="text-xs text-white/50">
                Bereich: EUR {earningsMin.toLocaleString('de-DE')} - EUR {earningsMax.toLocaleString('de-DE')}
              </div>
              <div className="text-xs text-white/40 mt-2">
                Basierend auf {activeCount} Zeitfenstern \u00d7 \u00d8 1-2 Auftraege/Slot \u00d7 EUR 200-500
              </div>
            </div>
            {activeCount === 0 && (
              <div className="text-right text-xs text-red-500/80 bg-red-500/5 px-3 py-2 rounded-lg border border-red-500/20">
                Keine aktiven Slots<br/>\u2192 Starten!
              </div>
            )}
            {activeCount >= 5 && (
              <div className="text-right text-xs text-[#00D4AA]/80 bg-[#00D4AA]/5 px-3 py-2 rounded-lg border border-[#00D4AA]/20">
                Maximale<br/>Sichtbarkeit!
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/60">{activeCount}/21 Slots aktiv</span>
            <span className="text-xs text-white/40">{slotPercentage}%</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] transition-all duration-300"
              style={{ width: `${slotPercentage}%` }}
            />
          </div>
          {activeCount < 10 && (
            <p className="text-[10px] text-white/40 mt-2">
              \ud83d\udca1 Tipp: {10 - activeCount} weitere Slots fuer maximale Sichtbarkeit
            </p>
          )}
        </div>

        {/* Quick Select Buttons */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => quickSelect("weekday-mornings")}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/70 hover:text-white"
            >
              Mo-Fr Morgens
            </button>
            <button
              onClick={() => quickSelect("weekday-full")}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/70 hover:text-white"
            >
              Mo-Fr Komplett
            </button>
            <button
              onClick={() => quickSelect("weekend")}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/70 hover:text-white"
            >
              Wochenende
            </button>
            <button
              onClick={() => quickSelect("all")}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#00D4AA]/15 border border-[#00D4AA]/30 hover:bg-[#00D4AA]/25 transition-all text-[#00D4AA]"
            >
              Alles
            </button>
            <button
              onClick={() => quickSelect("reset")}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all text-white/70 hover:text-red-400"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden mb-8">
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
                const isWeekend = tag.key === 0 || tag.key === 6
                const slotEarnings = isWeekend
                  ? Math.round(1.5 * 350 * 0.8)
                  : Math.round(1.5 * 350)

                return (
                  <div key={key} className="p-2 flex items-center justify-center">
                    <button
                      onClick={() => toggle(tag.key, slot.von)}
                      className={"w-full h-14 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 " + (
                        active
                          ? "bg-[#00D4AA]/20 border-[#00D4AA]/40 hover:bg-[#00D4AA]/30"
                          : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                      )}
                    >
                      {active && (
                        <>
                          <span className="text-[#00D4AA] text-xs font-bold">\u2713</span>
                          <span className="text-[10px] text-[#00D4AA]/70">~EUR {slotEarnings}/Mo</span>
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-20">
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

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-[#0a0a0f]/80 border-t border-white/5 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {changedCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <span className="text-xs font-medium text-yellow-500">{changedCount} Aenderungen</span>
              </div>
            )}
            {saved && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00D4AA]/10 border border-[#00D4AA]/20">
                <span className="text-xs font-medium text-[#00D4AA]">\u2713 Gespeichert!</span>
              </div>
            )}
          </div>
          <button
            onClick={save}
            disabled={saving || changedCount === 0}
            className={"px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 " + (
              saving
                ? "bg-[#00D4AA]/20 text-[#00D4AA]/60 cursor-wait"
                : changedCount === 0
                ? "bg-[#00D4AA]/10 text-[#00D4AA]/50 cursor-default"
                : "bg-[#00D4AA] text-black hover:bg-[#00D4AA]/90"
            )}
          >
            {saving && <span className="inline-block w-3 h-3 border-2 border-[#00D4AA]/60 border-t-[#00D4AA] rounded-full animate-spin" />}
            {saving ? "Speichert..." : saved ? "Gespeichert!" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  )
}
