# Reparo — Brain-Dump Prompt: Bugs, UX, KI, Kalender & Business

> **Quelle:** ChatGPT-Audit Brain-Dump (sortiert & priorisiert)  
> **Ziel:** Alle offenen Findings in einem Prompt für Claude Code — Web-App only (`app/`, `components/`, `lib/`).  
> **Vorgehen:** 4 Sprints, aufsteigend nach Komplexität. Nach jedem Sprint: `npm run build` + grep-Verifikation.

---

## Kontext & Stack

- Next.js 14.2 App Router + Supabase + Tailwind CSS + TypeScript
- Supabase RLS, SECURITY DEFINER Helpers
- KI-Erkennung via `claude-haiku-4-5` in `app/api/ki/schadenserkennung/route.ts`
- Pricing-Modul: `lib/pricing/commission` + `app/api/pricing/calculate/route.ts`
- Kalender: `components/handwerker/TimetableView.tsx` + Supabase-Tabellen `termine`, `verfuegbarkeiten`

---

## SPRINT 1 — Quick-Win Bugs (30 min)

### BUG-1: Kurzwahl "Bad" zeigt keinen Active-State

**Datei:** `app/dashboard-mieter/melden/page.tsx` ca. Zeile 586-599

Die Schnellauswahl-Raum-Chips (Küche, Bad, Wohnzimmer …) hängen den Raum an `form.wohnung` an. Das Problem: der Active-State (visuelles Highlighting des ausgewählten Chips) fehlt oder funktioniert nicht korrekt für "Bad".

**Fix:** Sicherstellen, dass die `className` jedes Chips dynamisch auf `form.wohnung.includes(raum)` reagiert. Der Chip für "Bad" muss denselben `bg-accent text-white border-accent` Style bekommen wie alle anderen selektierten Chips.

**Verifikation:**
```bash
grep -n "Bad\|Küche\|wohnung" app/dashboard-mieter/melden/page.tsx | head -20
```

### BUG-2: Geschätzte Zeit aktualisiert sich nicht beim Ändern (State-Sync-Bug)

**Datei:** `app/dashboard-mieter/melden/page.tsx` ca. Zeile 442-443

Die angezeigte geschätzte Zeit (`analyse.zeit`) stammt aus dem `KI_ANALYSEN`-Lookup (Zeilen 15-22). Wenn der User die KI-Kategorie/Schadensart nachträglich ändert, aktualisiert sich die angezeigte Zeit nicht.

**Fix:** Die Zeit-Anzeige muss reaktiv vom aktuell gewählten Gewerk/Kategorie abhängen, nicht nur vom initialen KI-Ergebnis. Wenn der User manuell eine andere Kategorie wählt, muss `analyse.zeit` aus der neuen KI_ANALYSEN-Kategorie gezogen werden.

**Verifikation:**
```bash
grep -n "zeit\|KI_ANALYSEN\|analyse\." app/dashboard-mieter/melden/page.tsx | head -20
```

---

## SPRINT 2 — Mieter-Portal UX-Verbesserungen (1-2h)

### UX-1: Mehrere Fotos ermöglichen (aktuell nur 1)

**Datei:** `app/dashboard-mieter/melden/page.tsx` Zeile 55

Aktuell: `fotoFile` ist `File | null` — nur ein einzelnes Foto.

**Fix:**
1. State ändern: `const [fotoFiles, setFotoFiles] = useState<File[]>([])`
2. Max 5 Fotos erlauben
3. `<input type="file" multiple accept="..." />` (Zeile ~290)
4. Vorschau: Thumbnail-Grid statt Einzelbild
5. Upload-Logik in `handleSubmit()` (Zeile ~180-251): Loop über alle Fotos, speichere als Array in `foto_urls` (NEUES Feld) oder als komma-separierte `foto_url`
6. Bestehende `foto_url`-Kompatibilität beibehalten (erstes Foto = `foto_url`, Rest = `foto_urls[]`)

**Supabase:** Neues Feld `foto_urls text[]` an Tickets-Tabelle — **ODER** einfach `foto_url` als erstes Foto lassen und weitere Fotos als `schadens-fotos/{user_id}/{ticket_id}/foto_2.jpg` etc. hochladen, abrufbar via Storage-Listing.

