# Spec — Voice-AI V2 (Outbound zu Mieter für Klärungs-Anrufe)

> Lennart-Bestätigung (25.05.2026): „Anrufe durch ki zur Schadens
> Steuerung sind smart und reduzieren extrem den Aufwand."
> 
> Ersetzt V1 (Inbound für Verwalter) komplett — V1-Backend-Code bleibt
> aber im Repo als Wiederverwendung.
> 
> Status: SPEC ready. Implementation wartet auf Vapi-Account-Setup
> durch Lennart.
> Aufwand: ~6-8h Claude Code nach Vapi-Setup.

## Use-Case

**Trigger:** Mieter meldet Schaden via Wizard. KI klassifiziert. Wenn
Vollständigkeits-Score <80%, ruft System den Mieter zurück für genau die
fehlenden Infos.

**Workflow:**
1. Mieter submitted Wizard (oder Voice-AI-Direkt-Anruf eingehend)
2. KI klassifiziert + berechnet `vollstaendigkeits_score`
3. Wenn Score <80: System legt Job in Vapi-Outbound-Queue
4. Vapi ruft Mieter (Twilio Outbound)
5. KI führt 2-3 Min Klärungs-Gespräch
6. Ticket wird ergänzt + Score neu berechnet
7. Wenn jetzt vollständig: Verwalter bekommt Notification

## Vapi-Setup (anders als V1!)

| Setting | V1 (alt) | V2 (neu) |
|---|---|---|
| Direction | Inbound (Verwalter ruft an) | **Outbound (System ruft Mieter)** |
| Caller | Verwalter | System (Vapi via Twilio) |
| Callee | — | Mieter |
| Trigger | Verwalter wählt Nummer | API-Call wenn Score <80 |
| Twilio-Permission | Inbound-only | **Outbound + Inbound** |
| Anruf-Initiation | Telefon-Wahl | POST zu Vapi-API |

## DSGVO

**Pflicht:** Mieter muss **explizit** dem System-Anruf zustimmen.

**Wo Opt-in einholen:**
- Beim Mieter-Onboarding (einmal): „Reparo darf mich für Klärungs-Anrufe
  zurückrufen" (Checkbox)
- Im Wizard Step „Submit": „Bei Lücken rufen wir Sie zurück — einverstanden?"

**Default:** Opt-out (datensparsamer Ansatz).

**Speicherung:** `profiles.voice_ai_consent boolean` + `voice_ai_consent_datum`

## Trigger-Logik

```typescript
// In Mieter-Wizard nach Submit
const ticket = await createTicket({ ... })
const klassifikation = await classifyTicket(ticket)
const score = calculateCompleteness(klassifikation)

await updateTicket(ticket.id, { vollstaendigkeits_score: score, ki_klassifikation: klassifikation })

if (score < 80 && mieter.voice_ai_consent && mieter.telefon) {
  await enqueueVapiOutbound({
    to: mieter.telefon,
    ticket_id: ticket.id,
    missing_fields: identifyMissingFields(klassifikation),
    max_versuche: 3,
  })
  // Ticket-Status: "klaerung_laeuft"
} else {
  // Direkt an Verwalter
  await notifyVerwalter(ticket.verwalter_id, ticket.id)
}
```

## KI-Prompt (Vapi-Assistant V2)

```
Du bist Reparo, ein telefonischer Sprach-Assistent.
Du rufst Mieter zurück um fehlende Infos zu deren Schadensmeldung zu klären.

BEGRÜSSUNG:
"Hi, hier ist Reparo. Sie haben vor [X] Minuten einen Schaden gemeldet:
[Schaden-Kurzbeschreibung]. Mir fehlen noch 2 wichtige Infos. Haben Sie
1-2 Minuten?"

WENN NEIN/NICHT-JETZT:
"Verstanden. Ich versuche es in 30 Minuten nochmal. Ihre Schadensmeldung
liegt schon bei Ihrer Hausverwaltung, kein Stress."
→ Reschedule via Vapi-API um 30 Min

WENN JA:
Stelle nur die spezifischen fehlenden Fragen. Beispiele:

Wenn `adresse` fehlt:
"In welcher Wohnung ist der Schaden? Straße, Hausnummer, Etage."

Wenn `gewerk` unklar:
"Ist das eher [Wasser-Schaden / Heizungs-Problem / Strom / Schloss-Defekt /
etwas anderes]?"

Wenn `dringlichkeit` unklar:
"Ist das eilig — also läuft was gerade akut — oder kann das die Woche warten?"

Wenn `foto` fehlt aber wichtig:
"Können Sie ein Foto vom Schaden machen und an [reparo@example.de] schicken?
Das hilft dem Handwerker schon vorzubereiten."

ABSCHLUSS:
"Perfekt. Ich update Ihr Ticket. Ihre Verwaltung bekommt das jetzt direkt —
Sie hören in [Y] Stunden zurück, wann der Handwerker kommt."

NIEMALS:
- Mit Verwalter sprechen (Verwalter hat keine Rolle in V2)
- Mehr als 3 Fragen pro Anruf (sonst Mieter überfordert)
- Preise oder HW-Empfehlungen nennen
- Andere Themen (Beschwerden, Versicherung) — verweise auf Verwalter

DATENEXTRAKTION (Webhook-Output):
- antworten: { feld_name: wert } für jede beantwortete Frage
- abbruch_grund: enum (mieter_legt_auf | nicht_erreichbar | technical_error | erfolgreich)
- klaerung_score_neu: 0-100 nach Update
```

