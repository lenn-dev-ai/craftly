"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts"

// Sprint H — 4-Wochen-Throughput-Chart fürs Verwalter-Dashboard.
// Pro Woche zwei Bars (neu/erledigt), responsive auf Container-Width.

export type ThroughputBucket = {
  woche: string
  label: string
  neu: number
  erledigt: number
}

export function ThroughputChart({ data }: { data: ThroughputBucket[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-ink-muted text-center py-8">
        Keine Daten in den letzten 4 Wochen.
      </div>
    )
  }
  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B6259" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6B6259" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#FFF", border: "1px solid #E8E5E0", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#2F2A24", fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="neu" name="Neu" fill="#5B6ABF" radius={[4, 4, 0, 0]} />
          <Bar dataKey="erledigt" name="Erledigt" fill="#3D8B7A" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