> **Hinweis:** Kein Video-Upload in diesem Sprint — zu komplex (Transcoding, Storage-Kosten). Später als Feature.

### UX-2: "Diagnose und direkte Reparatur" raus aus Mieter-Portal

**Datei:** `app/dashboard-mieter/melden/page.tsx` Zeilen 495-544

Die Option "Erst Diagnose" vs. "Direkte Reparatur" ist eine Fachentscheidung, die der Mieter nicht treffen sollte. Das gehört in den Verwalter-/Handwerker-Flow.

**Fix:** Den gesamten Block (Zeilen 495-544) entfernen. Default `ticketTyp = "standard"` (Zeile 63). Die Diagnose-Option wird vom Verwalter nach Sichtung des Tickets gesetzt.

**Achtung:** Auch die `diagnosePreis`-Anzeige und die Auswirkungen in `handleSubmit()` (Zeile 211: `status: ticketTyp === 'diagnose' ? 'auktion' : 'offen'`) bereinigen. Status immer `'offen'` bei Mieter-Einreichung.

### UX-3: Dringlichkeit "Normal" wird kaum gewählt — Default überarbeiten

**Datei:** `app/dashboard-mieter/melden/page.tsx` Zeilen 474-493

Aktuell 3 Optionen: Normal / Hoch / Notfall. "Normal" wird laut Nutzerfeedback fast nie aktiv gewählt.

**Fix-Optionen (wähle eine):**
- **Option A:** "Normal" als Default vorselektieren → User muss nur hochstufen wenn nötig
- **Option B:** Labels umformulieren: "Planbar" (statt Normal), "Zeitnah" (statt Hoch), "Notfall" (bleibt)
- **Empfohlen: Option A + B kombiniert** — Default = "Planbar", Hochstufen möglich

**Zusätzlich — Dringlichkeit-Enum vereinheitlichen!**  
Frontend benutzt `normal` / `hoch` / `dringend`, aber die KI-API gibt `planbar` / `zeitnah` / `notfall` zurück. Das muss überall einheitlich sein. Empfohlene Werte: `planbar` / `zeitnah` / `notfall` (konsistent mit API).

**Dateien betroffen:**
- `app/dashboard-mieter/melden/page.tsx` Zeilen 474-493 (Chips)
- `app/dashboard-mieter/melden/page.tsx` Zeilen 15-22 (KI_ANALYSEN Lookup — `dringlichkeit`-Werte)
- `app/api/ki/schadenserkennung/route.ts` Zeilen 37-39 (API-Schema)
- Alle Stellen die `dringend` / `hoch` / `normal` als Enum-Werte nutzen

```bash
grep -rn "dringend\|\"hoch\"\|\"normal\"\|zeitnah\|planbar\|notfall" app/ components/ --include="*.tsx" --include="*.ts" | grep -v node_modules | head -30
```

### UX-4: Schnellauswahl Raum evaluieren

**Datei:** `app/dashboard-mieter/melden/page.tsx` Zeilen 586-599

Die Raum-Chips (Küche, Bad, Wohnzimmer, Schlafzimmer, Flur, Keller, Balkon) sind praktisch, aber optional. Statt sie komplett zu entfernen: **als optional markieren** und das Freitextfeld prominenter machen.

**Fix:** Label ändern von "Wo befindet sich der Schaden?" zu "Wo befindet sich der Schaden? (optional)". Raum-Chips als Vorschläge stylen (outline statt filled), Freitextfeld für Adresse/Details bleibt Pflicht.

### UX-5: Bestätigungsseite kürzen

**Datei:** `app/dashboard-mieter/melden/page.tsx` Zeilen 684-712

Die Gesendet-Seite zeigt eine 5-Schritte-Pipeline (Gemeldet > Prüfung > Marktplatz > Reparatur > Fertig). Das ist zu viel Info nach dem Submit.

**Fix:** Auf 3 Elemente reduzieren:
1. ✅ Erfolgsmeldung: "Schaden erfolgreich gemeldet!"
2. Kurzer Hinweis: "Wir prüfen deine Meldung und melden uns."
3. Zwei Buttons: "Meine Meldungen" + "Weiteren Schaden melden"

