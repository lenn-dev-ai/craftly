# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint I — Bulk-Wohnungs-Import via Excel/CSV

> Sales-Blocker eliminieren: Verwalter mit 50-500 Wohnungen kann Bestand in 5 Min hochladen.
> Aufwand: ~4h Claude Code. Eigenständig.

## Ziel

Verwalter lädt Excel/CSV mit Wohnungs-Bestand hoch. System validiert, zeigt Vorschau, lässt Verwalter Spalten mappen, importiert. Optional auch Mieter-Stammdaten verknüpfen.

## Code-Lokationen

- `app/dashboard-verwalter/wohnungen/import/page.tsx` — neue Route, Upload + Mapping UI
- `app/api/wohnungen/bulk-import/route.ts` — neuer Endpoint
- DB: `public.wohnungen` (existiert? sonst aus Sprint F übernehmen), `public.profiles`
- Library: `papaparse` (CSV) + `sheetjs` (XLSX) — beide schon in Repo (Artifact-Libs)

## Spec

### Schritt 1 — Upload

- Drag-Drop oder File-Picker
- Accept: `.csv, .xlsx`
- Max 10 MB
- Direkt nach Upload: Parse + zeige Tabelle mit ersten 10 Zeilen

### Schritt 2 — Spalten-Mapping

- System schlägt Mapping vor (auf Spalten-Namen-Match: „Straße"→strasse, „Hausnr"→hausnummer, etc.)
- Verwalter kann Mapping anpassen via Dropdowns pro Spalte
- Pflicht-Felder: strasse, hausnummer, plz, ort, whg_bezeichnung
- Optional: mieter_name, mieter_email, mieter_telefon, baujahr, qm

### Schritt 3 — Validierung

- PLZ: 5-stellige Zahl
- E-Mail: regex
- Duplicate-Check: schon vorhandene Wohnungen (gleiche Adresse+Whg-Bez) markieren als „Update" oder „Skip"
- Zeige Fehler-Zeilen rot, Erfolg-Zeilen grün

### Schritt 4 — Import-Vorschau + Confirm

- Statistik: „X neue Wohnungen, Y Updates, Z übersprungen"
- Verwalter klickt „Import starten"
- Progress-Bar während Insert (batched in 50er-Chunks)

### Schritt 5 — Erfolg

- Toast: „X Wohnungen importiert"
- Redirect zu Wohnungs-Liste

## Implementations-Plan

### Phase I1 — Schema-Check (XS)

- Existiert `public.wohnungen`? (Falls Sprint F sie angelegt hat, prüfen)
- Falls nein: Migration
```sql
CREATE TABLE IF NOT EXISTS public.wohnungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verwalter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  strasse text NOT NULL,
  hausnummer text NOT NULL,
  plz text NOT NULL,
  ort text NOT NULL,
  whg_bezeichnung text NOT NULL,
  mieter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  baujahr int,
  qm numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (verwalter_id, strasse, hausnummer, whg_bezeichnung)
);
ALTER TABLE public.wohnungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY wohnungen_verwalter_all ON public.wohnungen
  FOR ALL TO authenticated
  USING (verwalter_id = auth.uid())
  WITH CHECK (verwalter_id = auth.uid());
```

### Phase I2 — Upload + Parse-UI (1h)

- Neue Route `app/dashboard-verwalter/wohnungen/import/page.tsx`
- File-Input, on-change: papaparse oder sheetjs je nach Extension
- Tabelle mit ersten 10 Zeilen

### Phase I3 — Mapping-UI (1h)

- Dropdown pro erkannte Spalte: zuordnen zu DB-Feld oder „Ignorieren"
- Auto-Match auf Spalten-Namen
- Validation: alle Pflicht-Felder gemappt?

### Phase I4 — Validierung + Vorschau (45 min)

- Client-side Validierung pro Zeile
- Rot/Grün-Markierung
- Statistik berechnen

### Phase I5 — API-Endpoint (45 min)

```typescript
// app/api/wohnungen/bulk-import/route.ts
// Auth: nur Verwalter
// Body: { wohnungen: [...], strategy: 'upsert' | 'insert_only' }
// Insert in 50er-Batches via supabase.from('wohnungen').upsert(...)
// Response: { inserted, updated, skipped, errors }
```

### Phase I6 — Progress + Erfolg (30 min)

- Progress-Bar während Insert
- Toast bei Success
- Error-Handling: Teil-Imports erlauben (Verwalter kann fehlerhafte Zeilen später fixen)

### Phase I7 — Commit

`feat(verwalter): Bulk-Wohnungs-Import via Excel/CSV (Sprint I)`

## Constraints

- Max 5000 Wohnungen pro Upload (höher → eigene Async-Job-Lösung)
- RLS sicherstellen: Verwalter sieht nur eigene Wohnungen
- DSGVO: Mieter-Daten nur mit explizitem Verwalter-Consent („Ich versichere, dass die Mieter informiert wurden")

## Erfolg

- Verwalter mit 200 Wohnungen ist in 5 Min onboarded
- Sales-Demo: „Schicken Sie mir Ihre Excel, ich zeig Ihnen den Import live"

## Erster Schritt

Phase I1: Schema-Check via Supabase-MCP. Wenn Sprint F die Tabelle anders aufgebaut hat, anpassen.
