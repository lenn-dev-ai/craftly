import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="logo text-3xl mb-4">Craft<span className="text-[#1D9E75]">ly</span></div>
        <h1 className="text-6xl font-medium text-gray-200 mb-2">404</h1>
        <p className="text-gray-500 mb-6">Diese Seite wurde nicht gefunden.</p>
        <Link href="/login"
          className="inline-block bg-[#1D9E75] text-white font-medium px-5 py-2.5 rounded-lg hover:bg-[#0F6E56] transition-colors text-sm">
          ZurÃ¼ck zum Login
        </Link>
      </div>
    </div>
  )
}
