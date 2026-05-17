# Cloud-Deploy — Beta-Vorbereitung

> Diese Datei ist eine Wegwerf-Checkliste. Nach erfolgtem Deploy kann sie
> gelöscht werden (oder als Vorlage für nächste Migrations-Wellen bleiben).

Drei Schritte, je 1-3 Min. **In dieser Reihenfolge.**

---

## Schritt 1 — Supabase Migrationen (5 Min)

Studio öffnen: <https://supabase.com/dashboard/project/gkojaogdzzyuboajwyom/sql/new>

Pro Block einmal **„Run"** klicken. Wenn ein Block durchläuft (keine roten Fehler), nächsten Block einfügen.

> **Idempotent:** Alle 4 Blöcke nutzen `IF NOT EXISTS` / `DROP IF EXISTS` — wiederholtes Ausführen schadet nicht.

### Block 1 — Frist-Warnung-Marker

```sql
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS frist_warnung_gesendet boolean NOT NULL DEFAULT false;
```

### Block 2 — Prioritäts-Enum vereinheitlichen

```sql
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_prioritaet_check;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_prioritaet_check
  CHECK (prioritaet IN ('normal','hoch','dringend','planbar','zeitnah','notfall'));

UPDATE public.tickets
   SET prioritaet = CASE prioritaet
     WHEN 'normal'   THEN 'planbar'
     WHEN 'hoch'     THEN 'zeitnah'
     WHEN 'dringend' THEN 'notfall'
     ELSE prioritaet
   END
 WHERE prioritaet IN ('normal','hoch','dringend');

ALTER TABLE public.tickets
  ALTER COLUMN prioritaet SET DEFAULT 'planbar';
```

### Block 3 — Stripe-Connect + Penalty-Schema

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarded_at timestamptz;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS penalty_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS penalty_amount_cents int,
  ADD COLUMN IF NOT EXISTS penalty_charge_id text,
  ADD COLUMN IF NOT EXISTS penalty_buchung_versucht_am timestamptz;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_penalty_status_check;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_penalty_status_check
  CHECK (penalty_status IN ('none','manual_pending','paid','failed'));

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;

  NEW.rolle := OLD.rolle;
  NEW.email := OLD.email;
  NEW.bewertung_avg := OLD.bewertung_avg;
  NEW.auftraege_anzahl := OLD.auftraege_anzahl;
  NEW.angebotstreue := OLD.angebotstreue;
  NEW.verfuegbarkeit_score := OLD.verfuegbarkeit_score;
  NEW.sichtbarkeit_stufe := OLD.sichtbarkeit_stufe;
  NEW.early_adopter_bis := OLD.early_adopter_bis;
  NEW.kalender_streak := OLD.kalender_streak;
  NEW.letzte_kalender_pflege := OLD.letzte_kalender_pflege;
  NEW.letzte_reaktivierung_mail := OLD.letzte_reaktivierung_mail;

  NEW.verifiziert := OLD.verifiziert;
  NEW.verifiziert_am := OLD.verifiziert_am;
  NEW.verifiziert_von := OLD.verifiziert_von;

  NEW.stripe_account_id := OLD.stripe_account_id;
  NEW.stripe_charges_enabled := OLD.stripe_charges_enabled;
  NEW.stripe_payouts_enabled := OLD.stripe_payouts_enabled;
  NEW.stripe_onboarded_at := OLD.stripe_onboarded_at;

  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS tickets_penalty_status_idx
  ON public.tickets (penalty_status)
  WHERE penalty_status IN ('manual_pending', 'failed');
```

### Block 4 — Feedback-Tabelle

```sql
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  rolle text,
  kontext_url text,
  message text NOT NULL,
  viewed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_unread_idx ON public.feedback (viewed, created_at DESC)
  WHERE viewed = false;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_insert_self ON public.feedback;
CREATE POLICY feedback_insert_self ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS feedback_select_own_or_admin ON public.feedback;
CREATE POLICY feedback_select_own_or_admin ON public.feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS feedback_update_admin ON public.feedback;
CREATE POLICY feedback_update_admin ON public.feedback
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS feedback_delete_admin ON public.feedback;
CREATE POLICY feedback_delete_admin ON public.feedback
  FOR DELETE TO authenticated
  USING (public.is_admin());
```

### Smoke-Check (zur Bestätigung)

```sql
-- Erwartet: stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_onboarded_at
SELECT column_name FROM information_schema.columns
 WHERE table_name='profiles' AND column_name LIKE 'stripe_%';

-- Erwartet: penalty_status, penalty_amount_cents, penalty_charge_id, penalty_buchung_versucht_am
SELECT column_name FROM information_schema.columns
 WHERE table_name='tickets' AND column_name LIKE 'penalty_%';

-- Erwartet: 4 Zeilen (insert_self, select_own_or_admin, update_admin, delete_admin)
SELECT polname FROM pg_policy WHERE polrelid='public.feedback'::regclass;

