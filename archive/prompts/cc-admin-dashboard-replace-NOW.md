# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# DRINGEND CC — Admin-Dashboard ersetzen

Cowork hat schon einen lokalen Commit `feecf34` der nur die
`/dashboard-admin/mission-control` Route als Redirect umbaut. Was FEHLT:
`app/dashboard-admin/page.tsx` ist auf Disk schon mit Mission-Control-
Inhalt überschrieben, aber im Commit nicht drin (Sandbox-Git-Race).

## Was zu tun ist

```bash
cd ~/Desktop/Reparo
rm -f .git/index.lock

# Lokalen Commit so amenden dass page.tsx mit drin ist:
git add app/dashboard-admin/page.tsx
git commit --amend --no-edit

# Oder, falls das Probleme macht, einfach neuer Commit:
# git add app/dashboard-admin/page.tsx
# git commit -m "refactor(admin): /dashboard-admin selber ist jetzt Mission Control (alte Statistik-Page weg)"

git push
```

## Erwarteter Effekt nach Deploy

`/dashboard-admin` zeigt NICHT mehr:
- KI-Analyse-Banner ("0 Anomalien · 1 Empfehlungen")
- Große Stat-Cards (13 User / 4 Verwalter / 3 HW / 3 Mieter / 0 Tickets / 0 Offen / 0 Erledigt / 0€)
- "Tickets pro Woche · letzte 8 Wochen" Chart

Stattdessen:
- "Mission Control" Header mit Live-Pulse-Dot
- Live-Sektion (3 große Zahlen: User online / Aktive Auktionen / Neue Tickets 1h)
- "Brauchen Aktion" Sektion (leer wenn keine Verwalter/Auktionen overdue)
- "Letzte 24 Stunden" mit ↑↓-Pfeilen (Neue Tickets / Vergeben / Erledigt / Neue HW)
- System-Health-Bar (DB / Resend / Vapi / Mapbox grüne Dots)

## Sub-Routen bleiben unangetastet

Sidebar-Links wie /dashboard-admin/feedback, /nutzer, /system, /aktivitaet,
/diagnose-preise — alle eigene Routen, alle bleiben funktional.

`/dashboard-admin/mission-control` (alte Sub-Route von Sprint AH) ist
jetzt ein Redirect auf `/dashboard-admin` (alte Bookmarks).

## Sanity nach Deploy

```bash
curl -sI https://reparo-app.netlify.app/dashboard-admin/mission-control | head -3
# erwartet: HTTP/2 307 (Redirect)

# Browser: /dashboard-admin als Admin → Mission Control statt KI-Analyse-Banner
```

## Rollback wenn was schiefgeht

```bash
git revert HEAD
git push
```
DB ist nicht angefasst, kein Rollback-Bedarf da.
