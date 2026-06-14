# Reparo Onboarding-Email-Sequence (Beta-Tester)

> 5-stufige Sequenz die Beta-Tester automatisch durch die ersten 14 Tage führt.
> Resend als Mailer (bereits eingerichtet: `RESEND_API_KEY` in Netlify-ENVs).
> Triggern: über Scheduled-Task oder direkter Cron-Job.

## Übersicht der Sequenz

| # | Mail | Trigger | Ziel | Tag |
|---|---|---|---|---|
| 1 | Welcome | Anmeldung Beta-Tester | Login + erste Orientierung | 0 |
| 2 | Schritt 1 (Erste Aktion) | +1 Tag nach Anmeldung | Erstes Ticket anlegen | 1 |
| 3 | Reminder | +3 Tage nach Anmeldung | Re-Engagement falls noch nichts gemacht | 3 |
| 4 | Feedback-Anfrage | +7 Tage nach Anmeldung | Strukturiertes Feedback einsammeln | 7 |
| 5 | Re-Engagement | +14 Tage nach Anmeldung | Bei Inaktivität nochmal animieren | 14 |

---

## Mail 1 — Welcome (Tag 0, direkt nach Anmeldung)

**Trigger:** Beta-Tester-Account wird erstellt (Hook auf `profiles` INSERT).
**Subject:** Willkommen bei Reparo — Ihr Beta-Zugang ist bereit
**From:** `lennart@reparo-app.de` (sobald Domain verifiziert; vorerst `onboarding@resend.dev`)

```
Hallo {VORNAME},

schön, dass Sie Reparo als einer der ersten testen.

Bevor Sie loslegen — drei Dinge die Sie wissen sollten:

1) DAS HIER IST EINE BETA
   Wir bauen Reparo gerade. Features funktionieren — aber wir lernen mit
   jedem Klick dazu. Ehrliches Feedback (auch negatives) ist Gold wert.

2) IHRE 3 LOGIN-OPTIONEN
   Sie sind als {ROLLE} eingeladen. Login: {LOGIN_URL}
   Passwort: {PASSWORT}
   (Sie können das Passwort jederzeit im Profil ändern.)

3) FEEDBACK GEHT IM TOOL
   Unten rechts ist ein kleiner Feedback-Button. Ein Klick, kurze
   Notiz — landet bei mir auf dem Schreibtisch. Keine Umfrage,
   kein Quiz.

Was passiert jetzt:
- Morgen schicke ich Ihnen einen kurzen Hinweis für den ersten Schritt
- In 3 Tagen frage ich kurz nach wie es läuft
- In einer Woche bitte ich um strukturiertes Feedback (max 5 Min)

Wenn Sie zwischendurch Fragen haben: einfach antworten. Diese Mail
geht direkt an mich.

Viel Spaß,
Lennart
Gründer Reparo

PS: Anbei finden Sie unsere Beta-Welcome-PDF mit Übersicht aller Funktionen.
```

**Anhang:** `BETA-WELCOME.pdf`
**Placeholder:** `{VORNAME}`, `{ROLLE}`, `{LOGIN_URL}`, `{PASSWORT}`

---

## Mail 2 — Schritt 1 (Tag 1, +24h nach Anmeldung)

**Trigger:** 24h nach Account-Erstellung.
**Subject:** Reparo — Ihr erster Schritt (2 Minuten)
**From:** `lennart@reparo-app.de`

### Variante 2a — Wenn ROLLE = Mieter

```
Hallo {VORNAME},

heute ein kurzer Tipp:

Probieren Sie mal eine fingierte Schadensmeldung anzulegen.
Es geht nichts kaputt — alle Daten sind im Test-Modus.

So geht's:
1. Login: {LOGIN_URL}
2. „Schaden melden"-Button (oben)
3. Wizard durchklicken: Beispiel-Schaden „Heizung kalt" eintippen
4. Submit → Sie sehen sofort wie die Auktion losläuft

Dauert max 2 Minuten. Wenn etwas verwirrend ist: Feedback-Button.

Lennart
```

### Variante 2b — Wenn ROLLE = Verwalter

