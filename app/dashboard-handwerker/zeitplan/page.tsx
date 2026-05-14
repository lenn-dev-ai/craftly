import TimetableView from "@/components/handwerker/TimetableView"

export default function ZeitplanPage() {
  return (
    <div>
      {/* Konsistenter Ziel-Messaging-Header */}
      <div className="bg-gradient-to-r from-[#3D8B7A]/[0.08] to-[#5B6ABF]/[0.04] border-b border-[#EDE8E1]">
        <div className="max-w-6xl mx-auto px-6 py-3 text-xs sm:text-sm text-[#2D2A26]">
          <span className="font-semibold text-[#3D8B7A]">Reparo organisiert deinen Tag</span>
          <span className="text-[#6B665E]"> — du konzentrierst dich aufs Handwerk.</span>
        </div>
      </div>
      <TimetableView />
    </div>
  )
}