-- Erwartet: nur planbar/zeitnah/notfall (oder leer wenn DB clean)
SELECT prioritaet, count(*) FROM tickets GROUP BY prioritaet;
```

---

## Schritt 2 — Netlify ENV-Vars (3 Min)

Site Settings → Build & deploy → Environment → Environment variables → **„Add a variable"**:

```
NEXT_PUBLIC_REPARO_BETREIBER_NAME    = <Vor- und Nachname>
NEXT_PUBLIC_REPARO_BETREIBER_STRASSE = <Straße + Hausnummer>
NEXT_PUBLIC_REPARO_BETREIBER_PLZORT  = <PLZ Ort>
NEXT_PUBLIC_REPARO_KONTAKT_EMAIL     = lenn-dev@proton.me
NEXT_PUBLIC_REPARO_LIVE_DATA         = true
REPARO_FEEDBACK_EMAIL                = lenn-dev@proton.me
```

Danach: **Deploys → Trigger deploy → Deploy site** (sonst greifen die neuen Vars erst beim nächsten Push).

**Verifikation:** Impressum-Seite öffnen <https://reparo-app.netlify.app/impressum> → kein gelber Warnbanner mehr, deine Daten stehen drin.

---

## Schritt 3 — Admin-Account (3 Min)

**Variante: neu registrieren** (einfacher als Auth-Email-Migration)

1. <https://reparo-app.netlify.app/registrierung> öffnen
2. Mit `lenn-dev@proton.me` registrieren — Rolle egal (z. B. „Hausverwaltung")
3. Bestätigungsmail im Proton-Postfach → Link klicken
4. Studio öffnen → SQL Editor:
   ```sql
   UPDATE profiles SET rolle = 'admin'
    WHERE email = 'lenn-dev@proton.me';
   ```
5. Re-Login → Sidebar zeigt Admin-Einträge (Feedback, Penalties, Nutzer, …)

**Alten Admin** kannst du behalten oder über Studio → Authentication → Users → Delete entfernen.

---

## Fertig — was jetzt funktioniert

- Frist-Cron läuft sauber (Block 1)
- Prioritäts-Enum sauber (Block 2) — keine Compat-Layer-Risiken mehr
- HW kann Stripe Connect onboarden (Block 3) — Penalty-Markierung via Cron
- Feedback-Button + Admin-Inbox funktionieren (Block 4)
- Impressum/Datenschutz rechtssicher
- `lenn-dev@proton.me` ist Admin

Optional als nächstes: Resend-Domain verifizieren (sonst kein Mail-Versand), Google-OAuth-Client anlegen (sonst nur E-Mail-Login).

---

## Nachtrag (17. Mai 2026) — 3 weitere Migrationen aus Agent-Review

### Block 5 — Einladungen RLS für Verwalter (BUG-2)

```sql
DROP POLICY IF EXISTS "einladungen_select_hw" ON public.einladungen;
DROP POLICY IF EXISTS "einladungen_select_alle_beteiligten" ON public.einladungen;

CREATE POLICY "einladungen_select_alle_beteiligten" ON public.einladungen
  FOR SELECT
  USING (
    auth.uid() = handwerker_id
    OR EXISTS (
      SELECT 1 FROM public.tickets t
       WHERE t.id = einladungen.ticket_id
         AND (t.erstellt_von = auth.uid() OR t.verwalter_id = auth.uid())
    )
    OR public.is_admin()
  );
```

### Block 6 — Nachträge RLS für Verwalter (BUG-3)

```sql
DROP POLICY IF EXISTS "nachtraege_select_beteiligte" ON public.nachtraege;

CREATE POLICY "nachtraege_select_beteiligte" ON public.nachtraege
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
       WHERE t.id = nachtraege.ticket_id
         AND (
              t.erstellt_von = auth.uid()
           OR t.verwalter_id = auth.uid()
           OR t.zugewiesener_hw = auth.uid()
         )
    )
    OR public.is_admin()
  );
```

### Block 7 — Diagnose-Preise Encoding-Cleanup (BUG-5)

```sql
UPDATE public.diagnose_preise
   SET gewerk = CASE
     WHEN gewerk ILIKE 'sanit%'        THEN 'sanitaer'
     WHEN gewerk ILIKE 'elektr%'       THEN 'elektro'
     WHEN gewerk ILIKE 'heiz%'         THEN 'heizung'
     WHEN gewerk ILIKE 'mal%'          THEN 'maler'
     WHEN gewerk ILIKE 'schloss%'      THEN 'schlosser'
     WHEN gewerk ILIKE 'schrein%'      THEN 'schreiner'
     WHEN gewerk ILIKE 'dachdeck%'     THEN 'dachdecker'
     WHEN gewerk ILIKE 'allgemein%'    THEN 'allgemein'
     WHEN gewerk ILIKE 'fliesen%'      THEN 'fliesenleger'
     ELSE LOWER(gewerk)
   END
 WHERE gewerk IS NOT NULL
   AND gewerk NOT IN ('sanitaer','elektro','heizung','maler','schlosser','schreiner','dachdecker','allgemein','fliesenleger');
```

### Smoke-Check nach Block 5-7
```sql
-- erwartet: nur ASCII-Keys
SELECT DISTINCT gewerk FROM diagnose_preise ORDER BY gewerk;

-- erwartet: einladungen_select_alle_beteiligten
SELECT polname FROM pg_policy WHERE polrelid='public.einladungen'::regclass;

-- erwartet: nachtraege_select_beteiligte
SELECT polname FROM pg_policy WHERE polrelid='public.nachtraege'::regclass;
```

> Diese 3 Blöcke fixen die zwei großen Verwalter-Workflow-Blocker (Einladungen + Nachträge sichtbar) sowie das „SanitÃ¤r"-Mojibake. Lokal sind sie schon getestet.
