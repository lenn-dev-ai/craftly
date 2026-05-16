# Reparo — Live-Test Findings & Remaining Fixes

> **Quelle:** Kompletter Live-Test aller 4 Rollen (Admin, Verwalter, Handwerker, Mieter) am 15.05.2026 + Abgleich mit AUDIT-FIX-PROMPT.md und BRAINDUMP-FIX-PROMPT.md  
> **Ziel:** Alle offenen Findings + neue Bugs aus dem Live-Test fixen. Web-App only.  
> **Vorgehen:** 3 Sprints. Nach jedem Sprint: `npm run build && npm run typecheck && npm run lint`

---

## Kontext & Stack

- Next.js 14.2 App Router + Supabase + Tailwind CSS + TypeScript
- Supabase RLS, SECURITY DEFINER Helpers
- KI-Erkennung via `claude-haiku-4-5` in `app/api/ki/schadenserkennung/route.ts`
- Pricing-Modul: `lib/pricing/commission` + `app/api/pricing/calculate/route.ts`
- Deployed auf Netlify, Supabase Cloud

---

## Was bereits erledigt ist (NICHT nochmal anfassen)

Folgende Fixes aus AUDIT-FIX-PROMPT.md und BRAINDUMP-FIX-PROMPT.md sind **bereits implementiert und im Live-Test verifiziert**:

- ✅ BUG-1: "Bad" Chip Active-State — funktioniert korrekt
- ✅ FIX-10: Admin-KPI Feldnamen (erstellt_von statt ersteller_id) — KPIs zeigen korrekte Werte
- ✅ Sicht-Wechsel (Admin/Verwaltung/Handwerker/Mieter) — funktioniert in allen Dashboards
- ✅ KI-Anomalie-Erkennung im Admin-Dashboard — zeigt korrekt "70% offen"
- ✅ KI-Empfehlungen im Admin-Dashboard — Handwerker einladen, Erledigungsrate
- ✅ KPI-Labels korrekt (NUTZER GESAMT, VERWALTER, HANDWERKER, MIETER)
- ✅ Mieter 5-Step-Flow (Foto → Analyse → Details → Ort → Zusammenfassung → Gesendet)
- ✅ KI-Preisschätzungen als Spannen im Verwalter-View (150–800€, 100–500€, 250–600€)
- ✅ Handwerker Einnahmen-Seite mit 100%-Auftragswert-Banner
- ✅ Verwalter Reporting mit Provisions-Anzeige (5%) und Auktions-Ersparnis
- ✅ Tickets-Pipeline mit Typ-Filter (Standard/Diagnose/Projekt) und Status-Filter
- ✅ Footer-Links (Impressum, AGB, Datenschutz) in allen Dashboards
- ✅ Impressum-Seite mit §5 TMG Struktur und Platzhalter-Hinweis
- ✅ SQL-Migrationen: `foto_urls text[]` + `ki_analysen_cache` Tabelle auf Cloud-Supabase

---

## SPRINT 1 — Bugs & UX-Fixes aus dem Live-Test (1h)

### LT-1: Diagnose-Option noch sichtbar im Mieter-Portal

**Status:** BRAINDUMP UX-2 forderte Entfernung — scheint noch nicht umgesetzt.

**Datei:** `app/dashboard-mieter/melden/page.tsx`

Die Option "Erst Diagnose" vs. "Direkte Reparatur" ist immer noch im Mieter-Meldeflow sichtbar. Die Diagnose-Entscheidung gehört zum Verwalter, nicht zum Mieter.

**Fix:**
1. Block für Diagnose/Reparatur-Auswahl entfernen (ca. Zeilen 495-544, ggf. verschoben durch vorherige Edits)
2. Default `ticketTyp = "standard"` sicherstellen
3. In `handleSubmit()`: Status immer `'offen'` bei Mieter-Einreichung, nie `'auktion'`
4. `diagnosePreis`-Anzeige und zugehörige State-Variablen bereinigen

**Verifikation:**
```bash
grep -n "diagnose\|Diagnose\|ticketTyp\|diagnosePreis" app/dashboard-mieter/melden/page.tsx
# Erwartung: Keine UI-relevanten Diagnose-Optionen mehr, ticketTyp = "standard"
```

### LT-2: Dringlichkeit-Enum immer noch inkonsistent

**Status:** BRAINDUMP UX-3 + KI-4 — prüfen ob vereinheitlicht.

Die KI-API gibt `notfall` / `zeitnah` / `planbar` zurück, aber das Frontend nutzt möglicherweise noch `dringend` / `hoch` / `normal`.

**Fix:**
1. Überall auf `notfall` / `zeitnah` / `planbar` vereinheitlichen
2. Chip-Labels im Mieter-Formular: "Planbar" (Default, vorselektiert), "Zeitnah", "Notfall"
3. "Planbar" als Default vorselektiert → User muss nur hochstufen

