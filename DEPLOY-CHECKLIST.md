# Deploy-Checklist — Migrationen, Cron-Setup, Env-Vars

> **Stand:** 2026-05-15. Single source of truth für Prod-Deploy.
> Code ist auf `main`. Bleibt: **5 ausstehende Migrationen + 1 neue Cron-Function + ENV-Var-Check**.

---

## 1. Bereits in Cloud-Supabase deployed (Stand letzter Sync)

Diese sind im `supabase/migrations/`-Verzeichnis und vermutlich schon in
Prod:

```
20240101000000_schema_v2.sql
20240201000000_termine_verfuegbarkeiten.sql
20240301000000_ticket_einsatzort.sql
20240401000000_yield.sql
20240501000000_marktplatz.sql
20240601000000_route_optimizer.sql
20240701000000_provisionen.sql
20240801000000_auction_engine.sql
20240901000000_sichtbarkeit.sql
20241001000000_ki_analyse.sql
20241101000000_e2e_flow.sql
20241201000000_indexes.sql
20260101000000_diagnose_projekt.sql
20260514000000_diagnose_fixes.sql
20260515000000_diagnose_ablauf.sql
20260516000000_tickets_verwalter_id.sql
20260517000000_reminder_tracking.sql
20260518000000_diagnose_ablauf_trigger.sql
20260519000000_security_hardening.sql
20260519100000_security_recursion_fix.sql
20260519200000_security_trigger_nesting_fix.sql
20260519300000_security_hw_korridor_whitelist.sql
20260520100000_rate_limit_ki_separate_table.sql
```

> Migration `20260520000000_rate_limit_ki_calls.sql` ist bewusst NICHT in
> Prod: erste KI-Quota-Variante mit profiles-Spalten, wurde durch
> `20260520100000_rate_limit_ki_separate_table.sql` ersetzt (eigene Tabelle).
> Auf einer frischen Cloud-DB komplett überspringen.

---

## 2. Ausstehende Cloud-Migrationen (5 Stück, in dieser Reihenfolge)

Studio öffnen: https://supabase.com/dashboard/project/<projektref>/sql/new

Pro Migration: File-Inhalt (`supabase/migrations/<file>.sql`) komplett
kopieren, einfügen, **Run**.

| # | Datei | Was sie tut | Sprint |
|---|---|---|---|
| 1 | `20260520200000_unassigned_tickets_for_verwalter.sql` | tickets_select + tickets_update + protect_ticket_fields erweitert um `verwalter_id IS NULL`-Branch + Backfill | Sprint 1 vom Audit |
| 2 | `20260521000000_storage_fotos_strict.sql` | Storage-RLS für `schadens-fotos` strict — nur Owner/Admin/Beteiligte | Sprint B FIX-8 |
| 3 | `20260522000000_handwerker_verifiziert.sql` | `profiles.verifiziert` + `verifiziert_am` + `verifiziert_von` + Index + Schutz im Trigger | Trust-Sprint |
| 4 | `20260523000000_tickets_foto_urls.sql` | `tickets.foto_urls text[]` für Multi-Foto-Support + Storage-Policy ergänzt | Brain-Dump Sprint 2 UX-1 |
| 5 | `20260524000000_ki_analysen_cache.sql` | Tabelle `ki_analysen_cache` für SHA-256-Hash-Dedup von KI-Calls | Brain-Dump Sprint 3 KI-3 |

**Warum genau diese Reihenfolge:**

- **#2 hängt von #4 ab** — die Storage-Policy in #4 referenziert
  `tickets.foto_urls`. Wenn #4 fehlt, throwt der `ANY(t.foto_urls)`-
  Subquery in der Policy. **Daher gilt: #4 VOR #2 ausspielen, sonst
  #2 nochmal nach #4 laufen lassen** (idempotent via `DROP POLICY IF EXISTS`).
  → Reihenfolge `1, 4, 2, 3, 5` ist die sichere Variante.
- #3 verwendet `is_admin()` aus 519000 (bereits in Prod).
- #5 ist standalone.

### Smoke-Tests nach allen 5

In einem SQL-Block ausführen, alle 4 Checks sollten Werte zurückliefern:

```sql
-- Check 1: alle neuen Helper-Functions existieren
SELECT proname FROM pg_proc
WHERE proname IN ('is_verwalter','try_consume_ki_quota')
ORDER BY proname;
-- erwartet: 2 Zeilen

-- Check 2: neue Spalten in profiles
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('verifiziert','verifiziert_am','verifiziert_von')
ORDER BY column_name;
-- erwartet: 3 Zeilen

-- Check 3: neue Spalte + Tabelle
SELECT
  EXISTS(SELECT 1 FROM information_schema.columns
         WHERE table_name = 'tickets' AND column_name = 'foto_urls') AS foto_urls,
  EXISTS(SELECT 1 FROM information_schema.tables
         WHERE table_name = 'ki_analysen_cache') AS ki_cache_table;
-- erwartet: beide true

-- Check 4: storage-policy aktualisiert
SELECT policyname FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'schadens_fotos%'
ORDER BY policyname;
-- erwartet: schadens_fotos_select_strict (NICHT mehr _select_authenticated)
```

---

## 3. Env-Vars in Netlify

Stand: existierend + 1 zu prüfen.

**Setzen (Site Settings → Environment Variables, Scope BUILD + FUNCTIONS):**

| Key | Status | Wofür |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | sollte gesetzt sein | Service-Role für Crons + protect-Trigger-Bypass |
| `NEXT_PUBLIC_SUPABASE_URL` | gesetzt | Public anon |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | gesetzt | Public anon |
| `CRON_SECRET` | gesetzt | Cron-Auth (alle 5 Cron-Endpoints prüfen das) |
| `RESEND_API_KEY` | gesetzt | Mail-Versand |
| `RESEND_FROM_EMAIL` | gesetzt | Absender-Adresse |
| `ANTHROPIC_API_KEY` | sollte gesetzt sein | KI-Schadenserkennung |

