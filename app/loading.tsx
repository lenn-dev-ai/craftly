export default function Loading() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-5">
        <div className="logo text-3xl">
          <span className="text-[#2D2A26]">Repa</span>
          <span className="gradient-text">ro</span>
        </div>

        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#3D8B7A] border-r-[#3D8B7A]/40 animate-spin" />
          <div
            className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-[#4A9E8C] animate-spin"
            style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
          />
        </div>

        <p className="text-[#8C857B] text-xs tracking-wide">Wird geladen...</p>
      </div>
    </div>
  );
}
