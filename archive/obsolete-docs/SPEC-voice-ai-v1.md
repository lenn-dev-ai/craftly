# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Spec — Voice-AI V1 (Verwalter-Use-Case)

> Detail-Spec für Vapi-PoC. Bereit für CC-Execution sobald Vapi-Account existiert.
> Use-Case: VERWALTER ruft Reparo-Nummer an, beschreibt Schaden, KI erstellt Ticket.
> (Alternative Mieter-Use-Case ist in KONZEPT-ki-voice-call-schaden.md — auf Eis bis Pivot-Entscheidung.)

## Warum Verwalter-Use-Case (statt Mieter)

Per Soft-Pivot-Strategie: Verwalter ist Buyer, Verwalter telefoniert mit Mieter ohnehin, Verwalter würde gerne nicht tippen müssen → Voice-AI ersetzt das Verwalter-Wizard-Eintippen.

**Workflow:**
1. Mieter ruft Verwalter an (klassisch)
2. Verwalter sagt: „Moment, ich schalte unser System dazu" → ruft Reparo-Nummer
3. KI: „Hi, was ist passiert?" → Verwalter beschreibt (oft mit Mieter im Hintergrund)
4. KI fragt strukturiert: Adresse, Gewerk, Dringlichkeit, Fotos verfügbar?
5. KI: „Ticket #4711 ist erstellt, Auktion läuft. SMS-Bestätigung kommt."

## Tech-Stack

- **Voice-Provider:** Vapi (vapi.ai) — gut für deutsch, 700ms Latenz
- **Phone-Number:** Twilio DE Nummer (~5 €/Mon)
- **LLM:** GPT-4o-mini (in Vapi inkludiert)
- **STT:** Deepgram Nova-3 (deutsch)
- **TTS:** ElevenLabs „Antoni" oder Vapi default deutsch
- **Webhook:** POST von Vapi nach Anruf-Ende → `/api/voice-call/ingest` in Reparo-Backend

## Kosten

- Vapi: ~0.15 €/Min (mit unseren Provider-Wahlen)
- Twilio: ~0.05 €/Min inbound
- Ø 3-5 Min/Call → **0.60 – 1.00 € pro Schadenserfassung**
- 100 Calls/Monat = 60-100 € → vom Verwalter via SaaS-Gebühr abgedeckt

## Vapi-Setup-Steps (Lennart-Aufgabe nach Urlaub)

1. Vapi-Account anlegen, Stripe-Card hinterlegen (Free-Tier reicht für PoC)
2. Twilio-Account anlegen, DE-Nummer kaufen (~10 € Setup + 5 €/Mon)
3. Twilio-Nummer in Vapi importieren
4. Cowork bekommt Vapi-API-Key + Webhook-Secret → in Netlify-ENVs als `VAPI_API_KEY` + `VAPI_WEBHOOK_SECRET`

## KI-Prompt (Vapi-Assistant)

```
Du bist Reparo, ein Sprach-Assistent für Hausverwalter.
Du nimmst Schadensmeldungen entgegen, die Verwalter telefonisch von ihren Mietern bekommen.

Deine Aufgabe: in 2-3 Min die wichtigsten Daten erfassen.

Ablauf:
1. Begrüßung: "Hi, ich bin Reparo, was ist passiert?"
2. Wenn Verwalter beschreibt, höre zu und stelle gezielte Nachfragen:
   - Welche Adresse / welche Wohnung?
   - Welches Gewerk? (Wasser, Heizung, Strom, Schloss, anderes)
   - Wie dringend? (Notfall = Wasser läuft jetzt / zeitnah = innerhalb 24h / planbar)
   - Hat der Mieter Fotos die er per SMS schicken könnte?
3. Wiederhole am Ende die wichtigsten Daten zur Bestätigung
4. Schließe ab: "Ich lege das Ticket jetzt an, du bekommst gleich eine SMS mit der Ticket-Nummer."

Wichtig:
- Sprich Deutsch mit Sie (Verwalter ist Geschäftskunde)
- Halte dich kurz, max 1 Frage pro Turn
- Wenn unklar, frage nach (nicht raten)
- Bei Notfall: signalisiere explizit "Ich markiere das als Notfall"

Wenn der Verwalter "abbrechen" oder "stopp" sagt, beende sofort höflich.
```

## Webhook-Schema (Vapi → Reparo)

Vapi schickt nach Anruf-Ende ein JSON-Payload:

```json
{
  "call_id": "call_xxx",
  "duration_seconds": 187,
  "caller_phone": "+49170...",
  "transcript_full": "...",
  "extracted_data": {
    "adresse": "Musterstraße 12, 14055 Berlin, Whg 3B",
    "gewerk": "wasser",
    "beschreibung": "Spülkasten läuft seit gestern",
    "dringlichkeit": "zeitnah",
    "mieter_telefon": "+4930...",
    "fotos_verfuegbar": true
  },
  "recording_url": "https://vapi.ai/recordings/xxx.mp3"
}
```

