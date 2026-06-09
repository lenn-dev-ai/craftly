# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint AC — Bronze/Silber/Gold → „Partner-Stufen" rebrand

> 3-zu-1-Audit-Konsens (ChatGPT + Designer + nachträglich Cowork): aktuelle
> Bronze/Silber/Gold-Mechanik wirkt zu „Lieferdienst-Ranking" / „Uberisierung"
> / „Billigplattform" für B2B-Handwerker.
>
> Lösung (vom Designer vorgeschlagen): Mechanik beibehalten, Wording auf
> Enterprise-Partner-Sprache umstellen.
>
> Aufwand: ~1-1.5h Claude Code. Eigenständig.

## Designer-Audit-Quote

> „Handwerker wollen faire Jobs, Planbarkeit, Respekt, Transparenz —
> NICHT Gamification. Empfehlung: weniger spielerisch, mehr professioneller
> Partner-Look. Reputation statt Level-System."

## Spec

### Wording-Mapping

| Alt | Neu |
|---|---|
| Bronze-Stufe | **Vertrauter Partner** (10+ erledigte Aufträge ODER 6 Monate aktiv) |
| Silber-Stufe | **Top-Partner** (50+ Aufträge, Bewertung ≥4.7) |
| Gold-Stufe | **Premium-Partner** (200+ Aufträge, Bewertung ≥4.8, Antwort <2h) |
| Smart-Score-Multiplikator | **Sichtbarkeits-Bonus** (×1.05 / ×1.10 / ×1.15) |
| „Sichtbarkeits-Stufe" | **Partner-Status** |
| „Angebotstreue 100%" | **Antwort-Rate 100%** (mit Tooltip: „% deiner abgegebenen Angebote die du auch tatsächlich ausführst") |

**Zusätzlich neu:** „Stamm-Partner-Marker" (Bonus-Badge bei einer Verwaltung wo HW schon mehrfach erfolgreich war) — verbindet sich mit Sprint V (Stamm-HW-Konzept).

### Visuell

**Vorher (laut Cowork-Live-Test):**
- Bronze-Medaille-Icon mit „3" Position-Nummer
- Orange-brauner Background-Akzent
- „Sichtbarkeits-Stufe Bronze" Headline
- „0 / 100 Punkte" Score-Anzeige

**Nachher:**
- Diskreter Badge (kein Medaillen-Look) — z.B. nur Text mit Akzent-Farbe
- Reparo-Green / dezent statt Bronze-Orange
- „Partner-Status: Vertrauter Partner" Headline
- „10 von 50 Aufträgen bis Top-Partner" als Fortschritt (klare Progression statt abstrakter Score)

### Code-Lokationen

- `app/dashboard-handwerker/page.tsx` — Hero mit Sichtbarkeits-Box (~Zeilen 160-200 vermutlich)
- `lib/sichtbarkeit/*.ts` — Stufen-Berechnung (Wording in Konstanten?)
- `components/handwerker/SichtbarkeitsBadge.tsx` (falls existent)
- Verwalter-Marktplatz: HW-Cards zeigen vermutlich Bronze/Silber/Gold-Marker → auch updaten

### Phase AC1 — Konstanten umlabeln (~30 min)

In `lib/sichtbarkeit/*.ts` (oder wo Stufen definiert):
```typescript
export const PARTNER_STUFEN = [
  { key: 'vertrauter_partner', label: 'Vertrauter Partner', multiplikator: 1.0, schwelle_auftraege: 0 },
  { key: 'top_partner', label: 'Top-Partner', multiplikator: 1.05, schwelle_auftraege: 50, schwelle_bewertung: 4.7 },
  { key: 'premium_partner', label: 'Premium-Partner', multiplikator: 1.10, schwelle_auftraege: 200, schwelle_bewertung: 4.8 },
] as const
```

Bestehende `BRONZE`/`SILBER`/`GOLD`-Konstanten als deprecated markieren oder löschen wenn keine externen Referenzen.

### Phase AC2 — UI-Texte updaten (~30 min)

Suche+Ersetze in `app/dashboard-handwerker/*` und `components/handwerker/*`:
- „Sichtbarkeits-Stufe" → „Partner-Status"
- „Bronze" → „Vertrauter Partner"
- „Silber" → „Top-Partner"
- „Gold" → „Premium-Partner"
- „Angebotstreue" → „Antwort-Rate" (mit Tooltip)
- „Stufe wirkt als Multiplikator" → „Bonus-Faktor für deine Sichtbarkeit"

### Phase AC3 — Visuell entspielen (~30 min)

In HW-Dashboard-Box:
- Medaille-Icon → schlichtes Badge-Layout (Text + dezenter Akzent-Border)
- Bronze-Orange-Background → Reparo-Cream + Reparo-Green-Akzent
- „3"-Position-Nummer raus (kein „Platz 3"-Gefühl)
- Progress zur nächsten Stufe als simpler Balken (kein „XP"-Look)

### Phase AC4 — Verwalter-Sicht updaten (~20 min)

HW-Karten in `app/dashboard-verwalter/marktplatz` und `app/dashboard-verwalter/handwerker`:
- „Gold-Partner"-Badge → „Premium-Partner"
- Keine Medaille-Icons im HW-Verzeichnis

### Phase AC5 — Smoke-Test + Commit

Test mit test.handwerker und test.verwalter:
- HW sieht „Vertrauter Partner" Status statt Bronze
- Verwalter sieht im Verzeichnis Partner-Stufen statt Gold-Badges

Commit: `refactor(handwerker): Bronze/Silber/Gold → Partner-Stufen rebrand (Sprint AC)`

## Constraints

- Berechnungs-Logik NICHT ändern — nur Wording + Visuals
- DB-Felder können bleiben (`sichtbarkeit_bronze` etc.), nur die UI-Anzeige ändert sich
- Sales-Material (Deck, Landing) erwähnt Bronze/Gold nicht prominent — kein paralleler Update nötig
- Smart-Score-Algorithmus bleibt unangetastet

## Erfolg

- Designer-Audit-Bewertung Handwerker steigt (von „Lieferdienst-Look" weg)
- HW-Feedback in Beta: „fühl mich wie Partner, nicht wie Foodora-Bote"
- Verwalter sieht „Premium-Partner" statt „Gold" — wirkt seriöser im Sales-Pitch

## Erster Schritt

Phase AC1 — Konstanten suchen + umlabeln.