## Retry-Logik

- Versuch 1: 5 Min nach Wizard-Submit
- Versuch 2: 30 Min später (wenn V1 nicht erreicht)
- Versuch 3: 2h später
- Nach Versuch 3: SMS mit Wizard-Link „Sie haben einen Anruf von uns
  verpasst — bitte klären Sie selbst über diesen Link"
- Plus: Verwalter-Notification „Mieter X ist nicht erreichbar, bitte
  manuell klären"

## Schema-Erweiterungen

```sql
-- Migration: voice_ai_v2_felder
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS voice_ai_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_ai_consent_datum timestamptz;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS vollstaendigkeits_score int,
  ADD COLUMN IF NOT EXISTS klaerungsanrufe_versuche int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS klaerungsanrufe_status text
    CHECK (klaerungsanrufe_status IN (NULL, 'queued', 'in_progress', 'erfolgreich', 'mieter_nicht_erreichbar', 'mieter_abgelehnt', 'technical_fail'));

CREATE TABLE IF NOT EXISTS public.voice_ai_anrufe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  versuch_nr int NOT NULL,
  vapi_call_id text,
  recording_url text,
  transcript text,
  duration_seconds int,
  klaerung_score_vorher int,
  klaerung_score_nachher int,
  abbruch_grund text,
  antworten jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## Code-Lokationen für Implementation

### Backend (CC, ~4h)

- `app/api/voice-call/outbound/route.ts` — POST endpoint: triggert Vapi-Outbound
- `app/api/voice-call/webhook/route.ts` — Vapi-Callback nach Anruf-Ende
- `lib/voice-ai/queue.ts` — In-DB-Queue oder via Inngest/Trigger
- `lib/voice-ai/score-calculator.ts` — Vollständigkeits-Score-Berechnung
- `lib/voice-ai/vapi-client.ts` — Vapi-API-Wrapper
- `lib/sms/twilio-outbound.ts` — Twilio-Outbound-Caller

### Frontend (CC, ~2h)

- `app/dashboard-mieter/profil/page.tsx` — Voice-AI-Consent-Checkbox
- `app/dashboard-mieter/melden/page.tsx` — Submit zeigt „Wir rufen Sie ggf. zurück" Info
- `app/dashboard-mieter/ticket/[id]/page.tsx` — Status „Klärungs-Anruf läuft" sichtbar
- `app/dashboard-verwalter/ticket/[id]/page.tsx` — Marker „via Voice-AI ergänzt"

### Vapi-Setup (Lennart, ~30 min)

- Vapi-Account anlegen (vapi.ai)
- Twilio-Account + DE-Nummer + Outbound-Permission
- Assistant „Reparo-Mieter-Klärung" mit Prompt aus diesem Spec
- Webhook-URL: `https://reparo-app.netlify.app/api/voice-call/webhook`
- API-Key + Secret an Cowork → ENV via Netlify-MCP setzen

## Test-Szenarien

### Szenario 1 — Normaler Klärungs-Anruf (Erfolg)
- Mieter meldet „Wasser läuft", fehlt Adresse + Dringlichkeit
- System ruft an, Mieter antwortet, Score 95 → an Verwalter

### Szenario 2 — Mieter nicht erreichbar
- Mieter geht nicht ran, 3 Versuche, dann SMS + Verwalter-Notification

### Szenario 3 — Mieter lehnt ab
- Mieter sagt „nicht jetzt" → reschedule
- Mieter sagt „lassen Sie das" → Ticket geht direkt an Verwalter mit Marker

### Szenario 4 — Technical-Fail
- Vapi-API down → Fallback: Ticket geht direkt an Verwalter mit Hinweis
  „Voice-AI-Klärung temporär nicht verfügbar"

## Erwartete Quality-Metrics

- **Klärungs-Anruf-Erfolgs-Rate:** ≥70% (Mieter erreichbar UND bereit)
- **Ø Anruf-Dauer:** <3 Min
- **Score-Anstieg pro erfolgreichem Anruf:** ≥20 Punkte
- **Mieter-Zufriedenheit:** „Anruf war OK/nützlich" ≥80%

## Reihenfolge nach Urlaub

1. Lennart bestätigt Spec
2. Lennart legt Vapi + Twilio an (30 Min)
3. Cowork setzt ENVs via MCP (RESEND_API_KEY-Style)
4. CC baut Backend + Frontend (6-8h)
5. Smoke-Test mit demo-mieter-1 (Lennart als Tester)
6. Production-Rollout

## Verbindung zu anderen Sprints

- **Sprint AA (Hotfix Vergabe)** — muss zuerst grün sein (sonst kann
  Verwalter eh nicht vergeben)
- **Sprint AD (G-UI verstecken)** — Mieter-First-UI muss sichtbar sein
  bevor Voice-AI V2 sinnvoll ist
- **Sprint Voice-AI V1** — Backend-Code bleibt, eventuell refactor zu
  shared Code für V1+V2
- **Sales-Material-Update (R Phase 24)** — neue 3-Step-Story basiert
  auf V2-Verhalten

## Status

SPEC READY. Wartet auf Lennart-Vapi-Setup nach Urlaub.
