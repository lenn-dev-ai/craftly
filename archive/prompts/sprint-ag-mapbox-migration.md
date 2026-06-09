# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint AG — Map-Library-Migration OSM/Leaflet → Mapbox

> Bestätigt 25.05.2026 — Konzept aus `KONZEPT-map-upgrade-mapbox.md` wird
> Sprint-Spec.
>
> Aufwand: ~1 Tag CC. Mittel-prio (B2B-Image).
>
> Voraussetzungen (bereits erledigt 25.05.2026):
> - ✅ Mapbox-Account angelegt (Cowork hat geholfen)
> - ✅ `NEXT_PUBLIC_MAPBOX_TOKEN` in Netlify-ENV gesetzt
>   (Wert: `pk.eyJ...REDACTED...` — siehe Netlify-ENV)

## Ziel

Leaflet/OSM-Karten in allen Reparo-Surfaces durch Mapbox + `react-map-gl`
ersetzen. Moderner Look, Vector-Tiles, Reparo-Marker-Branding.

## Betroffene Lokationen

```
app/dashboard-handwerker/karte/page.tsx     ← Hauptkarte mit HW-Marker + Aufträgen + Routen
app/dashboard-handwerker/auftrag/[id]/...   ← Detail-Map (Adresse anzeigen)
app/dashboard-verwalter/objekte/...         ← optional: Objekt-Map
app/marktplatz/...                          ← Mieter-Adress-Picker (falls Leaflet drin)
app/hausverwaltungen/page.tsx               ← optional: Hero-Map als visueller Anker
```

Bash zur Identifikation aller Leaflet-Usages:
```bash
grep -rn "leaflet\|react-leaflet\|L\.map\|TileLayer\|OpenStreetMap" app/ components/ lib/
```

## Schritte

### 1. Dependencies (5 Min)

```bash
npm install react-map-gl mapbox-gl
npm install -D @types/mapbox-gl
npm uninstall leaflet react-leaflet @types/leaflet  # falls keine Restnutzung
```

CSS-Import (z.B. in `app/layout.tsx`):
```typescript
import 'mapbox-gl/dist/mapbox-gl.css';
```

### 2. Token-Setup (5 Min)

Token kommt aus `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` (bereits gesetzt).

```typescript
import mapboxgl from 'mapbox-gl';
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
```

### 3. Shared `<MapView>` Komponente bauen (~3h)

`components/map/MapView.tsx`:

```typescript
'use client';
import Map, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapViewProps {
  center: [number, number]; // [lng, lat]
  zoom?: number;
  markers?: Array<{ id: string; lng: number; lat: number; label?: string; variant?: 'hw' | 'auftrag' | 'objekt' }>;
  routes?: Array<{ id: string; geojson: any; color?: string }>;
  onMarkerClick?: (id: string) => void;
  className?: string;
}

export function MapView({ center, zoom = 12, markers = [], routes = [], onMarkerClick, className }: MapViewProps) {
  return (
    <Map
      initialViewState={{ longitude: center[0], latitude: center[1], zoom }}
      mapStyle="mapbox://styles/mapbox/streets-v12"  // Beta-Start; später custom Style
      style={{ width: '100%', height: '100%' }}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      className={className}
    >
      <NavigationControl position="top-right" />
      {markers.map(m => (
        <Marker key={m.id} longitude={m.lng} latitude={m.lat} onClick={() => onMarkerClick?.(m.id)}>
          <div className={`reparo-marker reparo-marker--${m.variant ?? 'default'}`} />
        </Marker>
      ))}
      {routes.map(r => (
        <Source key={r.id} id={r.id} type="geojson" data={r.geojson}>
          <Layer
            id={`route-${r.id}`}
            type="line"
            paint={{ 'line-color': r.color ?? '#0066ff', 'line-width': 3 }}
          />
        </Source>
      ))}
    </Map>
  );
}
```

Custom-Marker via SVG/CSS — Reparo-Brand-Farben.

### 4. Migration pro Seite (~3h)

Alle Leaflet-Calls durch `<MapView />` ersetzen. Props bleiben (zentriert,
Marker-Liste, Routen-Liste), Renderer ist neu.

Bei Routen: GeoJSON-LineString aus Coordinates bauen (gleiches Format wie
bei Leaflet-Polyline).

### 5. Mobile-Verhalten (~1h)

- Pinch-Zoom + Pan automatisch via mapbox-gl
- KEIN Fullscreen-Lock (Sprint R Phase 18 wird obsolet — Mapbox handhabt
  Mobile out-of-the-box)
- Map-Höhe: `h-[60vh] md:h-[80vh]` (responsive)
- Klick auf Marker → Bottom-Sheet auf Mobile, Side-Panel auf Desktop

### 6. Smoke-Test (~0.5h)

1. HW-Karte: 5+ Marker, 1 Route → rendert sauber
2. Mobile (DevTools 390px): Pinch-Zoom funktioniert, kein Fullscreen-Lock
3. Performance: erste Map-Load <2 Sek (Vector-Tiles sind schneller als OSM)

## Kosten-Monitoring

Free-Tier: 50K Map-Loads/Mon. Bei aktueller Closed-Beta-Skala (10 HW × 50 Loads/Mon = 500) weit weg von Limit. Trotzdem:

- Token ist `pk.` (public) — read-only, im Frontend ok
- Bei `secret_token` braucht es einen `sk.` Token serverseitig
- Beim ersten Skalierungs-Sprint: Custom-Style + Reparo-Branding designen
  (Mapbox Studio, 1-2h Designer-Aufwand)

## Sanity-Check nach Deploy

1. `curl https://reparo-app.netlify.app/dashboard-handwerker/karte` → Mapbox-Karte sichtbar (Inspect: `mapboxgl-canvas`)
2. Browser-Console: keine "leaflet"-Errors
3. Lighthouse-Score Mobile ≥80 (Mapbox-Tiles sind schneller als OSM-Raster)

## Constraints

- KEINE Daten-Pipeline-Änderung (Marker-Source-Tables `profiles.location_lng/lat` usw. bleiben)
- Geocoding bleibt vorerst bei OSM-Nominatim (separater Sprint AG.2 für Mapbox-Geocoding)

## Commit

`feat(map): migrate Leaflet/OSM → Mapbox via react-map-gl (Sprint AG)`

## Erfolg

- Lennart-Feedback `345cee63` („Karte sieht veraltet aus") ist erledigt
- Alle Karten in Reparo modern (Vector-Tiles, sauberes UI)
- Mobile-Verhalten besser
- Sprint R Phase 18 (X-Button bei Mobile-Fullscreen) wird obsolet
