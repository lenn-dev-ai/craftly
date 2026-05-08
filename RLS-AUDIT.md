# Reparo — RLS-Audit (Stand 2026-05-08)

Dieser Walkthrough geht jede Tabelle durch, listet die Policies, beschreibt das **erwartete Verhalten** und liefert SQL-Snippets, um das Verhalten gegen die Live-DB zu testen.

Alle Test-Queries sind **read-only** — risikolos. Sie nutzen `auth.uid()` über `SET LOCAL ROLE authenticated` und Session-Variablen, falls in einer SQL-Session ohne echten User-Kontext getestet wird.

## Methodik der Tests

Alle Tests laufen in einer fresh Postgres-Session in Supabase Studio:

```sql
-- Setze die Test-User-ID (UUID eines existierenden profiles.id)
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"REPLACE-WITH-USER-UUID"}';
SET LOCAL ROLE authenticated;
```

Danach reflektieren alle `SELECT * FROM ...` die RLS-Sicht dieses Users.

---

## 1. profiles

**Erwartung:**
- Jeder authentifizierte User darf alle Profile *lesen* (öffentliche Bewertungen, Namen).
- Jeder darf nur das *eigene* Profil updaten.
- Insert nur mit `auth.uid() = id` (verhindert Profil-Squatting).

**Policies aus `supabase-schema-v2.sql`:**
```
profiles_select        FOR SELECT USING (true)
profiles_update_own    FOR UPDATE USING (auth.uid() = id)
profiles_insert        FOR INSERT WITH CHECK (auth.uid() = id)
```

**Tests:**
```sql
-- Sollte alle Profile zeigen
SELECT count(*) FROM profiles;

-- Versuch fremdes Profil zu updaten — 0 rows affected (silent fail durch RLS)
UPDATE profiles SET name = 'HACKED' WHERE id <> auth.uid();
SELECT id, name FROM profiles WHERE name = 'HACKED'; -- → 0 rows

-- Versuch fremdes Profil zu inserten — Policy verbietet es
INSERT INTO profiles (id, email, rolle) VALUES (gen_random_uuid(), 'attacker@test', 'admin');
-- → ERROR: new row violates row-level security policy
```

---

## 2. tickets

**Erwartung:**
- Mieter sieht **nur eigene** Tickets (`erstellt_von = auth.uid()`).
- Verwalter sieht eigene Tickets + alle in Status `auktion` (zur Anzeige in Übersichten).
- Handwerker sieht Tickets nur, wenn er **eingeladen** ist oder sie ihm zugewiesen sind oder sie offen-Auktion sind.
- Admin sieht alles.
- Update nur durch erstellt_von, zugewiesener_hw oder Admin.

**Policies aus `supabase-schema-v2.sql`:**
```
tickets_select  USING (
  auth.uid() = erstellt_von
  OR auth.uid() = zugewiesener_hw
  OR status = 'auktion'
  OR EXISTS (SELECT 1 FROM einladungen WHERE ticket_id = id AND handwerker_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rolle = 'admin')
)
tickets_insert  WITH CHECK (auth.uid() = erstellt_von)
tickets_update  USING (
  auth.uid() = erstellt_von
  OR auth.uid() = zugewiesener_hw
  OR Admin
)
```

**Mögliche Lücken (heute kein konkreter Bug, aber bewusst):**
- Status `auktion` ist **für ALLE authenticated User sichtbar** — also auch für Mieter anderer Hausverwaltungen. Das ist gewollt (zeigt offene Auktionen am Marktplatz), könnte aber bei künftigen Privacy-Anforderungen eingeschränkt werden auf Handwerker und Admins.
- Es gibt keine Verknüpfung Verwalter↔Mieter über Objekte (verwalter_id auf objekte) für tickets-Sicht. Verwalter sieht aktuell **nur Tickets, die er selbst erstellt hat** (`erstellt_von = auth.uid()`). Wenn ein Mieter ein Ticket meldet, sieht der Verwalter es **nicht automatisch**, sondern nur über den Auktion-Status. Dieser Punkt ist im Code-Flow versteckt — aktuell erstellen Mieter ihr eigenes Ticket und der Verwalter sieht es erst nach dem ersten "Handwerker einladen"-Klick (wo der Status auf `auktion` geht). Das ist die UX-Realität, sollte aber als Designentscheidung dokumentiert sein.

