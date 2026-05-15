import TimetableView from "@/components/handwerker/TimetableView"

export default function ZeitplanPage() {
  return (
    <div>
      {/* Konsistenter Ziel-Messaging-Header */}
      <div className="bg-gradient-to-r from-[#3D8B7A]/[0.08] to-[#5B6ABF]/[0.04] border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-3 text-xs sm:text-sm text-ink">
          <span className="font-semibold text-accent">Reparo organisiert deinen Tag</span>
          <span className="text-ink-secondary"> — du konzentrierst dich aufs Handwerk.</span>
        </div>
      </div>
      <TimetableView />
    </div>
  )
}
