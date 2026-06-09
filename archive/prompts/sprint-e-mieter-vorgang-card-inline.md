# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint E — Mieter-Vorgang-Card: HW + Termin inline anzeigen

> Lennart-Feedback `ee101390` aus Iteration 7: „Auf der Uebersichts-Seite waere es schoen wenn man bei einem offenen Vorgang direkt sehen koennte wer der zugewiesene Handwerker ist und wann er kommt. Aktuell muss ich erst draufklicken um das zu sehen. Lieber inline statt extra Klick."
> Aufwand S–M (~45 Min).
> Cowork hat in der autonomen Nacht-Session eine Konzept-Entscheidung getroffen (Lennart hatte „needdecision" markiert, aber jetzt mit Vollmacht entscheide ich pragmatisch).

## Cowork-Entscheidung (pragmatisch)

**Inline-Anzeige IMMER, sobald ein HW zugewiesen ist** (also ab Status „in_bearbeitung" / nachdem Slot bestätigt).
- Status „gemeldet" / „auktion" / „diagnose": kein HW da → kein Inline-Block, stattdessen Hinweis „Wird vergeben…"
- Status „in_bearbeitung" / „bestätigt-termin" → **HW-Name + Termin-Zeit inline auf der Card**
- Status „erledigt" → „Erledigt am X.X. von HW-Name" inline

Begründung: User-Mental-Model „mein offener Vorgang" = „wer kommt wann". Wenn vorhanden anzeigen, sonst transparent als „in Vergabe".

## Code-Lokation

`app/dashboard-mieter/page.tsx` — Mieter-Übersichts-Komponente. Aktuell zeigt sie pro Vorgang eine Card mit Titel, Status, Datum. Inline-Block soll dazu kommen.

Plus: `components/MieterVorgangCard.tsx` falls separat (wenn nicht, neue Komponente erzeugen).

## Implementations-Plan

### Phase E1: Daten holen

Aktueller Mieter-Page-Query holt Tickets via `select('*')` (vermutlich). Erweitern um:
```ts
.select(`
  *,
  zugewiesener_hw_profile:profiles!tickets_zugewiesener_hw_fkey ( name, firma ),
  termin:termine!termine_ticket_id_fkey ( datum, von, bis, status )
`)
.eq('erstellt_von', userId)
.order('created_at', { ascending: false })
```

Achtung: `termin` ist 1:N (mehrere Termine pro Ticket, davon manche „vorgeschlagen", einer „bestätigt"). Frontend muss den `bestaetigt`-Termin rausfiltern.

Wenn FK auf zugewiesener_hw → profiles nicht existiert: muss erst angelegt werden (Cowork-Migration nötig — siehe Constraint unten).

### Phase E2: Card-Erweiterung

In der Vorgang-Card unter dem Titel/Status einen neuen Block:

```tsx
{status === "in_bearbeitung" && termin?.bestaetigt && hw && (
  <div className="mt-2 flex items-center gap-2 text-sm text-ink-secondary">
    <UserIcon size={14} />
    {hw.firma || hw.name}
    <span>·</span>
    <CalendarIcon size={14} />
    {formatDatum(termin.datum)} · {termin.von}–{termin.bis} Uhr
  </div>
)}
```

Plus: bei Status `auktion`/`gemeldet`: dezente Zeile „Wird vergeben…" mit Spinner-Animation.

### Phase E3: Mobile-Check

- Auf 390px Mobile darf die Inline-Zeile nicht umbrechen oder wenn dann sauber
- Eventuell HW-Name + Termin auf 2 Zeilen wenn zu lang

## Schema-Check (vorher mit Cowork klären)

Wenn `tickets_zugewiesener_hw_fkey` FK nicht existiert, ist der PostgREST-Embed nicht möglich. Vermutung: existiert bereits. Wenn nicht, Cowork legt ihn an (Migration, idempotent, niedriges Risiko).

Cowork hat in autonomer Session noch nicht geprüft — Claude Code bitte:
1. Prüfen ob `tickets.zugewiesener_hw` einen FK auf `profiles.id` hat
2. Falls nicht: Cowork ping → Migration

## Constraints

- Mobile-First
- Pricing nicht anfassen
- Pro Phase max. 1 Frage
- Falls FK-Migration nötig: Cowork (Lennart-Approval via Chat)

## Erster Schritt

Phase E1: Mieter-Page öffnen, aktuellen Select-Query lesen. Diff vorzeigen für E1-Erweiterung. Wenn FK fehlt: Cowork-Ping.
