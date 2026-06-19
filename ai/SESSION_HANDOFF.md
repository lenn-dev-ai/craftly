# Session Handoff

> **Zweck**: Zeitliche Lage. Was sich pro Session ändert.
> Für die langlebige Konstitution → `REPARO_OPERATING_SYSTEM.md`.
> **Letzte Review:** 19.06.2026, Sprints AY–BB + Vapi-Fixes abgeschlossen

---

## TL;DR für die nächste Session

- **Letzter commit:** `0da2740` — fix(vapi): serverUrl/tools-Loop-Fix
- **DB-Migration** `sprint_bb_rueckruf_status` auf Production angewendet (19.06.)
- **Voice-AI V2 Outbound** ist gebaut und deployed. Noch ausstehend: `VAPI_API_KEY` + `VAPI_PHONE_NUMBER_ID` in Netlify ENV eintragen → dann ist der Outbound-Rückruf scharf.
- **Vapi Inbound (HW-Assistent):** Stimme auf 11labs gewechselt, Deepgram DE Transcriber aktiv, Config-Loop-Bug behoben.
- **Kein Blocker** außer den zwei Netlify-ENVs.

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

## Aktuelle Sprint-Lage

### Zuletzt abgeschlossen (18.06.–19.06.2026)

| Sprint/Thema | Was | Status |
|---|---|---|
| Sprint AY Fix (18.06.) | Zod-null-Fix, Countdown entfernt, Verwalter-Wording | ✅ live (`686616f`) |
| Sprint AZ Fix (18.06.) | Wetter-Tagesmax statt Momentantemperatur im Briefing | ✅ live (`cd38c32`) |
| Sprint BA (18.06.) | Wohneinheit-Picker im Mieter-Melden-Wizard, RLS-Policy, Auto-Vorauswahl | ✅ live (`0e41163`) |
| Sprint BB Cowork (18.06.) | KI-HW-Empfehlung für Verwalter (Claude Haiku, Top-3 mit Begründung) | ✅ live (`1725387`) |
| Sprint BC Cowork (18.06.) | Mapbox echte Fahrzeiten im Tages-Briefing (Haversine Fallback) | ✅ live (`1725387`) |
| Sprint BB Voice (19.06.) | Voice-AI V2 Outbound-Rückruf: trigger-rueckruf + mieter-outbound Webhook, rueckruf_status in tickets | ✅ live (`4260cfa`) |
| Vapi-Fixes (19.06.) | Model-String korrigiert, Azure→11labs, Deepgram DE Transcriber, Loop-Bug behoben | ✅ live (`599e429`–`0da2740`) |

### Offen / Nächste Prioritäten

1. **VAPI_API_KEY + VAPI_PHONE_NUMBER_ID in Netlify eintragen** — dann ist Outbound-Rückruf scharf (Lennart, ~5 Min im Netlify-Dashboard)
2. **Outbound-Rückruf E2E testen** — Mieter meldet lückenhaftes Ticket → Anruf kommt an → Infos landen im Ticket
3. **Smoke-Test Google-Login** (#162/#225) — Phase 1+2 live, Lennart-Test in Inkognito steht noch aus
4. **Agent Auto-Accept testen** — Sprint AX Infrastruktur vorhanden, kein E2E-Test ob `agent_auto_accept=true` korrekt auslöst
5. Weitere Audit-3.0-Empfehlungen aus dem Bericht (docx, lokal bei Lennart) ggf. in neuem Sprint

### Pending (extern blockiert)

- `VAPI_API_KEY` / `VAPI_PHONE_NUMBER_ID` → Netlify ENV (Lennart, ~5 Min)
- `#4` Netlify-ENVs Impressum → Lennart einpflegen
- `#8` Resend Domain-Verifikation → reparo-app.de (Domain existiert noch nicht)
- `#12` HIBP-Toggle → Supabase Pro erforderlich

---

## Offene Entscheidungen für Lennart

### Pricing-Modell — gelöst ✅
5 % (Direktvergabe) / 5,5 % (Auktion) vereinheitlicht. `CRITICAL-Pricing-Konflikt-2026-05-24.md` ist obsolet.

### Pivot-Frage „Mieter raus" — beantwortet ✅
**NEIN (25.05.2026).** Mieter bleibt, Voice-AI klärt Lücken. `KONZEPT-pivot-mieter-raus-b2b-fokus.md` ist OBSOLET.

---

## Aktive Inkonsistenzen / Tech-Debt

| # | Wo | Was | Priorität |
|---|---|---|---|
| 1 | Sprint G UI | Alter Verwalter-Wizard ist obsolet (Mieter-First), evtl. noch erreichbar | niedrig |
| 2 | `CRITICAL-Pricing-Konflikt-2026-05-24.md` | Obsolet seit Quick-Win 1, sollte archiviert werden | niedrig |

---

## Vapi / Voice-AI — Status

| Komponente | Status |
|---|---|
| Vapi-Account | ✅ angelegt |
| Outbound-Permissions | ✅ aktiviert (19.06.) |
| Vapi-Webhook `/api/vapi/hw-assistant` | ✅ live — 11labs Stimme, Deepgram DE, Loop-Fix |
| `get_neue_anfragen_mit_empfehlung` Tool | ✅ live (Sprint AX) |
| Outbound-Rückruf `/api/vapi/trigger-rueckruf` | ✅ gebaut (Sprint BB) |
| Outbound-Webhook `/api/vapi/mieter-outbound` | ✅ gebaut (Sprint BB) |
| `VAPI_API_KEY` in Netlify | ⏳ Lennart eintragen |
| `VAPI_PHONE_NUMBER_ID` in Netlify | ⏳ Lennart eintragen |
| Outbound E2E-Test | ❌ ausstehend |

---

## Was die nächste Session als erstes tun sollte

1. `git log --oneline -5` — prüfen ob Cowork neue Commits lokal hat, ggf. pushen
2. Lennart fragen: `VAPI_API_KEY` + `VAPI_PHONE_NUMBER_ID` in Netlify eingetragen? → dann Outbound E2E testen
3. Falls nicht: Smoke-Test Google-Login oder Agent Auto-Accept E2E

---

*Handoff-Stand: 19.06.2026 · Commit `0da2740` ist letzter Stand*
