// Wiederverwendbare Skeleton-Komponenten
// Skeletons fühlen sich schneller an als Spinner, weil das Layout schon steht.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[#EDE8E1] rounded ${className}`} />
}

// Karten-Skeleton — für Listen wie Tickets, Termine, Handwerker
export function CardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EDE8E1] p-5">
      <Skeleton className="h-5 w-1/2 mb-3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`h-3 mb-2 ${i % 2 === 0 ? "w-3/4" : "w-2/3"}`} />
      ))}
    </div>
  )
}

// Liste mit n Karten — für Dashboard-Streams
export function CardListSkeleton({ count = 3, rows = 2 }: { count?: number; rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} rows={rows} />
      ))}
    </div>
  )
}

// KPI-Grid Skeleton — z.B. Verwalter-Dashboard
export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#EDE8E1] p-4">
          <Skeleton className="h-3 w-1/2 mb-2" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ))}
    </div>
  )
}

// Page-Header Skeleton (Hero-Bereich auf jeder Seite)
export function PageHeaderSkeleton() {
  return (
    <div className="mb-8">
      <Skeleton className="h-8 w-1/3 mb-2" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}
