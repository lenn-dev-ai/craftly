# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint W — Eigentümer-Reporting (WEG-Verwaltung)

> Strategischer Sprint aus B2B-Vertrauens-Roadmap. Adressiert WEG-Verwaltung
> (Wohnungseigentümer-Gemeinschaften), die Quartals-/Jahres-Reports an
> Eigentümer schicken müssen (Wirtschaftsplan-Pflicht).
>
> Aufwand: ~1 Woche CC. Strategisch **kritisch** für WEG-Markt, **niedrig**
> für reine Miet-Verwaltung.
>
> Voraussetzung: ≥1 WEG-Beta-Kunde der Reports konkret braucht. Sonst falsche
> Features.

## Konzept

PDF-Reports pro Objekt / Eigentümer / Zeitraum mit:
- Übersicht aller Schäden + Aufträge
- Kosten pro Eigentümer (Aufteilung nach MEA = Miteigentumsanteilen)
- SLA-Erfüllung (Vergabe-Zeit, Reparatur-Dauer)
- Audit-Trail-Auszug (Sprint T)
- Export als PDF mit Verwalter-Briefkopf

## Schema-Erweiterungen

```sql
-- Eigentümer pro Wohnung
CREATE TABLE public.eigentuemer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verwalter_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  anschrift text,
  email text,
  telefon text,
  bank_iban text,  -- optional, nur wenn auto-Abrechnung gewünscht
  erstellt_at timestamptz NOT NULL DEFAULT now()
);

-- Miteigentumsanteile (MEA) pro Wohnung
ALTER TABLE wohnungen ADD COLUMN eigentuemer_id uuid REFERENCES eigentuemer(id);
ALTER TABLE wohnungen ADD COLUMN mea_promille int;  -- z.B. 47 = 4.7% Anteil

-- Reporting-Config pro Verwaltung
CREATE TABLE public.reporting_config (
  verwalter_id uuid PRIMARY KEY REFERENCES auth.users(id),
  briefkopf_logo_url text,
  briefkopf_html text,        -- HTML-Snippet für Header
  unterschrift_url text,
  default_zeitraum text DEFAULT 'quartal',  -- 'monat', 'quartal', 'jahr'
  auto_versand boolean DEFAULT false,        -- nach Quartal-Ende auto an Eigentümer
  versand_email_template text
);

-- Generierte Reports archivieren
CREATE TABLE public.reports_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verwalter_id uuid NOT NULL REFERENCES auth.users(id),
  eigentuemer_id uuid REFERENCES eigentuemer(id),
  objekt_id uuid,
  zeitraum_start date NOT NULL,
  zeitraum_ende date NOT NULL,
  pdf_storage_path text NOT NULL,  -- Pfad in Supabase Storage
  erzeugt_at timestamptz NOT NULL DEFAULT now(),
  versendet_at timestamptz,
  versendet_an_email text
);
```

## Report-Bauplan

Ein PDF-Report enthält:

```
[Briefkopf mit Verwalter-Logo + Anschrift]

Eigentümer-Report
Zeitraum: Q2/2026 (01.04.2026 – 30.06.2026)

Eigentümer: Frau Müller (Wohnung 7B + 12A, MEA 9.4%)
Objekt: Hauptstraße 12, 10115 Berlin

────────────────────────────────────────
Zusammenfassung
────────────────────────────────────────
• 3 Schäden im Zeitraum
• 2 Reparaturen abgeschlossen, 1 läuft
• Gesamtkosten Ihres Anteils: 184,50 €
• Durchschnittliche Reparaturzeit: 2.1 Tage
• Alle SLA-Ziele eingehalten ✓

────────────────────────────────────────
Detail-Liste
────────────────────────────────────────
Schaden #1: Heizung defekt (Wohnung 7B)
  Gemeldet: 03.04.2026
  Vergeben: 03.04.2026, 14:23 (SLA: 4h ✓ — innerhalb 9h)
  HW: Müller Sanitär GmbH
  Repariert: 04.04.2026, 11:00
  Kosten brutto: 480 €
  Ihr Anteil (9.4%): 45,12 €

[... weitere Schäden ...]

────────────────────────────────────────
SLA-Erfüllung im Zeitraum
────────────────────────────────────────
Vergabe-Zeit < 24h:  100% ✓ (Ziel: 95%)
Reparatur < 5 Tage:  100% ✓ (Ziel: 90%)
Uptime Plattform:    99.95% ✓ (Ziel: 99.9%)

────────────────────────────────────────
Audit-Trail (Auszug, nur entscheidende Events)
────────────────────────────────────────
03.04. 09:15  Mieter A. Schulz hat Schaden gemeldet (Heizung)
03.04. 09:30  Verwalter J. Bach hat geprüft + freigegeben
03.04. 09:45  Auktion gestartet (Marktplatz, Notfall-Flag)
03.04. 13:10  3 Angebote eingegangen
03.04. 13:55  Verwalter hat Müller Sanitär (480 €) gewählt
03.04. 14:23  Auftrag bestätigt — HW Müller Sanitär
04.04. 11:00  HW hat Erledigung gemeldet
04.04. 18:30  Mieter hat Reparatur abgenommen

[... bei größeren Aufträgen: Freigabe-Trail (Sprint T) ...]

────────────────────────────────────────
Mit freundlichen Grüßen
[Unterschrift-Bild]
J. Bach
Bach Hausverwaltung GmbH

Reparo Plattform-Hinweis: Diese Auswertung wurde automatisch generiert.
Originalbelege liegen Ihrer Hausverwaltung vor.
```

