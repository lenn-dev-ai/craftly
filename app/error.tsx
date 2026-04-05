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
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Icon */}
        <div className="flex justify-center">
          <AlertTriangle size={64} className="text-[#C4574B]/70" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-[#2D2A26]">
          Ein Fehler ist aufgetreten
        </h1>

        {/* Error Info — only digest for support, no raw messages */}
        <div className="bg-[#FDEEEC] border border-[#C4574B]/20 rounded-lg p-4">
          <p className="text-[#C4574B] text-sm">
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.
          </p>
          {error.digest && (
            <p className="text-[#C4574B]/60 text-xs mt-2 font-mono">
              Fehler-ID: {error.digest}
            </p>
          )}
        </div>

        {/* Description */}
        <p className="text-[#8C857B]">
          Falls das Problem weiterhin besteht, kontaktieren Sie bitte den Support
          {error.digest ? ` mit der Fehler-ID: ${error.digest}` : ''}.
        </p>

        {/* Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#3D8B7A] text-white font-semibold rounded-lg hover:bg-[#4A9E8C] transition-colors"
          >
            Erneut versuchen
          </button>
          <a
            href="/login"
            className="px-6 py-3 bg-white border border-[#3D8B7A]/30 text-[#3D8B7A] font-semibold rounded-lg hover:bg-white/80 transition-colors"
          >
            Zum Login
          </a>
        </div>
      </div>
    </div>
  );
}
