# Voice-AI PoC — Setup-Paket

> Alles was du brauchst um Voice-AI in ~30 Min live zu bekommen, sobald Vapi-Account existiert.

## Inhalt dieses Ordners

```
voice-ai-poc/
├── README.md                        ← du bist hier
├── SETUP-CHECKLIST.md              ← Schritt-für-Schritt Setup für Lennart
├── vapi-assistant-prompt.md         ← finaler Prompt für Vapi-Assistant
├── vapi-assistant-config.json       ← Konfig-Snapshot (Modell, Voice, Functions)
├── mock-webhook-payload.json        ← Beispiel-Payload wie Vapi senden würde
├── test-webhook.js                  ← Node-Skript zum lokalen Testen
└── api-route-skeleton.ts            ← Code-Skeleton für /api/voice-call/ingest
```

## Reihenfolge (für Lennart nach Urlaub)

1. **Vapi-Account anlegen** (5 Min, vapi.ai)
2. **Twilio-Account + DE-Nummer** (10 Min, twilio.com)
3. **Nummer in Vapi importieren** (2 Min)
4. **Assistant-Prompt aus `vapi-assistant-prompt.md` einfügen** (2 Min)
5. **Webhook-URL auf Reparo zeigen** (1 Min)
6. **Test-Anruf machen** (3 Min)
7. **Cowork-Chat: "Voice-AI live, hier API-Key"** → setze in Netlify-ENVs

## Reihenfolge (für CC während Lennart Urlaub macht)

CC implementiert vorab den Reparo-Backend-Teil:
- `/api/voice-call/ingest`-Route (Skeleton liegt bereit)
- HMAC-Verification
- Ticket-Erstellung via `createTicketByVerwalter` (existiert nach Sprint G)

Mit Mock-Webhook lokal testbar, ohne dass Vapi schon live ist.

## Aufwand

- Lennart nach Urlaub: ~30 Min
- CC vorab (Backend-Integration): ~3-4h
- Cowork (dieser Setup-Ordner): ✅ erledigt

## Bezug zu anderen Specs

- Übergeordnete Konzept-Doc: `../KONZEPT-ki-voice-call-schaden.md`
- Detaillierte Spec: `../SPEC-voice-ai-v1.md`
- Schema-Erweiterung: in `SPEC-voice-ai-v1.md` dokumentiert
