"use client"
import { useEffect, useRef, useState } from "react"

// Photon (Komoot) — kein API-Key, kein Account, EU-Hosting (München)
// Docs: https://photon.komoot.io/
const PHOTON_URL = "https://photon.komoot.io/api/"

type PhotonFeature = {
  type: "Feature"
  geometry: { type: "Point"; coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    state?: string
    country?: string
    countrycode?: string
    type?: string
    osm_value?: string
  }
}

type Vorschlag = {
  label: string
  lat: number
  lng: number
}

function formatiereAdresse(p: PhotonFeature["properties"]): string {
  const strasse = [p.street, p.housenumber].filter(Boolean).join(" ")
  const ort = [p.postcode, p.city].filter(Boolean).join(" ")
  const teile = [strasse, ort, p.country].filter(t => t && t.length > 0)

  // Falls Straße fehlt aber name vorhanden (z. B. POI), nimm den Namen
  if (!strasse && p.name) {
    teile.unshift(p.name)
  }
  return teile.join(", ")
}

type Props = {
  label?: string
  placeholder?: string
  initialAdresse?: string
  onSelect: (treffer: { adresse: string; lat: number; lng: number }) => void
  disabled?: boolean
}

export default function AddressAutocomplete({
  label,
  placeholder = "Straße, Hausnummer, Ort",
  initialAdresse = "",
  onSelect,
  disabled = false,
}: Props) {
  const [text, setText] = useState(initialAdresse)
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function suchen(eingabe: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!eingabe || eingabe.length < 3) {
      setVorschlaege([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        // Photon — lang=de, limit=6, layer=address bevorzugt Adressen vor POIs
        const url = `${PHOTON_URL}?q=${encodeURIComponent(eingabe)}&lang=de&limit=6&layer=house&layer=street`
        const res = await fetch(url)
        if (!res.ok) throw new Error("Photon-Geocoding fehlgeschlagen")
        const data = await res.json() as { features?: PhotonFeature[] }

        const treffer: Vorschlag[] = (data.features || [])
          .filter(f => f.properties.countrycode === "DE" || !f.properties.countrycode)
          .map(f => ({
            label: formatiereAdresse(f.properties),
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
          .filter(v => v.label.length > 3)

        setVorschlaege(treffer)
        setOpen(treffer.length > 0)
      } catch {
        setVorschlaege([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  function waehlen(v: Vorschlag) {
    setText(v.label)
    setOpen(false)
    onSelect({ adresse: v.label, lat: v.lat, lng: v.lng })
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      {label && <label className="text-sm font-medium text-[#6B665E]">{label}</label>}
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value)
          suchen(e.target.value)
        }}
        onFocus={() => vorschlaege.length > 0 && setOpen(true)}
        className="w-full px-3 py-2.5 border border-[#EDE8E1] rounded-lg text-sm bg-white focus:outline-none focus:border-[#3D8B7A] transition-colors disabled:bg-[#FAF8F5] disabled:cursor-not-allowed"
        autoComplete="off"
      />
      {open && vorschlaege.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#EDE8E1] rounded-lg shadow-lg z-20 max-h-72 overflow-auto">
          {vorschlaege.map((v, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => waehlen(v)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#FAF8F5] transition-colors"
              >
                {v.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <p className="text-xs text-[#8C857B]">Suche…</p>
      )}
    </div>
  )
}
