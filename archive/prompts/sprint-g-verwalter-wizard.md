# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint G — Verwalter-Wizard „Neues Ticket selbst erstellen"

> Pre-Pivot-Investition (P2 aus KONZEPT-pivot-mieter-raus-b2b-fokus.md). 
> Verwalter telefoniert mit Mieter, tippt Schaden selbst ein.
> Aufwand: ~3-4h Claude Code. Eigenständig, kein Lennart-Input nötig.

## Ziel

Verwalter hat ein „+ Neues Ticket"-Button im Dashboard. Klick öffnet einen Wizard wie der Mieter-Wizard, aber mit zusätzlichen Anrufer-Daten-Feldern (Mieter-Name, Telefon, Wohnungs-Auswahl wenn mehrere Wohnungen in der Verwaltung).

## Code-Lokationen

- `app/dashboard-verwalter/page.tsx` — Button-Integration
- `app/dashboard-verwalter/neues-ticket/page.tsx` — Neue Route, Wizard
- `app/dashboard-mieter/melden/page.tsx` — Vorlage zum Kopieren
- DB: `public.tickets` (neuen Feld `eingetragen_von_verwalter` boolean), `public.wohnungen`, `public.profiles`

## Spec

### Step 1 — Anrufer-Daten

- Mieter-Name (Pflicht)
- Telefon (optional, vorbefüllt aus profiles wenn Mieter bekannt)
- Wohnung-Auswahl (Dropdown aller Wohnungen der Verwaltung)
- Falls Wohnung nicht in DB: „Adresse manuell eingeben" → Freitext

### Step 2 — Schadens-Beschreibung

- Wie Mieter-Wizard Step 1: Gewerk-Auswahl + Beschreibung
- KI-Klassifikation läuft auf Verwalter-Eingabe (statt Mieter-Eingabe)

### Step 3 — Ort & Dringlichkeit

- Wie Mieter-Wizard Step 2 + 3 kombiniert (Verwalter weiß meist Ort schon aus Wohnungs-Auswahl)

### Step 4 — Foto (optional)

- Verwalter hat in 80% kein Foto vom Schaden (Mieter hat nicht gesendet)
- Skip-Option prominent

### Step 5 — Submit

- Ticket wird angelegt mit `eingetragen_von_verwalter = true`
- Notification an Mieter (E-Mail wenn Adresse bekannt): „Ihre Schadensmeldung wurde aufgenommen"
- Ticket landet im Verwalter-Dashboard in „Neu vergeben"-Spalte

## Implementations-Plan

### Phase G1 — Schema-Erweiterung (XS)

```sql
-- Migration: ticket_eingetragen_von_verwalter
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS eingetragen_von_verwalter boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.tickets.eingetragen_von_verwalter IS 
  'true wenn Verwalter das Ticket telefonisch via Sprint-G-Wizard eingetragen hat';
```

### Phase G2 — Route + Wizard-Skeleton (1h)

- Neue Route `app/dashboard-verwalter/neues-ticket/page.tsx`
- Schritt-Steuerung wie Mieter-Wizard (useState + StepIndicator)
- Layout: Verwalter-Sidebar bleibt

### Phase G3 — Steps 1-5 ausimplementieren (1.5h)

- Step 1: Anrufer-Daten — neuer Code, mit Wohnung-Selector
- Step 2-4: Code aus Mieter-Wizard kopieren + an Verwalter-Kontext anpassen
- Step 5: Submit → POST /api/tickets/create-by-verwalter (neue Route)

### Phase G4 — API-Endpoint (30 min)

- `app/api/tickets/create-by-verwalter/route.ts`
- Auth: nur Verwalter-Role
- Body: { mieter_name, mieter_telefon?, wohnung_id?, einsatzort_manuell?, gewerk, beschreibung, dringlichkeit, fotos[] }
- Insert in tickets mit eingetragen_von_verwalter = true
- Optional: Wenn mieter_telefon vorhanden, Notification-SMS triggern (post-MVP)

### Phase G5 — Dashboard-Integration (30 min)

- `app/dashboard-verwalter/page.tsx`: Prominent „+ Neues Ticket"-Button oben rechts
- Klick → `/dashboard-verwalter/neues-ticket`
- In Ticket-Liste: Badge „📞 telefonisch" wenn `eingetragen_von_verwalter = true`

### Phase G6 — Smoke-Test + Commit

- Lokaler Test: Verwalter-Login → Wizard durch → Ticket erscheint
- Commit: `feat(verwalter): Neues-Ticket-Wizard (Sprint G, P2-Pre-Pivot)`

## Constraints

- Mieter-Wizard NICHT verändern (bleibt parallel funktional)
- Pricing-Engine nicht anfassen
- Bei Verwalter-Eingabe greift gleiche KI-Klassifikation wie bei Mieter
- Wenn Wohnung gewählt → einsatzort_* Felder automatisch aus Wohnung übernehmen

## Erfolg

- Verwalter kann in <2 Minuten ein Ticket telefonisch erfassen
- Demo-tauglich für Sales-Gespräch („So nehmen Sie eine Mieter-Schadensmeldung auf")
- Wenn später Pivot-ja: Mieter-Wizard wird deaktiviert, Verwalter-Wizard bleibt der einzige Eingabe-Pfad

## Erster Schritt

Phase G1 (Migration via Supabase-MCP) + G2 (Route-Skeleton).
