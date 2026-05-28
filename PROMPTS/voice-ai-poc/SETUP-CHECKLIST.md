# Voice-AI Setup-Checkliste für Lennart (nach Urlaub)

> ~30 Min Total für Lennart. Voraussetzung: Sprint G ist live (Verwalter-Wizard
> + createTicketByVerwalter-API existiert), CC hat api-route-skeleton.ts integriert.

## Phase 1 — Vapi-Account (5 Min)

- [ ] vapi.ai aufrufen, mit Google oder Email anmelden
- [ ] Stripe-Card hinzufügen (kein Charge solange unter Free-Tier)
- [ ] Im Dashboard: neuen Assistant „Reparo-Verwalter" anlegen
- [ ] **System-Prompt** aus `vapi-assistant-prompt.md` 1:1 reinkopieren
- [ ] **Model:** `gpt-4o-mini` auswählen
- [ ] **Voice:** ElevenLabs → `Antoni` (DE)
- [ ] **STT:** Deepgram Nova-3 (de)
- [ ] **Max Duration:** 8 Minuten
- [ ] Speichern, API-Key kopieren → in Notiz für später

## Phase 2 — Twilio + DE-Nummer (10 Min)

- [ ] twilio.com → Account anlegen
- [ ] Verify deine eigene Handy-Nummer
- [ ] Phone Numbers → Buy Number → Country: Germany → Local
- [ ] DE-Nummer für ~5 €/Mon kaufen (Setup-Fee ~1 €)
- [ ] Notiere Nummer + Account-SID + Auth-Token

## Phase 3 — Vapi mit Twilio verbinden (2 Min)

- [ ] Vapi Dashboard → Phone Numbers → Import from Twilio
- [ ] Twilio Account-SID + Auth-Token + DE-Nummer eingeben
- [ ] Nummer dem „Reparo-Verwalter"-Assistant zuordnen

## Phase 4 — Webhook-URL setzen (2 Min)

- [ ] Vapi Dashboard → Assistant → Server URL
- [ ] URL: `https://reparo-app.netlify.app/api/voice-call/ingest`
- [ ] Secret generieren (`openssl rand -hex 32`), kopieren
- [ ] In Vapi: das Secret als `secretKey` für Webhook hinterlegen

## Phase 5 — Reparo-ENVs setzen (Cowork macht via MCP, ~1 Min)

Nachdem Lennart die Werte hat, ins Cowork-Chat:
```
Vapi-Setup fertig. Hier sind die ENVs:
- VAPI_API_KEY: <key>
- VAPI_WEBHOOK_SECRET: <secret>
- TWILIO_ACCOUNT_SID: <sid>
- TWILIO_AUTH_TOKEN: <token>
- TWILIO_PHONE_NUMBER: <+49...>
```

Cowork setzt alle 5 via Netlify-MCP als Secret-ENVs für alle Contexts.

## Phase 6 — Smoke-Test (3 Min)

- [ ] Lennart ruft die DE-Nummer von seinem Handy an
- [ ] Spielt das „normal"-Szenario durch (Wasserschaden Musterstr. 12)
- [ ] Verifiziert:
  - Reparo begrüßt + DSGVO-Frage
  - 4-5 Klärungsfragen
  - Abschluss-Zusammenfassung
  - Anruf endet sauber
- [ ] Reparo-Verwalter-Dashboard öffnen → neues Ticket sollte da sein
- [ ] Badge „📞 Voice-AI" am Ticket sichtbar

## Phase 7 — Production-Hardening (optional, ~30 Min)

- [ ] DSGVO: Recording-Retention auf 90 Tage in Vapi setzen
- [ ] Cron-Job in Reparo: alte Recordings nach 90 Tagen löschen
- [ ] Twilio SMS-Bestätigung an Verwalter nach Anruf-Ende
- [ ] Vapi-Recording-Link im Admin-Dashboard zugänglich machen
- [ ] Quality-Metrics-Dashboard (Time-to-Ticket, Vollständigkeit, etc.)

## Troubleshooting

### „Unknown caller"-Fehler im Reparo-Log
→ Verwalter-Profil hat keine Telefonnummer hinterlegt. Lennart muss in
   sein Verwalter-Profil gehen und Nummer im E.164-Format eintragen
   (z.B. `+4915112345678`).

### Vapi sagt nichts / hängt
→ ElevenLabs-Quota erschöpft. Im Vapi-Dashboard checken, ggf. Upgrade.

### Reparo-Webhook gibt 401
→ HMAC-Secret stimmt nicht. ENV `VAPI_WEBHOOK_SECRET` in Netlify gegen
   Vapi-Dashboard-Wert checken.

### Reparo-Webhook gibt 500
→ Logs in Netlify Functions checken. Wahrscheinlich:
   - `createTicketByVerwalter` nicht importiert
   - Migration `eingetragen_via` nicht angewendet
   - Supabase-Client falsch initialisiert

## Lokal testen (für CC)

```bash
# 1. Dev-Server starten
npm run dev

# 2. In zweitem Terminal: Test-Webhook abfeuern
cd PROMPTS/voice-ai-poc
node test-webhook.js

# 3. Mit Notfall-Szenario
node test-webhook.js --scenario notfall

# 4. Mit HMAC-Signatur (production-like)
node test-webhook.js --secret YOUR_SECRET

# 5. Gegen production
node test-webhook.js --url https://reparo-app.netlify.app/api/voice-call/ingest --secret YOUR_SECRET
```

## Kosten-Forecast

Bei 100 Verwalter-Anrufen/Monat, Ø 3 Min:

| Posten | Kosten |
|---|---|
| Vapi (LLM + STT + TTS) | ~45 € |
| Twilio Nummer | 5 € |
| Twilio Inbound-Minuten | ~15 € |
| **Total** | **~65 €/Monat** |

Bei 200 Calls: ~125 €. Bei 500 Calls: ~300 €.

Daher: pro Verwalter-Account-Pauschale (z.B. +10 €/Mon für Voice-AI-Add-on)
deckt locker die Kosten und macht Marge.