(Vapi unterstützt strukturierte Datenextraktion direkt im Assistant-Prompt via JSON-Schema)

## Reparo-API-Endpoint

```typescript
// app/api/voice-call/ingest/route.ts
export async function POST(req: Request) {
  // 1. Webhook-Secret prüfen (HMAC)
  const sig = req.headers.get('x-vapi-signature')
  if (!verifyHmac(await req.text(), sig, process.env.VAPI_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 401 })
  }
  
  // 2. Caller-Phone matchen auf Verwalter-Profil
  const verwalter = await supabase
    .from('profiles')
    .select('id')
    .eq('telefon', body.caller_phone)
    .eq('rolle', 'verwalter')
    .single()
  
  if (!verwalter) return new Response('Unknown caller', { status: 403 })
  
  // 3. Ticket anlegen via Sprint-G-API-Endpoint (Code-Reuse)
  const ticket = await createTicketByVerwalter({
    verwalter_id: verwalter.id,
    mieter_telefon: body.extracted_data.mieter_telefon,
    einsatzort_manuell: body.extracted_data.adresse,
    gewerk: body.extracted_data.gewerk,
    beschreibung: body.extracted_data.beschreibung,
    dringlichkeit: body.extracted_data.dringlichkeit,
    voice_call_recording_url: body.recording_url,
    eingetragen_via: 'voice-ai',
  })
  
  // 4. SMS an Verwalter mit Ticket-Nummer + Link
  await twilioSendSms({
    to: body.caller_phone,
    body: `Reparo-Ticket #${ticket.id_kurz} erstellt: ${process.env.APP_URL}/v/${ticket.id}`
  })
  
  return Response.json({ ok: true, ticket_id: ticket.id })
}
```

## Schema-Erweiterungen

```sql
-- Migration: ticket_voice_ai_felder
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS eingetragen_via text 
  CHECK (eingetragen_via IN ('mieter-wizard','verwalter-wizard','voice-ai','admin'));
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS voice_call_recording_url text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS voice_call_transcript text;

-- Index für Voice-AI-Filter im Admin-Dashboard
CREATE INDEX IF NOT EXISTS idx_tickets_eingetragen_via ON public.tickets(eingetragen_via);
```

## DSGVO

- **Anruf-Aufzeichnung:** Vapi-Assistant beginnt mit „Dieses Gespräch wird aufgezeichnet, um Ihre Schadensmeldung sauber zu dokumentieren. Sind Sie einverstanden? Sagen Sie ja oder nein." → bei „nein" → keine Recording, nur Transkript ohne Speicherung
- **Speicherort:** Vapi EU-Region (Frankfurt)
- **Löschfrist:** 90 Tage automatisch (Vapi-Setting + Cron-Job in Reparo)
- **Mieter-Daten:** Telefon-Nummer + Adresse landen im Ticket — wie bei normaler Verwalter-Wizard-Eingabe → keine zusätzliche DSGVO-Pflicht

## PoC-Roadmap (CC ~6h, post-Vapi-Setup)

### Phase V1 — Webhook + Endpoint (2h)
- /api/voice-call/ingest schreiben
- HMAC-Verify
- Test mit Vapi-Test-Webhook

### Phase V2 — Schema + Code-Integration (1h)
- Migration ausführen
- createTicketByVerwalter erweitern um voice-Felder

### Phase V3 — Vapi-Assistant konfigurieren (1h)
- Prompt im Vapi-UI einfügen
- Strukturierte Extraction definieren
- Webhook-URL auf prod-Endpoint setzen

### Phase V4 — Twilio-SMS-Bestätigung (1h)
- Twilio-Account-Token in ENV
- sendSms-Helper schreiben
- Test mit Lennart-Nummer

### Phase V5 — Smoke-Test (1h)
- Lennart ruft Vapi-Nummer → durchspielen
- Ticket erscheint in Verwalter-Dashboard
- SMS angekommen

## Erfolg

- Verwalter mit Mieter am anderen Ohr ruft Reparo an, ist in 3 Min durch
- Demo-WOW-Effekt für Sales-Gespräche
- Skaliert auf Hunderte Verwaltungen ohne mehr Personal

## Bereitschafts-Liste (vor PoC-Start)

- [ ] Vapi-Account (Lennart)
- [ ] Twilio-Account + DE-Nummer (Lennart)
- [ ] Vapi-API-Key in Netlify-ENV (Cowork via MCP, wenn Lennart Key liefert)
- [ ] VAPI_WEBHOOK_SECRET generiert + in beide Systeme (Cowork)
- [ ] Twilio-Token in Netlify-ENV (Cowork via MCP)
- [ ] Sprint-G (Verwalter-Wizard) merged → createTicketByVerwalter-API existiert
