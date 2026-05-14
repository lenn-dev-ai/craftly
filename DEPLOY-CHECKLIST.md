# Deploy-Checklist — Migrations & Cron-Setup

Alle Code-Änderungen sind auf `main`. Bleibt: **3 Migrations + 1 Env-Var**.
Danach laufen die 4 Cron-Jobs automatisch über Netlify Scheduled Functions.

---

## 1. Migrations in Cloud-Supabase Studio

Reihenfolge spielt keine Rolle (alle idempotent). Drei Files öffnen, jeweils
in [Supabase SQL Editor](https://supabase.com/dashboard/project/gkojaogdzzyuboajwyom/sql/new)
pasten und Run.

| Datei | Was sie tut |
|---|---|
| `supabase-migration-diagnose-ablauf.sql` | `tickets.diagnose_ablauf` + Backfill für existing Diagnose-Tickets |
| `supabase-migration-tickets-verwalter-id.sql` | `tickets.verwalter_id` + Auto-Fill-Trigger + Backfill aus `objekt.verwalter_id` |
| `supabase-migration-reminder-tracking.sql` | `tickets.bewertung_reminder_gesendet` + `profiles.letzte_reaktivierung_mail` |

**Smoke-Checks nach jeder Migration:**

```sql
-- Nach Migration 1
SELECT count(*) FILTER (WHERE diagnose_ablauf IS NOT NULL) AS mit_ablauf
FROM tickets WHERE ticket_typ = 'diagnose' AND status = 'auktion';

-- Nach Migration 2 (wichtig — bei verwaisten Tickets manuell zuweisen)
SELECT count(*) FILTER (WHERE verwalter_id IS NULL) AS verwaiste
FROM tickets WHERE status != 'erledigt';

-- Nach Migration 3
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tickets' AND column_name = 'bewertung_reminder_gesendet';
```

---

## 2. Env-Var `CRON_SECRET` in Netlify setzen

**Wo:** Netlify Dashboard → Site → Site configuration → Environment variables → Add a single variable.

- Key: `CRON_SECRET`
- Scopes: **Builds** + **Functions** (beide!)
- Value: ein Random-String. Vorschlag (frisch generiert):

```
60f193486d8c473588345f6e98754b128d8bae2db8e36ba491eb1605d5069f19
```

> Du kannst auch einen eigenen wählen. Wichtig: ≥ 32 Zeichen, nicht in Git
> committen.

---

## 3. Deploy auslösen

Push ist schon durch. Netlify deployed automatisch. Nach Deploy:

```bash
# Verify dass die 4 Functions registriert sind
# Netlify Dashboard → Functions → Scheduled
```

Erwartete Liste:
- `check-expired-auctions` (alle 5 Min)
- `bewertungs-reminder` (täglich 03:00 UTC)
- `stille-hw-reaktivierung` (täglich 03:10 UTC)
- `sichtbarkeits-recompute` (täglich 03:20 UTC)

---

## 4. Manueller Smoke-Test (optional, aber empfohlen)

Direkter Aufruf eines Endpoints zum Verifikation der Auth + Logic:

```bash
# Ersetze <CRON_SECRET> mit dem Wert aus Schritt 2
curl -X POST https://reparo-app.netlify.app/api/cron/bewertungs-reminder \
  -H "x-cron-secret: <CRON_SECRET>"
```

Erwartete Antwort: JSON mit `{ ok: true, geprueft, versendet, ... }`.

---

## Falls etwas schiefläuft

| Symptom | Diagnose |
|---|---|
| `401 Unauthorized` von Cron-Endpoints | `CRON_SECRET` in Netlify nicht gesetzt oder anderer Scope als "Functions" |
| `500 SUPABASE_SERVICE_ROLE_KEY nicht gesetzt` | Service-Role-Key in Netlify Env-Vars fehlt (siehe vorheriger Deploy) |
| Scheduled Function läuft nicht | Netlify Functions → Scheduled Tab prüfen, ggf. Site neu deployen |
| `tickets.verwalter_id` ist null nach Migration | Mieter-Tickets ohne `objekt_id` brauchen manuelles UPDATE |

Bei verwaisten Tickets ohne `verwalter_id`:

```sql
-- Falls vorhanden: manuell zuordnen über Mieter-Email-Heuristik o.ä.
SELECT id, titel, erstellt_von, objekt_id
FROM tickets
WHERE verwalter_id IS NULL AND status != 'erledigt';
```
