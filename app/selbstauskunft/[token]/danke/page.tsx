import type { Metadata } from "next"

// WoonWoon: Bestätigungsseite nach erfolgreicher Einreichung.

export const metadata: Metadata = {
  title: { absolute: "Selbstauskunft eingereicht | WoonWoon" },
  robots: { index: false, follow: false },
}

export default function DankeSeite() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900">WoonWoon</p>
          <p className="mt-1 text-sm text-slate-500">
            REK Berlin Home Service GmbH · Digitale Selbstauskunft
          </p>
        </header>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl" aria-hidden>
            ✓
          </div>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            Vielen Dank — Ihre Selbstauskunft ist eingegangen.
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Wir prüfen Ihre Angaben und Unterlagen und melden uns zeitnah bei
            Ihnen. Sie müssen nichts weiter tun — dieses Fenster können Sie
            jetzt schließen.
          </p>
        </div>
      </div>
    </main>
  )
}