**Verifikation:**
```bash
grep -rn "dringend\|\"hoch\"\|\"normal\"" app/ components/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."
# Erwartung: Keine alten Enum-Werte mehr
```

### LT-3: Zeitschätzungen im Mieter-Flow noch als Punktwerte

**Status:** BRAINDUMP KI-1 — Im Verwalter-View zeigen die Preise bereits Spannen (150–800€). Aber im Mieter-Meldeflow könnten die Zeitangaben noch als Punktwerte (~4h) angezeigt werden.

**Datei:** `app/dashboard-mieter/melden/page.tsx` (KI_ANALYSEN Lookup)

**Fix:**
1. `KI_ANALYSEN`-Lookup: `zeit`-Feld durch Spanne ersetzen (z.B. `zeitSpanne: "2–6 Stunden"`)
2. UI: Statt `~4h` → `ca. 2–6 Stunden`
3. Disclaimer unter der Schätzung: "Unverbindliche Ersteinschätzung — der finale Preis wird vom Handwerker bestimmt."

**Verifikation:**
```bash
grep -n "zeit\|~.*h\|Stunden\|disclaimer\|Ersteinschätzung" app/dashboard-mieter/melden/page.tsx | head -15
```

### LT-4: Bestätigungsseite nach Schadensmeldung zu überladen

**Status:** BRAINDUMP UX-5 — Die 5-Schritte-Pipeline auf der Bestätigungsseite ist zu viel Info.

**Datei:** `app/dashboard-mieter/melden/page.tsx` (Schritt "gesendet")

**Fix:** Reduzieren auf:
1. ✅ Erfolgsmeldung: "Schaden erfolgreich gemeldet!"
2. Kurzer Hinweis: "Wir prüfen deine Meldung und melden uns bei dir."
3. Zwei Buttons: "Meine Meldungen ansehen" + "Weiteren Schaden melden"

Die detaillierte Pipeline gehört in die Ticket-Detail-Ansicht.

---

## SPRINT 2 — Security-Fixes (1-2h)

### LT-5: Profile-Selects zu breit (AUDIT FIX-7)

**Status:** Aus AUDIT-FIX-PROMPT — prüfen ob umgesetzt.

**Fix:** Alle `select("*")` auf Profile-Tabelle durch explizite Spalten ersetzen:
```bash
grep -rn 'profiles(\*)\|\.select("\*")' app/ components/ --include="*.tsx" --include="*.ts" | grep -iv "node_modules"
```
Ersetze durch: `.select("id, name, rolle, firma, gewerk, bewertung_avg")` (öffentlich sichtbare Felder).

### LT-6: Storage-RLS für Schadensfotos (AUDIT FIX-8)

**Status:** Aus AUDIT-FIX-PROMPT — prüfen ob umgesetzt. Die neue `schadens_fotos_select_strict` RLS-Policy wurde per SQL-Migration auf Cloud-Supabase eingespielt.

**Fix:** Verifizieren, dass die Storage-Policy korrekt greift:
```bash
grep -rn "schadens.fotos\|storage.*objects\|foto_url" supabase/migrations/ --include="*.sql" | tail -10
```

### LT-7: Error-Handling bei Business-Aktionen (AUDIT FIX-11)

**Status:** Aus AUDIT-FIX-PROMPT — prüfen ob umgesetzt.

**Fix:** Bei JEDER Supabase-Mutation den Error prüfen:
```bash
grep -rn "await supabase" components/ticket/ app/api/ --include="*.tsx" --include="*.ts" | grep -v "select\|from\|rpc.*select" | grep -v "error" | head -20
# Zeigt Writes ohne Error-Check
```

Jeder Write ohne Error-Check muss ergänzt werden:
```typescript
const { error } = await supabase.from("...").update({...}).eq("id", ...)
if (error) { toast.error("Aktion fehlgeschlagen"); return }
```

---

## SPRINT 3 — Kalender & Business-Logik (1-2h)

### LT-8: Bei Auftrag-Annahme Kalender-Eintrag erstellen (BRAINDUMP KAL-2)

**Status:** Im Live-Test getestet — der Handwerker-Zeitplan war leer trotz zugewiesener Aufträge.

**Datei:** `app/api/auction/close/route.ts` (oder Ticket-Vergabe-Logik)

**Fix:** Nach erfolgreicher Vergabe einen Termin auto-erstellen:
```typescript
await supabase.from('termine').insert({
  handwerker_id: zugewiesenerHw,
  ticket_id: ticketId,
  titel: `Auftrag: ${ticket.titel}`,
  datum: ticket.wunschtermin ?? new Date().toISOString().split('T')[0],
  von: '09:00',
  bis: '13:00', // Default 4h-Block
  notizen: 'Auto-erstellt bei Auftragsvergabe',
})
```