Die detaillierte Pipeline gehört in die Ticket-Detail-Ansicht, nicht auf die Bestätigungsseite.

---

## SPRINT 3 — KI & Pricing (1-2h)

### KI-1: Preisschätzungen realistischer machen — Punktschätzung → Preisspanne

**Datei:** `app/dashboard-mieter/melden/page.tsx` Zeilen 15-22 (`KI_ANALYSEN`)

Aktuell liefert die KI_ANALYSEN-Tabelle feste `zeit`-Werte wie `~4h`. Diese werden dem Mieter als feste Schätzung präsentiert, was unrealistische Erwartungen erzeugt.

**Fix:**
1. In `KI_ANALYSEN`: `zeit`-Feld durch Spanne ersetzen, z.B. `zeitVon: "2h", zeitBis: "6h"` oder `zeitSpanne: "2-6 Stunden"`
2. UI anpassen (Zeile 442-443): Statt `~4h` → `ca. 2-6 Stunden`
3. **Disclaimer hinzufügen:** "Unverbindliche Ersteinschätzung — der finale Preis wird vom Handwerker bestimmt."
4. Falls es eine Euro-Schätzung gibt: Auch diese durch eine Spanne ersetzen (z.B. "150-400 €" statt "280 €")

**Pricing-Modul prüfen:**
```bash
grep -rn "preis\|kosten\|estimate\|schaetz" lib/pricing/ app/api/pricing/ --include="*.ts" | head -20
```

### KI-2: "Sonstiger Schaden" — Pricing-Logik klären

**Datei:** `app/dashboard-mieter/melden/page.tsx` Zeile 22 (KI_ANALYSEN `sonstiges`)

Wenn die KI `sonstiges` erkennt, gibt es keinen klaren Gewerk-Zuordnung. Die Preis-Logik für diesen Fall ist unklar.

**Fix:** Bei `sonstiges` → keine Preisschätzung anzeigen, stattdessen: "Preis wird nach Besichtigung festgelegt." Gewerk auf `allgemein` setzen.

### KI-3: Spam-Schutz verbessern — identische Anfragen blocken

**Datei:** `app/api/ki/schadenserkennung/route.ts` Zeilen 97-118

Aktuell: Max 10 KI-Calls pro Tag pro User (über `try_consume_ki_quota`). Aber: Derselbe Schaden kann 10x identisch eingereicht werden.

**Fix:** Vor dem KI-Call: Hash des Foto-Blobs (oder `foto_url`-Pfad) prüfen. Wenn dasselbe Foto bereits in den letzten 24h analysiert wurde → gecachtes Ergebnis zurückgeben statt neuen API-Call.

```typescript
// Pseudo-Code für Deduplizierung
const fotoHash = await crypto.subtle.digest('SHA-256', fotoBuffer)
const hashHex = [...new Uint8Array(fotoHash)].map(b => b.toString(16).padStart(2,'0')).join('')
const { data: cached } = await supabase
  .from('ki_analysen_cache')
  .select('ergebnis')
  .eq('foto_hash', hashHex)
  .eq('user_id', userId)
  .gte('created_at', new Date(Date.now() - 86400000).toISOString())
  .single()
if (cached) return NextResponse.json(cached.ergebnis)
```

> **Supabase:** Neue Tabelle `ki_analysen_cache` (foto_hash, user_id, ergebnis jsonb, created_at) — oder einfach im Memory/Redis wenn verfügbar.

### KI-4: Dringlichkeit-Enum Mismatch fixen (gehört auch zu UX-3)

Die KI-API (`route.ts` Zeile 37-39) gibt `notfall` / `zeitnah` / `planbar` zurück.  
Die Frontend-Chips (`page.tsx` Zeile 474-493) nutzen `dringend` / `hoch` / `normal`.  
Die KI_ANALYSEN-Lookup (`page.tsx` Zeile 15-22) nutzt gemischte Werte.

**Fix:** Überall auf `notfall` / `zeitnah` / `planbar` vereinheitlichen. Supabase-Check-Constraint anpassen wenn nötig.

```bash
grep -rn "CHECK.*dringlichkeit\|dringlichkeit.*CHECK" supabase/migrations/ | head -5
```

---

## SPRINT 4 — Kalender & Business-Logik (2-3h)

