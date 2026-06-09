# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint AD — Sprint G UI verstecken (Mieter-First-Konzept)

> Lennart-Bestätigung (25.05.2026): „auf jeden fall setzt nicht die HV das
> ticket ab" + „Anrufe durch ki zur Schadens Steuerung sind smart".
> 
> Voraussetzung: Sprint G ist live (Code existiert), aber UI muss versteckt
> werden weil Verwalter nicht mehr selbst Ticket eintippt.
> 
> Aufwand: ~30 min Claude Code.

## Ziel

Verwalter-Wizard-UI dezent verstecken, ohne Code zu droppen (für Edge-Cases
behalten — Admin/Notfall-Manual-Entry).

## Code-Lokationen

- `app/dashboard-verwalter/page.tsx` — „+ Neues Ticket"-Button entfernen
- `app/dashboard-verwalter/layout.tsx` oder Sidebar — Item ausblenden
- `app/dashboard-verwalter/neues-ticket/page.tsx` — Route bleibt, kein 410

## Spec

### Phase AD1 — Button raus aus Verwalter-Dashboard (~10 min)

In `app/dashboard-verwalter/page.tsx`:
- „+ Neues Ticket"-Button im Header entfernen
- Verwalter sieht primär: Tickets-Liste, KPIs, Aktions-Items

### Phase AD2 — Sidebar-Item verstecken (~10 min)

In Verwalter-Sidebar:
- „Neues Ticket"-Item entweder:
  - **Variante A:** komplett entfernen (Cowork-Empfehlung)
  - **Variante B:** unter „Sonderfälle" gruppieren mit kleinerer Schrift
- Cowork-Empfehlung: **A** — clean. Falls Admin den Wizard nutzen will,
  kann er die Route `/dashboard-verwalter/neues-ticket` direkt aufrufen.

### Phase AD3 — Route bleibt, kein Drop (~5 min)

- `app/dashboard-verwalter/neues-ticket/page.tsx` bleibt als-is
- Falls jemand die URL direkt aufruft: Wizard funktioniert weiterhin
- Sub-Header-Hinweis ergänzen: „Hinweis: Normalerweise meldet der Mieter
  selbst — dieser Wizard ist für Edge-Cases wie ältere Mieter ohne App."

### Phase AD4 — Smoke-Test + Commit (~5 min)

- Test mit demo-verwalter-1: Dashboard kein „+ Neues Ticket"
- Direkt /dashboard-verwalter/neues-ticket: Wizard lädt mit Edge-Case-Hinweis

Commit: `feat(verwalter): G-UI verstecken, Mieter ist primäre Eingabe-Quelle (Sprint AD)`

## Constraints

- KEIN Code droppen — Sprint G Backend + Frontend bleibt im Repo
- KEINE Auswirkung auf Mieter-Wizard (`/dashboard-mieter/melden`)
- Bestehende Tickets die via Sprint G angelegt wurden bleiben sichtbar
- Voice-AI V2 (Outbound-Klärung) ist separater Sprint — hier nur UI-Schritt

## Erfolg

- Verwalter sieht keinen Eingabe-CTA mehr
- Lennarts Konzept „HV setzt das Ticket nicht ab" ist im UI manifestiert
- Code-Investitionen aus Sprint G gehen nicht verloren

## Erster Schritt

Phase AD1 (Button raus aus Dashboard).
