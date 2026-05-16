# Reparo Security & Business-Logic Audit — Fix-Prompt für Claude Code

> **Kontext:** Zwei unabhängige Read-only-Audits (ChatGPT Codex + Cowork) haben 16 Findings ergeben. Dieses Dokument beschreibt die P1/P2-Fixes mit exakten Dateinamen, Zeilennummern und Code-Belegen. Du darfst Dateien ändern, committen und pushen. Nach den Fixes MUSS `npm run build` und `npm run typecheck` grün sein. E2E-Tests solltest du ebenfalls laufen lassen.

---

## SPRINT A — Kritische P1-Fixes (Security + Business-Logic)

### FIX-1: Cron nutzt falschen Supabase-Client (P1)

**Problem:** `app/api/auction/check-expired/route.ts` Zeile 45 erstellt `createServerSupabaseClient()` (User-Kontext). Wenn der Cron-Job via Secret-Auth aufgerufen wird, gibt es keinen User → RLS greift → Ticket-Query ab Zeile 60 gibt leer zurück → Auktionen werden nie automatisch geschlossen. Ab Zeile 264 wird für Diagnose-Tickets korrekt `createServiceRoleClient()` verwendet.

**Betroffene Dateien:**
- `app/api/auction/check-expired/route.ts` Zeile 45, 60
- `netlify/functions/check-expired-auctions.mts` Zeile 13

**Fix:**
1. Im Secret-Auth-Pfad (wenn `authViaSecret === true`) den Service-Role-Client verwenden statt den User-Context-Client:
```typescript
// Zeile 45 ersetzen durch:
const supabase = authViaSecret ? createServiceRoleClient() : createServerSupabaseClient()
```
2. Alternativ: Die gesamte Auktions-Query (Zeile 60ff) ebenfalls mit `createServiceRoleClient()` ausführen, so wie es ab Zeile 264 für Diagnose-Tickets bereits gemacht wird.
3. In `netlify/functions/check-expired-auctions.mts` Zeile 13: Fallback `"netlify-scheduled"` entfernen — wenn `CRON_SECRET` nicht gesetzt ist, soll der Cron NICHT laufen:
```typescript
// VORHER:
"x-cron-secret": process.env.CRON_SECRET || "netlify-scheduled",
// NACHHER:
"x-cron-secret": process.env.CRON_SECRET || "",
```

**Tests:** Cron mit gesetztem CRON_SECRET schließt abgelaufene Auktion mit Angeboten korrekt ab; ohne Angebote → Ticket zurück auf `offen`.

---

### FIX-2: Ticket-Vergabe ist clientseitig, nicht atomar, ignoriert Fehler (P1)

**Problem:** `components/ticket/TicketDetailView.tsx` ab Zeile 223: Die `vergeben()`-Funktion führt 5+ unabhängige Supabase-Writes direkt aus dem Browser aus (Ticket-Update Z.229, Angebote-Updates Z.236-237, Provisions-Upsert Z.245, Termin, Chat). Kein einziger Write prüft `{ error }`. Teilfehler = inkonsistenter DB-State.

**Fix:**
1. Erstelle eine neue API-Route `app/api/auction/close/route.ts` (oder erweitere die bestehende):
   - Nimmt `ticketId` und `angebotId` entgegen
   - Führt alle Writes serverseitig in einer Transaktion/RPC aus
   - Prüft jeden Write auf Fehler, gibt bei Teilfehler 500 zurück
   - Nutzt Service-Role oder User-Auth mit korrekter RLS
2. In `TicketDetailView.tsx`: Die `vergeben()`-Funktion soll nur noch `fetch("/api/auction/close", ...)` aufrufen statt direkte Supabase-Writes
3. **Mindestens Error-Handling hinzufügen:** Falls die API-Migration zu groß ist, als Zwischenlösung JEDE `await supabase.from(...).update/upsert(...)` mit `{ error }` destrukturieren und bei Fehler `toast.error()` anzeigen + abbrechen:
```typescript
// Beispiel für Zeile 229:
const { error: ticketErr } = await supabase.from("tickets").update({...}).eq("id", id)
if (ticketErr) { toast.error("Vergabe fehlgeschlagen"); return }
```

**Tests:** Doppel-Klick-Race, RLS-Block bei Teiloperation, fehlender Provisions-Insert → sichtbare Fehlermeldung.

