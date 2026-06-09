# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC-Master-Block 2 — 4 Sprints + 3 Fixes (25.05.2026 später Abend)

> Status: Cowork hat alle DB-Migrationen schon via Supabase-MCP applied
> und sämtlichen Code auf Disk geschrieben. CC committet + pusht in
> 5 sauberen Commits.

## DB-Migrationen (alle bereits LIVE via MCP)

| Migration | Status |
|---|---|
| `sprint_t_mvp_audit_trail` | ✅ applied |
| `sprint_ah_admin_action_items_fix_status_values` | ✅ applied |
| `sprint_u_mvp_status_erweiterung` | ✅ applied |
| `sprint_v_mvp_stamm_handwerker` | ✅ applied |
| `sprint_w_mvp_eigentuemer_schema` | ✅ applied |
| `sprint_ae_hw_google_oauth` | ✅ applied |

CC muss NICHTS an der DB tun — nur Code committen.

## 5 Commits (in dieser Reihenfolge)

### 1. fix: Status-Werte in AH-Code synchron mit DB-Check-Constraint

In Sprint AH hatte Cowork "auktion_offen" und "abgeschlossen" verwendet,
die DB akzeptiert aber "auktion" und "erledigt". Code wurde gefixt;
die View `admin_action_items` und RPC `admin_activity_24h` sind in der
DB schon korrigiert.

```bash
git add app/api/admin/live/route.ts app/dashboard-admin/mission-control/page.tsx
git commit -m "fix(admin): status-werte (auktion/erledigt) statt auktion_offen/abgeschlossen (Sprint AH Hotfix)"
```

### 2. Sprint T MVP — Audit-Trail

Neue Dateien:
- `lib/audit/logTicketEvent.ts`

Geänderte Dateien:
- `app/api/auction/close/route.ts` (1 import + 1 logTicketEvent-Aufruf am Ende)

```bash
git add lib/audit/logTicketEvent.ts app/api/auction/close/route.ts
git commit -m "feat(audit): ticket_audit_log + logger + auction/close integration (Sprint T MVP)"
```

### 3. Sprint AE — Google-Cal OAuth-Code (Live wartet auf ENV-Setup)

Neue Dateien:
- `lib/google-cal/oauth.ts`
- `app/api/auth/google/connect/route.ts`
- `app/api/auth/google/callback/route.ts`
- `app/api/auth/google/disconnect/route.ts`

**Voraussetzung für Live-Test (Lennart, post-Urlaub):**
1. Google-Cloud-Console-Setup (siehe `PROMPTS/google-oauth-setup-anleitung.md`, ~15 Min)
2. ENVs in Netlify: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (secret), `NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI`

Code ist deployment-ready — beim ersten Connect-Klick im HW-Profil ohne ENVs gibt's eine ehrliche Fehlermeldung statt Crash.

```bash
git add lib/google-cal/ app/api/auth/google/
git commit -m "feat(google-cal): OAuth-Flow + Token-Refresh (Sprint AE, ENVs wait for Lennart)"
```

### 4. Sprint AF Phase 2 — Foto-Prescan-Endpoint

Neue Datei:
- `app/api/ki/foto-prescan/route.ts`

claude-haiku-4-5 Vision-Call mit max_tokens=10, mappt Foto auf einen
von 9 Pill-Keys. Wird vom neuen TicketWizard (Sprint AI) bereits
genutzt; alte `/melden` würde Phase 3 brauchen.

```bash
git add app/api/ki/foto-prescan/route.ts
git commit -m "feat(ki): foto-prescan endpoint für Pill-Pre-Selection (Sprint AF Phase 2)"
```

### 5. Sprint AI — Wizard-Refactor als Parallel-Routes

Neue Dateien:
- `components/wizard/TicketWizard.tsx` (~470 LOC, deckt alle 5 Steps + Variant-Switch + Foto-Prescan)
- `app/dashboard-mieter/melden-neu/page.tsx` (Test-Route)
- `app/dashboard-verwalter/neues-ticket-neu/page.tsx` (Test-Route)

**Bewusst KEIN Replace von /melden** — Regression-Safety. Nach
Smoke-Test in Beta kann CC die Original-Pages durch Wrapper ersetzen.

Plus: 3 strategische Sprint-Specs für T/U/V/W (post-Beta-Implementation):
- `PROMPTS/sprint-t-b2b-trust-package.md`
- `PROMPTS/sprint-u-verwalter-statuslogik.md`
- `PROMPTS/sprint-v-stamm-hw-marktplatz-hybrid.md`
- `PROMPTS/sprint-w-eigentuemer-reporting.md`

```bash
git add components/wizard/ app/dashboard-mieter/melden-neu/ app/dashboard-verwalter/neues-ticket-neu/
git commit -m "feat(wizard): shared TicketWizard + parallel test-routes (Sprint AI, original /melden untouched)"

# Push alle 5 Commits
git push
```

## Sanity-Checks nach Deploy

```bash
# 1. AH-Hotfix wirkt (Mission-Control rendert)
curl -sI https://reparo-app.netlify.app/dashboard-admin/mission-control | head -3
# erwartet: HTTP/2 200 (oder 307 wegen Auth-Redirect)

# 2. Sprint T Audit-Trail funktioniert
# → Mit Demo-Verwalter-1 einloggen, Test-Auktion schließen,
#   dann via SQL: SELECT count(*) FROM ticket_audit_log WHERE event_type='auktion_geschlossen';
# → ≥1 nach Test

# 3. Sprint AE — OAuth-Connect-Endpoint
curl -sI https://reparo-app.netlify.app/api/auth/google/connect
# erwartet: 401 (Unauthorized) wenn nicht eingeloggt;
#           500 mit "GOOGLE_OAUTH_CLIENT_ID missing" wenn eingeloggt aber ENVs fehlen

# 4. Sprint AF2 — Foto-Prescan
curl -sX POST https://reparo-app.netlify.app/api/ki/foto-prescan
# erwartet: 401 Unauthorized

# 5. Sprint AI — neue Wizard-Route lädt
curl -sI https://reparo-app.netlify.app/dashboard-mieter/melden-neu
# erwartet: 200 oder Auth-Redirect

# 6. Voller Browser-Smoke (manuell):
#    - Login Demo-Mieter-1 → /dashboard-mieter/melden-neu → Wizard durchklicken bis Submit
#    - Login Demo-Verwalter-1 → /dashboard-verwalter/neues-ticket-neu → Wizard mit Anrufer-Feldern
#    - Login Admin → /dashboard-admin/mission-control → 4 Sektionen rendern
```

## Bekannte Limits

- **TicketWizard** hat eine schlanke Implementation der Foto-Upload-Logik
  (keine HEIC-Conversion, kein Drag-and-Drop, kein Progress-Bar). Wenn
  Beta-Tester das vermissen, später nachziehen.
- **Audit-Trail** logged nur `auktion_geschlossen`. Weitere Events
  (created, status_change, vergeben) kommen in Sprint T Phase 2 — der
  Logger ist vorhanden, nur die Aufruf-Stellen fehlen.
- **Stamm-HW Routing** (`lib/auction/stamm-routing.ts`) ist Helper-Only.
  Aufruf aus `/api/auction/start` ist Sprint V Phase 2.
- **Eigentümer-PDF-Reports** sind nur Schema. PDF-Engine + UI + Cron
  in Sprint W Phase 2.

## Wenn was bricht

`git revert <commit>` für den problematischen Commit. Die DB-Migrationen
sind alle additive — kein Rollback nötig auch wenn Code revertiert wird.