```
Hallo {VORNAME},

heute ein kurzer Tipp:

Im Dashboard sehen Sie bereits 5 Test-Tickets in unterschiedlichen
Stadien — perfekt zum Reinklicken. Wir haben Beispiel-Angebote von
Demo-Handwerkern hinterlegt.

So gewinnen Sie ein Gefühl:
1. Login: {LOGIN_URL}
2. „Tickets"-Übersicht
3. Auf das Wasserrohrbruch-Ticket klicken (NOTFALL)
4. Sehen Sie die 2 Angebote, klicken Sie das beste an

Dauert max 3 Minuten. Wenn etwas hakt: Feedback-Button.

Lennart
```

### Variante 2c — Wenn ROLLE = Handwerker

```
Hallo {VORNAME},

heute ein kurzer Tipp:

Im Marktplatz sehen Sie bereits 4-5 offene Aufträge — perfekt zum
Üben einer Angebots-Abgabe.

So geht's:
1. Login: {LOGIN_URL}
2. „Marktplatz"-Übersicht
3. Auf ein Ticket klicken das Sie interessant finden
4. „Angebot abgeben" → Preis + Termin + Notiz

Dauert max 3 Minuten. Wenn etwas verwirrend ist: Feedback-Button.

Lennart
```

---

## Mail 3 — Reminder (Tag 3)

**Trigger:** 3 Tage nach Anmeldung, NUR wenn Tester noch keine Aktion gemacht hat (kein eingeloggt, kein Ticket angelegt, kein Angebot).
**Subject:** Reparo — alles gut bei Ihnen?
**From:** `lennart@reparo-app.de`

```
Hallo {VORNAME},

ich sehe Sie haben Reparo noch nicht ausprobiert — alles in Ordnung?

Häufige Gründe und Hilfen:

- „Hab den Login-Link verloren" → hier nochmal: {LOGIN_URL}
- „War zu beschäftigt" → kein Stress, Beta läuft noch 4 Wochen
- „Hab vergessen wofür's war" → 30-Sekunden-Erklärung: {LANDING_URL}
- „Hat mich nicht überzeugt" → ich nehme ehrliches Feedback dankbar an

Wenn Sie keine Lust mehr haben: einfach antworten mit „raus" und
ich entferne Sie aus dem Verteiler. Kein böses Blut.

Lennart
```

---

## Mail 4 — Feedback-Anfrage (Tag 7)

**Trigger:** 7 Tage nach Anmeldung, alle aktiven Tester.
**Subject:** Reparo — Ihre 3 wichtigsten Eindrücke?
**From:** `lennart@reparo-app.de`

```
Hallo {VORNAME},

eine Woche Reparo — Zeit für Ihr ehrliches Feedback.

3 Fragen, max 5 Minuten:

1. WAS HAT FUNKTIONIERT?
   Welcher Moment in Reparo hat Sie überzeugt — wenn überhaupt einer?

2. WAS HAT GENERVT?
   Wo haben Sie geflucht? Wo hat etwas nicht so funktioniert
   wie Sie es erwartet hatten?

3. WÜRDEN SIE FÜR REPARO ZAHLEN?
   - Wenn ja: was wäre Ihnen pro Monat fair?
   - Wenn nein: was müsste anders sein?

Antworten Sie einfach auf diese Mail — formloser Text reicht.
Sie können auch nur 1 von 3 Fragen beantworten wenn Sie wenig Zeit haben.

Danke, das hilft uns enorm.

Lennart

PS: Falls Sie etwas Konkretes zeigen wollen, geht auch ein
kurzer Anruf — antworten Sie einfach „kann anrufen" und ich melde mich.
```

---

## Mail 5 — Re-Engagement (Tag 14)

**Trigger:** 14 Tage nach Anmeldung, NUR wenn Aktivität nachgelassen hat (kein Login in letzten 7 Tagen).
**Subject:** Reparo — letzter Versuch, kein Stress
**From:** `lennart@reparo-app.de`

```
Hallo {VORNAME},

letzte Mail von mir aus dem Onboarding — versprochen.

Falls Sie Reparo weiterhin interessant finden: hier sind die
3 Features die unsere aktivsten Tester am meisten loben:

- [Feature 1 — wird durch Auto-Loop befüllt basierend auf Beta-Feedback-Daten]
- [Feature 2 — dito]
- [Feature 3 — dito]

Hier nochmal Login: {LOGIN_URL}

Falls Sie KEIN Interesse mehr haben: bitte 1 Klick auf {UNSUBSCRIBE_URL}
und Sie hören nie wieder von mir.

Falls Sie 2 Minuten haben für Feedback warum es nicht gepasst hat:
einfach antworten — das hilft uns das Produkt zu verbessern.

Danke und alles Gute,
Lennart
```

