"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import L from "leaflet"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { createClient } from "@/lib/supabase"
import { optimiereRoute } from "@/lib/auction/route-bundling"
import { Map as MapIcon, AlertCircle } from "lucide-react"
import { formatGewerk } from "@/types"

// ============================================================
// Daten-Typen
// ============================================================

type Dringlichkeit = "notfall" | "zeitnah" | "planbar"

interface Stop {
  ticketId: string
  titel: string
  beschreibung: string | null
  gewerk: string | null
  dringlichkeit: Dringlichkeit
  lat: number
  lng: number
  adresse: string | null
  status: string
  von?: string
  bis?: string
  datum?: string
}

interface ProfilGeo {
  startort_lat: number | null
  startort_lng: number | null
  startort_adresse: string | null
  lat: number | null
  lng: number | null
}

// ============================================================
// Farbcodierung
// ============================================================

const FARBE: Record<Dringlichkeit, string> = {
  notfall: "#C4574B",
  zeitnah: "#C4956A",
  planbar: "#5B6ABF",
}

const LABEL: Record<Dringlichkeit, string> = {
  notfall: "🔴 Notfall",
  zeitnah: "🟡 Zeitnah",
  planbar: "🟢 Planbar",
}

// Default-Leaflet-Icon zerlegen wir nicht — wir bauen eigene divIcons
// mit der Dringlichkeits-Farbe.
function farbPin(farbe: string, nummer?: number): L.DivIcon {
  const inner = nummer != null ? String(nummer) : ""
  return L.divIcon({
    className: "reparo-pin",
    html: `<div style="
      width: 32px; height: 32px;
      background: ${farbe};
      border: 3px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="transform: rotate(45deg); color: #fff; font-weight: 700; font-size: 12px;">
        ${inner}
      </div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

function startPin(): L.DivIcon {
  return L.divIcon({
    className: "reparo-start-pin",
    html: `<div style="
      width: 24px; height: 24px;
      background: #3D8B7A;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

// Auto-Fit der Map auf alle Marker
function FitBounds({ punkte }: { punkte: Array<[number, number]> }) {
  const map = useMap()
  useEffect(() => {
    if (punkte.length === 0) return
    if (punkte.length === 1) {
      map.setView(punkte[0], 13)
      return
    }
    map.fitBounds(L.latLngBounds(punkte), { padding: [40, 40] })
  }, [map, punkte])
  return null
}

// ============================================================
// Haupt-Component
// ============================================================

export default function KarteView() {
  const router = useRouter()
  const [profilGeo, setProfilGeo] = useState<ProfilGeo | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [loading, setLoading] = useState(true)
  const [datum, setDatum] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [zeigeAlle, setZeigeAlle] = useState(false) // false = nur heute, true = alle offenen

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }

      const [{ data: prof }, { data: termine }, { data: tickets }] = await Promise.all([
        supabase.from("profiles").select("startort_lat, startort_lng, startort_adresse, lat, lng").eq("id", user.id).single<ProfilGeo>(),
        supabase
          .from("termine")
          .select("ticket_id, datum, von, bis, einsatzort_lat, einsatzort_lng, einsatzort_adresse, ticket:tickets(titel, beschreibung, gewerk, dringlichkeit, status, einsatzort_lat, einsatzort_lng, einsatzort_adresse)")
          .eq("handwerker_id", user.id)
          .gte("datum", new Date().toISOString().slice(0, 10))
          .order("datum")
          .returns<Array<{
            ticket_id: string | null
            datum: string
            von: string
            bis: string
            einsatzort_lat: number | null
            einsatzort_lng: number | null
            einsatzort_adresse: string | null
            ticket: { titel: string; beschreibung: string | null; gewerk: string | null; dringlichkeit: Dringlichkeit | null; status: string; einsatzort_lat: number | null; einsatzort_lng: number | null; einsatzort_adresse: string | null } | null
          }>>(),
        // Zusätzlich: zugewiesene Tickets ohne festen Termin
        supabase
          .from("tickets")
          .select("id, titel, beschreibung, gewerk, dringlichkeit, status, einsatzort_lat, einsatzort_lng, einsatzort_adresse")
          .eq("zugewiesener_hw", user.id)
          .neq("status", "erledigt")
          .returns<Array<{
            id: string
            titel: string
            beschreibung: string | null
            gewerk: string | null
            dringlichkeit: Dringlichkeit | null
            status: string
            einsatzort_lat: number | null
            einsatzort_lng: number | null
            einsatzort_adresse: string | null
          }>>(),
      ])
      setProfilGeo(prof ?? null)

      const ausTerminen: Stop[] = (termine ?? [])
        .filter(t => t.ticket_id && (t.einsatzort_lat ?? t.ticket?.einsatzort_lat) != null && (t.einsatzort_lng ?? t.ticket?.einsatzort_lng) != null)
        .map(t => ({
          ticketId: t.ticket_id!,
          titel: t.ticket?.titel ?? "Auftrag",
          beschreibung: t.ticket?.beschreibung ?? null,
          gewerk: t.ticket?.gewerk ?? null,
          dringlichkeit: (t.ticket?.dringlichkeit ?? "planbar") as Dringlichkeit,
          lat: (t.einsatzort_lat ?? t.ticket?.einsatzort_lat) as number,
          lng: (t.einsatzort_lng ?? t.ticket?.einsatzort_lng) as number,
          adresse: t.einsatzort_adresse ?? t.ticket?.einsatzort_adresse ?? null,
          status: t.ticket?.status ?? "in_bearbeitung",
          datum: t.datum,
          von: t.von?.slice(0, 5),
          bis: t.bis?.slice(0, 5),
        }))

      const termineIds = new Set(ausTerminen.map(s => s.ticketId))
      const ausTickets: Stop[] = (tickets ?? [])
        .filter(x => !termineIds.has(x.id) && x.einsatzort_lat != null && x.einsatzort_lng != null)
        .map(x => ({
          ticketId: x.id,
          titel: x.titel,
          beschreibung: x.beschreibung,
          gewerk: x.gewerk,
          dringlichkeit: (x.dringlichkeit ?? "planbar") as Dringlichkeit,
          lat: x.einsatzort_lat as number,
          lng: x.einsatzort_lng as number,
          adresse: x.einsatzort_adresse,
          status: x.status,
        }))

      setStops([...ausTerminen, ...ausTickets])
      setLoading(false)
    }
    load()
  }, [router])

  const tagesStops = useMemo(
    () => stops.filter(s => s.datum === datum),
    [stops, datum],
  )
  const sichtbar = zeigeAlle ? stops : tagesStops

  const startLat = profilGeo?.startort_lat ?? profilGeo?.lat
  const startLng = profilGeo?.startort_lng ?? profilGeo?.lng

  // Optimierte Tagesroute (Nearest-Neighbor) für die Polyline
  const route = useMemo(() => {
    if (!zeigeAlle && tagesStops.length >= 2 && startLat != null && startLng != null) {
      return optimiereRoute(startLat, startLng, tagesStops.map(s => ({
        ticketId: s.ticketId, latitude: s.lat, longitude: s.lng,
      })))
    }
    return null
  }, [tagesStops, zeigeAlle, startLat, startLng])

  const polyline: Array<[number, number]> = useMemo(() => {
    if (!route || startLat == null || startLng == null) return []
    const punkte: Array<[number, number]> = [[startLat, startLng]]
    for (const r of route.reihenfolge) {
      punkte.push([r.latitude, r.longitude])
    }
    return punkte
  }, [route, startLat, startLng])

  const reihenfolgeIndex = useMemo(() => {
    if (!route) return null
    const map = new Map<string, number>()
    route.reihenfolge.forEach((r, i) => map.set(r.ticketId, i + 1))
    return map
  }, [route])

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-sm text-ink-muted">Karte lädt…</div>
      </div>
    )
  }

  // Fit-Punkte aus Stops + Startort
  const fitPunkte: Array<[number, number]> = [
    ...(startLat != null && startLng != null ? [[startLat, startLng] as [number, number]] : []),
    ...sichtbar.map(s => [s.lat, s.lng] as [number, number]),
  ]

  // Fallback-Center: Berlin Mitte wenn nichts da ist
  const center: [number, number] = fitPunkte[0] ?? [52.520, 13.405]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">Karte</h1>
          <p className="text-sm text-ink-muted mt-1">
            {sichtbar.length} {sichtbar.length === 1 ? "Auftrag" : "Aufträge"} sichtbar
            {!zeigeAlle && route && route.reihenfolge.length >= 2 && (
              <> · Tagesroute {route.gesamtDistanzKm} km · {route.gesamtFahrzeitMin} min</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={datum}
            onChange={e => setDatum(e.target.value)}
            disabled={zeigeAlle}
            className="text-sm bg-white border border-line rounded-xl px-3 py-1.5 focus:outline-none focus:border-accent/40 disabled:opacity-50"
          />
          <button
            onClick={() => setZeigeAlle(z => !z)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              zeigeAlle
                ? "bg-accent text-white"
                : "bg-white border border-line text-ink-secondary hover:bg-surface"
            }`}
          >
            {zeigeAlle ? "Nur heute" : "Alle Aufträge"}
          </button>
        </div>
      </div>

      {/* Legende */}
      <div className="flex items-center gap-4 text-xs text-ink-secondary flex-wrap">
        <Legende farbe={FARBE.notfall} label="Notfall" />
        <Legende farbe={FARBE.zeitnah} label="Zeitnah" />
        <Legende farbe={FARBE.planbar} label="Planbar" />
        {startLat != null && (
          <Legende farbe="#3D8B7A" label="Startort" rund />
        )}
      </div>

      {/* Map oder Empty-State */}
      {fitPunkte.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-12 text-center shadow-sm">
          <MapIcon size={32} className="text-ink-muted mx-auto mb-3" />
          <div className="text-sm font-semibold text-ink mb-1">
            {!startLat ? "Startort nicht hinterlegt" : "Keine Aufträge mit Adresse"}
          </div>
          <div className="text-xs text-ink-muted mb-4">
            {!startLat
              ? "Trage deinen Startort im Profil ein, damit Routen berechnet werden können."
              : "Sobald dir Aufträge mit Einsatzort zugewiesen werden, erscheinen sie hier."}
          </div>
          {!startLat && (
            <button
              onClick={() => router.push("/dashboard-handwerker/profil")}
              className="text-xs font-medium bg-accent text-white px-4 py-2 rounded-xl hover:bg-accent-hover transition-colors"
            >
              Startort eintragen
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-line shadow-sm relative" style={{ height: 540 }}>
          {/* Sprint R Phase 18 (Feedback 345cee63): Karte fing
              Scroll-Events ab — User kam auf Mobile nicht mehr aus
              der Page raus.
              scrollWheelZoom={false}: Desktop-Scrollen scrollt die
              Page, nicht die Map. User kann mit Tap auf die Map
              dragging + pinch-zoom nutzen, aber Page-Scroll bleibt
              dem User. */}
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Startort-Pin */}
            {startLat != null && startLng != null && (
              <Marker position={[startLat, startLng]} icon={startPin()}>
                <Popup>
                  <div className="text-xs">
                    <strong>Startort</strong>
                    {profilGeo?.startort_adresse && <div className="text-ink-secondary">{profilGeo.startort_adresse}</div>}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Auftrags-Pins */}
            {sichtbar.map(s => {
              const nummer = reihenfolgeIndex?.get(s.ticketId)
              return (
                <Marker
                  key={s.ticketId}
                  position={[s.lat, s.lng]}
                  icon={farbPin(FARBE[s.dringlichkeit], nummer)}
                >
                  <Popup>
                    <div className="text-xs space-y-1 min-w-[180px]">
                      <div className="font-semibold text-ink text-sm">{s.titel}</div>
                      <div style={{ color: FARBE[s.dringlichkeit] }} className="font-medium">{LABEL[s.dringlichkeit]}</div>
                      {s.gewerk && <div className="text-ink-secondary">Gewerk: {formatGewerk(s.gewerk)}</div>}
                      {s.adresse && <div className="text-ink-secondary">📍 {s.adresse}</div>}
                      {s.von && s.bis && (
                        <div className="text-ink-secondary">⏰ {s.von}–{s.bis} {s.datum && `· ${s.datum}`}</div>
                      )}
                      <button
                        onClick={() => router.push(`/dashboard-handwerker/ticket/${s.ticketId}`)}
                        className="mt-2 text-accent hover:underline font-medium"
                      >
                        Auftrag öffnen →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )
            })}

            {/* Optimierte Routen-Linie (nur Tagesansicht) */}
            {polyline.length >= 2 && (
              <Polyline
                positions={polyline}
                pathOptions={{ color: "#3D8B7A", weight: 3, opacity: 0.7, dashArray: "8 6" }}
              />
            )}

            <FitBounds punkte={fitPunkte} />
          </MapContainer>
        </div>
      )}

      {/* Info zu Routen-Vorschau */}
      {!zeigeAlle && tagesStops.length >= 2 && route && (
        <div className="bg-white border border-line rounded-2xl p-4 shadow-sm text-xs text-ink-secondary flex items-start gap-2">
          <AlertCircle size={14} className="text-rolle-mieter flex-shrink-0 mt-0.5" />
          <span>
            Die gestrichelte Linie zeigt die optimierte Tagesroute (Nearest-Neighbor, Luftlinie).
            Stops sind nummeriert in der Reihenfolge, in der sie angefahren werden sollten.
          </span>
        </div>
      )}
    </div>
  )
}

function Legende({ farbe, label, rund = false }: { farbe: string; label: string; rund?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block"
        style={{
          width: 12, height: 12,
          background: farbe,
          borderRadius: rund ? "50%" : "50% 50% 50% 0",
          transform: rund ? "none" : "rotate(-45deg)",
        }}
      />
      {label}
    </span>
  )
}
