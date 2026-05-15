# Production-Setup — Email + Observability

Komplement zu `DEPLOY-CHECKLIST.md`. Beide Schritte sind notwendig
bevor echte User auf die Plattform losgelassen werden.

---

## 1. Resend (Email-Versand)

**Status aktuell:** `RESEND_API_KEY` ist nicht gesetzt → alle Mail-Templates
(Befund-Notifications, Bewertungs-Reminder, Zuschlag-Mails) sind no-op.
Wenn morgen ein echter Verwalter ein Ticket bekommt, sieht er nichts.

### 1.1 Account + Domain

1. Account auf https://resend.com (Free Tier: 3000 Mails/Monat, 100/Tag)
2. Domain hinzufügen (Settings → Domains → Add Domain): `reparo-app.de`
3. DNS-Records aus Resend kopieren → bei deinem Domain-Provider eintragen:
   - SPF (TXT)
   - DKIM (3 CNAMEs)
4. Verify klicken — geht idR in ≤ 15 Min durch
5. API-Key holen: Settings → API Keys → Create API Key → "Production"

### 1.2 Env-Vars in Netlify

→ Netlify → Site → Site configuration → Environment variables → Add a single variable

- Key: `RESEND_API_KEY`
- Value: der Key aus Schritt 1.1
- Scopes: **Functions** + **Builds**

- Key: `RESEND_FROM_EMAIL`
- Value: `Reparo <noreply@reparo-app.de>` (oder eigene)
- Scopes: gleich

### 1.3 Live-Test

Nach Netlify-Redeploy:

```bash
# Bewertungs-Reminder mit echter Mail testen
curl -X POST https://reparo-app.netlify.app/api/email/test \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"template":"zuschlag","to":"deine@email.de"}'
```

**Sicherheit:** der Test-Endpoint ist in Production auf
"eingeloggter Admin + Empfänger = eigene Email" gelocked, im Dev offen.
Siehe `app/api/email/test/route.ts` für die genaue Auth-Logik.

### 1.4 Was du danach beobachten solltest

- Resend Dashboard → Logs: jede einzelne Mail mit Status
- Bei Bounce-Rate > 2 %: Domain-Reputation prüfen
- Tägliches Quota im Free Tier: 100 Mails. Bei mehr → Pro Plan ($20/mo)

---

## 2. Sentry (Error-Monitoring)

**Status:** Code-Integration ist `main` ab Commit *(nächster Commit)*.
Aktiviert sobald `NEXT_PUBLIC_SENTRY_DSN` gesetzt ist. Ohne DSN: stumm
(kein Performance-Impact, keine Daten).

### 2.1 Sentry-Account + Projekt

1. Account auf https://sentry.io (Free Tier: 5000 Errors/Monat)
2. Neues Projekt: Platform = **Next.js**
3. DSN aus Settings → Projects → Reparo → Client Keys (DSN) kopieren
   (Format: `https://abc123@o12345.ingest.sentry.io/678`)

### 2.2 Env-Vars in Netlify

- Key: `NEXT_PUBLIC_SENTRY_DSN`
- Value: der DSN aus Schritt 2.1
- Scopes: **Functions** + **Builds** (wichtig: NEXT_PUBLIC_ wird ins
  Browser-Bundle inlined, also Build-Scope auch)

### 2.3 Was automatisch erfasst wird

| Layer | Was |
|---|---|
| Client | unhandled errors, Console-Errors, React-Errors, Session-Replay bei Errors |
| Server | API-Route-Errors, Server-Component-Errors |
| Edge | Middleware-Errors |

**Session-Replay:** bei Errors wird die letzte Minute User-Interaktion
aufgezeichnet (alle Text-Inputs gemasked, alle Bilder geblockt — DSGVO-ok).
5 % der nicht-Error-Sessions auch.

**Auth-Tokens werden redaktiert** vor Versand (Cookies + Authorization
header). Siehe `sentry.server.config.ts:beforeSend`.

### 2.4 Live-Test

Nach Setup einen Fehler provozieren:

```bash
# In Netlify Functions: erzeuge ein Throw
# Oder lokal:
curl -X POST https://reparo-app.netlify.app/api/diagnose/projekt-annehmen \
  -H "Content-Type: application/json" \
  -d '{"diagnose_ticket_id":"00000000-0000-0000-0000-000000000000"}'
```

Sollte 404 returnen + in Sentry erscheinen.

### 2.5 Alerts einrichten (empfohlen)

In Sentry → Alerts → Create Alert Rule:
- "Error Rate > 10/min" → Slack/Email-Webhook
- "New Error appears" → Email
- "Cron-Endpoint failed" → tag-basiert filtern (Sentry-Tag `function: cron`)

---

## Reihenfolge

1. Resend Domain verifizieren (≤ 15 Min DNS-Propagation)
2. Beide Env-Vars in Netlify setzen
3. Redeploy auslösen (oder warten bis nächster Push)
4. Live-Tests (1.3 + 2.4)
5. Erst dann: Beta-User onboarden
