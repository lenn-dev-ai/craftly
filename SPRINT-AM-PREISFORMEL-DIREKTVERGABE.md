# Sprint AM — Preisformel (Fahrtweg + Auslastung) & generalisierte Direktvergabe

> Basis: `KONZEPT-handwerker-direktbuchung-doctolib.md` (v4, bestätigt
> 14.06.2026 — "Auktion = Preisformel, dann Direktvergabe"). Diese Datei
> ist die konkrete Sprint-Spec für CC, analog Format Sprint AE/AL.
> Strategischer Rahmen: Handwerker sind Kern-Zielgruppe — "das Doctolib
> der Reparaturen".

## Ziel

`/api/auction/start` berechnet den Preis nicht mehr aus einer einzigen
Konstante (`stundensatz × geschätzte_Stunden × surge_faktor`), sondern
aus drei Faktoren — **Zeitdruck** (bestehend), **Fahrtweg** (neu) und
**Auslastung** (neu, ersetzt "Komplexität"). Anschließend wird der
bereits für Notfall existierende Direktvergabe-Mechanismus (Top-Kandidat
per Smart-Score → Google-Cal-Check → Direktvergabe) auf alle
Dringlichkeitsstufen generalisiert, mit Stamm-HW-Vorzug als Schritt 0 und
der heutigen Mass-Invite-Auktion als letzten Fallback.

Zwei unabhängige Phasen, **Phase 1 zuerst** (risikoarm, sofort sichtbarer
Mehrwert), Phase 2 danach (größerer Eingriff in den Vergabe-Flow).

---

## Phase 1 — Preisformel (`lib/pricing/auftragswert.ts`)

### Neue Datei: `lib/pricing/auftragswert.ts`

```typescript
import { schaetzeFahrzeitMin } from "@/lib/distance"

export interface AuftragswertInput {
  stundensatz: number          // € / Stunde des HW
  geschaetzteStunden: number    // estimatedH oder befund_aufwand_stunden
  surgeFaktor: number            // aus konfigFuer(dringlichkeit).surgeFaktor
  entfernungKm: number           // haversineKm(Objekt, HW-Standort)
  auslastung: number | null      // 0..1 Anteil belegter Stunden, null = kein Google-Cal
}

export interface AuftragswertBreakdown {
  basisbetrag: number
  zeitdruckBetrag: number        // basisbetrag * surgeFaktor
  anfahrtspauschale: number
  auslastungsMultiplikator: number
  gesamt: number                  // gerundet auf volle Euro
}

/**
 * Anfahrtspauschale: Stufenmodell nach Fahrzeit (Hin+Rückweg wird NICHT
 * verdoppelt — die Pauschale deckt die "verlorene" Zeit pro Anfahrt ab,
 * nicht die volle Rundreise, sonst werden ländliche HW unverhältnismäßig
 * teuer).
 *   0–10 min   →  0 €  (Nahbereich, im Stundensatz "eingepreist")
 *   10–20 min  →  8 €
 *   20–30 min  → 15 €
 *   30+ min    → 15 € + 0,50 €/min über 30
 */
export function berechneAnfahrtspauschale(fahrzeitMin: number): number {
  if (!isFinite(fahrzeitMin) || fahrzeitMin <= 10) return 0
  if (fahrzeitMin <= 20) return 8
  if (fahrzeitMin <= 30) return 15
  return Math.round(15 + (fahrzeitMin - 30) * 0.5)
}

/**
 * Auslastungs-Multiplikator aus Dichte 0..1 (Anteil belegter
 * Arbeitsstunden in den nächsten 7 Tagen).
 *   null (kein Google-Cal) → 1.00 (neutral, fail-open)
 *   0.0  (leer)            → 0.95 (Anreiz-Rabatt)
 *   0.5  (halb voll)       → 1.00
 *   1.0  (komplett voll)   → 1.10 (Opportunitätskosten-Aufschlag)
 * Linear interpoliert zwischen 0 und 1.
 */
export function berechneAuslastungsMultiplikator(auslastung: number | null): number {
  if (auslastung == null || !isFinite(auslastung)) return 1.0
  const clamped = Math.max(0, Math.min(1, auslastung))
  // 0 -> 0.95, 0.5 -> 1.00, 1.0 -> 1.10 (stückweise linear, leicht konvex)
  if (clamped <= 0.5) return 0.95 + (clamped / 0.5) * 0.05
  return 1.00 + ((clamped - 0.5) / 0.5) * 0.10
}

export function berechneAuftragswert(input: AuftragswertInput): AuftragswertBreakdown {
  const basisbetrag = input.stundensatz * input.geschaetzteStunden
  const zeitdruckBetrag = basisbetrag * input.surgeFaktor
  const fahrzeitMin = schaetzeFahrzeitMin(input.entfernungKm)
  const anfahrtspauschale = berechneAnfahrtspauschale(fahrzeitMin)
  const auslastungsMultiplikator = berechneAuslastungsMultiplikator(input.auslastung)

  const vorMultiplikator = zeitdruckBetrag + anfahrtspauschale
  const gesamt = Math.round(vorMultiplikator * auslastungsMultiplikator)

  return {
    basisbetrag: Math.round(basisbetrag * 100) / 100,
    zeitdruckBetrag: Math.round(zeitdruckBetrag * 100) / 100,
    anfahrtspauschale,
    auslastungsMultiplikator,
    gesamt: Math.max(80, gesamt), // bestehender Preis-Floor (80€) bleibt
  }
}
```

