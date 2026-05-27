# CC-Commit-Prompt — U7 Arbeitszeit-Config aus Profil

Lennart hat schon lokal editiert. Bitte folgende Files committen + pushen,
damit Netlify deployt.

## Geänderte Files

```
app/dashboard-handwerker/kalender/page.tsx
app/dashboard-handwerker/profil/page.tsx
```

## Migration — schon via Supabase-MCP applied (`audit_u7_profile_arbeitszeit`)

Falls auf einer anderen DB (Branch/Local) noch nötig:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS arbeitszeit_von smallint DEFAULT 7,
  ADD COLUMN IF NOT EXISTS arbeitszeit_bis smallint DEFAULT 20;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_arbeitszeit_range_check
  CHECK (
    arbeitszeit_von IS NULL OR (arbeitszeit_von >= 0 AND arbeitszeit_von <= 23)
  ) NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_arbeitszeit_range_check;
```

## Was U7 macht

Vorher: Kalender-Stunden-Achse war hartcodiert 07–20. Frühdienst-HW (5–15)
oder Notdienst (8–24) hatten keinen Weg, das anzupassen — und sahen ihre
echten Arbeitsfenster nicht im Grid.

Jetzt:
- `profiles.arbeitszeit_von` / `arbeitszeit_bis` als `smallint` (DB-Default 7/20).
- HW-Profil-Page bekommt einen neuen Card-Block "Arbeitszeit-Fenster" mit
  zwei Number-Inputs (Beispiele: Frühdienst 5–15 / Standard 7–20 / Notdienst 8–24).
- Kalender liest beim Load das Profil, setzt `arbVon`/`arbBis` und nutzt
  diese statt der Modul-Konstanten für: Stunden-Achse, Stunden-Trennlinien,
  Klick-Hotzonen, Slot-Default-`bis`, Now-Linie-Range-Check und alle
  `offsetTop`-Berechnungen.
- Fallback (`sicherArbVon`/`sicherArbBis`) hält 7–20 wenn DB-Werte
  ungültig oder Migration nicht angewandt wurde — kein leerer Kalender möglich.

## Commit-Message

```
feat(kalender): U7 — Arbeitszeit-Fenster aus Profil konfigurierbar

- profiles.arbeitszeit_von/bis (smallint, 7/20 default, range-check)
- HW-Profil-Page: neuer Card-Block "Arbeitszeit-Fenster" mit zwei Inputs
- Kalender: STUNDE_VON/BIS-Konstanten ersetzt durch arbVon/arbBis-State
- offsetTop in Component-Body verschoben (closure über sicherArbVon)
- Migration audit_u7_profile_arbeitszeit applied
- Fallback bei ungültigen Werten → 7-20 (kein leerer Kalender möglich)

Audit-Finding U7 — Bezug: UX-AUDIT-Kalender-2026-05-27.md
```

## Push-Befehle

```bash
cd ~/Desktop/Reparo
git add app/dashboard-handwerker/kalender/page.tsx \
        app/dashboard-handwerker/profil/page.tsx
git commit -m "feat(kalender): U7 — Arbeitszeit-Fenster aus Profil konfigurierbar"
git push origin main
```

## Smoke-Test nach Deploy

1. Login als HW → /dashboard-handwerker/profil
2. Card "Arbeitszeit-Fenster" sichtbar mit 7 / 20 als Defaults
3. Ändere auf z.B. 6 / 18 → "Profil speichern" → grüne Bestätigung
4. /dashboard-handwerker/kalender → Stunden-Achse zeigt 06:00–17:00 (11 Reihen)
5. Now-Linie nur sichtbar wenn aktuelle Stunde im Fenster
6. Zurück auf /profil, setze "Bis" < "Von" → rote Warnung erscheint
   (UI lässt save trotzdem zu, aber Kalender fällt auf 7–20 zurück)

## Typecheck — schon GRÜN

`npx tsc --noEmit` läuft sauber durch (EXIT=0).