---

### FIX-3: Mail-Empfänger bei Mieter-Tickets falsch (P1, 3 Stellen)

**Problem:** Bid-Mails, Befund-Mails und Nachtrags-Mails werden an `ticket.erstellt_von` gesendet. Bei Mieter-erstellten Tickets ist das der Mieter — der Verwalter (der die Entscheidung treffen muss) bekommt keine Mail.

**Betroffene Stellen:**
1. `app/api/auction/bid/route.ts` Zeile 98: `.eq("id", ticket.erstellt_von)`
2. `app/api/nachtraege/einreichen/route.ts` Zeile 124: `.eq("id", ticket.erstellt_von)`
3. `app/api/diagnose/befund-abgeben/route.ts` (gleicher Pattern prüfen)

**Fix für jede Stelle:**
```typescript
// VORHER:
.eq("id", ticket.erstellt_von)

// NACHHER:
.eq("id", ticket.verwalter_id ?? ticket.erstellt_von)
```

Stelle sicher, dass der Ticket-Select an jeder Stelle `verwalter_id` mit abfragt (z.B. `.select("id, titel, erstellt_von, verwalter_id")`).

**Tests:** Mieter-Ticket mit zugewiesenem Verwalter: Bid-Mail, Befund-Mail und Nachtrags-Mail gehen an den Verwalter, nicht an den Mieter.

---

### FIX-4: Verwalter sieht Diagnose-/Nachtrags-Aktionen im UI nicht (P1)

**Problem:** In `DiagnosePipeline.tsx` Zeile 69 und `NachtragsBox.tsx` Zeile 66 wird `isErsteller` / `istErsteller` gegen `ticket.erstellt_von` geprüft. Bei Mieter-Tickets ist das der Mieter → der zuständige Verwalter sieht keine Aktionsbuttons (Angebot annehmen, In Auktion geben, Nachtrag genehmigen), obwohl die APIs ihn durchlassen würden.

**Fix DiagnosePipeline.tsx Zeile 69:**
```typescript
// VORHER:
const isErsteller = currentUser?.id === ticket.erstellt_von

// NACHHER:
const isErsteller = currentUser?.id === ticket.erstellt_von || currentUser?.id === ticket.verwalter_id
```

**Fix NachtragsBox.tsx Zeile 66:**
```typescript
// VORHER:
const istErsteller = currentUser?.id === ticket.erstellt_von

// NACHHER:
const istErsteller = currentUser?.id === ticket.erstellt_von || currentUser?.id === ticket.verwalter_id
```

**Wichtig:** Stelle sicher, dass der Ticket-Type in `types/index.ts` die Eigenschaft `verwalter_id` enthält und dass die Ticket-Queries in den Parent-Komponenten `verwalter_id` mit selektieren.

**Tests:** Mieter erstellt Diagnose-Ticket → Verwalter öffnet Ticket-Detail → sieht "Angebot annehmen", "In Auktion geben" Buttons. Verwalter sieht auch Nachtrag-Genehmigungs-Buttons.

---

### FIX-5: Diagnose-Übernahme durch Handwerker nicht implementiert (P1)

**Problem:** `app/dashboard-handwerker/diagnosen/page.tsx` Zeile 155-160: Der "Termin annehmen"-Button navigiert nur via `router.push()` zur Ticket-Detailseite. Es gibt keinen echten API-Endpunkt, der den Handwerker atomar als `zugewiesener_hw` setzt. Der E2E-Test (`diagnose-flow.spec.ts`) kaschiert das, indem er per Admin-Client den DB-State manuell setzt.

**Fix:**
1. Erstelle API-Route `app/api/diagnose/termin-annehmen/route.ts`:
   - POST mit `{ ticketId }` Body
   - Prüft: User ist Handwerker, Ticket ist `ticket_typ = 'diagnose'`, Status ist `'auktion'`, `zugewiesener_hw IS NULL`
   - Setzt atomar `zugewiesener_hw = user.id` und `status = 'in_bearbeitung'`
   - Race-Condition-sicher: `UPDATE ... WHERE zugewiesener_hw IS NULL` gibt 0 Rows zurück wenn schon vergeben → 409 Conflict
2. Button in `diagnosen/page.tsx` ändern: statt `router.push()` → `fetch("/api/diagnose/termin-annehmen", ...)` aufrufen, bei Erfolg navigieren
3. E2E-Test anpassen: Admin-Client-Hack entfernen, echter API-Call testen

