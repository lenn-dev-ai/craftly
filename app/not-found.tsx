import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md animate-fade-in">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-[#E8F4F1] flex items-center justify-center">
            <SearchX size={40} className="text-[#3D8B7A]/70" />
          </div>
        </div>

        <div>
          <h1 className="text-5xl font-bold text-[#2D2A26] mb-2">404</h1>
          <p className="text-xl font-medium text-[#6B655B]">
            Seite nicht gefunden
          </p>
        </div>

        <p className="text-[#8C857B] text-sm leading-relaxed">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
          Kehren Sie zum Dashboard zurück, um fortzufahren.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#3D8B7A] text-white font-semibold rounded-xl hover:bg-[#4A9E8C] hover:shadow-lg hover:shadow-[#00D4AA]/20 transition-all duration-200"
        >
          Zurück zum Dashboard
        </Link>
      </div>
    </div>
  );
}
