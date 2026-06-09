# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint AA — HOTFIX: Vergabe-Regression debuggen + fixen

> Lennart-Feedback `a441a93c` (25.05.2026 08:26): „beim klicken von auftrag
> vergeben kommt fehlermeldung das fehlschlägt".
>
> **Schon zweimal aufgetreten** — vorher als `f4d86912` (18.05., Iteration 11),
> war als H11+H12 gefixt mit Commits `33e83cc` + `628ba51` (Toast+setSending
> + RLS-Erweiterung einladungen).
>
> Jetzt Regression. Aufwand: ~1-2h Claude Code. **HIGH severity**, blockiert
> Verwalter-Kern-Workflow.

## Reproduktion

1. Login als test.verwalter@craftly-test.de
2. Öffne ein offenes Ticket (z.B. `ebdce602-89a5-4b7b-994e-57efd933da7a`)
3. Klick „Auftrag vergeben" / „An Handwerker vergeben"
4. Beobachte: Fehler-Toast erscheint, Vergabe schlägt fehl

## Debugging-Plan

### Phase AA1 — Root-Cause Analysis (~30 min)

**1. Browser-Console + Network-Tab checken:**
- Welcher Endpoint wird gerufen?
- HTTP-Status (401/403/500)?
- Response-Body (Fehlertext)?
- Stack-Trace im Server-Log?

**2. Netlify-Function-Logs ansehen:**
```bash
# In Netlify-Dashboard oder via CLI:
netlify functions:log --site reparo-app
```
Suchen nach dem Vergabe-Endpoint-Aufruf zum Zeitpunkt 25.05. 08:26.

**3. Supabase-Logs:**
- DB-Errors zwischen 08:25-08:30?
- RLS-Verletzungen?
- Constraint-Violations?

**4. Code-Review-Pfad:**
- `app/api/.../vergeben/route.ts` (oder wo Vergabe lebt)
- `app/dashboard-verwalter/ticket/[id]/page.tsx` (oder Detail-Page)
- Welcher Code-Pfad ist seit Sprint G/H/I/K/L geändert worden?

### Phase AA2 — Wahrscheinliche Ursachen prüfen (~30 min)

**Hypothese 1: Sprint G hat `tickets.eingetragen_via` eingeführt — RLS-Policy?**
Sprint G-Migration `20260605000050_ticket_eingetragen_von_verwalter.sql` hat
neue Spalten gebracht. Falls eine Policy auf der angebote-Tabelle Annahmen
über tickets-Felder hat, könnte die brechen.

**Hypothese 2: Sprint L `handwerker_gewerke[]` Filter beim Vergabe-Endpoint?**
Wenn der Vergabe-Endpoint prüft „ist der HW für dieses Gewerk qualifiziert?",
und Sprint L hat HW jetzt mit `handwerker_gewerke = NULL` (für nicht-gemigrierte
HW) → Vergabe könnte daran scheitern.

**Hypothese 3: Sprint H/I Schema-Erweiterungen brachen ein älteres
INSERT/UPDATE-Statement.**
Wenn die Vergabe-Logik z.B. `RETURNING *` macht und ein TypeScript-Typ
veraltet ist, könnte parsing failen.

**Hypothese 4: angebote_ticket_handwerker_unique Constraint (H7).**
Wenn der Vergabe-Code versucht ein neues Angebot anzulegen statt einem
existierenden zuzuweisen → UNIQUE-Violation.

**Hypothese 5: einladungen-RLS-Policy (H12) hat sich durch andere Migrationen
geändert oder eine neue Spalte erwartet die nicht gesetzt wird.**

### Phase AA3 — Fix implementieren (~30 min)

Basierend auf Root-Cause aus Phase AA2:
- Wenn RLS-Policy: per Supabase-MCP fixen
- Wenn Code-Pfad-Bug: gezielt fixen
- Wenn Schema-Mismatch: Migration nachziehen

**Wichtig:** Fix muss idempotent sein und nicht den ursprünglichen H11/H12-Fix
brechen.

### Phase AA4 — Regression-Test (~30 min)

1. Lokaler Smoke-Test: Vergabe durchführen → grün
2. Sprint J E2E-Test laufen lassen → grün
3. Plus neuen Playwright-Test für Vergabe-Edge-Cases ergänzen:
   - Vergabe an HW mit `handwerker_gewerke = NULL`
   - Vergabe an HW mit anderem Gewerk als Ticket
   - Vergabe eines Tickets mit `eingetragen_via = 'verwalter-wizard'`
   - Vergabe eines Tickets ohne `auktion_ende`

### Phase AA5 — Commit + Reporting

Commit: `fix(verwalter): Vergabe-Regression nach Sprint G/H/I/L (Sprint AA)`

In BETA-FEEDBACK.md: „Iteration 21 — Sprint AA Hotfix" mit:
- Root-Cause-Beschreibung
- Welche Hypothese stimmte
- Welche Sprints den Bug eingeführt haben
- Regression-Test-Coverage

Plus: in URLAUBS-STATUS.md den Hotfix erwähnen.

## Constraints

- Pricing-Engine NICHT anfassen
- Stripe/Banking-Code NICHT anfassen
- H11/H12-Fix-Logik nicht zurückrollen — nur ergänzen
- Bei DB-Migration: idempotent, via Supabase-MCP

## Erfolg

- Verwalter kann Tickets wieder vergeben
- Edge-Cases sind E2E-getestet
- Root-Cause + Prävention in BETA-FEEDBACK dokumentiert

## Erster Schritt

Phase AA1: Browser-Console + Netlify-Logs zur Zeit 25.05. 08:26 öffnen.
Bug muss reproduzierbar sein bevor du fixen kannst.
