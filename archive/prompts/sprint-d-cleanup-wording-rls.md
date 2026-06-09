# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint D — Wording-Restwasser + RLS-Cleanup

> Backlog von Iteration 7+8. Kein Beta-Blocker, aber Politur.
> Aufwand S–M (~30-45 Min). 2 Sub-Items, beide quick wins.

## Item D1: Wording-Restwasser „Angebot abgeben →" / „0 Angebote"

**Beobachtung:** Auf HW-Dashboard (`app/dashboard-handwerker/page.tsx`) zeigt die Ausschreibungs-Card:
- „Angebot abgeben →" als Action-Link
- „N Angebote" (z.B. „0 Angebote bisher")

Beides ist Auktion-Wording von vor F11 (Vollkalkulation). H2-H4 hat das auf der Annahme-Page gefangen, aber nicht auf der Listen-Card.

**Fix:**
1. „Angebot abgeben →" → **„Auftrag annehmen →"**
2. „N Angebote" → **„N Annahmen"** (oder ganz weglassen, weil im Festpreis-Modell „erste Annahme gewinnt")
3. Plus: HW-Marktplatz-Page hat noch „Gebot abgeben"-Button (Phase B2-Test gefunden) → auch zu „Auftrag annehmen" oder „Buchen"

**Code-Lokationen:**
- `app/dashboard-handwerker/page.tsx` (Card)
- `app/dashboard-verwalter/marktplatz/page.tsx` (Marktplatz-Liste)
- Suche nach „Angebot abgeben" + „Gebot abgeben" + „0 Angebote" — alle ersetzen

**Commit:** `chore(wording): festpreis-konsistenz in HW-Dashboard-Card + Marktplatz`

## Item D2: Doppelte RLS-Policies konsolidieren

**Beobachtung:** Auf `angebote` und `termine` gibt es überlappende INSERT-Policies:

`angebote`:
- „Handwerker erstellt Angebote" — `with_check: auth.uid() = handwerker_id`
- „angebote_insert" — `with_check: auth.uid() = handwerker_id` (identisch!)

`termine`:
- „termine_insert" — `with_check: auth.uid() = handwerker_id`
- „termine_insert_beteiligte" — überlappt (HW oder Ticket-Ersteller)

**Risiko:** Postgres evaluiert beide Policies (OR). Funktional egal, aber Code-Cleanup wenn jemand später debug'gt.

**Fix-Empfehlung (Cowork):** Eine konsolidierte Policy pro Tabelle, alte droppen.

**SCHEMA-TOUCH — braucht Lennart-OK.** Du kannst es entweder Claude Code machen lassen (mit Migration-File ins Repo) ODER Cowork autonom (Migration via Supabase-MCP). 

**Mein Vorschlag:** Cowork macht die Migration autonom (Lennart hat „Freiheit" gegeben + Migration ist niedriges Risiko, idempotent).

**SQL-Snippet (Cowork hat schon angewandt):**
```sql
-- siehe Migration cleanup_doppelte_rls_policies_2026_05_18 (separat dokumentiert)
```

## Constraints

- D1: nur Code-Wording, kein Logic-Touch
- D2: idempotent, droppen nur exakt diese Policy-Namen, keine anderen anfassen
- Pro Item max. 1 Klärungsfrage

## Erster Schritt

D1: grep nach „Angebot abgeben" + „Gebot abgeben" im app/, alle Treffer auflisten, dann einer nach dem anderen ersetzen.
