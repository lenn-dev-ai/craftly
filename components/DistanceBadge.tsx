"use client"
import {
  haversineKm,
  formatiereDistanz,
  schaetzeFahrzeitMin,
  formatiereFahrzeit,
  distanzKategorie,
} from "@/lib/distance"

type Props = {
  vonLat?: number | null
  vonLng?: number | null
  zuLat?: number | null
  zuLng?: number | null
  radiusKm?: number
  zeigeFahrzeit?: boolean
}

const FARBEN: Record<string, string> = {
  nah: "bg-[#E1F5EE] text-[#2D6B5A] border-[#3D8B7A]/20",
  mittel: "bg-[#FAF1DE] text-[#854F0B] border-[#D4A24E]/30",
  weit: "bg-[#F5EBDF] text-[#854F0B] border-[#C4956A]/30",
  ausserhalb: "bg-[#FCEBEB] text-[#A32D2D] border-[#C4574B]/20",
}

export default function DistanceBadge({
  vonLat,
  vonLng,
  zuLat,
  zuLng,
  radiusKm,
  zeigeFahrzeit = false,
}: Props) {
  if (
    vonLat == null ||
    vonLng == null ||
    zuLat == null ||
    zuLng == null
  ) {
    return null
  }

  const km = haversineKm(vonLat, vonLng, zuLat, zuLng)
  const kat = distanzKategorie(km, radiusKm)
  const fahrzeit = schaetzeFahrzeitMin(km)

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${FARBEN[kat]}`}
      title={
        kat === "ausserhalb"
          ? `Außerhalb deines Radius (${radiusKm} km)`
          : `Geschätzte Fahrzeit: ${formatiereFahrzeit(fahrzeit)}`
      }
    >
      <span aria-hidden>📍</span>
      <span>{formatiereDistanz(km)}</span>
      {zeigeFahrzeit && fahrzeit > 0 && (
        <span className="opacity-70">· {formatiereFahrzeit(fahrzeit)}</span>
      )}
    </span>
  )
}
