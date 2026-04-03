'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Icon */}
        <div className="flex justify-center">
          <AlertTriangle size={64} className="text-red-400/70" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-white">
          Ein Fehler ist aufgetreten
        </h1>

        {/* Error Info — only digest for support, no raw messages */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.
          </p>
          {error.digest && (
            <p className="text-red-300/60 text-xs mt-2 font-mono">
              Fehler-ID: {error.digest}
            </p>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-400">
          Falls das Problem weiterhin besteht, kontaktieren Sie bitte den Support
          {error.digest ? ` mit der Fehler-ID: ${error.digest}` : ''}.
        </p>

        {/* Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#00D4AA] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#00B4D8] transition-colors"
          >
            Erneut versuchen
          </button>
          <a
            href="/login"
            className="px-6 py-3 bg-[#12121a] border border-[#00D4AA]/30 text-[#00D4AA] font-semibold rounded-lg hover:bg-[#12121a]/80 transition-colors"
          >
            Zum Login
          </a>
        </div>
      </div>
    </div>
  );
}
