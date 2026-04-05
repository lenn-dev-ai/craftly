export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-5">
        <div className="logo text-3xl">
          <span className="text-white">Repa</span>
          <span className="gradient-text">ro</span>
        </div>

        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00D4AA] border-r-[#00D4AA]/40 animate-spin" />
          <div
            className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-[#00B4D8] animate-spin"
            style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
          />
        </div>

        <p className="text-gray-500 text-xs tracking-wide">Wird geladen...</p>
      </div>
    </div>
  );
}