**Tests:** Zwei Handwerker klicken gleichzeitig → nur einer bekommt `zugewiesener_hw`. Zweiter bekommt 409.

---

### FIX-6: Nachtrags-Mail an falschen Empfänger (P1)

**Problem:** `app/api/nachtraege/einreichen/route.ts` Zeile 124 — identisch mit FIX-3, aber spezifisch für Nachträge.

**Fix:** Bereits in FIX-3 beschrieben. Stelle sicher, dass auch der Ticket-Select in dieser Route `verwalter_id` enthält.

---

## SPRINT B — P2-Fixes (Datenschutz, UX, Datenqualität)

### FIX-7: Datenschutzrisiko — Profile zu breit lesbar (P2)

**Problem:** RLS-Policy `profiles_select` (aus `security_hardening.sql` Zeile 107) erlaubt allen authentifizierten Nutzern `SELECT *` auf alle Profile. Client-Seiten nutzen `profiles(*)` und `.select("*")` (z.B. `TicketDetailView.tsx` Zeile 161). Damit sind E-Mail, Telefon, Adresse, Provision-Rates für alle Nutzer sichtbar.

**Fix:**
1. Ersetze `select("*")` in Client-Seiten durch explizite Spalten:
   - `TicketDetailView.tsx` Zeile 161: `.select("id, name, rolle, firma, gewerk, bewertung_avg")` statt `.select("*")`
   - Alle `profiles(*)` Joins: `.select("..., handwerker:profiles(id, name, firma, gewerk, bewertung_avg)")` statt `profiles(*)`
2. Langfristig: RLS-Policy aufsplitten in "public profile" (Name, Firma, Gewerk, Bewertung) und "private profile" (Email, Telefon, Adresse) — nur für eigenes Profil oder Admin

**Dateien zum Grep-Durchsuchen:**
```bash
grep -rn 'profiles(\*)' app/ components/ --include="*.tsx" --include="*.ts"
grep -rn 'select("\*")' app/ components/ --include="*.tsx" --include="*.ts"
```

---

### FIX-8: Storage-RLS für Schadensfotos zu breit (P2)

**Problem:** `supabase/migrations/20241001000000_ki_analyse.sql` Zeile 39: Alle authentifizierten User können `storage.objects` im Bucket `schadens-fotos` selektieren. Pfade können erraten werden.

**Fix:** Migration schreiben die die SELECT-Policy einschränkt:
- Nur Owner (Hochlader) oder Ticket-Beteiligte (erstellt_von, verwalter_id, zugewiesener_hw) dürfen Fotos lesen
- Alternativ: Signed URLs serverseitig erzeugen statt direktem Storage-Access

---

### FIX-9: KI-Quota vor Validierung verbraucht (P2)

**Problem:** `app/api/ki/schadenserkennung/route.ts` — Quota-RPC `try_consume_ki_quota` wird in Zeile 72-92 aufgerufen, BEVOR die Datei-Validierung (Zeile 94-115) stattfindet. Ein Request mit falschem MIME-Type, zu großer Datei oder fehlendem Feld verbrennt trotzdem ein Quota-Credit.

**Fix:** Reihenfolge umkehren — erst `formData()` parsen und validieren (MIME, Size, File-Existenz), DANN Quota verbrauchen:
```typescript
// 1. Erst Request validieren
let formData: FormData
try { formData = await request.formData() } catch { return 400 }
const file = formData.get("foto")
if (!(file instanceof File)) return 400
if (!ERLAUBTE_MIMES.has(file.type)) return 415
if (file.size > MAX_BYTES) return 413

// 2. Dann Quota prüfen/verbrauchen
const { data: quotaResult } = await supabase.rpc("try_consume_ki_quota", ...)
if (!quotaResult?.allowed) return 429

// 3. Dann KI-Analyse starten
```

---

### FIX-10: Admin-KPI nutzt falsche Feldnamen (P2)

**Problem:** `app/dashboard-admin/nutzer/page.tsx` Zeilen 11 und 17:
- `t.ersteller_id` → Feld heißt `erstellt_von`
- `t.melder_id` → Feld heißt ebenfalls `erstellt_von` (Mieter erstellen Tickets über `erstellt_von`)

