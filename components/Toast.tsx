"use client"
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import { useFocusTrap } from "@/lib/use-focus-trap"

type ToastType = "success" | "error" | "info"

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastApi {
  show: (message: string, type?: ToastType) => void
  confirm: (message: string) => Promise<boolean>
}

const ToastContext = createContext<ToastApi | null>(null)

// Hook für Komponenten: ersetzt window.alert + window.confirm durch
// design-konsistente Toasts und Inline-Dialoge. Beide Methoden Promise-
// basiert für drop-in-Ersatz.
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback wenn Provider nicht im Tree — verhindert Hard-Crash
    return {
      show: (msg) => { if (typeof window !== "undefined") console.warn("[Toast no-provider]", msg) },
      confirm: async (msg) => typeof window !== "undefined" ? window.confirm(msg) : false,
    }
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null)
  const confirmRef = useRef<HTMLDivElement>(null)
  useFocusTrap(confirmRef, pendingConfirm !== null)

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>(resolve => {
      setPendingConfirm({ message, resolve })
    })
  }, [])

  function answerConfirm(v: boolean) {
    pendingConfirm?.resolve(v)
    setPendingConfirm(null)
  }

  return (
    <ToastContext.Provider value={{ show, confirm }}>
      {children}

      {/* Toast-Stack — bottom-right. aria-live=polite damit Screen-Reader
          die Nachricht vorlesen, aber nicht den Focus stehlen. */}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg max-w-sm text-sm border ${
              t.type === "error"
                ? "bg-[#C4574B] text-white border-[#C4574B]"
                : t.type === "success"
                  ? "bg-accent text-white border-[#3D8B7A]"
                  : "bg-white text-ink border-line"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirm-Dialog — Center-Modal */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4"
          onClick={() => answerConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-message"
        >
          <div
            ref={confirmRef}
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <p id="confirm-dialog-message" className="text-sm text-ink leading-relaxed mb-5 whitespace-pre-wrap">{pendingConfirm.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => answerConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={() => answerConfirm(true)}
                className="px-4 py-2 text-sm font-bold bg-[#C4574B] text-white rounded-lg hover:bg-[#A34739]"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
