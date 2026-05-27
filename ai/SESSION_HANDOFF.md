# Session Handoff

> **Zweck**: Zeitliche Lage. Was sich pro Session ändert.
> Für die langlebige Konstitution → `REPARO_OPERATING_SYSTEM.md`.
> **Letzte Review:** 27.05.2026, 22:30 lokal

---

## TL;DR für die nächste Session

- **Letzter Loop:** Loop-26 (Feedback-ID `d3495b20`) — gefixt + deployed
- **Letzte Commits auf main:** `7186097` (Admin-Fallback Angebot-Seite), `aff1032` (auction/start einladungen-UPSERT)
- **Nächster geplanter Sprint:** AL (Sichtbarkeits-Score V2 + Einnahmen-Seite ohne zeitslots)
- **Größter offener Blocker:** Pricing-Konflikt (3 widersprüchliche Modelle live) — Lennart muss Option A/B/C/D wählen

---

## Aktuelle Sprint-Lage

### Zuletzt abgeschlossen
| Sprint/Loop | Was | Status |
|---|---|---|
| Sprint AK | zeitslots-Cleanup + Marktplatz-Rebuild + Pool-Endpoint | ✅ live |
| Loop-26 | `auction/start` legt `einladungen`-Zeilen mit Preis an | ✅ live (commit `aff1032`) |
| Hotfix | Admin-Fallback auf Angebot-Seite (erster verfügbarer `empfohlener_preis` statt null) | ✅ live (commit `7186097`) |

### Offen / Nächste Prioritäten
1. **Sprint AL** — Sichtbarkeits-Score V2 (Google-Cal-Verbindung + Antwort-Rate, nicht mehr Slots)
2. **Sprint AL** — Einnahmen-Seite auf `tickets`-Basis (zeitslots raus)
3. **Loop-23 Feature** — Wohneinheits-Referenz im Verwalter-Ticket-Detail anzeigen (Migration live, UI fehlt)
4. **HW-Reject-Flow** — Handwerker kann Auftrag ablehnen (Angebot-Seite hat nur Annehmen)
5. **Voice-AI V2** — Outbound-Rückruf bei lückenhaften Tickets (Vapi-Account live, Spec ausstehend)

### Pending (extern blockiert)
- `#4` Netlify-ENVs Impressum → Lennart einpflegen
- `#8` Resend Domain-Verifikation → reparo-app.de
- `#12` HIBP-Toggle → Supabase Pro erforderlich
- `#83–86` B2B-Sales-Material → LinkedIn-DMs, Email-Templates, Demo-Video, MSA

---

## Offene Entscheidungen für Lennart

### 🚨 Pricing-Modell (kritisch, blockt Outreach)
3 Modelle gleichzeitig live (Landing-Page, Sales-Material, Startseite-FAQ).
Vollständige Analyse: `CRITICAL-Pricing-Konflikt-2026-05-24.md`.

| Option | Modell | Cowork-Bewertung |
|---|---|---|
| A | Pauschal (49/149 €/Mon) | Einfach, aber regressiv |
| B | Per Wohnung (1,29/0,89 €) | **Cowork-Empfehlung** |
| C | Hybrid (Pauschale + variabel) | Beste Marge, höchste Komplexität |
| D | Provision-only (0 € Grundgebühr) | Cowork warnt davor |

→ **Bis entschieden: kein Cold-Outreach.**

### Pivot-Frage „Mieter raus"
**BEANTWORTET 25.05.2026: NEIN.** Mieter bleibt, Voice-AI klärt Lücken. `KONZEPT-pivot-mieter-raus-b2b-fokus.md` ist OBSOLET.

---

## Loop-Status

| Counter | Letzte Feedback-ID | Datum | Status |
|---|---|---|---|
| Loop-22 | siehe `LOOP-ITERATION-22-2026-05-25.md` | 25.05. | ✅ |
| Loop-23 | siehe `LOOP-ITERATION-23-2026-05-27.md` | 27.05. | ✅ Migration live, UI offen |
| Loop-24 | siehe `LOOP-ITERATION-24-2026-05-27.md` | 27.05. | ✅ |
| **Loop-26** | `d3495b20` | 27.05. | ✅ gefixt + deployed |

→ **Nächster Loop = 27.** Cowork startet mit Query auf `feedback WHERE viewed = false`.

---

## Smoke-Test-Status (post-Deploy Loop-26)

Geprüft via Supabase-MCP, Ticket-Auswahl post-Deploy:
- **Wasserschaden** (heizung_sanitaer, auction_start 19:19:07 UTC): 1 einladung mit `empfohlener_preis = 121,00 €` ✓ Fix wirkt.
- **Elektroproblem** (elektro, ~19:18 UTC): 0 einladungen — vermutlich kein Elektro-HW im Radius, nicht durch Fix verursacht. **Noch nicht final verifiziert.**

Constraint `einladungen_ticket_id_handwerker_id_key` (UNIQUE ticket_id+handwerker_id) ✓ existiert, UPSERT funktioniert ohne Migration.

---

## Aktive Inkonsistenzen / Tech-Debt

| # | Wo | Was | Priorität |
|---|---|---|---|
| 1 | Landing vs. Sales-Material vs. FAQ | 3 Pricing-Modelle live | 🚨 hoch (blockt Outreach) |
| 2 | Angebot-Seite | Kein Reject-Flow für HW | mittel |
| 3 | Verwalter-Ticket-Detail | Wohneinheits-Referenz nicht angezeigt (DB-Spalte da) | mittel |
| 4 | Sprint G UI | Verwalter-Wizard ist obsolet (Mieter-First), aber noch sichtbar | niedrig |
| 5 | `zeitslots`-Tabelle | Deprecated für HW-Slots, nur noch Privat-Blöcke | niedrig (cleanup-fähig nach Sprint AL) |

---

## Vapi / Voice-AI V2 — Status

- Vapi-Account: ✅ angelegt
- Outbound-Permissions: aktivieren (Lennart, ~30 Min)
- Backend (Cowork-Spec): ausstehend
- Frontend-Integration (Trigger-Logik im Mieter-Wizard): ausstehend
- Aufwand-Schätzung: ~15h CC + 3h Cowork + 30 Min Lennart

---

## Was die nächste Session als erstes tun sollte

1. `git pull` in `~/Desktop/Reparo` (Cowork-Commits könnten parallel reingekommen sein)
2. `feedback WHERE viewed = false`-Query → Loop-27 öffnen falls neue Einträge
3. Pricing-Entscheidung bei Lennart einholen (falls nicht zwischenzeitlich beantwortet)
4. Sprint AL spec finalisieren wenn Pricing geklärt

---

*Handoff-Stand: 27.05.2026 · Nächste Review nach Loop-27*
