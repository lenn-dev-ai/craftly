# Loop Iteration 23 — Triage 3 neuer Feedbacks (27.05.2026)

> Seit Iteration 22 (25.05.) sind drei ungelesene Feedbacks reingekommen.
> Alle drei wurden in dieser Iteration ausgewertet.

## Die 3 Findings

| # | ID | Wann | Wer | URL | Message |
|---|---|---|---|---|---|
| 1 | `37f6be65` | 25.05. 16:25 | admin | `/dashboard-mieter/melden` | „hier brauchen wir noch einen unique identifier zb Wohneinheit damits von der verwaltung direkt zugeordnet werden kan" |
| 2 | `16d4d582` | 27.05. 08:08 | handwerker | `/dashboard-handwerker` | „Warum steht hier Hallo Mieter wenns handwerker ist?" |
| 3 | `d0ec6e39` | 27.05. 13:00 | admin | `/dashboard-mieter/melden` | „Hier fehlt mieter nummer" |

## Triage

### 🐛 BUG-1 — HW-Dashboard zeigt „Hallo Mieter"
**`16d4d582`** (handwerker, /dashboard-handwerker)

Klassischer Rollen-Mismatch in der Begrüßung. Entweder ist die Greeting-Komponente nicht rollenabhängig oder es wird hartcodiert „Mieter" gezeigt. Hohe Sichtbarkeit (= Landing-Page nach HW-Login), niedriger Fix-Aufwand.

**Action für Sprint AK Phase 4** (oder Quick-Hotfix):
- `app/dashboard-handwerker/page.tsx` → Begrüßung prüfen, evtl. liest sie aus dem Profil-Namen + Rolle und konkateniert falsch.
- Eventuell in einer Shared-Greeting-Komponente — dann zentral fixen.
- Smoke-Test: nach Fix einmal HW + Verwalter + Mieter logins.

**Severity**: HIGH (Reparo wirkt unprofessionell wenn der erste Eindruck nach Login falsch ist).

### ✨ FEATURE — Mieter-Identifikation im Wizard (Mieter-Nr / Wohneinheit)
**`37f6be65`** + **`d0ec6e39`** (Duplikat-Pair, beide auf /dashboard-mieter/melden)

Lennart hat zweimal nachgehakt: im Mieter-Schadensmeldung-Wizard fehlt ein Identifikations-Feld, damit der Verwalter den Mieter bzw. die Wohneinheit beim Eingang sofort zuordnen kann.

Aktuell muss der Verwalter über Mieter-Name + Einsatzort manuell matchen — fehleranfällig und langsam, vor allem bei großen Beständen mit gleichlautenden Namen oder Mehrfamilienhäusern.

Lösungs-Optionen:
1. **„Wohneinheit-Nummer" / „Mietvertrag-Nr." als optionales Freitext-Feld** im Wizard. Quick-Win, kein Datenmodell-Eingriff (Spalte in `tickets`). Wert wird im Verwalter-Ticket-Detail prominent angezeigt.
2. **Strukturierte Zuordnung über `wohnungen`-Tabelle**: Mieter-Profil hat eine Wohnungs-Referenz, beim Wizard wird die automatisch als Read-Only angezeigt. Erfordert dass der Verwalter den Mieter beim Onboarding einer Wohnung zuordnet (Sprint W vorbereitet, aber wahrscheinlich noch nicht durchgängig).
3. **QR-Code im Hausflur** (Vision): Mieter scannt → Wohnung ist vorausgefüllt. Erfordert (1) als Basis.

**Empfehlung**: Option 1 als Quick-Win sofort, Option 2 als Sprint-AL-Spec für strukturierte Lösung.

**Severity**: MEDIUM-HIGH (Verwalter-Pain-Point bei Skalierung, kein Beta-Blocker).

## Was noch im DB-Backlog liegt (alle viewed=true, also schon mal angesehen, aber nicht alle nachverfolgt)

Aus dem Run am 25.05. (Iteration 22) wurden 13 Feedbacks zu Sprint R Phase 15-22 plus Konzept-Memos kanalisiert. Diese sind teilweise schon durch (Sprint AE Google-Cal-Sync, Sprint AG Mapbox, Sprint AH Admin-Mission-Control, Sprint AK Slot-Cleanup), teilweise warten sie noch — siehe Sprint-R-Backlog für den Rest.

## Empfehlung für CC

Direkt umsetzbar als Hotfix-Commit:

1. **BUG-1 fixen** (HW-Dashboard-Begrüßung) — vermutlich 10-Zeilen-Edit
2. **Wohneinheit-Feld einfügen** in Mieter-Wizard als optionales Freitext-Feld:
   - `tickets`-Migration: `ADD COLUMN wohneinheit_referenz text`
   - `app/dashboard-mieter/melden`-Wizard: neues Feld nach „Einsatzort"
   - `app/dashboard-verwalter/tickets/[id]`: Feld prominent oben anzeigen

Beides als ein Commit ist sauber, Migration ist non-breaking (nullable Spalte).

## viewed-Flag

Die drei Feedbacks (`37f6be65`, `16d4d582`, `d0ec6e39`) werden in dieser Iteration auf `viewed=true` gesetzt, damit sie nicht erneut auftauchen.
