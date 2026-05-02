"use client"
import { useState, useCallback } from "react"

// Wrapper für async Aktionen mit Loading + Error State.
// Spart das try/catch + setLoading-Boilerplate in jedem Component.
//
// Usage:
//   const action = useAsyncAction()
//   await action.run(async () => {
//     await supabase.from("...").insert(...)
//   }, { fehlermeldung: "Speichern fehlgeschlagen" })
//
//   <Button disabled={action.loading}>
//   {action.error && <Toast message={action.error} />}

export type UseAsyncActionResult = {
  loading: boolean
  error: string | null
  run: <T>(
    fn: () => Promise<T>,
    opts?: { fehlermeldung?: string }
  ) => Promise<T | null>
  reset: () => void
}

export function useAsyncAction(): UseAsyncActionResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T,>(
    fn: () => Promise<T>,
    opts?: { fehlermeldung?: string }
  ): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      const msg =
        opts?.fehlermeldung ??
        (e instanceof Error
          ? e.message
          : "Ein unerwarteter Fehler ist aufgetreten.")
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setLoading(false)
  }, [])

  return { loading, error, run, reset }
}