---

## Resend-Integration Plan (für Claude Code)

### Phase E1 — Email-Templates als React-Components (~1h)

Resend supports React-Email-Components. Erstelle:

```
emails/
├── welcome.tsx
├── schritt-1-mieter.tsx
├── schritt-1-verwalter.tsx
├── schritt-1-handwerker.tsx
├── reminder.tsx
├── feedback-anfrage.tsx
└── re-engagement.tsx
```

Jeder Template ist eine React-Component mit Props `{vorname, rolle, login_url, ...}`.

### Phase E2 — Send-Helper (~30 min)

```typescript
// lib/email/onboarding.ts
import { Resend } from 'resend';
import { WelcomeEmail } from '@/emails/welcome';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOnboardingMail(
  to: string,
  template: 'welcome' | 'schritt-1' | 'reminder' | 'feedback' | 're-engagement',
  vars: { vorname: string; rolle: 'mieter'|'verwalter'|'handwerker'; login_url: string; passwort?: string }
) {
  const components = {
    welcome: WelcomeEmail,
    'schritt-1': vars.rolle === 'mieter' ? Schritt1MieterEmail : ...,
    // ...
  };
  
  return resend.emails.send({
    from: 'lennart@reparo-app.de',
    to,
    subject: getSubject(template),
    react: components[template](vars),
  });
}
```

### Phase E3 — Scheduled-Task für Automation (~1h)

Cron-basierter Task der täglich:
1. Findet alle Beta-Tester mit Anmelde-Datum
2. Berechnet Tag-Offset (heute - anmeldung)
3. Schickt passende Mail wenn Offset = 1 / 3 / 7 / 14
4. Trackt in DB welche Mails schon raus sind (Tabelle `email_log`)

```sql
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  resend_id text,
  status text DEFAULT 'sent',
  UNIQUE (profile_id, template)
);
```

UNIQUE-Constraint verhindert Doppel-Sendungen.

### Phase E4 — Conditional Logic (Wer bekommt was wann?)

| Template | Conditions |
|---|---|
| welcome | profiles.created_at = today AND rolle IN beta-rollen |
| schritt-1 | offset = 1 AND welcome bereits gesendet |
| reminder | offset = 3 AND keine Aktivität (kein last_sign_in_at in letzten 3 Tagen) |
| feedback | offset = 7 AND welcome bereits gesendet |
| re-engagement | offset = 14 AND last_sign_in_at < (now - 7 days) |

### Phase E5 — Welcome-Mail INSTANT trigger (~30 min)

Statt Cron: Datenbank-Trigger oder Server-Action im Auth-Sign-up:

```typescript
// In der Signup-Handler:
await supabase.auth.admin.createUser({...});
await sendOnboardingMail(email, 'welcome', { vorname, rolle, login_url, passwort });
await supabase.from('email_log').insert({ profile_id, template: 'welcome' });
```

## Setup-Checkliste (für Lennart vor Beta-Start)

- [ ] Resend-Domain verifizieren (`reparo-app.de` oder Subdomain)
- [ ] `RESEND_FROM_EMAIL` ENV setzen (z.B. `lennart@reparo-app.de`)
- [ ] BETA-WELCOME.pdf in `public/` deployen (für Attachment-Link)
- [ ] Test-Welcome-Mail an dich selbst → prüfen
- [ ] Scheduled-Task in `mcp__scheduled-tasks` anlegen (täglich 09:00)
- [ ] DSGVO: kurzer Hinweis im Welcome dass Mails strikt Reparo-only

## Erfolg

- 80% der Beta-Tester loggen sich innerhalb 24h ein (Welcome wirkt)
- 50% legen innerhalb Tag 3 mindestens 1 Ticket/Angebot an (Schritt-1 wirkt)
- 30% beantworten Feedback-Mail Tag 7 (gut für B2B-Beta)
- <5% Unsubscribe-Rate über 14 Tage
