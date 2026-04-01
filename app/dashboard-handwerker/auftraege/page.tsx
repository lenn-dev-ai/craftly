"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  vergeben: { label: "Vergeben", color: "#00D4AA", bg: "#00D4AA15" },
  in_arbeit: { label: "In Arbeit", color: "#F59E0B", bg: "#F59E0B15" },
  erledigt: { label: "Erledigt", color: "#8B5CF6", bg: "#8B5CF615" },
  auktion: { label: "Auktion", color: "#00B4D8", bg: "#00B4D815" },
}

function kiDauerSchaetzung(ticket: any): string {
  const t = (ticket.titel || "").toLowerCase()
  if (t.includes("heizung") || t.includes("therme")) return "2-4 Std."
  if (t.includes("wasser") || t.includes("rohr")) return "1-3 Std."
  if (t.includes("elektr") || t.includes("strom")) return "1-2 Std."
  if (t.includes("tuer") || t.includes("schloss")) return "1-2 Std."
  if (t.includes("schimmel")) return "3-6 Std."
  return "1-3 Std."
}

export default function AuftraegePage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("alle")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("tickets").select("*")
        .eq("zugewiesener_hw", user.id).order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
        <span className="text-sm text-white/40">Auftraege laden...</span>
      </div>
    </div>
  )

  const filtered = filter === "alle" ? tickets : tickets.filter(t => t.status === filter)
  const aktiv = tickets.filter(t => t.status !== "erledigt").length
  const erledigt = tickets.filter(t => t.status === "erledigt").length

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Meine Auftraege</h1>
          <p className="text-white/40 text-sm mt-1">
            {aktiv} aktiv | {erledigt} abgeschlossen | {tickets.length} gesamt
          </p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {[
            { key: "alle", label: "Alle", count: tickets.length },
            { key: "vergeben", label: "Vergeben", count: tickets.filter(t => t.status === "vergeben").length },
            { key: "in_arbeit", label: "In Arbeit", count: tickets.filter(t => t.status === "in_arbeit").length },
            { key: "erledigt", label: "Erledigt", count: erledigt },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap " + (
                filter === f.key
                  ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30"
                  : "bg-white/5 text-white/40 border border-white/5 hover:text-white/60"
              )}>
              {f.label}
              <span className={"ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] " + (filter === f.key ? "bg-[#00D4AA]/20" : "bg-white/5")}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-[#12121a] border border-white/5 rounded-xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-[#00B4D8]">[!]</span>
            </div>
            <div className="text-white/60 text-sm font-medium mb-1">
              {filter === "alle" ? "Noch keine Auftraege" : "Keine Auftraege mit Status \"" + (STATUS_CONFIG[filter]?.label || filter) + "\""}
            </div>
            <div className="text-white/30 text-xs mb-4">
              {filter === "alle"
                ? "Auftraege erscheinen hier, sobald du den Zuschlag fuer eine Ausschreibung erhaeltst."
                : "Aendere den Filter oder warte auf neue Auftraege."}
            </div>
            {filter === "alle" && (
              <button onClick={() => router.push("/dashboard-handwerker")}
                className="text-xs text-[#00D4AA] border border-[#00D4AA]/20 px-4 py-2 rounded-lg hover:bg-[#00D4AA]/10 transition-colors">
                Zu den Ausschreibungen
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(t => {
              const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.vergeben
              const steps = ["vergeben", "in_arbeit", "erledigt"]
              const stepIdx = steps.indexOf(t.status) >= 0 ? steps.indexOf(t.status) : 0

              return (
                <div key={t.id} onClick={() => router.push("/ticket/" + t.id)}
                  className={"bg-[#12121a] border border-white/5 rounded-xl p-4 cursor-pointer transition-all " + (
                    t.status === "erledigt" ? "opacity-60 hover:border-white/10" : "hover:border-[#00D4AA]/30"
                  )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">{t.titel}</div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-white/30 mb-3">
                    {t.wohnung || "Keine Adresse"}{" | "}Erstellt: {new Date(t.created_at).toLocaleDateString("de")}
                    {t.status !== "erledigt" && (
                      <span className="ml-2 text-[#00B4D8]">Geschaetzte Dauer: {kiDauerSchaetzung(t)}</span>
                    )}
                  </div>
                  {t.status !== "erledigt" ? (
                    <div className="flex gap-1">
                      {steps.map((s, i) => (
                        <div key={s} className={"h-1 flex-1 rounded-full " + (i <= stepIdx ? "bg-[#00D4AA]" : "bg-white/10")} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {steps.map(s => (
                        <div key={s} className="h-1 flex-1 rounded-full bg-[#8B5CF6]/50" />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