`80€`-Floor: existiert heute bereits in der Mass-Invite-Logik
(`Math.max(80, ...)`), wird hierher übernommen, damit die zentrale
Funktion die einzige Quelle der Wahrheit ist.

### Neue Datei: `lib/google-cal/auslastung.ts`

```typescript
import { listEventsForUser } from "./events"

const ARBEITSSTUNDEN_PRO_TAG = 8 // 08:00-16:00, vereinfachtes Modell
const TAGE = 7

/**
 * Anteil belegter Arbeitsstunden in den nächsten `TAGE` Tagen, 0..1.
 * Fail-open wie hasGoogleEventInRange: kein Token / API-Fehler → null
 * (→ Multiplikator 1.0, kein Nachteil für HW ohne Google-Cal).
 */
export async function berechneAuslastung(userId: string): Promise<number | null> {
  const von = new Date()
  const bis = new Date(von.getTime() + TAGE * 24 * 3600 * 1000)

  try {
    const events = await listEventsForUser(userId, von, bis)
    if (events === null) return null // kein Google-Cal verbunden

    let belegteMinuten = 0
    for (const ev of events) {
      const start = new Date(ev.start)
      const end = new Date(ev.end)
      belegteMinuten += Math.max(0, (end.getTime() - start.getTime()) / 60000)
    }
    const verfuegbareMinuten = TAGE * ARBEITSSTUNDEN_PRO_TAG * 60
    return Math.min(1, belegteMinuten / verfuegbareMinuten)
  } catch {
    return null // fail-open
  }
}
```

> **Hinweis für CC:** `listEventsForUser` Signatur/Rückgabewert vorher in
> `lib/google-cal/events.ts` prüfen — ggf. muss die Funktion angepasst
> werden, damit sie bei "kein Token" `null` statt `[]` zurückgibt, damit
> Sprint AM zwischen "kein Cal" (→ Multiplikator 1.0) und "Cal, aber
> leer" (→ Multiplikator 0.95) unterscheiden kann. Falls `events.ts`
> diese Unterscheidung nicht hergibt, `listEventsForUser` minimal
> erweitern (zusätzlicher Rückgabewert `connected: boolean`), NICHT die
> bestehende `hasGoogleEventInRange`-Semantik (F1) verändern.

### Integration in `/api/auction/start`

Beide Code-Pfade ersetzen ihre Inline-Preisberechnung:

**Notfall-Pfad** (aktuell `stundensatz × DEFAULT_NOTFALL_STUNDEN ×
surge_faktor`):

```typescript
const entfernungKm = haversineKm(objekt.lat, objekt.lng, hw.lat, hw.lng)
const auslastung = await berechneAuslastung(hw.user_id)
const wert = berechneAuftragswert({
  stundensatz: hw.stundensatz,
  geschaetzteStunden: DEFAULT_NOTFALL_STUNDEN,
  surgeFaktor: konfig.surgeFaktor,
  entfernungKm,
  auslastung,
})
// wert.gesamt statt bisherigem kosten_final
```

