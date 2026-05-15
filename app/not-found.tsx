import Link from "next/link"
import { SearchX } from "lucide-react"

export const metadata = {
  title: "Seite nicht gefunden",
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md animate-fade-in">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
            <SearchX size={40} className="text-accent" />
          </div>
        </div>

        <div>
          <h1 className="text-5xl font-bold text-ink mb-2">404</h1>
          <p className="text-xl font-medium text-ink-secondary">
            Seite nicht gefunden
          </p>
        </div>

        <p className="text-ink-muted text-sm leading-relaxed">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover transition-colors"
          >
            Zur Startseite
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 text-ink-secondary font-medium rounded-xl border border-line hover:bg-white transition-colors"
          >
            Anmelden
          </Link>
        </div>
      </div>
    </div>
  )
}
