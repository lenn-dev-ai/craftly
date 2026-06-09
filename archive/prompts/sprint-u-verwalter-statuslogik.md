# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint U — Verwalter-Statuslogik vertiefen (4 → 11 Zustände)

> Strategischer Sprint aus B2B-Vertrauens-Roadmap. **Voraussetzung für Sprint T**
> (SLA brauchen feinere Status-Granularität).
>
> Aufwand: ~1 Woche CC. MVP (6 Zustände + Reklamations-Flow) 2-3 Tage.

## Status-Quo

Aktuelle ticket-States: `offen`, `auktion_offen`, `in_bearbeitung`, `abgeschlossen`

(Plus Sub-States für Auktion: `vergeben`, `terminvorschlag_offen`, ...)

**Probleme:**
- Verwalter sehen 100+ Tickets mit Status „auktion_offen" und können nicht filtern
- Kein expliziter Zustand für „Mieter hat reklamiert nach Abnahme"
- KI-Klärungs-Anrufe haben keinen Status („wartet auf Mieter-Antwort")
- Keine Trennung zwischen „Verwalter hat angeschaut" vs. „Verwalter hat noch nicht reagiert"

## Ziel — 11 Zustände

```
gemeldet              → Mieter eingereicht, Verwalter noch nicht angeschaut
geprüft               → Verwalter hat OK gegeben (Plausi-Check)
rückfrage_offen       → Verwalter braucht Info vom Mieter, wartet
ausgeschrieben        → Auktion läuft (alte: auktion_offen)
angebote_da           → Auktion vorbei, Verwalter muss wählen
vergeben              → HW beauftragt, Termin noch nicht fix
termin_bestätigt      → Mieter+HW haben Termin abgestimmt
in_arbeit             → HW vor Ort, Reparatur läuft
abgenommen            → Mieter hat „Reparatur OK" bestätigt
abgerechnet           → Rechnung gestellt, Geld in Bearbeitung
reklamiert            → Mieter beschwert sich nach Abnahme (Sonder-Zustand)
```

## MVP-Scope (2-3 Tage) — minimal viable

Statt 11 → 6 Zustände + 1 Sonder:

```
gemeldet              → (NEU) Mieter eingereicht, Verwalter not seen
geprüft               → ersetzt 'offen' (Verwalter hat OK)
ausgeschrieben        → ersetzt 'auktion_offen'
in_arbeit             → ersetzt 'in_bearbeitung' (umfasst vergeben + termin + ausführung)
abgenommen            → ersetzt 'abgeschlossen' (Mieter hat OK)
reklamiert            → (NEU) Mieter beschwert
```

Vollwertige 11 Zustände in Phase 2 wenn Beta-Daten zeigen welche Differenzierung wirklich gebraucht wird.

## Migrations

```sql
-- Neue Werte zum enum hinzufügen (oder text-column lassen + check-constraint)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (
  status IN (
    'gemeldet', 'geprüft', 'rückfrage_offen', 'ausgeschrieben',
    'angebote_da', 'vergeben', 'termin_bestätigt', 'in_arbeit',
    'abgenommen', 'abgerechnet', 'reklamiert'
  )
);

-- Backward-Compatibility-Update:
UPDATE tickets SET status = 'geprüft' WHERE status = 'offen';
UPDATE tickets SET status = 'ausgeschrieben' WHERE status = 'auktion_offen';
UPDATE tickets SET status = 'in_arbeit' WHERE status = 'in_bearbeitung';
UPDATE tickets SET status = 'abgenommen' WHERE status = 'abgeschlossen';
```

**Neue Reklamations-Tabelle:**
```sql
CREATE TABLE public.ticket_reklamationen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  mieter_id uuid REFERENCES auth.users(id),
  grund text NOT NULL,
  details text,
  fotos text[],
  status text NOT NULL DEFAULT 'offen', -- 'offen', 'in_klaerung', 'geloest', 'abgelehnt'
  created_at timestamptz NOT NULL DEFAULT now(),
  geloest_at timestamptz
);

ALTER TABLE ticket_reklamationen ENABLE ROW LEVEL SECURITY;
-- ... RLS analog tickets
```

## Workflow-Logik

### State-Transitions (state machine)

```typescript
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  gemeldet: ['geprüft', 'rückfrage_offen'],
  geprüft: ['ausgeschrieben', 'rückfrage_offen'],
  rückfrage_offen: ['gemeldet', 'geprüft', 'ausgeschrieben'],
  ausgeschrieben: ['angebote_da'],
  angebote_da: ['vergeben'],
  vergeben: ['termin_bestätigt'],
  termin_bestätigt: ['in_arbeit'],
  in_arbeit: ['abgenommen', 'reklamiert'],
  abgenommen: ['abgerechnet', 'reklamiert'],
  abgerechnet: ['reklamiert'],
  reklamiert: ['abgenommen', 'vergeben'], // zurück zu HW oder erneute Vergabe
};
```

`lib/tickets/transitions.ts` enthält Validierung. API-Route lehnt
invalide Transitions ab.

### Auto-Transitions (Cron)

- `gemeldet` → `geprüft` automatisch nach 48h wenn Verwalter nicht reagiert (Warnung an Verwalter, Status bleibt aber `gemeldet`)
- `in_arbeit` → `abgenommen` automatisch nach 5 Tagen wenn Mieter nicht reagiert (Auto-Akzeptanz)
- `abgenommen` → `abgerechnet` wenn Rechnung eingeht (Webhook von Buchhaltung)

## UI-Änderungen

### Verwalter-Dashboard

Tab-Filter (statt 1 Liste):
```
[Neu (3)] [In Klärung (1)] [Marktplatz (5)] [Aktiv (2)] [Abgeschlossen (40)] [Reklamationen (1)]
```

- Neu = `gemeldet`
- In Klärung = `geprüft + rückfrage_offen`
- Marktplatz = `ausgeschrieben + angebote_da`
- Aktiv = `vergeben + termin_bestätigt + in_arbeit`
- Abgeschlossen = `abgenommen + abgerechnet`
- Reklamationen = `reklamiert`

### Mieter-View

Beim Vorgang sieht der Mieter:
- Nur 5 user-friendly Status:
  1. „Gemeldet — wartet auf Verwaltung"
  2. „In Bearbeitung — Verwaltung kümmert sich"
  3. „Handwerker kommt — Termin XX.XX."
  4. „Erledigt — bitte abnehmen"
  5. „Reklamation läuft"

Mapping intern → extern in `lib/tickets/userStatusLabel.ts`.

### Reklamations-Button

Im Mieter-Vorgang nach „abgenommen": Button „Reparatur war nicht ok" → öffnet Reklamations-Form.

## Tests

- State-Machine: alle erlaubten Transitions grün, alle verbotenen 400
- E2E: Mieter meldet → Verwalter prüft → Auktion → Vergabe → Termin → Arbeit → Abnahme → Reklamation
- Backward-Compat: Bestand-Tickets (n=50 Demo) wurden korrekt auf neue Statuses umgemapped

## Constraints

- Old API-Endpoints (`/api/tickets/[id]/close` etc.) bleiben funktional (umgemapped intern)
- Mieter-Wording wird nicht 1:1 mit Verwalter-Status sein
- Reklamations-Flow NICHT mit Audit-Trail aus Sprint T verheiraten (Sprint U muss eigenständig laufen)

## Commit-Struktur

1. `migration: 6+1 statuses + reklamations-table (Sprint U 1/3)`
2. `feat(tickets): state-machine + auto-transitions (Sprint U 2/3)`
3. `feat(verwalter-dashboard): tab-filter nach status (Sprint U 3/3)`

## Erfolg

- Verwalter sehen klare Tabs statt 100-Tickets-Liste
- Reklamationen haben formellen Workflow (vorher: Email-Chaos)
- Sprint T (SLA) hat saubere State-Basis