### KAL-1: Zeitslot-Logik vereinfachen — Kalender-Editor bauen

**Datei:** `components/handwerker/TimetableView.tsx`

Aktuell: TimetableView ist **read-only** — es zeigt bestehende Termine an (Zeilen 314-434), hat aber **keine Erstellungs-/Bearbeitungs-UI**. Freie Slots werden erkannt (Zeilen 336-353) aber nicht interaktiv nutzbar.

**Fix:** Inline-Editing hinzufügen:
1. Klick auf freien Zeitslot → Modal öffnen mit: Titel, Datum, Von, Bis
2. Termin speichern via `supabase.from('termine').insert({...})`
3. Termin löschen via Swipe oder Long-Press → Bestätigungsdialog
4. Verfügbarkeiten editieren: Wochentag-Grid (Mo-Fr) mit Von/Bis-Zeiten, toggle aktiv/inaktiv
5. Drag-Resize für bestehende Termine (nice-to-have, kann später)

**Bestehende Supabase-Tabellen nutzen:** `termine` (Zeile 103-132 im Component) und `verfuegbarkeiten`.

### KAL-2: Bei Auftrag-Annahme Slot automatisch sperren

**Aktuell:** Wenn ein Verwalter ein Angebot annimmt (`app/api/auction/close`), wird der Handwerker zugewiesen, aber kein Kalender-Eintrag erstellt.

**Fix:** Im `auction/close`-Endpoint nach erfolgreicher Vergabe:
```typescript
// Auto-create Termin nach Vergabe
await supabase.from('termine').insert({
  handwerker_id: zugewiesenerHw,
  ticket_id: ticketId,
  titel: `Auftrag: ${ticket.titel}`,
  datum: ticket.wunschtermin ?? new Date().toISOString().split('T')[0],
  von: '09:00',
  bis: '13:00', // Default 4h-Block
  notizen: `Auto-erstellt bei Auftragsvergabe`,
})
```

**Datei prüfen:**
```bash
grep -rn "auction/close\|zugewiesener_hw" app/api/ --include="*.ts" | head -10
```

### KAL-3: Google Calendar Integration (Konzept, nicht vollständig implementierbar)

**Status:** Supabase hat bereits `google_refresh_token` und `google_calendar_connected` Spalten in `profiles` (aus früherer Migration). Aber **kein Code** nutzt diese.

**Minimale Integration:**
1. OAuth2-Flow: `app/api/auth/google-calendar/route.ts` — Redirect zu Google, Token speichern
2. Sync-Funktion: Bei Termin-Erstellen/Löschen → Google Calendar API call
3. UI: "Google Kalender verbinden" Button im Handwerker-Profil

> **Umfang:** Das ist ein größeres Feature. Für diesen Sprint reicht es, die Endpunkte zu **stubben** und die UI-Buttons hinzuzufügen mit "Coming soon"-Hinweis.

### KAL-4: Abwicklungsfrist mit automatischer Freigabe

**Konzept:** Wenn ein Handwerker einen Auftrag annimmt aber nach X Tagen nicht als erledigt markiert:
1. Automatische Warnung nach 80% der Frist
2. Nach Ablauf: Ticket-Status zurück auf `auktion`, Handwerker-Zuordnung entfernen
3. Penalty auf Handwerker-Profil (Bewertungs-Malus)

**Fix:** Supabase Edge-Function oder Cron-Job der täglich `tickets` mit Status `in_bearbeitung` und `created_at` > X Tage prüft.

```typescript
// Pseudo: Cron prüft überfällige Tickets
const { data: ueberfaellig } = await supabase
  .from('tickets')
  .select('id, zugewiesener_hw, created_at')
  .eq('status', 'in_bearbeitung')
  .lt('created_at', new Date(Date.now() - 14 * 86400000).toISOString()) // 14 Tage
```

> **Hinweis:** Frist-Dauer und Penalty-Logik sind Business-Entscheidungen — als konfigurierbare Konstanten anlegen.

### BIZ-1: Vermittlungsgebühr 10% — bereits implementiert, prüfen

**Dateien:**
- `app/agb/page.tsx` Zeilen 98-126: AGB-Definition (5% Basis, +20% Notfall-Zuschlag, +10% Zeitnah, 90-Tage Early-Adopter 0%)
- `lib/pricing/commission` + `app/api/pricing/calculate/route.ts`: `calculateTotal`, `getEffectiveRate`, `provisionRate`