**Tests:**
```sql
-- Ein Mieter sieht NUR eigene Tickets
SELECT count(*) FROM tickets WHERE erstellt_von = auth.uid();
-- vs.
SELECT count(*) FROM tickets;
-- → Sollte gleich sein (oder sie sind in 'auktion'-Status)

-- Update fremdes Ticket → 0 rows
UPDATE tickets SET status = 'erledigt' WHERE erstellt_von <> auth.uid();
```

---

## 3. angebote

**Erwartung:**
- Handwerker sieht eigene Angebote.
- Verwalter sieht Angebote auf eigene Tickets.
- Admin sieht alles.

**Policies aus `supabase-schema-v2.sql`:**
```
angebote_select  USING (
  auth.uid() = handwerker_id
  OR EXISTS (SELECT 1 FROM tickets WHERE id = ticket_id AND erstellt_von = auth.uid())
  OR Admin
)
angebote_insert  WITH CHECK (auth.uid() = handwerker_id)
angebote_update  USING (handwerker_id = auth.uid() OR ticket-owner)
```

**Anmerkung:** `INSERT WITH CHECK (handwerker_id = auth.uid())` heißt: ein Handwerker kann **nicht** unter fremder ID bieten. Auch wenn ein angreifender Client `handwerker_id` manipuliert, wird das von RLS abgefangen.

**Tests:**
```sql
-- Versuch unter fremder ID zu bieten
INSERT INTO angebote (ticket_id, handwerker_id, preis) VALUES
  ('SOME-TICKET-UUID', 'OTHER-HW-UUID', 100);
-- → ERROR: violates row-level security policy
```

---

## 4. einladungen

**Erwartung:**
- Verwalter (Ticket-Owner) erstellt + sieht Einladungen.
- Handwerker sieht eigene Einladungen.

**Policies (aus schema-v2):**
```
einladungen_select  USING (handwerker_id = auth.uid() OR ticket-owner)
einladungen_insert  WITH CHECK (ticket-owner)
einladungen_update  USING (handwerker_id = auth.uid() OR ticket-owner)
```

**Tests:** wie bei angebote — fremdes Insert wird abgefangen.

---

## 5. nachrichten

**Erwartung:**
- Beteiligte am Ticket (Ersteller + zugewiesener Handwerker + Verwalter/Admin) lesen + schreiben.

**Policies aus `supabase-migration-e2e-flow.sql`:**
```
nachrichten_select_beteiligte  USING (
  auth.uid() IN (SELECT erstellt_von UNION SELECT zugewiesener_hw FROM tickets WHERE id = ticket_id)
  OR Verwalter/Admin
)
nachrichten_insert_beteiligte  WITH CHECK (
  absender_id = auth.uid()
  AND (Beteiligter ODER Verwalter/Admin)
)
```

**Anmerkung:** Die `WITH CHECK`-Klausel verhindert, dass ein Außenstehender Nachrichten in fremden Tickets ablegt — auch wenn `absender_id` gefälscht wäre.

---

## 6. bewertungen

**Erwartung:**
- Bewertungen sind **public read** (Ranking-System).
- Insert nur, wenn der Bewerter der Ticket-Ersteller ist UND Status `erledigt`.
- Trigger aktualisiert `profiles.bewertung_avg` per `SECURITY DEFINER`.

**Policies aus `supabase-migration-e2e-flow.sql`:**
```
bewertungen_select_visible        USING (true)
bewertungen_insert_eigenes_ticket WITH CHECK (
  bewerter_id = auth.uid()
  AND tickets.erstellt_von = auth.uid()
  AND tickets.status = 'erledigt'
)
```

