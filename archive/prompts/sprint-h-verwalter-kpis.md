# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint H — Verwalter-Dashboard-KPIs

> Stats-Cards für Verwalter-Dashboard. Sales-relevant: zeigt sofort den Wert.
> Aufwand: ~3h Claude Code. Eigenständig.

## Ziel

Verwalter-Dashboard zeigt prominent oben 4-5 KPI-Karten mit Live-Daten. Plus eine Throughput-Trend-Grafik (letzte 4 Wochen).

## Code-Lokationen

- `app/dashboard-verwalter/page.tsx` — KPI-Karten-Sektion
- `app/api/verwalter/kpis/route.ts` — neue API-Route (server-side query)
- DB: `public.tickets`, `public.angebote`, `public.handwerker_bewertungen`

## Spec

### KPI-Karten (oben im Dashboard, Grid 2x2 mobile / 4x1 desktop)

1. **Offene Tickets** — Anzahl tickets mit status IN (`neu`, `auktion`, `vergeben`, `in_arbeit`)
2. **Diese Woche neu** — count tickets mit `created_at >= start_of_week()`
3. **Vergeben diese Woche** — count tickets mit `status_changed_at['vergeben'] >= start_of_week()`
4. **Ø Vergabe-Zeit** — average (neu → vergeben) der letzten 30 Tage, in Stunden

### Throughput-Chart (unter den KPIs)

- Bar-Chart letzte 4 Wochen (oder 8 Wochen)
- Pro Woche: Anzahl neu + Anzahl abgeschlossen
- Recharts-Library (schon im Repo)

### Top-Handwerker (rechts neben Chart, optional)

- Liste Top 3 HW nach abgeschlossenen Aufträgen letzte 30 Tage
- Mit Sterne-Rating-Schnitt

## Implementations-Plan

### Phase H1 — API-Endpoint (1h)

```typescript
// app/api/verwalter/kpis/route.ts
// Auth: nur Verwalter
// Query 4 KPIs + 4-Wochen-Throughput parallel via Promise.all
// Response: { offene_tickets, neu_diese_woche, vergeben_diese_woche, avg_vergabe_zeit_h, throughput_4w: [{woche, neu, abgeschlossen}], top_hw: [{name, count, rating}] }
```

### Phase H2 — KPI-Karten-Komponente (1h)

- Komponente `components/verwalter/KpiCard.tsx`
- Props: `title, value, trend?, icon?, color?`
- 4 Karten im Grid

### Phase H3 — Throughput-Chart (45 min)

- Komponente `components/verwalter/ThroughputChart.tsx`
- Recharts BarChart, 2 Bars pro Woche (neu/abgeschlossen)
- Responsive, mobile-first

### Phase H4 — Dashboard-Integration (15 min)

- `app/dashboard-verwalter/page.tsx`: KPI-Karten oben einbauen, Chart darunter
- Loading-State: Skeleton-Cards
- Error-State: Inline-Fehler-Box, retry-Button

### Phase H5 — Commit

`feat(verwalter): KPI-Karten + Throughput-Chart im Dashboard (Sprint H)`

## Constraints

- Performance: KPI-Query <500ms (Indexe prüfen, ggf. ergänzen)
- Mobile: Karten vertikal stapeln auf <640px
- Chart skaliert auf Container-Width
- Kein Pricing-Engine-Touch

## Erfolg

- Verwalter sieht beim Login sofort Status seiner Vergabe-Pipeline
- Sales-Demo: „Sehen Sie? Im Februar haben wir Ihren Schnitt von 18h auf 6h gedrückt"

## Erster Schritt

Phase H1 (API-Endpoint mit Mock-Daten lokal testen).
