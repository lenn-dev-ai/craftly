# Voice-AI PoC — Setup-Paket

Alles was Lennart braucht, um Voice-AI in ~30 Min live zu bekommen, sobald der Vapi-Account existiert.

## Inhalt dieses Ordners

```
voice-ai-poc/
├── README.md                     ← du bist hier
├── SETUP-CHECKLIST.md            ← Schritt-für-Schritt Setup für Lennart
├── vapi-assistant-prompt.md      ← finaler Prompt für Vapi-Assistant
├── vapi-assistant-config.json    ← Konfig-Snapshot (Modell, Voice, Functions)
├── mock-webhook-payload.json     ← Beispiel-Payload wie Vapi senden würde
├── test-webhook.js               ← Node-Skript zum lokalen Testen
└── api-route-skeleton.ts         ← Code-Skeleton der bereits live ist
```

## Status (Stand 23.05.2026, Tag 3 der Urlaubs-Session)

**Backend ist bereits gebaut** (`app/api/voice-call/ingest/route.ts`):

- HMAC-Signatur-Verifikation gegen `VAPI_WEBHOOK_SECRET`
- Caller-Phone → Verwalter-Match (über `profiles.telefon`, suffix-basiert)
- Ticket-Insert mit `eingetragen_via='voice-ai'` + Recording-URL + Transkript
- SMS-Bestätigung via Twilio (Skeleton — fällt auf no-op zurück wenn ENV fehlt)

**Backend nutzt diese ENVs:**

```
VAPI_WEBHOOK_SECRET       (Pflicht — sonst 503)
SUPABASE_SERVICE_ROLE_KEY (existiert schon)
TWILIO_ACCOUNT_SID        (optional — SMS sendet sonst nicht)
TWILIO_AUTH_TOKEN         (optional)
TWILIO_FROM_NUMBER        (optional)
NEXT_PUBLIC_APP_URL       (optional — sonst reparo-app.netlify.app)
```

**Migrations vorbereitet** in `supabase/migrations/`:

- `20260605000050_ticket_eingetragen_von_verwalter.sql` (Sprint G — wird vom Voice-Ticket gebraucht)
- `20260605000070_voice_ai_felder.sql` (neue Spalten: eingetragen_via, voice_call_recording_url, voice_call_transcript)

## Reihenfolge (für Lennart nach Urlaub)

1. **Migrations anwenden** (Studio SQL-Editor oder Cowork-MCP):
   - `…000050` (Sprint G)
   - `…000070` (Voice-AI-Felder)
2. **Vapi-Account anlegen** (5 Min, vapi.ai)
3. **Twilio-Account + DE-Nummer** (10 Min, twilio.com) — optional aber empfohlen
4. **Nummer in Vapi importieren** (2 Min)
5. **Assistant-Prompt aus `vapi-assistant-prompt.md`** in Vapi-UI einfügen (2 Min)
6. **Webhook-URL** auf `https://reparo-app.netlify.app/api/voice-call/ingest` (1 Min)
7. **`VAPI_WEBHOOK_SECRET`** generieren (`openssl rand -hex 32`), in Netlify-ENV + Vapi-Settings (2 Min)
8. **Verwalter-Profil**: `profiles.telefon` muss gesetzt sein für Lennarts Test-Verwalter
9. **Test-Anruf** machen (3 Min)

Genaue Klick-Anleitung in `SETUP-CHECKLIST.md`.

## Lokaler Smoke-Test (während Lennart Urlaub macht)

```bash
# 1. Server lokal hochfahren mit Webhook-Secret
VAPI_WEBHOOK_SECRET=local-test-secret npm run dev

# 2. Mock-Webhook senden
node voice-ai-poc/test-webhook.js

# 3. Im Verwalter-Dashboard erscheint das Test-Ticket
```

## Was noch fehlt (post-Vapi-Setup)

- Vapi-Function-Schema (statt freier extracted_data-Felder) für robustere Strukturierung
- DSGVO-Cron für 90-Tage-Recording-Löschung (Cron + `DELETE`-Helper auf Vapi-API)
- Multi-Tenant: aktuell matched die Caller-Phone auf `profiles.telefon` — bei Verwaltern mit mehreren Mitarbeitern (Sprint-G-Pivot) braucht das mehr Logik

## Bezug zu anderen Specs

- Übergeordnete Konzept-Doc: `../KONZEPT-ki-voice-call-schaden.md`
- Detaillierte Spec: `../SPEC-voice-ai-v1.md`
- Sprint-G-Vorarbeit: `../PROMPTS/sprint-g-verwalter-wizard.md`
