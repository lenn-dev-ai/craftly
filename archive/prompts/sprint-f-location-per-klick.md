# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint F — Location per Klick im Mieter-Wizard

> Lennart-Gedanke 21.05.2026 Abend. Quick Win.
> Aufwand S–M (~30-60 Min).

## Ziel

Statt im Mieter-Wizard (Schritt 2 „Ort") die Adresse manuell einzutippen, gibt es einen Default „Meine Wohnung" der die Adresse aus dem Mieter-Profil zieht. Mit „Andere Adresse"-Override für die seltenen Fälle (Mieter mit mehreren Wohnungen, Schaden im Treppenhaus, etc.).

## Aktueller Stand

Mieter-Wizard `/dashboard-mieter/melden`, Step 2 hat ein Adress-Textfeld. User muss komplett tippen.

## Spec

### Wenn Mieter-Profil einsame Wohnung hat:

- **Default-Pill** oben: „📍 Meine Wohnung — Musterstr. 12, 14055 Berlin, Whg 3B" (auto-vorausgefüllt)
- **Sekundär-Button**: „Andere Adresse eingeben" → öffnet das aktuelle Adress-Textfeld

### Wenn Mieter-Profil mehrere Wohnungen hat:

- **Dropdown** statt Pill: „Wähle Wohnung" mit allen 2-3 Optionen plus „Andere Adresse"
- Default: erste Wohnung oder zuletzt genutzte

### Wenn Mieter-Profil keine Wohnung hat:

- Aktueller Fallback: Adress-Textfeld direkt sichtbar
- Plus dezenter Hinweis „Hinterlege deine Wohnung im Profil, damit das schneller geht"

## Code-Lokationen

- `app/dashboard-mieter/melden/page.tsx` — Schritt 2 „Ort"
- `app/dashboard-mieter/profil/...` — Wohnungs-Pflege (existiert sie? sonst neu)
- DB: `public.wohnungen` oder `profiles.adresse` o.ä. — prüfen ob's Tabelle gibt

## Implementations-Plan

### Phase F1: Profil-Schema check

- Existiert eine `wohnungen`-Tabelle? Oder ist die Adresse direkt im `profiles`? Lass Code-Lesen entscheiden.
- Falls keine Tabelle: ergänzen via Cowork-Migration (FK auf profiles, ein Mieter kann N Wohnungen haben). Aufwand: XS.

### Phase F2: Wizard-Erweiterung

- Schritt 2: Wohnungs-Selector vor das Adress-Feld
- Bei Default-Auswahl: einsatzort_* Felder im Ticket aus der Wohnung auto-befüllen
- „Andere Adresse" entkoppelt → User tippt manuell wie bisher

### Phase F3: Profil-UX (optional)

- Wenn Profil noch kein Wohnungs-Feld hat, eines hinzufügen (in `/dashboard-mieter/profil` oder Onboarding)
- Mit Mini-Hinweis im Wizard wenn kein Wohnungs-Profil existiert

## Constraints

- Mobile-First (Wizard ist eh mobile-optimiert)
- Pricing-Engine nicht anfassen
- Pro Phase max. 1 Frage

## Erster Schritt

Phase F1: Schema-Inventur. Schau ob `wohnungen`-Tabelle existiert oder Adresse im profiles steckt. Dann F2.
