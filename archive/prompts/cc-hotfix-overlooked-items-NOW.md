# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# DRINGEND CC — 4 Hotfixes für Cowork-Lennart-Issue (25.05.2026 spät-Abend)

> Lennart hat zurecht angemerkt dass die Admin-Page noch alt aussieht +
> mehrere Sprint-Items "nicht sichtbar" sind. Cowork hat 4 Hotfixes
> auf Disk + ein lokales Commit das nicht gepushed werden kann
> (SSH-Host-Key blockt im Sandbox). CC: amend + push.

## Stand

- Lokal: `feecf34` (refactor: mission-control IS jetzt /dashboard-admin)
  enthält bisher NUR den Redirect von `/mission-control` auf `/dashboard-admin`,
  der eigentliche `page.tsx`-Replace fehlt im Commit (Sandbox-Git-Race).
- Auf Disk geupdated: 4 weitere Files.

## Commit-Reihenfolge

```bash
cd ~/Desktop/Reparo
rm -f .git/index.lock

# 1. Amend den vorhandenen Commit mit der echten page.tsx + den 3 Hotfix-Files
git add app/dashboard-admin/page.tsx \
        app/dashboard-mieter/melden/page.tsx \
        app/dashboard-handwerker/profil/page.tsx \
        lib/feedback-verdicts.ts

# Falls noch nicht gemerged:
git commit --amend -m "refactor(admin): /dashboard-admin IS Mission Control + AF2-Integration im Mieter-Wizard + AE-Connect-UI im HW-Profil + Verdict-Map Iteration 25"

# 2. Push
git push
```

## Was sich konkret ändert nach Deploy

### 1. /dashboard-admin (alte Page)
**Vorher:** KI-Analyse-Banner, 8 große Stat-Cards, "Tickets pro Woche"-Chart.
**Nachher:** "Mission Control"-Header mit Pulse-Dot, 4 Sections:
- 🟢 Live: User online (5min) · Aktive Auktionen · Neue Tickets (1h)
- ⚠️ Brauchen Aktion: Liste auf View `admin_action_items` basierend
- 📊 Letzte 24h: Neue Tickets / Vergeben / Erledigt / Neue HW mit ↑↓-Pfeilen
- 🔧 System: 4 farbige Dots (DB, Resend, Vapi, Mapbox)

### 2. /dashboard-mieter/melden (Original-Wizard)
**Vorher:** 5 statische/dynamische Pills, keine Pre-Selection nach Foto.
**Nachher:** Nach Foto-Upload wird die wahrscheinlichste Pill automatisch
hervorgehoben (✓-Prefix + Accent-Border + ring-2). Foto-Prescan-Call läuft
im Hintergrund, non-blocking. Sprint AF Phase 2 nun in beiden Wizards aktiv
(Original UND `/melden-neu`).

### 3. /dashboard-handwerker/profil (Google-Cal-Section)
**Vorher:** Statischer "Demnächst"-Button (disabled, nichts klickbar).
**Nachher:** Echte Connect/Disconnect-Buttons:
- Beim ersten Render: liest `hw_google_oauth` für aktuellen User → Status
- "Mit Google verbinden" → Redirect zu `/api/auth/google/connect` (OAuth-Flow)
- Falls verbunden: "Trennen"-Button + Anzeige "Verbunden seit XX.XX.2026"
- OAuth-Callback-Query-Params (`?google=connected` / `?google=error&reason=...`)
  werden geparst und als Status / Fehler-Banner angezeigt.

**Voraussetzung für Live-Test:** Lennart muss noch in Google-Cloud-Console
einen OAuth-Client anlegen + Client-ID/Secret als Netlify-ENVs setzen.
Bis dahin: Button ist klickbar aber Connect schlägt mit ehrlicher
Fehlermeldung fehl ("GOOGLE_OAUTH_CLIENT_ID missing"). Setup-Anleitung:
`PROMPTS/google-oauth-setup-anleitung.md`.

### 4. lib/feedback-verdicts.ts
Neuer Verdict für `37f6be65` (Wohneinheit-Identifier, fehlte noch).
`9ab7382d` (Dashboard-Sinn) von needdecision → done (Mission Control live).

## Sanity-Checks

```bash
curl -sI https://reparo-app.netlify.app/dashboard-admin | head -3
# erwartet: 200 oder Auth-Redirect; Browser → Mission Control statt KI-Cards

curl -sI https://reparo-app.netlify.app/dashboard-admin/mission-control | head -3
# erwartet: 307 Redirect auf /dashboard-admin

# Browser-Smoke (manuell):
# - Login Admin → /dashboard-admin → Mission Control sichtbar
# - Login Demo-Mieter-1 → "Schaden melden" → Foto hochladen → eine Pill
#   bekommt nach ~1-2s einen Accent-Border + ✓
# - Login Demo-Handwerker-1 → /dashboard-handwerker/profil → "Google-Kalender
#   verbinden"-Section zeigt "Mit Google verbinden" Button (klickbar)
```

## Rollback

`git revert HEAD && git push` — DB nicht angefasst.