**Mass-Invite-Pfad** (aktuell `empfohlener_preis = Math.max(80,
Math.round(stundensatz × estimatedH × surge_faktor))`): pro HW im Radius
denselben `berechneAuftragswert()`-Call statt der bisherigen
Inline-Formel — **jeder HW sieht seinen individuellen
`empfohlener_preis`**, abhängig von eigenem Stundensatz, Fahrtweg und
Kalenderauslastung.

`berechneAuslastung()` pro Kandidat ist ein zusätzlicher Google-API-Call
— bei Mass-Invite mit z.B. 8-15 Kandidaten im Radius relevant fürs
Rate-Limit. **Parallelisieren** (`Promise.all`) und das bestehende
5-Min-Cache-Pattern aus Sprint AE Phase 2 wiederverwenden (siehe dort:
"Cache 5 Min für free/busy-Antworten" — `berechneAuslastung` sollte den
gleichen Cache nutzen, da es dieselben Events liest).

### Was NICHT ändert (Phase 1)

- Vergabe-Ablauf (Notfall = Direktmatch, Zeitnah/Planbar = Stamm-Vorzug
  dann Mass-Invite) bleibt exakt wie heute — nur die **Zahl** ändert
  sich.
- `geschätzte_Stunden`-Logik (`DEFAULT_NOTFALL_STUNDEN`, `ESTIMATED_STUNDEN`,
  `befund_aufwand_stunden`) bleibt unverändert.
- `berechneSmartScore()` / Ranking bleibt unverändert.
- `protect_ticket_fields()` — Phase 1 schreibt nur in bereits
  whitelistete Felder (`kosten_final`, `empfohlener_preis`), keine neue
  Transition nötig.

---

## Phase 2 — Generalisierte sequenzielle Direktvergabe

### Ziel

Für `zeitnah`/`planbar` **ohne** Stamm-HW: statt sofort an alle HW im
Radius einzuladen (Mass-Invite, Verwalter wählt aus mehreren Angeboten),
wird sequenziell der Top-Kandidat (Smart-Score) **direkt** angefragt —
mit bereits berechnetem Preis (Phase 1) und einem Terminvorschlag. Erst
nach `N=3` Ablehnungen/Timeouts fällt das System auf die heutige
Mass-Invite-Auktion zurück.

### Neue Spalten (Migration `sprint_am_direktvergabe.sql`)

```sql
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS direktvergabe_kandidaten jsonb,      -- geordnete Liste {hw_id, score, preis}[]
  ADD COLUMN IF NOT EXISTS direktvergabe_index int DEFAULT 0,    -- aktuell angefragter Kandidat (Index)
  ADD COLUMN IF NOT EXISTS direktvergabe_angefragt_am timestamptz,
  ADD COLUMN IF NOT EXISTS direktvergabe_timeout_min int;        -- 15 / 120 / 1440 je Dringlichkeit
```

`direktvergabe_kandidaten` wird beim Auktionsstart einmal berechnet
(Smart-Score + `berechneAuftragswert()` pro Kandidat) und dann
sequenziell abgearbeitet — vermeidet wiederholte Score-Berechnung bei
jeder Eskalation.

### Flow (siehe KONZEPT Abschnitt 4)

```
POST /api/auction/start (zeitnah/planbar, kein Stamm-HW)
  1. Kandidatenliste bilden (Smart-Score-sortiert, Top 10 im Radius)
  2. Pro Kandidat: berechneAuftragswert() (Phase 1)
  3. direktvergabe_kandidaten = [...], direktvergabe_index = 0
  4. Kandidat[0]: Google-Cal-Check (F1) — wenn belegt, index++ (Schritt 2 wiederholen)
  5. einladungen-Row für Kandidat[0] mit status='offen',
     empfohlener_preis = wert.gesamt, terminvorschlag (siehe unten)
  6. direktvergabe_angefragt_am = now(), timeout je dringlichkeit
  7. zuschlagEmail/einladungEmail an Kandidat[0]

Cron (alle 5 Min, neuer Scheduled Task "direktvergabe-eskalation"):
  - Tickets mit status='auktion'/'offen' + direktvergabe_angefragt_am
    älter als direktvergabe_timeout_min UND kein 'angenommen'-Angebot:
    → einladungen-Row für aktuellen Kandidat auf status='abgelaufen'
    → direktvergabe_index++
    → wenn index < kandidaten.length: zurück zu Schritt 4
    → wenn index >= kandidaten.length ODER index >= 3:
        Fallback auf Mass-Invite (heutiger Code-Pfad, alle übrigen
        Kandidaten im Radius einladen, status bleibt 'auktion')

HW lehnt explizit ab (POST /api/auction/decline, neu):
  → wie Timeout, aber sofort statt nach Ablauf
```