**Fix:**
```typescript
// Zeile 11:
// VORHER: const created = tickets.filter(t => t.ersteller_id === user.id).length
// NACHHER:
const created = tickets.filter(t => t.erstellt_von === user.id).length

// Zeile 17:
// VORHER: const reports = tickets.filter(t => t.melder_id === user.id).length
// NACHHER:
const reports = tickets.filter(t => t.erstellt_von === user.id).length
```

---

### FIX-11: Business-Aktionen prüfen DB-Errors nicht (P2)

**Problem:** Mehrere Stellen ignorieren `{ error }` bei Supabase-Writes:
- `TicketDetailView.tsx` Zeile 191: Chat-Insert ohne Error-Check
- `TicketDetailView.tsx` Zeile 229ff: vergeben() ohne Error-Check (→ FIX-2)
- `app/api/nachtraege/genehmigen/route.ts` Zeile 82: Update ohne Error-Check

**Fix:** Bei JEDER Mutation den Error destrukturieren:
```typescript
const { error } = await supabase.from("...").update({...}).eq("id", ...)
if (error) {
  // In API-Routes: return NextResponse.json({ error: error.message }, { status: 500 })
  // In UI-Komponenten: toast.error("Aktion fehlgeschlagen: " + error.message); return
}
```

---

### FIX-12: Diagnose-Liste filtert nicht nach Nähe (P2)

**Problem:** `app/dashboard-handwerker/diagnosen/page.tsx` Zeile 51-58: Kommentar sagt "Offene in der Nähe", aber der Query filtert nur `status.eq.auktion` ohne Radius/Gewerk-Filter.

**Fix:** Entweder:
1. Kommentar korrigieren (wenn bewusst alle Diagnosen gezeigt werden sollen)
2. Oder serverseitige RPC mit Distanzfilter implementieren (konsistent mit dem Auktions-Radius)

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
# FIX-1: Service-Role im Cron-Pfad
grep -n "createServiceRoleClient\|createServerSupabaseClient" app/api/auction/check-expired/route.ts
# Erwartung: Cron-Pfad nutzt Service-Role

# FIX-3/6: Mail-Empfänger
grep -rn "ticket.erstellt_von" app/api/ --include="*.ts" | grep -i "mail\|email\|profil"
# Erwartung: Kein Mail-Empfänger mehr direkt über erstellt_von — immer verwalter_id ?? erstellt_von

# FIX-4: isErsteller prüft auch verwalter_id
grep -n "isErsteller\|istErsteller" components/ticket/DiagnosePipeline.tsx components/ticket/NachtragsBox.tsx
# Erwartung: Bedingung enthält verwalter_id

# FIX-7: Keine select("*") mehr auf profiles
grep -rn 'select("\*")' app/ components/ --include="*.tsx" --include="*.ts" | grep -i profil
# Erwartung: Keine Treffer (oder nur in Admin-Kontext)

# FIX-9: Quota nach Validierung
grep -n "try_consume_ki_quota\|formData\|ERLAUBTE_MIMES\|MAX_BYTES" app/api/ki/schadenserkennung/route.ts
# Erwartung: formData/MIME/Size-Check VOR Quota-RPC

# FIX-10: Korrekte Feldnamen
grep -n "ersteller_id\|melder_id" app/dashboard-admin/nutzer/page.tsx
# Erwartung: Keine Treffer (ersetzt durch erstellt_von)
```

### Schritt 3: E2E-Tests
```bash
npm run test:e2e
# Alle Tests müssen grün sein. Wenn Tests wegen FIX-5 (Diagnose-Übernahme) rot werden, ist das ERWÜNSCHT — dann den Test anpassen.
```

---

## WICHTIG: Reihenfolge

1. **Erst Sprint A** (FIX 1-6) — das sind die P1-Findings die echte Produktionsprobleme verursachen
2. **Dann Sprint B** (FIX 7-12) — Datenschutz und Qualität
3. **Nach jedem Fix:** `npm run typecheck` laufen lassen
4. **Am Ende:** Kompletten Build + E2E + Grep-Verifikation

## Commit-Konvention

```
fix(audit): [Beschreibung]
```

Beispiele:
- `fix(audit): cron uses service-role client for auction expiry`
- `fix(audit): mail recipients use verwalter_id ?? erstellt_von`
- `fix(audit): add error handling to ticket vergabe flow`
