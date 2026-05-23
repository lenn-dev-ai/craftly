# Voice-AI PoC — Setup-Checkliste für Lennart

> Reihenfolge wichtig — Schritt 1 (Migrations) muss vor Schritt 7 (Test-Call) durch sein.

## 1. DB-Migrations anwenden (~5 Min)

Im Supabase-Studio → SQL-Editor → folgende Files in dieser Reihenfolge ausführen:

```
1. supabase/migrations/20260605000050_ticket_eingetragen_von_verwalter.sql
2. supabase/migrations/20260605000070_voice_ai_felder.sql
```

Beide sind idempotent (`IF NOT EXISTS`), Re-Apply ist gefahrlos.

Sanity-Check nach Apply:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tickets'
  AND column_name IN ('eingetragen_von_verwalter', 'eingetragen_via', 'voice_call_recording_url', 'voice_call_transcript');
-- erwartet: 4 Zeilen
```

## 2. Vapi-Account (~5 Min)

1. `vapi.ai` → "Sign up"
2. Stripe-Card hinterlegen (Free-Tier reicht für PoC, Credits ~5 USD)
3. EU-Region wählen (DSGVO + Latenz)
4. API-Key kopieren — kommt in Schritt 6 in Netlify

## 3. Twilio-Account (~10 Min, optional)

1. `twilio.com` → "Sign up"
2. DE-Nummer kaufen (ca. 1 €/Mon Setup + 0,05 €/Min)
3. `Account SID` + `Auth Token` aus Console kopieren
4. Nummer im E.164-Format notieren (z.B. `+49301234567`)

Ohne Twilio läuft der Backend-Code trotzdem — nur die SMS-Bestätigung fällt aus.

## 4. Twilio-Nummer in Vapi importieren (~2 Min)

Vapi-Dashboard → Phone Numbers → Add → "Twilio" → SID + Token + Number eingeben.

## 5. Vapi-Assistant konfigurieren (~5 Min)

Vapi-Dashboard → Assistants → Create:

- **Name:** Reparo-DE
- **Model:** GPT-4o-mini
- **Voice:** ElevenLabs „Antoni" oder Vapi default deutsch
- **STT:** Deepgram Nova-3 deutsch
- **System-Prompt:** kompletter Inhalt aus `vapi-assistant-prompt.md`
- **Structured Outputs:** JSON-Schema aus `vapi-assistant-config.json` einfügen
- **Webhook-URL:** `https://reparo-app.netlify.app/api/voice-call/ingest`
- **Webhook-Secret:** zufällig generieren (`openssl rand -hex 32`) und nirgendwo committen

Webhook-Secret in beide Systeme:
- Vapi-Assistant-Settings → Webhook → Secret-Feld
- Netlify → Environment Variables → `VAPI_WEBHOOK_SECRET`

## 6. Netlify-ENVs setzen

| Variable | Wert | Pflicht? |
|---|---|---|
| `VAPI_WEBHOOK_SECRET` | Hex-String aus Schritt 5 | ✅ Pflicht |
| `TWILIO_ACCOUNT_SID` | aus Schritt 3 | optional |
| `TWILIO_AUTH_TOKEN` | aus Schritt 3 | optional |
| `TWILIO_FROM_NUMBER` | E.164, z.B. +49301234567 | optional |
| `NEXT_PUBLIC_APP_URL` | https://reparo-app.netlify.app | optional |

Nach Setzen: Netlify-Deploy triggert nicht automatisch — `Deploys → Trigger deploy → Clear cache and deploy site`.

## 7. Verwalter-Profil prüfen

Voraussetzung: dein Test-Verwalter hat `profiles.telefon` gesetzt.

```sql
UPDATE public.profiles
SET telefon = '+49170…'  -- deine eigene Handy-Nummer
WHERE email = 'test.verwalter@craftly-test.de';
```

Match-Logik im Backend nimmt die letzten 10 Ziffern, also `+49170…` / `0170…` / `49170…` matchen alle gleich.

## 8. Test-Anruf (~3 Min)

1. Twilio-Nummer aus Schritt 3 anrufen
2. Vapi-Assistant grüßt: „Hi, ich bin Reparo, was ist passiert?"
3. Schaden beschreiben (z.B. „Wasserhahn tropft in Musterstr. 5, Whg. 3B")
4. Assistant fragt durch (Adresse, Gewerk, Dringlichkeit)
5. Assistant bestätigt: „Ich lege das Ticket jetzt an"
6. Anruf endet → Vapi schickt Webhook an Reparo
7. Im Verwalter-Dashboard: neues Ticket mit „📞 telefonisch"-Badge sichtbar
8. SMS an deine Nummer mit Ticket-Link (wenn Twilio konfiguriert)

## 9. Troubleshooting

| Symptom | Ursache | Fix |
|---|---|---|
| 401 Invalid signature | Secret stimmt nicht überein | beide Stellen prüfen, neu deployen |
| 403 Unknown caller | profiles.telefon fehlt oder anders normalisiert | SQL aus Schritt 7 |
| 503 Server not configured | VAPI_WEBHOOK_SECRET fehlt in Netlify | Schritt 6 nachholen |
| 500 column does not exist | Migration nicht angewandt | Schritt 1 |
| Kein SMS empfangen | Twilio-ENV fehlt oder Free-Tier-Limit | Twilio-Console-Logs |

## 10. DSGVO-Hygiene

- Vapi-Settings: Recording-Aufbewahrung auf 90 Tage
- Optional: Cron in Reparo bauen, der `voice_call_recording_url` nach 90 Tagen auf `null` setzt + Vapi-API zum tatsächlichen Löschen anstößt
- Mieter-Daten: Telefon-Nummer + Adresse landen wie beim normalen Wizard im Ticket — kein extra DSGVO-Hinweis nötig
