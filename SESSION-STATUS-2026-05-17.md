# Session-Status zum Ende der Sitzung am 17. Mai 2026

> Wegwerf-Notiz: was ist erledigt, was steht offen. Auf dem neuen PC
> als erstes lesen — danach kann die Datei gelöscht werden.

---

## Code-Stand auf `main`

Aktueller Commit: `e2f8616` — `fix(onboarding): upsert statt insert + echter error.message`

Diese Session hat geliefert:
- **OAuth-Login** (Google) inkl. Onboarding-Page für Erst-Logins
- **Stripe Connect Phase 1** (Schema, Onboarding-Flow für HW, Penalty-Markierung im Cron, Admin-Penalty-Übersicht, Webhook-Stub)
- **Beta-Loop** (Feedback-Widget, Admin-Feedback-Inbox, Welcome-Mail-Template)
- **UI-UX-Sprint** (Drawer, Chat Auto-Scroll, Kalender, Spacing, Toast)
- **Agent-Review-Sprint** (Ticket-Detail-Crash gefixt, Verwalter-RLS-Migrationen, SanitÃ¤r-Encoding-Fix, Mieter-Wizard Zurück, Filterchips, Tooltips, Error-Boundary mit Details)
- **Onboarding-Upsert-Fix** (war heute Abend der letzte Bug: „Profil konnte nicht erstellt werden")

Tests: **15/15 E2E grün, 16/16 Pen-Tests blocked, tsc/lint/build clean**.

---

## Offene Cloud-Tasks (was DU im Browser machen musst)

### 1. Netlify ENV-Vars setzen — Hard-Blocker

Impressum-Seite zeigt aktuell noch Platzhalter („DEINE-EMAIL"). Rechtlich Pflicht vor Beta:

```
NEXT_PUBLIC_REPARO_BETREIBER_NAME    = <Vor- und Nachname>
NEXT_PUBLIC_REPARO_BETREIBER_STRASSE = <Straße + Hausnummer>
NEXT_PUBLIC_REPARO_BETREIBER_PLZORT  = <PLZ Ort>
NEXT_PUBLIC_REPARO_KONTAKT_EMAIL     = lenn-dev@proton.me
NEXT_PUBLIC_REPARO_LIVE_DATA         = true
REPARO_FEEDBACK_EMAIL                = lenn-dev@proton.me
```

Dann **Deploy auslösen** (Netlify → Deploys → Trigger deploy).

### 2. Admin-Profil anlegen

Du hattest gemeldet „Profil konnte nicht erstellt werden" beim Onboarding. Der Code-Fix ist seit `e2f8616` live (upsert + echte error.message). Zwei Optionen:

**A — über die UI:** Onboarding-Formular nochmal ausfüllen → sollte jetzt durchlaufen → danach im SQL Editor:
```sql
UPDATE profiles SET rolle = 'admin' WHERE email = 'lenn-dev@proton.me';
```

**B — direkt per SQL:**
```sql
INSERT INTO public.profiles (id, email, name, rolle)
SELECT u.id, u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       'admin'
  FROM auth.users u
 WHERE u.email = 'lenn-dev@proton.me'
ON CONFLICT (id) DO UPDATE SET rolle = 'admin';
```

### 3. Migrationen-Verifikation

Du sagtest „Migrationen sind durch". Unklar ob das alle 7 Blöcke aus `CLOUD-DEPLOY-NOW.md` umfasst oder nur die ersten 4. Smoke-Check im Studio:

```sql
-- Erwartet: 4 stripe_*-Spalten, 4 penalty_*-Spalten, 1 frist_warnung_gesendet
SELECT column_name FROM information_schema.columns
 WHERE table_name IN ('profiles','tickets')
   AND (column_name LIKE 'stripe_%' OR column_name LIKE 'penalty_%' OR column_name = 'frist_warnung_gesendet');

-- Erwartet: einladungen_select_alle_beteiligten + nachtraege_select_beteiligte
SELECT polname FROM pg_policy
 WHERE polrelid IN ('public.einladungen'::regclass, 'public.nachtraege'::regclass)
 ORDER BY polname;

-- Erwartet: nur ASCII-Keys (sanitaer, elektro, …) — KEIN "Sanitär"-String
SELECT DISTINCT gewerk FROM diagnose_preise ORDER BY gewerk;
```

Wenn irgendwas fehlt: die entsprechenden Blöcke aus `CLOUD-DEPLOY-NOW.md` nachfahren.

---

## Optional aber empfohlen vor echten Beta-Usern

- **Resend-Domain** `reparo-app.de` verifizieren (DNS), sonst kommen Welcome- und Feedback-Mails nicht durch
- **Google-OAuth-Client** anlegen (siehe `ONBOARDING.md` § 3) — sonst nur E-Mail-Login
- **Stripe-Account** + Connect aktivieren — Penalty läuft bis dahin als `manual_pending`
- **Manual-QA** bei 390 px: Mieter-Wizard durch, HW-Termin annehmen, Verwalter-Vergabe
- **2-3 echte Beta-User** anwerben

---

## Was ich aus Memory wissen sollte für die nächste Session

Beim Start einer neuen Claude-Code-Session auf dem neuen PC: meine Memory startet leer. Diese Datei + `ONBOARDING.md` + `CLOUD-DEPLOY-NOW.md` sind die Wahrheit. Wenn du in der ersten Frage „lies SESSION-STATUS-2026-05-17.md und sag was Stand ist" schickst, bin ich in 30 Sek wieder im Kontext.

Wichtige Memory-Regeln aus dieser Session (für künftige Sessions relevant):

- **Action-Bias bei „weiter" / „los"**: vollständig liefern statt um Erlaubnis fragen
- **Glaubwürdigkeit**: keine Fake-Stats/Testimonials in Reparo-Marketing
- **Security-Trigger-Invariante**: column-level Whitelist via BEFORE-UPDATE-Trigger; `tests/security/pen-tests.ts` vor jedem RLS-Change laufen lassen
- **KI-Quota**: `try_consume_ki_quota` begrenzt `/api/ki/schadenserkennung` auf 10/Tag/User

---

## Ein paar offene große Brocken (wenn du Lust hast nach Beta)

- **Stripe Phase 2** — echte Penalty-Charging-Logik (Architektur-Entscheidung: PaymentMethod off_session vs. Connect-Reversal)
- **Eigentümer-Rolle** als 4. Persona — 2-3 Tage
- **Chat-Read-Indicators** zwischen Rollen
- **Voller Wochen-Editor** für Kalender
- **Mehrsprachigkeit** (de/en) sobald Markt das verlangt
