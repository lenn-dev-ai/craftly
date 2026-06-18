# Session Handoff

> **Zweck**: Zeitliche Lage. Was sich pro Session ändert.
> Für die langlebige Konstitution → `REPARO_OPERATING_SYSTEM.md`.
> **Letzte Review:** 18.06.2026, Sprint AX abgeschlossen + Handoff aktualisiert

---

## TL;DR für die nächste Session

- **Letzter commit:** `5216ef8` — Sprint AX: Handwerker-Agent alle 4 Phasen live
- **DB-Migration** `sprint_ax_agent_preferences` auf Production angewendet (18.06.)
- **Kein Blocker.** Nächste sinnvolle Arbeit: Voice-AI V2 Outbound-Rückruf (Vapi-Account live, Outbound-Permissions bei Lennart ausstehend) oder Smoke-Test Google-Login.
- **Wohneinheits-Referenz-UI** war als offen gelistet — ist aber bereits fertig (TicketDetailView.tsx zeigt sie via `select("*")` + rendert an 2 Stellen). Punkt aus Backlog entfernt.

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

### Zuletzt abgeschlossen (15.06.–18.06.2026)

| Sprint/Thema | Was | Status |
|---|---|---|
| Audit-Fixes (15.06.) | Reklamations-Transparenz (ReklamationStatusBox), geocode Rate-Limit (60/Tag), SichtbarkeitsBadge auf /einnahmen, 0-Tickets-Loading-Fix | ✅ live (`526bf53`) |
| Sprint AV (15.06.) | Tages-Briefing Cron (hw-morgen-briefing, 06:00 UTC) + KI-Haiku-Text | ✅ live |
| Sprint AW (16.06.) | Voice AI (Vapi-Webhook), Google-Cal bidirektionaler Konflikt-Check, KI-Slot-Vorschlag | ✅ live (`063d37a`) |
| Fix AW (16.06.) | Google-Cal-Duplikate, Briefing-GCal-Stops, KI-Ton sachlicher | ✅ live (`514bd7e`–`03a1578`) |
| Fix AX Loop (17.06.) | Timezone-Bug GCal, slot_conflict UX, redundante DB-Query | ✅ live (`9358817`) |
| Sprint AX Karte (17.06.) | Mapbox Wegbeschreibung, Route-Panel, Navi-Links | ✅ live (`fe2da12`) |
| Sprint AX Agent (17.06.) | Handwerker-Agent 4 Phasen: DB-Migration, Scoring (score-einladung.ts), AgentPanel, Vapi get_neue_anfragen_mit_empfehlung | ✅ live (`5216ef8`) |

### Offen / Nächste Prioritäten

1. **Voice-AI V2 Outbound** — Vapi-Account live, aber Outbound-Permissions noch nicht aktiviert (Lennart, ~30 Min). Danach: Outbound-Rückruf-Spec + Umsetzung (~15h CC)
2. **Smoke-Test Google-Login** (#162/#225) — Phase 1+2 live, Lennart-Test in Inkognito steht noch aus
3. **Agent Auto-Accept testen** — Sprint AX hat die Infrastruktur, aber kein E2E-Test ob `agent_auto_accept=true` korrekt auslöst
4. Weitere Audit-3.0-Empfehlungen aus dem Bericht (docx, lokal bei Lennart) ggf. in neuem Sprint

### Pending (extern blockiert)

- `#4` Netlify-ENVs Impressum → Lennart einpflegen
- `#8` Resend Domain-Verifikation → reparo-app.de (Domain existiert noch nicht)
- `#12` HIBP-Toggle → Supabase Pro erforderlich
- `#83–86` B2B-Sales-Material — **erledigt** (#229), Versand/Aufnahme bei Lennart

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

*(Wohneinheits-Referenz-UI: war als offen gelistet — bereits implementiert in TicketDetailView.tsx + types/index.ts. Entfernt.)*

---

## Vapi / Voice-AI — Status

| Komponente | Status |
|---|---|
| Vapi-Account | ✅ angelegt |
| Vapi-Webhook `/api/vapi/hw-assistant` | ✅ live (Sprint AW) |
| `get_neue_anfragen_mit_empfehlung` Tool | ✅ live (Sprint AX) |
| Outbound-Permissions aktivieren | ⏳ Lennart (~30 Min) |
| Outbound-Rückruf bei lückenhaften Tickets | ❌ ausstehend (~15h CC) |

---

## Was die nächste Session als erstes tun sollte

1. `git log --oneline -5` — prüfen ob Cowork neue Commits lokal hat, ggf. pushen
2. Lennart fragen: Outbound-Permissions in Vapi aktiviert? → dann Voice-AI V2 Outbound starten
3. Falls nicht: Agent Auto-Accept E2E testen oder Smoke-Test Google-Login

---

*Handoff-Stand: 18.06.2026 · Commit `5216ef8` ist letzter Stand*