## Implementation

### Phase 1 — Report-Generation-Engine (3 Tage)

Bibliothek: `@react-pdf/renderer` oder `pdfkit` (Cowork-Empfehlung: react-pdf weil
JSX-basiert und einfacher zu testen).

`lib/reporting/generateReport.ts`:

```typescript
export async function generateEigentuemerReport(opts: {
  verwalterId: string;
  eigentuemerId: string;
  zeitraumStart: Date;
  zeitraumEnde: Date;
}): Promise<Buffer> {
  const eigentuemer = await getEigentuemer(opts.eigentuemerId);
  const wohnungen = await getWohnungenForEigentuemer(opts.eigentuemerId);
  const tickets = await getTicketsForWohnungen(wohnungen, opts.zeitraumStart, opts.zeitraumEnde);
  const audit = await getAuditEventsForTickets(tickets);
  const sla = await calculateSLA(tickets);
  const config = await getReportingConfig(opts.verwalterId);

  // Render React-PDF document
  const buffer = await renderToBuffer(
    <ReportDocument
      eigentuemer={eigentuemer}
      wohnungen={wohnungen}
      tickets={tickets}
      audit={audit}
      sla={sla}
      config={config}
    />
  );

  // Archivieren in Storage
  const path = `reports/${opts.verwalterId}/${opts.eigentuemerId}/${opts.zeitraumStart.toISOString()}.pdf`;
  await supabaseAdmin.storage.from('reports').upload(path, buffer);
  await supabaseAdmin.from('reports_archive').insert({
    verwalter_id: opts.verwalterId,
    eigentuemer_id: opts.eigentuemerId,
    zeitraum_start: opts.zeitraumStart,
    zeitraum_ende: opts.zeitraumEnde,
    pdf_storage_path: path,
  });

  return buffer;
}
```

### Phase 2 — UI für Verwalter (1 Tag)

`/dashboard-verwalter/eigentuemer/page.tsx`:

```
Eigentümer-Verwaltung
─────────────────────────────────
+ Neuen Eigentümer anlegen
+ Wohnung einem Eigentümer zuordnen

Tabelle Eigentümer:
| Name           | Wohnungen | MEA Total | Reports
|----------------|-----------|-----------|---------
| Frau Müller    | 7B + 12A  | 9.4%      | [📄 Q2/26] [📄 Q1/26]
| Herr Schmidt   | 3A        | 4.7%      | [📄 Q2/26]
```

Klick auf Report-Button → PDF-Download oder Email-Versand (mit Vorschau).

`/dashboard-verwalter/reporting/page.tsx`:
- Konfiguration des Briefkopfs (Logo-Upload, Adress-Felder)
- Default-Zeitraum (Monat / Quartal / Jahr)
- Auto-Versand-Toggle

### Phase 3 — Cron für Quartals-Auto-Versand (1 Tag)

`/api/cron/reports-auto-versand` (täglich 6:00):
```typescript
const heute = new Date();
const istQuartalsEnde = [3, 6, 9, 12].includes(heute.getMonth() + 1)
  && heute.getDate() === lastDayOfMonth(heute);

if (!istQuartalsEnde) return;

const verwalterMitAutoVersand = await getVerwalterWithAutoVersand();
for (const v of verwalterMitAutoVersand) {
  for (const e of v.eigentuemer) {
    const pdf = await generateEigentuemerReport({ ... });
    await sendEmailWithAttachment(e.email, pdf, ...);
  }
}
```

### Phase 4 — Tests (1 Tag)

- Unit: SLA-Berechnung mit verschiedenen Edge-Cases (kein Ticket, alle late, alle on-time)
- E2E: Verwalter generiert Report → PDF erscheint, alle Sektionen befüllt
- Visual-Regression: PDF-Snapshot bei Test-Daten vergleichen

## Constraints

- KEIN Eingriff in bestehende Ticket-Logik
- Bei fehlenden MEA-Daten: Report sagt „Anteil nicht zuordnenbar" (kein Crash)
- Audit-Trail aus Sprint T ist optional — wenn Sprint T noch nicht live, Audit-Sektion weggelassen
- DSGVO: Eigentümer-Daten nur in Verwaltungs-RLS-Scope sichtbar

## Commit-Struktur

1. `migration: eigentuemer + mea + reporting tables (Sprint W 1/4)`
2. `feat(reporting): generation engine + react-pdf templates (Sprint W 2/4)`
3. `feat(reporting): verwalter UI für eigentuemer + reports (Sprint W 3/4)`
4. `feat(reporting): cron für quartals-auto-versand (Sprint W 4/4)`

## Erfolg

- WEG-Verwalter-Pilots haben Compliance-relevantes Reporting
- Sales-Argument „erspart manuelle Excel-Reports" greift
- Marketing kann „Eigentümer-Reports automatisiert" als Feature listen
