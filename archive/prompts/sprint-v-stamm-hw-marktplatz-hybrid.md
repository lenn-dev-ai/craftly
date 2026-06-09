# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint V — Stamm-HW vs. Marktplatz Hybrid-Flow

> Strategischer Sprint aus B2B-Vertrauens-Roadmap. Adressiert größten
> B2B-Einwand bei Verwaltungen >100 Wohnungen („wir wollen nicht jeden
> Auftrag neu vergeben — wir haben Stamm-HW").
>
> Aufwand: ~1-2 Wochen CC.
>
> Voraussetzung: 2-3 Beta-Verwaltungen, die Stamm-HW haben und das Feature
> bestätigen.

## Konzept

Pro Verwalter / pro Wohnung / pro Gewerk kann ein **Stamm-HW** hinterlegt
werden. Bei neuem Ticket:

```
Neues Ticket gemeldet
  ↓
gewerk = "heizung_sanitaer"
wohnung_id = "abc-123"
  ↓
Suche Stamm-HW:
  1. wohnung-spezifisch (z.B. abc-123 hat eigenen HW für Heizung)
  2. verwalter+gewerk (z.B. „Müller Sanitär für alle Heizung-Tickets")
  3. verwalter-default (z.B. „Standard-HW wenn nichts spezifischer")
  ↓
Wenn Stamm-HW gefunden:
  → 1:1-Anfrage an Stamm-HW („nimmst du den Auftrag?")
  → 24h Frist
  → Annahme: direkt vergeben (kein Marktplatz)
  → Ablehnung oder Frist abgelaufen: Marktplatz-Auktion öffnet
  ↓
Wenn kein Stamm-HW: direkt Marktplatz-Auktion (heute-Verhalten)
```

## Schema

```sql
CREATE TABLE public.stamm_handwerker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verwalter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handwerker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wohnung_id uuid REFERENCES wohnungen(id) ON DELETE CASCADE,  -- NULL = gilt für alle Wohnungen
  gewerk text,  -- NULL = gilt für alle Gewerke
  prio int NOT NULL DEFAULT 100,  -- höher = wichtiger; bei mehreren Matches gewinnt höchste prio
  frist_stunden int NOT NULL DEFAULT 24,
  erstellt_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (verwalter_id, wohnung_id, gewerk, handwerker_id)
);

CREATE INDEX idx_stamm_hw_lookup ON stamm_handwerker(verwalter_id, gewerk, wohnung_id);

-- RLS: Verwalter sieht/managed eigene; HW sieht in welchen Pools er Stamm ist
ALTER TABLE stamm_handwerker ENABLE ROW LEVEL SECURITY;
CREATE POLICY verwalter_eigene_stamm ON stamm_handwerker
  FOR ALL USING (auth.uid() = verwalter_id);
CREATE POLICY hw_sees_eigene_pools ON stamm_handwerker
  FOR SELECT USING (auth.uid() = handwerker_id);
```

**Neue Tabelle für 1:1-Anfragen:**
```sql
CREATE TABLE public.stamm_anfragen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  handwerker_id uuid NOT NULL REFERENCES auth.users(id),
  stamm_eintrag_id uuid REFERENCES stamm_handwerker(id),
  status text NOT NULL DEFAULT 'gesendet',  -- 'gesendet', 'angenommen', 'abgelehnt', 'abgelaufen'
  frist_bis timestamptz NOT NULL,
  preis_vorschlag_cents int,  -- wenn HW annimmt, mit Preis
  ablehn_grund text,
  created_at timestamptz NOT NULL DEFAULT now(),
  entschieden_at timestamptz
);
```

## Workflow

### Phase 1 — Ticket-Routing-Logik (3 Tage)

`lib/tickets/routeToHandwerker.ts`:

```typescript
export async function routeNewTicket(ticketId: string): Promise<{ route: 'stamm' | 'marktplatz'; stammAnfrageId?: string }> {
  const ticket = await getTicket(ticketId);

  // 1. Suche Stamm-HW (am spezifischsten zuerst)
  const stammHW = await supabaseAdmin
    .from('stamm_handwerker')
    .select('*')
    .eq('verwalter_id', ticket.verwalter_id)
    .or(`wohnung_id.eq.${ticket.wohnung_id},wohnung_id.is.null`)
    .or(`gewerk.eq.${ticket.gewerk},gewerk.is.null`)
    .order('prio', { ascending: false })
    .limit(1)
    .single();

  if (!stammHW.data) {
    // Direkt Marktplatz
    await updateTicketStatus(ticketId, 'ausgeschrieben');
    return { route: 'marktplatz' };
  }

  // 2. 1:1-Anfrage erzeugen
  const anfrage = await supabaseAdmin
    .from('stamm_anfragen')
    .insert({
      ticket_id: ticketId,
      handwerker_id: stammHW.data.handwerker_id,
      stamm_eintrag_id: stammHW.data.id,
      frist_bis: new Date(Date.now() + stammHW.data.frist_stunden * 3600_000),
    })
    .select()
    .single();

  await updateTicketStatus(ticketId, 'stamm_anfrage_offen');  // NEU
  await sendEmailToHW(stammHW.data.handwerker_id, ticketId, anfrage.id);

  return { route: 'stamm', stammAnfrageId: anfrage.id };
}
```

### Phase 2 — HW-UI für Stamm-Anfragen (2 Tage)

`/dashboard-handwerker/stamm-anfragen/page.tsx` — neue Route:

```
Stamm-Anfragen
──────────────────────────────────
🟢 Aktive Anfragen (2)
  • Ticket „Heizung kaputt — Wohnung 12A"
    Frist: 14:30 Uhr (4h 23min)
    [Annehmen] [Ablehnen]

  • Ticket „Wasserrohrbruch — Wohnung 7B"
    Frist: morgen 9:00
    [Annehmen] [Ablehnen]
```

Annehmen → Termin-Vorschlag + Preis → Auftrag wird direkt vergeben.
Ablehnen → Grund-Eingabe → Marktplatz öffnet.

### Phase 3 — Verwalter-UI für Stamm-HW-Management (2 Tage)

`/dashboard-verwalter/stamm-handwerker/page.tsx` — neue Route:

```
Stamm-Handwerker
──────────────────────────────────
+ Stamm-HW hinzufügen

Tabelle:
| HW              | Wohnung    | Gewerk    | Prio | Frist | [✏️/🗑️]
|-----------------|------------|-----------|------|-------|--------
| Müller Sanitär  | (alle)     | Heizung   | 100  | 24h   | ...
| Schmidt Elektro | Bürohaus A | Elektro   | 90   | 12h   | ...
| Default GmbH    | (alle)     | (alle)    | 50   | 48h   | ...
```

Plus: bei jedem Ticket-Detail-View Verwalter sieht „Geht an Stamm-HW XYZ
falls online" mit Override-Möglichkeit.

### Phase 4 — Cron für Frist-Ablauf (1 Tag)

`/api/cron/stamm-anfragen-check` (alle 15 Min):
```typescript
// 1. Alle stamm_anfragen mit status='gesendet' UND frist_bis<now
// 2. Status auf 'abgelaufen' setzen
// 3. Ticket auf 'ausgeschrieben' setzen + Marktplatz öffnen
// 4. Email an Verwalter: „Stamm-HW XYZ hat Frist verpasst, Marktplatz aktiv"
```

## Edge-Cases

| Case | Verhalten |
|---|---|
| HW lehnt ab, aber Stamm-HW mit niedrigerer Prio existiert | Versuche nächsten Stamm-HW (max 3 in Serie) |
| Verwalter will Stamm-HW skippen | Override-Button im Ticket-Detail: „Direkt auf Marktplatz" |
| Notfall-Tickets (siehe Sprint X) | KEIN Stamm-HW-Routing — direkt Marktplatz mit kurzem SLA |
| Stamm-HW akzeptiert aber Mieter lehnt Termin ab | Zurück auf 'rückfrage_offen', neuer Termin oder Marktplatz |

## Migrations

1. `stamm_handwerker_table.sql`
2. `stamm_anfragen_table.sql`
3. `tickets_status_stamm_anfrage_offen.sql` (Erweiterung Sprint U)

## Tests

- Routing: Ticket mit Stamm-HW → 1:1-Anfrage, kein Marktplatz
- Routing: Ticket ohne Stamm-HW → direkt Marktplatz
- Frist: HW antwortet nicht in 24h → Marktplatz öffnet automatisch
- Verwalter-Override: Skip-Button → Marktplatz sofort
- Priorität: 2 matching Stamm-HW (wohnung-spezifisch + verwalter-default) → wohnung-spezifischer gewinnt

## Constraints

- Bestehende Marktplatz-Logik bleibt 100% kompatibel
- Stamm-HW ist OPTIONAL — Verwalter ohne Stamm-HW arbeitet wie vorher
- Sprint U muss vorher (oder gleichzeitig) live sein wegen neuem Status

## Commit-Struktur

1. `feat(stamm-hw): tables + routing logic (Sprint V 1/4)`
2. `feat(stamm-hw): HW-UI für Stamm-Anfragen (Sprint V 2/4)`
3. `feat(stamm-hw): Verwalter-UI für Stamm-Management (Sprint V 3/4)`
4. `feat(stamm-hw): cron für frist-ablauf (Sprint V 4/4)`

## Erfolg

- B2B-Verwaltungen mit >100 Wohnungen können Reparo nutzen ohne Stamm-HW-Beziehung
  zu zerstören
- Marktplatz-Modell bleibt für Akquise / Notfälle / Lücken
- Cold-Outreach-Antwort „wir haben schon HW" wird kein Killer mehr
