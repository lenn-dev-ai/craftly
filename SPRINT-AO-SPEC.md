# Sprint AO — Einladungs-Direktanfragen: Inbox + Ablehnen-Button

> Folge-Sprint zu Sprint AN (SPRINT-AN-SPEC.md, Abschnitt 5). Schließt den
> zweiten Direktvergabe-Pfad (`einladungen`, Sprint-AM-Phase-2) für den HW
> in der UI. Nach Sprint AO sind **beide** Direktvergabe-Pfade über die
> `#direktanfragen`-Sektion auf dem HW-Dashboard erreichbar.

---

## 1. Ausgangslage (Sprint AN Findings)

Sprint AN hat die `stamm_anfragen`-Direktvergabe (Stamm-HW-Pfad) prominent
gemacht. Der zweite Pfad (`einladungen`, für HW ohne Stamm-Beziehung) war
für den HW nur per E-Mail-Link auf `/dashboard-handwerker/angebot/[id]`
erreichbar — ohne Ablehnen-Möglichkeit und ohne Inbox-Ansicht.

Unterschiede zum Stamm-Anfragen-Pfad:
- **Preis**: Systemseitig fix (`empfohlener_preis`, F11 Vollkalkulation),
  kein Preis-Prompt.
- **Frist**: `tickets.direktvergabe_angefragt_am + tickets.direktvergabe_timeout_min`
  statt `stamm_anfragen.frist_bis`.
- **Filter**: Nur `einladungen.status='offen'` UND `tickets.status='offen'`
  (schließt Mass-Invite-Fallback mit `ticket.status='auktion'` aus).
- **Ablehnen-Effekt**: Löst sofort `eskaliereDirektvergabe()` aus
  (nächster Kandidat oder Mass-Invite-Fallback).

---

## 2. Umgesetzte Änderungen

### 2.1 `app/dashboard-handwerker/angebot/[id]/page.tsx`

**Ablehnen-Button (Sprint AO Kern):**
- `EinladungMini`-Typ um `id` erweitert (war bisher nicht gespeichert).
- `einladungId`-State: speichert die ID der offenen Einladung, `null` wenn
  keine existiert (Auktions-Ticket-Fall).
- `handleAblehnen()`-Funktion: ruft `POST /api/einladungen/${einladungId}/ablehnen`,
  optional mit Ablehn-Grund.
- UI: nach dem Submit-Button erscheint ein "Anfrage ablehnen"-Bereich nur
  wenn `einladungId` gesetzt. Zweistufig: Button → Inline-Form mit Textarea
  + Bestätigen/Zurück.

**Annehmen-Routing-Fix:**
- Bisheriger Bug: `handleSubmit` rief `/api/auftraege/annehmen` für alle
  Tickets, was für Direktvergabe-Tickets (status='offen') mit 422
  "Auktion nicht aktiv" fehlschlug.
- Fix: Wenn `einladungId` gesetzt UND `ticket.status === "offen"` →
  `POST /api/einladungen/${einladungId}/annehmen`. Sonst weiter via
  `/api/auftraege/annehmen` (Auktion-Pfad unverändert).

### 2.2 `components/handwerker/DirektanfragenInbox.tsx`

**Zweite Karten-Variante (Sprint AO):**
- Neuer Typ `EinladungDirektanfrage` (id, ticket_id, empfohlener_preis,
  created_at, ticket mit direktvergabe-Felder).
- `formatTimeout()`: Countdown aus `direktvergabe_angefragt_am +
  direktvergabe_timeout_min` (analog zu `formatFrist` für stamm_anfragen).
- `load()` lädt jetzt parallel `stamm_anfragen` + `einladungen` (mit
  client-seitigem Filter auf `ticket.status='offen'`).
- `onCountChange` meldet Summe beider Listen.
- Realtime: zweiter Supabase-Channel `"handwerker-einladungen-changes"` für
  `einladungen`-Tabelle (zusätzlich zum bestehenden `stamm-anfragen`-Channel).
- Einladungs-Karten: zeigen Festpreis aus `empfohlener_preis`, Countdown
  aus `formatTimeout`. "Annehmen" → Navigate zu `/dashboard-handwerker/angebot/[ticket_id]`
  (vollständiger Annehmen+Slots-Flow). "Ablehnen" → direkter API-Call
  via `ablehnenEinladung()`.
- Einladungs-Karten haben `ring-1 ring-accent/10` zur optischen Abgrenzung
  (beide sind Direktanfragen, aber unterschiedliche Mechanik).

---

## 3. Akzeptanzkriterien

- [x] `/dashboard-handwerker/angebot/[id]` zeigt "Anfrage ablehnen"-Button
      für Direktvergabe-Tickets (einladung.status='offen').
- [x] Ablehnen löst `POST /api/einladungen/[id]/ablehnen` aus, leitet
      danach zum Dashboard zurück.
- [x] Annehmen auf Direktvergabe-Tickets nutzt
      `POST /api/einladungen/[id]/annehmen` (nicht mehr `auftraege/annehmen`).
- [x] `DirektanfragenInbox` zeigt beide Typen: stamm_anfragen + einladungen.
- [x] KPI-Kachel "Offene Anfragen" zählt beide Typen (via `onCountChange`).
- [x] Realtime-Update für einladungen (Channel `"handwerker-einladungen-changes"`).
- [ ] `npx tsc --noEmit` / `npm run build`: vor nächstem Deploy prüfen.

---

## 4. Nicht umgesetzt (bewusst ausgegrenzt)

- Sidebar-Badge (Anzahl offener Anfragen neben "Stamm-Anfragen" im Menü):
  weiterhin als Stretch-Task markiert — Sidebar hat keinen Daten-Fetch,
  Nachrüstung würde größere Refactorings erfordern.
- Historie für einladungen auf `/dashboard-handwerker/stamm-anfragen`:
  Die "Vergangene"-Sektion zeigt nur stamm_anfragen. Einladungs-Historie
  wäre ein eigener Folge-Sprint.