### Terminvorschlag bei Direktvergabe-Anfrage

- HW mit Google-Cal: ersten freien Slot in Arbeitszeit innerhalb der
  Dringlichkeits-Frist vorschlagen (gleiche Logik wie
  `berechneAuslastung`, invertiert — erster freier Block ≥
  geschätzte_Stunden).
- HW ohne Google-Cal: `termine`-Eintrag mit Platzhalter
  (`terminvorschlag_offen`), K1-Doodle (`/api/termine/vorschlagen`)
  bleibt Nachgang — **unverändert**.

### `protect_ticket_fields()` — Whitelist-Erweiterung

Neue Transitionen, die der Trigger erlauben muss (Migration im selben
File wie die Spalten-Erweiterung):

| Transition | Felder | Auslöser |
|---|---|---|
| Eskalation zum nächsten Kandidaten | `direktvergabe_index`, `direktvergabe_angefragt_am` | Cron |
| Fallback zu Mass-Invite | `status` (`'offen'/'auktion'` → `'auktion'`), `auktion_start`, `auktion_ende` | Cron, nur wenn `direktvergabe_index >= 3` |
| Direktvergabe-Annahme | `zugewiesener_hw`, `kosten_final`, `status='in_bearbeitung'`, `surge_faktor`, `auktion_start` | bestehende Annahme-Route, jetzt auch für zeitnah/planbar |

**Pflicht (Sprint-AL-Lektion):** jede dieser drei Transitionen braucht
einen expliziten Trigger-Test (SQL: `UPDATE tickets SET ... WHERE id=...`
als der jeweilige DB-Role-Kontext, erwartet Erfolg/Fehler) — siehe
`supabase/migrations/20260614000020_fix_protect_ticket_fields_hw_abschluss.sql`
als Vorlage für Testaufbau.

### Migration: laufende Auktionen

Bestehende Tickets mit `status='auktion'` zum Umstellungszeitpunkt
**nicht** in den neuen Flow zwingen — `direktvergabe_kandidaten IS NULL`
ist der Marker "alter Flow, läuft aus wie bisher". Neue Tickets ab
Deploy bekommen `direktvergabe_kandidaten` befüllt.

---

## Edge-Cases — verpflichtend handhaben

| Case | Verhalten |
|---|---|
| Kandidat lehnt ab, aber war einziger HW im Radius | `direktvergabe_index >= kandidaten.length` → sofort Mass-Invite-Fallback (kein Warten auf N=3) |
| HW hat keinen `stundensatz` gepflegt (NULL/0) | `berechneAuftragswert` mit Default-Stundensatz (Plattform-Median, konfigurierbar) statt 0 — sonst `gesamt=0` trotz `Math.max(80,...)`-Floor inkonsistent |
| `entfernungKm` nicht berechenbar (fehlende Koordinaten) | Anfahrtspauschale = 0 (Fail-Safe, kein Blocker für Vergabe) |
| Google-Cal-Token abgelaufen während Auslastungs-Check | `berechneAuslastung` → `null` (wie "kein Cal"), kein Retry-Block |
| Mehrere offene `einladungen` für dasselbe Ticket (Race: Cron + manuelle Annahme gleichzeitig) | `UNIQUE(ticket_id, handwerker_id)` (existiert seit H7) + Annahme-Route prüft `direktvergabe_index` bei Schreibzugriff — Stale-Index → 409 |
| Stamm-HW lehnt direktvergabe-Anfrage mit Preis ab | Fällt NICHT auf Mass-Invite zurück, sondern in die normale Kandidatenliste (Schritt 1) — Stamm-Vorzug ist nur Schritt 0, kein Veto gegen den Rest des Flows |
| Auslastungs-Multiplikator bei `auslastung=null` für ALLE Kandidaten (Beta-Realität) | Erwartet — alle Preise nutzen Multiplikator 1.0, Formel bleibt korrekt, nur weniger differenziert |