**Prüfung:** Die AGB sagen 5% Basis, aber der Brain-Dump spricht von 10%. Welcher Wert ist korrekt? → AGB und Code auf Konsistenz prüfen.

```bash
grep -rn "provisionRate\|commission\|0\.05\|0\.10\|5%\|10%" lib/pricing/ app/api/pricing/ app/agb/ --include="*.ts" --include="*.tsx" | head -15
```

### BIZ-2: Verdienstkalkulator für Handwerker

**Status:** Existiert noch nicht.

**Konzept:** Neuer Screen im Handwerker-Dashboard: "Was kannst du verdienen?"
- Input: Gewerk, Stundensatz, verfügbare Stunden/Woche
- Output: Geschätzter Monatsverdienst nach Abzug der Reparo-Gebühr
- Formel: `(stundensatz × stunden_pro_woche × 4) × (1 - provisionRate)`

**Datei:** `app/dashboard-handwerker/verdienst/page.tsx` (NEU)

> **Hinweis:** Einfache statische Berechnung reicht, keine Supabase-Queries nötig.

---

## NICHT IN DIESEM PROMPT (spätere Sprints)

- **Video-Upload:** Braucht Transcoding-Pipeline (FFmpeg/Cloud), Storage-Kosten-Analyse
- **Eigentümer-Rolle:** Neues Auth-Konzept, Dashboard, RLS-Policies — eigener Mega-Prompt
- **Adresse erst nach Bestätigung:** Braucht Architektur-Entscheidung (verschlüsselte Spalte? separater Freigabe-Flow?)
- **Penalty/Gebühr bei No-Show:** Zahlungsintegration nötig (Stripe etc.)

---

## TECHNISCHE REGELN

1. **Nur Web-App** — `app/`, `components/`, `lib/` — keine Änderungen an `mobile/` oder Supabase-Migrationen
2. **Bestehende Patterns beibehalten** — Tailwind, Supabase-Client aus `lib/supabase`, Error-Handling
3. **Deutsche UI-Texte** — konsistent mit bestehendem Wording
4. **Keine neuen npm Dependencies** ohne triftigen Grund
5. **API-URL:** `process.env.NEXT_PUBLIC_SITE_URL` für API-Calls
6. **Neue Supabase-Tabellen:** Nur wenn unbedingt nötig, als SQL-Kommentar dokumentieren (Migration separat)

---

## QA-CHECKLISTE

Nach jedem Sprint:
```bash
npm run build 2>&1 | tail -5
# Muss ohne Fehler durchlaufen
```

### Sprint 1 — Bugs
```bash
grep -n "bg-accent.*Bad\|active.*Bad\|selected.*Bad" app/dashboard-mieter/melden/page.tsx
grep -n "zeit\|KI_ANALYSEN" app/dashboard-mieter/melden/page.tsx | head -10
```

### Sprint 2 — UX
```bash
# Multi-Foto: fotoFiles statt fotoFile
grep -n "fotoFile\|fotoFiles\|multiple" app/dashboard-mieter/melden/page.tsx | head -10
# Diagnose-Option entfernt
grep -n "diagnose\|ticketTyp" app/dashboard-mieter/melden/page.tsx | head -10
# Dringlichkeit-Enum vereinheitlicht
grep -rn "\"dringend\"\|\"hoch\"\|\"normal\"" app/ components/ --include="*.tsx" --include="*.ts" | head -10
# Sollte 0 Ergebnisse liefern (alles auf planbar/zeitnah/notfall)
```

### Sprint 3 — KI
```bash
grep -n "zeitVon\|zeitBis\|zeitSpanne\|Spanne\|range" app/dashboard-mieter/melden/page.tsx | head -10
grep -n "foto_hash\|cache\|dedup" app/api/ki/schadenserkennung/route.ts | head -10
```

### Sprint 4 — Kalender
```bash
grep -n "insert.*termine\|Termin.*erstell" components/handwerker/TimetableView.tsx | head -10
grep -n "auto.*termin\|termine.*insert" app/api/auction/ --include="*.ts" -r | head -5
```