Falls `CRON_SECRET` fehlt → Cron-Functions werfen 401, weil der Fallback
`"netlify-scheduled"` bewusst entfernt wurde (Sprint A FIX-1).

---

## 4. Cron-Functions (Netlify Scheduled)

Nach dem Push automatisch deployed. Verifizieren in Netlify Dashboard →
Functions → Scheduled.

| Function | Cron-Schedule | Endpoint |
|---|---|---|
| `check-expired-auctions` | `*/5 * * * *` (alle 5 Min) | `/api/auction/check-expired` |
| `bewertungs-reminder` | `0 3 * * *` (täglich 03:00) | `/api/cron/bewertungs-reminder` |
| `stille-hw-reaktivierung` | `10 3 * * *` (täglich 03:10) | `/api/cron/stille-hw-reaktivierung` |
| `sichtbarkeits-recompute` | `20 3 * * *` (täglich 03:20) | `/api/cron/sichtbarkeits-recompute` |
| **`abwicklungsfrist`** (NEU) | `0 3 * * *` (täglich 03:00) | `/api/cron/abwicklungsfrist` |

> Hinweis zur Kollision: `bewertungs-reminder` und `abwicklungsfrist`
> laufen beide um 03:00. Beide sind idempotent + leichtgewichtig — kein
> Problem. Wenn doch unsauber: `abwicklungsfrist` auf `0 4 * * *` setzen
> (`netlify/functions/abwicklungsfrist.mts` Zeile 23).

---

## 5. Manuelle Smoke-Tests nach dem Deploy

```bash
# CRON_SECRET aus Netlify Env-Vars
SECRET=<CRON_SECRET>
SITE=https://reparo-app.netlify.app

# Bewertungs-Reminder
curl -X POST "$SITE/api/cron/bewertungs-reminder" -H "x-cron-secret: $SECRET"

# Abwicklungsfrist (NEU)
curl -X POST "$SITE/api/cron/abwicklungsfrist" -H "x-cron-secret: $SECRET"

# Auktion check-expired
curl -X POST "$SITE/api/auction/check-expired" -H "x-cron-secret: $SECRET"
```

Erwartete Antwort: JSON mit `{ ok: true, ... }`. Bei `401` → SECRET falsch
oder Scope nicht auf "Functions".

---

## 6. Falls etwas schiefläuft

| Symptom | Diagnose & Fix |
|---|---|
| `401 Unauthorized` von Cron | `CRON_SECRET` Env-Var fehlt oder Scope `Functions` nicht aktiv |
| `500 SUPABASE_SERVICE_ROLE_KEY nicht gesetzt` | Service-Role-Key in Netlify Env-Vars fehlt |
| Cron läuft nicht | Netlify Functions → Scheduled Tab prüfen, ggf. Site neu deployen |
| `tickets.verwalter_id` ist NULL | Mieter-Tickets ohne `objekt_id` — Migration #1 sollte sie auf den ersten Verwalter zuweisen. Prüfen: `SELECT count(*) FROM tickets WHERE verwalter_id IS NULL AND status != 'erledigt';` |
| `column "foto_urls" does not exist` beim Insert | Migration #4 nicht eingespielt — der Code hat einen Retry-Pfad (siehe `melden/page.tsx`), aber der ist nur Notbremse |
| `relation "ki_analysen_cache" does not exist` | Migration #5 nicht eingespielt — KI-API funktioniert weiter (Cache nur best-effort), aber jeder Call verbraucht Quota |
| Verifiziert-Toggle wirft Error | Migration #3 nicht eingespielt — Spalten fehlen |
| Storage-Foto plötzlich 403 für Beteiligte | Migration #2 + #4 reihenfolge-abhängig — beide nochmal in `1,4,2,3,5`-Order ausspielen |

---

## 7. Test-Pipelines (lokal)

```bash
npm run typecheck                        # tsc clean
npm run lint                             # ESLint clean
npm run build                            # Production-Build
npm run test:auction                     # 34 Unit-Tests
bash -c 'source tests/e2e/load-env.sh > /dev/null && npm run test:e2e'         # 15 E2E
bash -c 'source tests/e2e/load-env.sh > /dev/null && npx tsx tests/security/pen-tests.ts'      # 14 Pen-Tests
bash -c 'source tests/e2e/load-env.sh > /dev/null && npx tsx tests/security/storage-pen-test.ts' # 4 Storage
bash -c 'source tests/e2e/load-env.sh > /dev/null && npx tsx tests/security/load-100-users.ts'   # Lasttest
bash -c 'source tests/e2e/load-env.sh > /dev/null && npx tsx tests/security/rate-limit-test.ts'  # Quota
```

Aktueller Stand auf `main`: alle grün.

---

## 8. Was bewusst NICHT in Prod ist

- **Video-Upload** (braucht Transcoding-Pipeline + Storage-Kosten-Konzept)
- **Eigentümer-Rolle** (eigenes Auth-Konzept + RLS-Policies + Dashboard)
- **Adresse-Privacy mit Freigabe-Flow** (Architektur-Entscheidung)
- **Stripe-Penalty bei No-Show** (Zahlungsintegration)
- **Voller Google-Calendar-OAuth** — UI-Stub im HW-Profil ("Demnächst"),
  DB-Spalten existieren, aber kein Flow
- **Voller Kalender-Editor in Wochenansicht** — aktuell nur Tagesansicht
  klickbar (KAL-1 done), Wochenansicht read-only
- **Drag-Resize bestehender Termine** — nice-to-have, später
