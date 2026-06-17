"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import MapboxMap, {
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
  type MapRef,
} from "react-map-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { createClient } from "@/lib/supabase"
import { optimiereRoute } from "@/lib/auction/route-bundling"
import { Map as MapIcon, Navigation, Clock, ExternalLink } from "lucide-react"
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

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

// Reparo-Markers als inline-SVG/CSS — Mapbox rendert beliebige JSX
function MapPin({ farbe, nummer }: { farbe: string; nummer?: number }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        background: farbe,
        border: "3px solid #ffffff",
        borderRadius: "50% 50% 50% 0",
        transform: "translate(-16px, -32px) rotate(-45deg)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          transform: "rotate(45deg)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        {nummer != null ? String(nummer) : ""}
      </div>
    </div>
  )
}

function StartPin() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        background: "#3D8B7A",
        border: "3px solid #ffffff",
        borderRadius: "50%",
        transform: "translate(-12px, -12px)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    />
  )
}

// ============================================================
// Haupt-Component
// ============================================================

export default function KarteView() {
  const router = useRouter()
  const mapRef = useRef<MapRef | null>(null)
  const [profilGeo, setProfilGeo] = useState<ProfilGeo | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [loading, setLoading] = useState(true)
  const [datum, setDatum] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [zeigeAlle, setZeigeAlle] = useState(false)
  const [openPopup, setOpenPopup] = useState<string | null>(null)
  // Mapbox Directions API: echte Straßenroute + Fahrzeiten
  const [roadRoute, setRoadRoute] = useState<{
    geometry: GeoJSON.LineString | null
    legs: Array<{ distanceKm: number; durationMin: number }>
  } | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

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

  const route = useMemo(() => {
    if (!zeigeAlle && tagesStops.length >= 2 && startLat != null && startLng != null) {
      return optimiereRoute(startLat, startLng, tagesStops.map(s => ({
        ticketId: s.ticketId, latitude: s.lat, longitude: s.lng,
      })))
    }
    return null
  }, [tagesStops, zeigeAlle, startLat, startLng])

  // Mapbox erwartet [lng, lat] (im Gegensatz zu Leaflets [lat, lng])
  // Priorität: echte Straßenroute (Directions API) > Luftlinie-Fallback
  const routeGeoJSON = useMemo(() => {
    if (!route || startLat == null || startLng == null) return null
    if (roadRoute?.geometry) {
      return {
        type: "Feature" as const,
        properties: {},
        geometry: roadRoute.geometry,
      }
    }
    // Fallback: Luftlinie
    const coords: Array<[number, number]> = [[startLng, startLat]]
    for (const r of route.reihenfolge) coords.push([r.longitude, r.latitude])
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: coords },
    }
  }, [route, roadRoute, startLat, startLng])

  const reihenfolgeIndex = useMemo(() => {
    if (!route) return null
    const map = new Map<string, number>()
    route.reihenfolge.forEach((r, i) => map.set(r.ticketId, i + 1))
    return map
  }, [route])

  // ----------------------------------------------------------------
  // Mapbox Directions API — echte Straßenroute für Tages-Stops
  // Wird ausgelöst wenn sich die optimierte Reihenfolge ändert.
  // Fehler werden ignoriert (Fallback auf Luftlinie-GeoJSON).
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!route || !MAPBOX_TOKEN || startLat == null || startLng == null) {
      setRoadRoute(null)
      return
    }
    const waypoints: Array<[number, number]> = [
      [startLng, startLat],
      ...route.reihenfolge.map(r => [r.longitude, r.latitude] as [number, number]),
    ]
    // Directions API max 25 Waypoints — für Demo ausreichend
    if (waypoints.length < 2) { setRoadRoute(null); return }

    const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";")
    setRouteLoading(true)
    fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
      `?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`,
    )
      .then(r => r.json())
      .then((data: {
        routes?: Array<{
          geometry: GeoJSON.LineString
          legs: Array<{ distance: number; duration: number }>
        }>
      }) => {
        const r0 = data.routes?.[0]
        if (!r0) { setRoadRoute(null); return }
        setRoadRoute({
          geometry: r0.geometry,
          legs: r0.legs.map(l => ({
            distanceKm: Math.round(l.distance / 100) / 10,
            durationMin: Math.round(l.duration / 60),
          })),
        })
      })
      .catch(() => setRoadRoute(null))
      .finally(() => setRouteLoading(false))
  }, [route, startLat, startLng])

  // FitBounds: Mapbox-Variante via mapRef
  useEffect(() => {
    if (!mapRef.current) return
    const punkte: Array<[number, number]> = [
      ...(startLat != null && startLng != null ? [[startLng, startLat] as [number, number]] : []),
      ...sichtbar.map(s => [s.lng, s.lat] as [number, number]),
    ]
    if (punkte.length === 0) return
    if (punkte.length === 1) {
      mapRef.current.flyTo({ center: punkte[0], zoom: 13, duration: 600 })
      return
    }
    const lngs = punkte.map(p => p[0])
    const lats = punkte.map(p => p[1])
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ]
    mapRef.current.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 14 })
  }, [sichtbar, startLat, startLng])

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-sm text-ink-muted">Karte lädt…</div>
      </div>
    )
  }

  const fitPunkte: Array<[number, number]> = [
    ...(startLat != null && startLng != null ? [[startLat, startLng] as [number, number]] : []),
    ...sichtbar.map(s => [s.lat, s.lng] as [number, number]),
  ]

  // Fallback-Center: Berlin Mitte
  const initialLng = startLng ?? sichtbar[0]?.lng ?? 13.405
  const initialLat = startLat ?? sichtbar[0]?.lat ?? 52.52

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
      ) : !MAPBOX_TOKEN ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-900">
          Mapbox-Token (NEXT_PUBLIC_MAPBOX_TOKEN) fehlt in den Environment-Variables. Karte kann nicht geladen werden.
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-line shadow-sm relative" style={{ height: 540 }}>
          {/* Sprint AG: Mapbox via react-map-gl (vorher Leaflet/OSM).
              scrollZoom={false} → Page-Scroll bleibt dem User, statt
              im Map-Container gefangen zu sein. Auf Mobile sind Pan
              und Pinch-Zoom out-of-the-box ohne Fullscreen-Lock. */}
          <MapboxMap
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ longitude: initialLng, latitude: initialLat, zoom: 12 }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: "100%", height: "100%" }}
            scrollZoom={false}
          >
            <NavigationControl position="top-right" showCompass={false} />

            {/* Startort-Pin */}
            {startLat != null && startLng != null && (
              <Marker
                longitude={startLng}
                latitude={startLat}
                anchor="center"
                onClick={e => { e.originalEvent.stopPropagation(); setOpenPopup("start") }}
              >
                <StartPin />
              </Marker>
            )}
            {openPopup === "start" && startLat != null && startLng != null && (
              <Popup
                longitude={startLng}
                latitude={startLat}
                anchor="top"
                onClose={() => setOpenPopup(null)}
                closeButton
                closeOnClick={false}
              >
                <div className="text-xs">
                  <strong>Startort</strong>
                  {profilGeo?.startort_adresse && (
                    <div className="text-ink-secondary">{profilGeo.startort_adresse}</div>
                  )}
                </div>
              </Popup>
            )}

            {/* Auftrags-Pins */}
            {sichtbar.map(s => {
              const nummer = reihenfolgeIndex?.get(s.ticketId)
              const popupKey = `t:${s.ticketId}`
              return (
                <Marker
                  key={s.ticketId}
                  longitude={s.lng}
                  latitude={s.lat}
                  anchor="bottom"
                  onClick={e => { e.originalEvent.stopPropagation(); setOpenPopup(popupKey) }}
                >
                  <MapPin farbe={FARBE[s.dringlichkeit]} nummer={nummer} />
                </Marker>
              )
            })}

            {sichtbar.map(s => {
              const popupKey = `t:${s.ticketId}`
              if (openPopup !== popupKey) return null
              return (
                <Popup
                  key={popupKey}
                  longitude={s.lng}
                  latitude={s.lat}
                  anchor="top"
                  onClose={() => setOpenPopup(null)}
                  closeButton
                  closeOnClick={false}
                >
                  <div className="text-xs space-y-1 min-w-[180px]">
                    <div className="font-semibold text-ink text-sm">{s.titel}</div>
                    <div style={{ color: FARBE[s.dringlichkeit] }} className="font-medium">{LABEL[s.dringlichkeit]}</div>
                    {s.gewerk && <div className="text-ink-secondary">Gewerk: {formatGewerk(s.gewerk)}</div>}
                    {s.adresse && <div className="text-ink-secondary">📍 {s.adresse}</div>}
                    {s.von && s.bis && (
                      <div className="text-ink-secondary">⏰ {s.von}–{s.bis} {s.datum && `· ${s.datum}`}</div>
                    )}
                    <div className="mt-2 flex flex-col gap-1">
                      <button
                        onClick={() => router.push(`/dashboard-handwerker/ticket/${s.ticketId}`)}
                        className="text-accent hover:underline font-medium text-left"
                      >
                        Auftrag öffnen →
                      </button>
                      {s.adresse && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.adresse)}&travelmode=driving`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-ink-secondary hover:text-accent font-medium"
                        >
                          <Navigation size={11} />
                          Navigation starten
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                </Popup>
              )
            })}

            {/* Tagesroute: echte Straßen wenn Directions-API geliefert, sonst Luftlinie */}
            {routeGeoJSON && (
              <Source id="route" type="geojson" data={routeGeoJSON}>
                {/* Halo für bessere Lesbarkeit auf hellen Kacheln */}
                <Layer
                  id="route-line-halo"
                  type="line"
                  paint={{
                    "line-color": "#ffffff",
                    "line-width": roadRoute?.geometry ? 7 : 5,
                    "line-opacity": 0.6,
                  }}
                />
                <Layer
                  id="route-line"
                  type="line"
                  paint={{
                    "line-color": "#3D8B7A",
                    "line-width": roadRoute?.geometry ? 4 : 3,
                    "line-opacity": 0.85,
                    ...(roadRoute?.geometry ? {} : { "line-dasharray": [2, 1.5] }),
                  }}
                />
              </Source>
            )}
          </MapboxMap>
        </div>
      )}

      {/* ─── Wegbeschreibung-Panel ─────────────────────────────── */}
      {!zeigeAlle && route && route.reihenfolge.length >= 1 && (
        <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Navigation size={15} className="text-accent" />
              Wegbeschreibung
              {routeLoading && (
                <span className="text-xs font-normal text-ink-muted animate-pulse">berechnet…</span>
              )}
            </div>
            {roadRoute && (
              <span className="text-xs text-ink-muted">
                {roadRoute.legs.reduce((s, l) => s + l.distanceKm, 0).toFixed(1)} km ·{" "}
                {roadRoute.legs.reduce((s, l) => s + l.durationMin, 0)} min gesamt
              </span>
            )}
          </div>

          <div className="divide-y divide-line/60">
            {/* Startort */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-7 h-7 rounded-full bg-accent/10 border-2 border-accent flex-shrink-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-ink">Startort</div>
                {profilGeo?.startort_adresse && (
                  <div className="text-xs text-ink-muted truncate">{profilGeo.startort_adresse}</div>
                )}
              </div>
            </div>

            {/* Stops in optimierter Reihenfolge */}
            {route.reihenfolge.map((r, idx) => {
              const s = sichtbar.find(x => x.ticketId === r.ticketId)
              if (!s) return null
              const leg = roadRoute?.legs[idx]
              const googleUrl = s.adresse
                ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.adresse)}&travelmode=driving`
                : null

              return (
                <div key={r.ticketId} className="flex items-start gap-3 px-4 py-3">
                  {/* Fahrt-Info zwischen Stops */}
                  {leg && (
                    <div className="absolute ml-[13px] -mt-3 flex flex-col items-center pointer-events-none" style={{ marginLeft: 13 }}>
                    </div>
                  )}

                  {/* Nummern-Pin */}
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: FARBE[s.dringlichkeit] }}
                  >
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Fahrstrecke vom Vorgänger */}
                    {leg && (
                      <div className="flex items-center gap-1 text-xs text-ink-muted mb-1">
                        <Clock size={10} />
                        {leg.durationMin} min · {leg.distanceKm} km
                      </div>
                    )}
                    <div className="text-xs font-semibold text-ink truncate">{s.titel}</div>
                    {s.adresse && (
                      <div className="text-xs text-ink-muted truncate">📍 {s.adresse}</div>
                    )}
                    {s.von && s.bis && (
                      <div className="text-xs text-ink-muted">⏰ {s.von}–{s.bis}</div>
                    )}
                  </div>

                  {/* Navigation starten */}
                  {googleUrl && (
                    <a
                      href={googleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover px-2 py-1 rounded-lg hover:bg-accent/5 transition-colors"
                      title="In Google Maps navigieren"
                    >
                      <Navigation size={12} />
                      <span className="hidden sm:inline">Navi</span>
                    </a>
                  )}
                </div>
              )
            })}
          </div>
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