**Verifikation:**
```bash
grep -rn "termine.*insert\|auto.*erstellt\|Auftragsvergabe" app/api/ --include="*.ts" | head -5
```

### LT-9: Abwicklungsfrist mit Warnung (BRAINDUMP KAL-4)

**Datei:** `app/api/auction/check-expired/route.ts` (erweitern) oder `netlify/functions/abwicklungsfrist.mts` (NEU)

**Fix:** Im bestehenden Cron-Job (check-expired) einen zweiten Check einbauen:
1. Tickets mit `status = 'in_bearbeitung'` und `updated_at` > 10 Tage → Warning-Flag setzen
2. Tickets mit `status = 'in_bearbeitung'` und `updated_at` > 14 Tage → Status zurück auf `offen`, `zugewiesener_hw = NULL`
3. Frist-Dauer als Konstante: `const WARN_NACH_TAGEN = 10; const FRIST_TAGEN = 14;`

**Verifikation:**
```bash
grep -rn "WARN_NACH\|FRIST_TAGEN\|abwicklungsfrist\|ueberfaellig" app/api/ netlify/ --include="*.ts" --include="*.mts" | head -5
```

### LT-10: Provisions-Konsistenz prüfen (BRAINDUMP BIZ-1)

**Problem:** AGB sagen 5% Basis, Brain-Dump sprach von 10%.

**Fix:** Einheitlichen Wert sicherstellen:
```bash
grep -rn "provisionRate\|commission\|0\.05\|0\.10\|5%\|10%" lib/pricing/ app/api/pricing/ app/agb/ --include="*.ts" --include="*.tsx" | head -15
```

Im Live-Test zeigte das Verwalter-Reporting "5% vom Auftragswert" (14,55€ auf 291€) — das ist konsistent. Sicherstellen, dass Code und AGB übereinstimmen. Falls 5% korrekt ist, alle Stellen mit 10% oder 0.10 korrigieren.

---

## NICHT IN DIESEM PROMPT (spätere Sprints)

Diese Punkte aus den vorherigen Prompts sind bewusst ausgeklammert:
- **KAL-1:** Vollständiger Kalender-Editor (zu komplex für Quick-Fix)
- **KAL-3:** Google Calendar OAuth-Integration (eigenes Feature)
- **Video-Upload:** Braucht Transcoding-Pipeline
- **Eigentümer-Rolle:** Neues Auth-Konzept
- **Stripe Penalty/Gebühr:** Zahlungsintegration nötig

---

## OBLIGATORISCHE QA-CHECKLISTE

### Schritt 1: Type-Check + Build
```bash
npm run typecheck    # tsc --noEmit muss grün sein
npm run build        # Production Build muss grün sein
npm run lint         # ESLint muss grün sein
```

### Schritt 2: Grep-Verifikation
```bash
# LT-1: Keine Diagnose-Option mehr im Mieter-Flow
grep -n "ticketTyp.*diagnose\|Erst Diagnose\|Direkte Reparatur" app/dashboard-mieter/melden/page.tsx
# Erwartung: Keine UI-Treffer

# LT-2: Keine alten Dringlichkeit-Enums
grep -rn "\"dringend\"\|\"hoch\"\|\"normal\"" app/ components/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test." | grep -v "// "
# Erwartung: Keine Treffer (nur planbar/zeitnah/notfall)

# LT-3: Zeitspannen statt Punktwerte
grep -n "~.*h\|zeit:" app/dashboard-mieter/melden/page.tsx | head -10
# Erwartung: Spannen wie "2–6 Stunden"

# LT-5: Keine select("*") auf profiles
grep -rn 'select("\*")' app/ components/ --include="*.tsx" --include="*.ts" | grep -i profil
# Erwartung: Keine Treffer

# LT-7: Error-Handling
grep -rn "\.update(\|\.insert(\|\.upsert(\|\.delete(" components/ticket/ --include="*.tsx" | grep -v "error"
# Erwartung: Alle Writes haben Error-Handling

# LT-8: Kalender-Eintrag bei Vergabe
grep -rn "termine.*insert" app/api/ --include="*.ts"
# Erwartung: Mindestens 1 Treffer in auction/close oder vergabe
```

### Schritt 3: E2E-Tests
```bash
npm run test:e2e
# Alle Tests müssen grün sein
```

---

## Commit-Konvention

```
fix(live-test): [Beschreibung]
```

Beispiele:
- `fix(live-test): remove diagnose option from mieter melden flow`
- `fix(live-test): unify dringlichkeit enum to planbar/zeitnah/notfall`
- `fix(live-test): add error handling to all supabase mutations`
- `fix(live-test): auto-create termin on auftrag vergabe`
