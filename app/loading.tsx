export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        {/* Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#00D4AA] border-r-[#00D4AA] animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-[#00B4D8] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
        </div>
        <p className="text-gray-400 text-sm">Lädt...</p>
      </div>
    </div>
  );
}
