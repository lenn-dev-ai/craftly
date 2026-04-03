import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Icon */}
        <div className="flex justify-center">
          <SearchX size={64} className="text-[#00D4AA]/50" />
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold text-white">404</h1>

        {/* Message */}
        <p className="text-2xl font-semibold text-gray-300">
          Seite nicht gefunden
        </p>

        <p className="text-gray-400">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>

        {/* Back Link */}
        <Link
          href="/login"
          className="inline-block px-6 py-3 bg-[#00D4AA] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#00B4D8] transition-colors"
        >
          Zurück zum Login
        </Link>
      </div>
    </div>
  );
}