---

## Testing

- **Unit-Tests** `lib/pricing/auftragswert.ts`: Tabellen-Tests für
  `berechneAnfahrtspauschale` (Grenzwerte 10/20/30 min) und
  `berechneAuslastungsMultiplikator` (0 / 0.5 / 1.0 / null).
- **Unit-Tests** `lib/google-cal/auslastung.ts`: Mock von
  `listEventsForUser` — leerer Kalender → 0, voller Kalender → 1, kein
  Token → null.
- **Integration**: `/api/auction/start` Notfall — Preis mit/ohne
  Anfahrtspauschale vergleichen (zwei HW-Profile, unterschiedliche
  Distanz).
- **Trigger-Tests** (Phase 2): die drei neuen Transitionen aus der
  Whitelist-Tabelle oben, je als eigener SQL-Block mit erwarteter
  Erfolg/Fehler-Assertion.
- **E2E** (Phase 2): zeitnah-Ticket ohne Stamm-HW → Top-Kandidat erhält
  Direktvergabe-Anfrage mit Preis+Termin → Annahme → `termine`-Eintrag
  korrekt.

## Sanity-Check nach Deploy

1. Showcase-Ticket (Notfall) auslösen → `kosten_final` enthält
   Anfahrtspauschale (Differenz zu vorher = `berechneAnfahrtspauschale`
   für die bekannte Demo-Distanz).
2. SQL: `SELECT empfohlener_preis FROM einladungen WHERE ticket_id=...`
   → Preise unterscheiden sich zwischen HW (unterschiedliche Distanz).
3. (Phase 2) Zeitnah-Ticket ohne Stamm-HW → `direktvergabe_kandidaten`
   befüllt, `einladungen`-Row für Kandidat[0] mit `status='offen'`
   erscheint, Email raus.
4. (Phase 2) Cron-Lauf nach Timeout → `direktvergabe_index` erhöht,
   nächster Kandidat erhält Anfrage.

## Constraints

- Phase 1 ändert **keine** Status-Maschine, **keine** neuen Trigger-Regeln
  — kann unabhängig und risikoarm deployed werden.
- Phase 2 NUR für `zeitnah`/`planbar` ohne Stamm-HW — Notfall- und
  Stamm-HW-Pfade bleiben strukturell wie heute (bekommen nur die neue
  Preisformel).
- K1-Doodle bleibt vollständig erhalten als Fallback für HW ohne
  Google-Cal.
- 80€-Preis-Floor bleibt.
- Bestehender 72h-Auktions-Cap (`MAX_AUKTIONSDAUER_STUNDEN`) gilt
  weiterhin für den Mass-Invite-Fallback.

## Commit-Struktur

1. `feat(pricing): Auftragswert-Formel mit Anfahrtspauschale + Auslastung (Sprint AM Phase 1a)`
2. `feat(google-cal): Auslastungs-Dichte-Funktion (Sprint AM Phase 1b)`
3. `feat(auction): Preisformel in /api/auction/start integrieren — Notfall + Mass-Invite (Sprint AM Phase 1c)`
4. `feat(auction): Direktvergabe-Kandidatenliste + sequenzielle Anfrage (Sprint AM Phase 2a)`
5. `feat(auction): Timeout-Cron + Mass-Invite-Fallback nach N=3 (Sprint AM Phase 2b)`
6. `fix(db): protect_ticket_fields() Whitelist für Direktvergabe-Transitionen + Trigger-Tests (Sprint AM Phase 2c)`

## Erfolg

- Zwei HW mit identischem Auftrag aber unterschiedlicher Distanz sehen
  unterschiedliche, nachvollziehbare Preise.
- HW mit verbundenem, leerem Google-Cal sehen leicht reduzierte Preise
  (Anreiz) — weiterer handfester Grund, Sprint AE zu nutzen.
- Zeitnah/Planbar-Tickets ohne Stamm-HW werden sequenziell an
  Top-Kandidaten vergeben statt per Mass-Invite — Mass-Invite wird zur
  Ausnahme (sichtbar an seltenerem Auftreten in `status='auktion'`).
- Kein Trigger-Fehler bei den drei neuen Status-Transitionen.
