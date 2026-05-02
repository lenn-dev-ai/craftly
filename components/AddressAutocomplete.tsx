"use client"
import { useEffect, useRef, useState } from "react"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

type Vorschlag = {
  place_name: string
  center: [number, number]
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
    if (!eingabe || eingabe.length < 3 || !MAPBOX_TOKEN) {
      setVorschlaege([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          eingabe
        )}.json?access_token=${MAPBOX_TOKEN}&country=de&autocomplete=true&types=address&language=de&limit=6`
        const res = await fetch(url)
        if (!res.ok) throw new Error("Geocoding fehlgeschlagen")
        const data = await res.json()
        setVorschlaege(data.features || [])
        setOpen(true)
      } catch {
        setVorschlaege([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  function waehlen(v: Vorschlag) {
    setText(v.place_name)
    setOpen(false)
    onSelect({ adresse: v.place_name, lng: v.center[0], lat: v.center[1] })
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      {label && <label className="text-sm font-medium text-[#6B665E]">{label}</label>}
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        disabled={disabled || !MAPBOX_TOKEN}
        onChange={(e) => {
          setText(e.target.value)
          suchen(e.target.value)
        }}
        onFocus={() => vorschlaege.length > 0 && setOpen(true)}
        className="w-full px-3 py-2.5 border border-[#EDE8E1] rounded-lg text-sm bg-white focus:outline-none focus:border-[#3D8B7A] transition-colors disabled:bg-[#FAF8F5] disabled:cursor-not-allowed"
      />
      {!MAPBOX_TOKEN && (
        <p className="text-xs text-[#C4574B]">
          Adress-Suche deaktiviert: <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> nicht gesetzt.
        </p>
      )}
      {open && vorschlaege.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#EDE8E1] rounded-lg shadow-lg z-20 max-h-72 overflow-auto">
          {vorschlaege.map((v, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => waehlen(v)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#FAF8F5] transition-colors"
              >
                {v.place_name}
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