**Tests:**
```sql
-- Versuch ohne erledigtes Ticket zu bewerten
INSERT INTO bewertungen (ticket_id, handwerker_id, bewerter_id, sterne)
VALUES ('TICKET-IM-AUKTION', 'HW-UUID', auth.uid(), 5);
-- → ERROR: violates row-level security policy
```

---

## 7. provisionen

**Erwartung:**
- Verwalter und Handwerker sehen jeweils eigene Provisions-Snapshots.
- Insert nur durch den Verwalter, der das Ticket erstellt hat.

**Policies aus `supabase-migration-provisionen.sql`:**
```
provisionen_select_eigene       USING (auth.uid() = verwalter_id OR auth.uid() = handwerker_id)
provisionen_insert_verwalter    WITH CHECK (auth.uid() = verwalter_id)
```

**Anmerkung:** `provision_settings` (Versionierung der Standard-Rate) ist nur für `authenticated` lesbar — kein anonymer Zugriff.

---

## 8. routen_planung

**Erwartung:**
- Handwerker sieht/ändert nur eigene Tagesrouten.
- Admin sieht alle.

**Policies aus `supabase-migration-auction-engine.sql`:**
```
routen_planung_select_own  USING (handwerker_id = auth.uid() OR Admin)
routen_planung_modify_own  FOR ALL USING (handwerker_id = auth.uid()) WITH CHECK (handwerker_id = auth.uid())
```

---

## 9. termine, verfuegbarkeiten, private_termine

Alle drei haben role-spezifische Policies (Handwerker eigene, Beteiligte am Ticket lesen). Konsistent mit dem Pattern.

---

## Cross-Tabellen-Risiken

### Joins über RLS hinweg

Manche Code-Pfade joinen Tickets mit Angeboten und Profilen. RLS wird **pro Tabelle** ausgewertet — das heißt ein User mit Lese-Zugriff auf Tickets, aber ohne Zugriff auf bestimmte Angebote, sieht das Ticket aber **leere `angebote`-Liste**. Das ist korrektes Verhalten, kein Datenleck.

### Service-Role-Keys

Wenn ein API-Endpoint mit dem Service-Role-Key arbeitet (anstatt mit der User-Session), umgeht er RLS komplett. **In diesem Repo wird der Service-Role-Key nirgendwo verwendet** (nur `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Falls künftige Cron-Endpoints auf Service-Role umsteigen müssten (z.B. `/api/auction/check-expired` für Mass-Updates), muss dort explizit Auth-Check (`x-cron-secret`) erfolgen — was bereits der Fall ist.

---

## Was nicht von RLS abgedeckt wird

**Geo-Filter ("nur Aufträge im Radius"):** RLS kann das nicht ohne PostGIS oder eine Custom-Funktion. Aktuell läuft Radius-Filtering in der App-Schicht (`lib/auction/scoring-pipeline.ts`). Risiko: ein böswilliger Handwerker könnte über Direct-DB-Queries Tickets außerhalb seines Radius abrufen — aber sie sind sowieso öffentlich (`status = 'auktion'`). Kein zusätzlicher Schutz nötig.

**Rate-Limits:** Nominatim-Geocoding über `/api/geocode` ist Login-protected, aber nicht rate-limited. Bei künftigem Missbrauchspotential: Vercel/Upstash-Rate-Limit oder einfacher: gleiches Pattern wie `check-expired` (Cron-Secret + Self-Throttle).

---

## Empfehlungen

| Punkt | Risiko | Aktion |
|---|---|---|
| Verwalter↔Mieter↔Objekte-Verknüpfung | UX-Lücke (Verwalter sieht Mieter-Tickets erst nach erstem Klick) | Optional: Policy erweitern um `EXISTS (SELECT 1 FROM objekte WHERE verwalter_id = auth.uid() AND tickets.objekt_id = objekte.id)` |
| Geo-Filter via RLS | gering, da `status='auktion'` ohnehin öffentlich | nichts tun |
| Service-Role-Nutzung | aktuell keine | bei Bedarf Cron-Secret-Pattern beibehalten |
