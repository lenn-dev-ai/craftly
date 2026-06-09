# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC: Sprint AE Phase 3 — Commit + Push

## Was Cowork gebaut hat:
3 Files (1 NEU, 1 NEU, 1 modified):
- `app/api/google-cal/events/route.ts` (NEU) — GET-Endpoint für Events
- `lib/google-cal/events.ts` (NEU) — listEventsForUser-Helper
- `app/dashboard-handwerker/kalender/page.tsx` (M) — neuer "Google"-Layer

Aufgabe: Reparo's HW-Kalender zeigt jetzt verbundene Google-Termine als blaue Read-Only-Blöcke.

## Ausführen:
```bash
cd ~/Desktop/Reparo

# 1. Lokalen git-lock entfernen falls noch da (Sandbox-Residual)
rm -f .git/index.lock

# 2. Build validieren
npm run build 2>&1 | tail -30

# 3. Wenn grün, committen + pushen
git add app/api/google-cal/events/route.ts lib/google-cal/events.ts app/dashboard-handwerker/kalender/page.tsx

git commit -m "feat(sprint-ae-p3): Google-Cal-Events read-only im HW-Kalender

Neuer Layer 'Google' im Wochen-Grid zeigt verbundene Google-Termine als
blaue Read-Only-Blöcke. Wird via /api/google-cal/events geladen
(Helper lib/google-cal/events.ts ruft calendar.googleapis.com/calendar/v3
mit Bearer-Token aus hw_google_oauth, refresht expiry automatisch).

- listEventsForUser: events.list mit singleEvents+orderBy
- API-Route GET /api/google-cal/events?from=&to=
- kalender/page.tsx: state googleEvents, Layer-Chip, Event-Renderer
  mit Klick auf htmlLink → Google-Cal in neuem Tab"

git push origin main
```

Nach ~2 Min Netlify-Rebuild → Lennart's /dashboard-handwerker/kalender zeigt blaue Google-Termin-Blöcke.
