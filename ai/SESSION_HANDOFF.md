# Session Handoff

> **Zweck**: Zeitliche Lage. Was sich pro Session ändert.
> Für die langlebige Konstitution → `REPARO_OPERATING_SYSTEM.md`.
> **Letzte Review:** 15.06.2026, Audit-Umsetzung (Recherche-Runde + Reklamations-Transparenz + Quick-Wins)

---

## TL;DR für die nächste Session

- **Letzter Stand:** Sprint AU (Direktvergabe-First Showcase-Daten) + Fix "Vergabe statt Auktion bei Direktvergabe" sind live (commit `a1b6141`).
- **Danach (diese Session, Audit-Umsetzung):** Aus dem finalen Audit-Report (#212/#264) wurden alle 4 vom Lennart ausgewählten Bereiche umgesetzt — Recherche-Runde, Reklamations-Transparenz im Mieter-Dashboard, 3 Quick-Wins (geocode Rate-Limit, Sichtbarkeits-Score auf /einnahmen, "0 Tickets"-Flackern). **Code ist fertig, aber noch NICHT committed/gepusht** (Cowork hat keinen Git-Push-Zugriff) — siehe „Lokale Änderungen (ungepusht)" unten. **Erste Aktion der nächsten Session: diese 6 Dateien + 4 neuen Dateien committen/pushen lassen (CC oder Lennart).**
- **Pricing:** Quick-Win 1 (#213, erledigt) hat den Provisionssatz bereits auf 5 % / 5,5 % vereinheitlicht — der alte "3 widersprüchliche Modelle"-Blocker aus `CRITICAL-Pricing-Konflikt-2026-05-24.md` ist damit gelöst. Diese Datei ist OBSOLET.
- **Größter offener Punkt:** Kein harter Blocker mehr. Offene Themen sind eher "nice to have" (Voice-AI V2, Smoke-Test Google-Login, Wohneinheits-Referenz-UI) plus die extern blockierten Infra-Themen (#4/#8/#12).

---

## ⚠️ Supabase Free Tier — Auto-Pause

**WICHTIG**: Das Supabase-Projekt (`gkojaogdzzyuboajwyom`, Free Tier)
pausiert nach ~7 Tagen ohne aktive DB-Verbindungen automatisch.

**Symptom**: Login-Spinner dreht endlos, Browser-Console zeigt
`TypeError: Failed to fetch` auf `_refreshAccessToken`/`_callRefreshToken`,
Network-Tab zeigt `503` auf `/auth/v1/token?grant_type=refresh_token`.

**Sofort-Fix**:
1. Supabase-MCP: `restore_project` mit `project_id: "gkojaogdzzyuboajwyom"`
2. 30–60 Sekunden warten
3. Im Browser `localStorage`, `sessionStorage` und Cookies clearen, dann neu laden

**Dauerhafte Lösung (seit 09.06.2026 live)**:
`/api/cron/keep-alive` pingt täglich (06:00 UTC via
`netlify/functions/keep-alive.mts`) die DB an, um Auto-Pause zu verhindern.

---

## Lokale Änderungen (ungepusht) — Stand 15.06.2026

Diese Session hat folgende Dateien geändert/erstellt, aber **noch nicht
committed/gepusht** (Collab-Pattern: Cowork code, CC/Lennart pusht):

**Geändert:**
- `app/api/geocode/route.ts` — Rate-Limit (60/Tag) via `try_consume_geocode_quota`
- `app/dashboard-handwerker/einnahmen/page.tsx` — Sichtbarkeits-Score/Partner-Status-Badge eingebaut
- `app/dashboard-handwerker/page.tsx` — `SichtbarkeitsBadge` als shared Component extrahiert (Import statt Inline)
- `app/dashboard-verwalter/tickets/page.tsx` — Loading-Skeleton für Header/Filter-Pills (kein "0 Tickets"-Flackern mehr)
- `components/ticket/ReklamationButton.tsx` — Reklamations-Transparenz
- `components/ticket/TicketDetailView.tsx` — Reklamations-Status-Anzeige für Mieter

**Neu:**
- `components/handwerker/SichtbarkeitsBadge.tsx` — extrahierte shared Component (Score-Badge)
- `components/ticket/ReklamationStatusBox.tsx` — Status-Box für Mieter-Dashboard
- `supabase/migrations/20260615100080_geocode_rate_limit.sql` — neue Migration (try_consume_geocode_quota), **muss noch auf Production angewendet werden**
- `Reparo-Audit-Strategische-Analyse-2026-06-15.docx` — finaler Audit-Report als Word-Dokument

`npx tsc --noEmit` lief nach allen Änderungen fehlerfrei durch.

---

## Aktuelle Sprint-Lage

### Zuletzt abgeschlossen (Auswahl, 27.05.–15.06.2026 — 34 Commits)
| Sprint/Thema | Was | Status |
|---|---|---|
| Sprint AM (1–3) | Preisformel (Fahrtweg + Auslastung), generalisierte Direktvergabe, Direktvergabe-First-UI für Verwalter | ✅ live |
| Sprint AN | HW-Dashboard → Direktanfragen-Inbox als primärer Content | ✅ live |
| Sprint AO | Ablehnen-Button + Einladungs-Inbox für Direktvergabe-Pfad | ✅ live |
| Audit 2.0 (#241–245) | Code/DB-Inventar, Entschlackungs-Report, sichere Cleanups | ✅ live |
| A11Y-Cleanup | aria-invalid/describedby, Focus-Trap, Kontrast-Fixes | ✅ live |
| Sprint AP | Einnahmen-V2 + Sichtbarkeits-Score V2 + Routen-Cleanup | ✅ live |
| Sprint AQ | P0 Security-Fixes (keep-alive Auth, CSP, X-Frame-Options) | ✅ live |
| Sprint AR (+follow-up) | Performance/RLS-Härtung, diagnose_preise Helper, profiles Column-Scoping | ✅ live |
| Sprint AS | Cleanup (toter Code, zeitslot_gebote, Anon-Client, profiles_public) | ✅ live |
| Sprint AT | Zod-Validation + Lighthouse-CI-Grundgerüst | ✅ live |
| Sprint AU | Demo-Reset + Showcase-Daten Direktvergabe-First (7 Tickets) | ✅ live |
| Fix | Phasen-Indikator "Vergabe" statt "Auktion" bei Direktvergabe-Tickets | ✅ live (commit `a1b6141`) |
| Audit 3.0 (#260–264) | Live-Walkthrough alle 4 Rollen, Code/Feature-Review, strategischer Report (docx) | ✅ erstellt |
| Recherche-Runde (#265) | Mail-Trigger, Score-Kalibrierung, Admin-Bereich gegen Audit-Empfehlungen geprüft | ✅ erledigt |
| Reklamations-Transparenz (#266) | Mieter sieht Reklamations-Status im Dashboard | ✅ Code fertig, **ungepusht** |
| Quick-Wins (#267) | geocode Rate-Limit, Score auf /einnahmen, "0 Tickets"-Loading-Fix | ✅ Code fertig, **ungepusht** |

### Offen / Nächste Prioritäten
1. **Commit & Push** der 10 Dateien aus „Lokale Änderungen" (siehe oben) + neue Migration auf Production anwenden
2. **Voice-AI V2** — Outbound-Rückruf bei lückenhaften Tickets (Vapi-Account live, Spec/Umsetzung ausstehend)
3. **Wohneinheits-Referenz-UI** — Migration ist live (#188), aber im Verwalter-Ticket-Detail noch nicht angezeigt
4. **Smoke-Test Google-Login** (#162/#225) — Phase 1+2 sind live, Lennart-Test in Inkognito steht noch aus
5. Weitere Audit-3.0-Empfehlungen, die über die 4 ausgewählten Bereiche hinausgehen, ggf. in neuem Sprint aufgreifen (siehe Audit-Report)

### Pending (extern blockiert)
- `#4` Netlify-ENVs Impressum → Lennart einpflegen
- `#8` Resend Domain-Verifikation → reparo-app.de (Domain existiert noch nicht)
- `#12` HIBP-Toggle → Supabase Pro erforderlich
- `#83–86` B2B-Sales-Material (LinkedIn-DMs, Email-Templates, Demo-Video-Skript, MSA) — **erledigt** (#229), nur Versand/Aufnahme noch bei Lennart

---

## Offene Entscheidungen für Lennart

### Pricing-Modell — gelöst ✅
Quick-Win 1 (#213) hat den Provisionssatz auf **5 % (Direktvergabe) / 5,5 %
(Auktion)** über Landing-Page, Sales-Material und FAQ vereinheitlicht.
`CRITICAL-Pricing-Konflikt-2026-05-24.md` ist damit **obsolet** und kann ins
Archiv verschoben werden. Cold-Outreach ist nicht mehr durch Pricing blockiert.

### Pivot-Frage „Mieter raus"
**BEANTWORTET 25.05.2026: NEIN.** Mieter bleibt, Voice-AI klärt Lücken.
`KONZEPT-pivot-mieter-raus-b2b-fokus.md` ist OBSOLET.

---

## Aktive Inkonsistenzen / Tech-Debt

| # | Wo | Was | Priorität |
|---|---|---|---|
| 1 | Verwalter-Ticket-Detail | Wohneinheits-Referenz nicht angezeigt (DB-Spalte + Migration da, #188) | mittel |
| 2 | Sprint G UI | Alter Verwalter-Wizard ist obsolet (Mieter-First), evtl. noch erreichbar | niedrig |
| 3 | `CRITICAL-Pricing-Konflikt-2026-05-24.md` | Obsolet seit Quick-Win 1, sollte archiviert werden | niedrig |

*(Entfernt gegenüber letzter Version: HW-Reject-Flow → gelöst via Sprint AO
Einladungs-Inbox; zeitslots-Cleanup → gelöst via Sprint AK Stufe 3 + AS;
3-Pricing-Modelle → gelöst via Quick-Win 1.)*

---

## Vapi / Voice-AI V2 — Status

- Vapi-Account: ✅ angelegt
- Outbound-Permissions: aktivieren (Lennart, ~30 Min)
- Backend (Cowork-Spec): ausstehend
- Frontend-Integration (Trigger-Logik im Mieter-Wizard): ausstehend
- Aufwand-Schätzung: ~15h CC + 3h Cowork + 30 Min Lennart

---

## Was die nächste Session als erstes tun sollte

1. `git status` / `git pull` in `~/Desktop/Reparo` prüfen — die 10 Dateien aus
   „Lokale Änderungen (ungepusht)" sollten von CC committed/gepusht worden
   sein. Falls nicht: Push anstoßen.
2. Migration `20260615100080_geocode_rate_limit.sql` auf Production
   anwenden (falls noch nicht passiert) und kurz smoke-testen
   (`/api/geocode` mit gültigem Token aufrufen).
3. Reklamations-Transparenz + Score-auf-/einnahmen + "0 Tickets"-Fix nach
   Deploy kurz live verifizieren (3 kleine Smoke-Checks).
4. Danach: nächste Priorität aus „Offen / Nächste Prioritäten" wählen
   (Voice-AI V2 oder Wohneinheits-Referenz-UI sind die größten Brocken).

---

*Handoff-Stand: 15.06.2026 · Nächste Review nach dem Commit/Push-Zyklus dieser Session*
