# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC / Lennart: 3 Cowork-Sprints zum Commit + Push (25.05.2026 abend)

> Cowork hat Code für **Sprint AG (Mapbox)**, **Sprint AF Phase 1 (KI-Pills)**
> und **Sprint AH (Admin-Mission-Control)** auf Disk geschrieben. Sandbox-Git
> war wegen stale `.git/index.lock` blockiert — Lennart oder CC muss commit + push.

## Status pro Sprint

| Sprint | DB-Migration | Code | Commit | Deploy |
|---|---|---|---|---|
| AG Mapbox | (keine nötig) | ✅ auf Disk | ⏳ ausstehend | ⏳ |
| AF KI-Pills Phase 1 | (keine nötig) | ✅ auf Disk | ⏳ ausstehend | ⏳ |
| AH Mission-Control | ✅ applied via MCP | ✅ auf Disk | ⏳ ausstehend | ⏳ |

DB-Migration AH ist schon live (`sprint_ah_admin_mission_control` —
function `count_users_online_last_5min`, view `admin_action_items`, RPCs
`admin_get_action_items` + `admin_activity_24h`).

## Geänderte / neue Dateien

### Sprint AG (Mapbox-Migration)
- `package.json` — leaflet/react-leaflet/@types/leaflet entfernt; mapbox-gl + react-map-gl + @types/mapbox-gl hinzugefügt
- `components/handwerker/KarteView.tsx` — komplett refaktoriert auf `react-map-gl`. Pin-Farben + Routen-Polyline + FitBounds + scrollZoom=false beibehalten.

### Sprint AF Phase 1 (KI-Pills dynamisch)
- `app/api/melden/pills/route.ts` — NEU. Endpoint liefert Top-5 Schadens-Pills basierend auf Saison + Verwalter-Stats. Fallback auf statische Top-5.
- `app/dashboard-mieter/melden/page.tsx` — useEffect zieht Pills via fetch. Static-Fallback drin. Pill-Buttons rendern jetzt aus `dynPills`.

### Sprint AH (Admin Mission Control)
- `app/api/admin/live/route.ts` — NEU
- `app/api/admin/action-items/route.ts` — NEU
- `app/api/admin/activity/route.ts` — NEU
- `app/api/admin/health/route.ts` — NEU
- `app/dashboard-admin/mission-control/page.tsx` — NEU (neue Route, /dashboard-admin/page.tsx bleibt unangetastet damit Lennart vergleichen kann)

## Commit-Befehle (für CC oder Lennart-Terminal)

```bash
cd ~/Desktop/Reparo

# Stale lock entfernen (Cowork konnte das aus Sandbox nicht)
rm -f .git/index.lock

# 1. Mapbox
git add package.json package-lock.json components/handwerker/KarteView.tsx
git commit -m "feat(map): migrate Leaflet/OSM → Mapbox via react-map-gl (Sprint AG)"

# 2. KI-Pills Phase 1
git add app/api/melden/pills/route.ts app/dashboard-mieter/melden/page.tsx
git commit -m "feat(melden): dynamische Pills via API mit Saison-Boosts (Sprint AF Phase 1)"

# 3. Mission Control
git add app/api/admin/live/route.ts app/api/admin/action-items/route.ts \
        app/api/admin/activity/route.ts app/api/admin/health/route.ts \
        app/dashboard-admin/mission-control/page.tsx
git commit -m "feat(admin): mission-control mit live + action-items + activity + health (Sprint AH)"

# 4. Push
git push
```

Wenn `npm install` lokal nötig ist (für Mapbox-deps): `npm install` einmal
vorher, damit `package-lock.json` aktualisiert wird, dann committen.

Netlify-Auto-Build holt die deps beim Deploy — kein manueller Schritt nötig.

## Sanity-Checks nach Deploy

```bash
# Mapbox (HW-Karte): kein Leaflet mehr im DOM
curl -s https://reparo-app.netlify.app/dashboard-handwerker/karte | grep -c "mapbox\|leaflet"
# erwartet: mehrere mapbox-Treffer, 0 leaflet

# KI-Pills Endpoint
curl -s https://reparo-app.netlify.app/api/melden/pills | jq '.pills | length'
# erwartet: 5

# Admin-Endpoints (nur als Admin eingeloggt)
# → in Browser einloggen, dann /dashboard-admin/mission-control öffnen
```

## Edge-Cases / Bekannte Limits

1. **Mapbox-Token**: muss `NEXT_PUBLIC_MAPBOX_TOKEN` in Netlify-ENV sein (Cowork hat das am 25.05. gesetzt). Wenn nicht: Karte zeigt Hinweis statt zu crashen.
2. **Pills-Fallback**: bei API-Fehler bleiben die 5 statischen Pills sichtbar. Kein UI-Crash.
3. **Mission Control vs. alt**: `/dashboard-admin` (alte Route) bleibt voll funktional. Neue Route ist parallel. Wenn Lennart die neue gut findet, kann CC später `/dashboard-admin/page.tsx` durch den Mission-Control-Inhalt ersetzen.
4. **Voice-Calls-Counter**: nicht im Live-Endpoint enthalten weil `voice_calls`-Tabelle (noch) nicht existiert.

## Empfohlener Smoke-Test nach Deploy

1. Login als `Demo-Handwerker-1` → `/dashboard-handwerker/karte` → Mapbox-Karte rendert
2. Login als `Demo-Mieter-1` → "Schaden melden" → Pills zeigen, klick füllt textarea
3. Login als Admin → `/dashboard-admin/mission-control` → alle 4 Sektionen sichtbar

## Lennart's Schritte

- Wenn du commitest: einfach obige Bash-Block ausführen
- Wenn CC committed: dieses File als Prompt verwenden ("commit + push + smoke-test")
- Bei Build-Failure: meist npm-Resolver-Konflikt → `rm -rf node_modules package-lock.json && npm install` lokal, dann committen
