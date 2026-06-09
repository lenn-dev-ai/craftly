# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint UX + B — 5 kleine UX-Items + Auktions-Cap, dann Slot+Verfügbarkeit-Merge

> 21.05.2026, von Cowork-Loop Iteration 11 zusammengestellt. Lennart-Approval für alle Items vorhanden.
> Phase 1 zuerst (~45 Min), dann Phase 2 (Sprint B, ~1-2h).

## Phase 1 — UX-Polishing + Auktions-Dauer-Cap (~45 Min)

Alle Items aus Lennarts Test-Session (Feedbacks 21.05). Reihenfolge egal, alle voneinander unabhängig.

### Item 1: M1-Wiederholung — Header beim Scrollen auf Mieter-Ticket-Detail (Feedback `0baa2d87`)

**Beobachtung:** „Wenn man nach ganz oben scrollt ist oben links in der Ecke das Zurück hinter den 3 Balken für den Auswahl-Baum verschwunden."

Das ist die M1-Klasse wieder, diesmal auf Mieter-Ticket-Detail-View (vorher war es Mieter-Wizard). Hamburger ☰ überlagert „← Zurück".

**Code-Lokation:** Mieter-Layout oder Ticket-Detail-Header (`app/dashboard-mieter/ticket/[id]/page.tsx` oder Layout-Komponente).

**Fix-Pattern (wie M1.1, Commit 8cfabf4):**
- Header-Container braucht `pl-14 pr-6 md:px-6` damit Hamburger Platz hat
- Plus: Zurück-Button sollte `ml-12 md:ml-0` haben

**Commit:** `fix(mieter-ticket): Header-Scroll-Layout Zurück hinter Hamburger (M6, M1-Wiederholung)`

### Item 2: Mieter-Ticket Auktions-Sicht — KI-Block verschoben (`0c6d8aae`)

**Beobachtung:** „Bei Auktion ist das AI links ziemlich verschoben"

KI-Vorschlag-Block ist linksbündig statt zentriert. Container-Fix.

**Code-Lokation:** Mieter-Ticket-Detail bei Status=auktion, Sektion „KI-Einschätzung".

**Fix:** Container-Klasse — `mx-auto` ergänzen oder `max-w-2xl` mit `mx-auto`. Mobile-Width-Check.

**Commit:** `fix(mieter-ticket): KI-Block zentriert in Auktions-Sicht`

### Item 3: Preisspanne nur bei echter Spanne (`18437be9`)

**Beobachtung:** „Bei einer Preisspanne von 107-107 brauchen wir keine Spanne, das ist ein Preis"

Display-Logik: Wenn `preis_min === preis_max` zeige nur einen Wert, sonst Spanne.

**Code-Lokation:** Suche nach `preis_min`+`preis_max` Anzeige in Mieter-Ticket oder shared Komponente.

**Fix:**
```tsx
{preis_min === preis_max
  ? `${preis_min} €`
  : `${preis_min}–${preis_max} €`}
```

**Commit:** `fix(preis): zeige Spanne nur bei min≠max`

### Item 4: HW-Zeitslots „h" eine Zeile zu tief (`24cd28cb`)

**Beobachtung:** „Das h bei der Preis Kalkulation ist immer noch eine Zeile zu tief"

CSS-Vertical-Align in der Preis-Suffix-Anzeige (z.B. „75 €/h").

**Code-Lokation:** `app/dashboard-handwerker/zeitslots/page.tsx` — Preis-Anzeige-Komponente.

**Fix:** Vertical-Align prüfen — vermutlich `align-baseline` oder Display-Issue. Inline-Block + line-height.

**Commit:** `fix(hw-zeitslots): h-Suffix vertikal aligned`

### Item 5: HW-Zeitslots Von-Bis-Zeiten überlappen (`2d757d5d`)

**Beobachtung:** „Die von bis Zeiten überlappen"

Time-Picker-Felder berühren sich oder überlappen visuell.

**Code-Lokation:** Selbe Page (`zeitslots/page.tsx`), Von/Bis Time-Picker-Layout.

**Fix:** Flex-Gap oder Margin zwischen den beiden Inputs. `gap-2` oder `gap-3`.

**Commit:** `fix(hw-zeitslots): von-bis-time-picker spacing`

### Item 6: Auktions-Dauer auf max 72h cappen (Konzept-Entscheidung `7326f74f`)

**Beobachtung:** „Die Auktionen sind viel zu lange — sollte doch nicht max 3 Tage gehen?"

**Konzept-Entscheidung Lennart:** Hart auf 72h cappen.

**Code-Lokation:** `lib/auktion-config.ts` oder `AUKTIONS_CONFIGS` Konstante. Suche nach „auktion_ende" oder „auktionsdauer".

**Fix:** Default-Dauer in jeder Dringlichkeits-Stufe auf max 72h begrenzen:
```ts
AUKTIONS_CONFIGS = {
  notfall: { dauerStunden: Math.min(12, X) },
  zeitnah: { dauerStunden: Math.min(48, X) },
  planbar: { dauerStunden: Math.min(72, X) }, // <-- Cap hier
}
```

**Commit:** `feat(auktion): Dauer-Cap auf 72h (Lennart-Entscheidung Iter 11)`

## Phase 2 — Sprint B: Slot + Verfügbarkeit mergen (~1-2h, nach Phase 1)

Bestätigt durch Feedback `25592383`: „Wir haben immer noch zeitslots und Kalender — wollten wir nicht mergen?"

**Spec liegt bereit:** `PROMPTS/sprint-b-merge-slot-verfuegbarkeit.md`

Phasenplan dort:
- B1: Slot-Chip aus HW-Kalender entfernen → Verfügbarkeit übernimmt
- B2: Wiederkehrend vs einmalig klar trennen (in derselben Tabelle)
- B3: Marktplatz-Adapter
- B4: Schema-Konsolidierung (NUR mit Lennart-OK)

**Reihenfolge:** Phase 1 (Sprint UX) zuerst, dann Sprint B beginnend mit B1.

## Constraints

- Pricing-Engine selbst nicht anfassen, nur Auktionsdauer
- Phase 1 + B1-B3 sind Code-only, B4 braucht Schema-Approval
- Pro Item max. 1 Klärungsfrage
- Cowork (anderer Chat) macht QA nach jedem Deploy

## Reporting

Nach Phase 1: Cowork-Smoke-Test der 6 Items.
Nach jedem B-Sub: Cowork-Smoke-Test im HW-Kalender.

## Erster Schritt

Phase 1, Item 1 (M6-Header-Fix) — Code lesen, Diff zeigen, dann reihum 2-6 durch. Sag mir nach jedem Commit Bescheid.
