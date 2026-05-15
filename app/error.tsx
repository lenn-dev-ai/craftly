'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // App-Error-Boundary: Loggt den Fehler in DevTools/Server-Logs.
    // Hier später ein Error-Reporting wie Sentry anschließen.
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Icon */}
        <div className="flex justify-center">
          <AlertTriangle size={64} className="text-danger/70" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-ink">
          Ein Fehler ist aufgetreten
        </h1>

        {/* Error Info — only digest for support, no raw messages */}
        <div className="bg-danger-light border border-danger/20 rounded-lg p-4">
          <p className="text-danger text-sm">
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.
          </p>
          {error.digest && (
            <p className="text-danger/60 text-xs mt-2 font-mono">
              Fehler-ID: {error.digest}
            </p>
          )}
        </div>

        {/* Description */}
        <p className="text-ink-muted">
          Falls das Problem weiterhin besteht, kontaktieren Sie bitte den Support
          {error.digest ? ` mit der Fehler-ID: ${error.digest}` : ''}.
        </p>

        {/* Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-[#4A9E8C] transition-colors"
          >
            Erneut versuchen
          </button>
          <a
            href="/login"
            className="px-6 py-3 bg-white border border-accent/30 text-accent font-semibold rounded-lg hover:bg-white/80 transition-colors"
          >
            Zum Login
          </a>
        </div>
      </div>
    </div>
  );
}
