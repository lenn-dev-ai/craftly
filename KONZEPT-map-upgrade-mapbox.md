# Konzept — Map-Library-Upgrade OSM → Mapbox

> Lennart-Feedback `345cee63` (25.05.): „Die Karte ... sieht völlig
> veraltete aus, das können wir nicht nutzen da muss was modernes
> state of the art hin als karte."
>
> Status: KONZEPT, kein Sprint-Spec. Aufwand ~1 Tag CC.

## Problem

Aktuelle Karten-Lib: OpenStreetMap (Leaflet) — funktional, aber:
- Default-Tiles sehen „2008 Wikipedia" aus
- Marker generisch
- Touch/Pan/Zoom mobile mittelmäßig
- B2B-Kunden erwarten Google-Maps-Niveau

→ B2B-Image-Problem für Reparo

## Optionen

### A) Mapbox — Cowork-Empfehlung

**Pro:**
- Modernes UI, customizable Tiles
- Vector-Tiles → schnell, schön
- Free-Tier: 50K Loads/Mon (genug für 200+ HW × 250 Loads/Mon)
- Großzügige Pricing: ~5 $/1000 Loads über Free-Tier
- React-Wrapper (`react-map-gl`) — gut dokumentiert
- Marker-Customization mit Reparo-Branding möglich

**Contra:**
- Setup-Kosten (Account, API-Key)
- Free-Tier-Limit bei Skalierung
- Vendor-Lock-in (aber moderate)

**Migration-Aufwand:** ~1 Tag CC
- Mapbox-Account anlegen (Lennart, 10 Min)
- `react-map-gl` installieren, Leaflet ersetzen
- Marker-Style anpassen
- Routen-Visualisierung migrieren
- Mobile-Touch testen

**Kosten:** Free-Tier reicht für Beta. Bei 200 aktive HW × 250 Loads/Mon = 50K Loads = Free.

### B) Google Maps — vertrauter, teurer

**Pro:**
- Jeder kennt Google Maps
- Beste mobile Bedienung
- Beste Search/Geocoding

**Contra:**
- Teurer: $7/1000 Loads ab Free-Tier (200K Free-Tier credit/Mon)
- Lock-in stärker
- Branding nur dezent anpassbar

**Cowork-Take:** mittel-prio. Wenn Google-Eintauch in DACH-Markt wichtig wird, später wechseln.

### C) MapTiler / TomTom / HERE — Alternativ

**Cowork-Take:** Nische. Nur wenn Mapbox/Google nicht passen.

### D) Leaflet bleibt, andere Tiles

**Schnellste Variante:** Statt OSM-Tiles z.B. Stadia Maps oder CartoDB-Tiles. ~1h CC.

**Pro:** kein Lib-Wechsel, nur Tile-URL-Tausch.
**Contra:** kein Vector-Tiles-Speed, kein Mapbox-Customization, nicht „state of the art" wie Lennart fordert.

→ als 80%-Lösung wenn Mapbox/Google zu groß wäre.

## Cowork-Empfehlung

**Mapbox** für Beta-Launch.

Reihenfolge:
1. Lennart bestätigt nach Urlaub
2. Lennart legt Mapbox-Account an (10 Min)
3. Cowork bekommt API-Key → in Netlify-ENV
4. CC migriert Leaflet → react-map-gl (1 Tag)
5. Smoke-Test mit HW-Karte + Route-Planning

## Use-Cases die unterstützt werden müssen

- `app/dashboard-handwerker/karte/page.tsx` — HW-Marker, Auftrags-Marker, Routen-Linien
- Map auf Mobile (Click → Detail-View, NICHT Fullscreen-Lock — siehe Sprint R Phase 18 als Quick-Fix)
- Verwalter-Verzeichnis: optional HW-Karte mit Reichweiten-Kreisen
- Sprint K Marketing-Landing: optional Hero-Map als visueller Anker

## Verbindung zu anderen Sprints

- Sprint R Phase 18 ist nur Quick-Fix (X-Button bei Mobile-Fullscreen) — Map bleibt OSM
- Sprint AG (Mapbox-Migration) = größerer Refactor, separates Sprint-File

## Status

WARTET auf Lennart-Bestätigung nach Urlaub. Konzept dokumentiert.
