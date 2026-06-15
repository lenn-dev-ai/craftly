# Sprint AN — HW-Dashboard: Direktvergabe-Inbox als primärer Content

> Umsetzung von Punkt 6 aus `ENTSCHLACKUNGS-REPORT.md` (Audit 2.0, größter
> strategischer Hebel): Die HW-Startseite zeigt aktuell primär "offene
> Ausschreibungen" (Auktion/Mass-Invite, das alte Bieter-Modell). Der
> eigentliche Sprint-AM-Kernmoment — "Dir wurde Auftrag X automatisch
> vorgeschlagen, Annehmen/Ablehnen mit Frist" — läuft über Stamm-Anfragen
> (`/dashboard-handwerker/stamm-anfragen`), ist aber im Nebenmenü versteckt.
> Diese Spec dreht die Reihenfolge um.

---

## 1. Bestandsaufnahme (Status quo)

### `app/dashboard-handwerker/page.tsx`
1. Hero-Greeting + `SichtbarkeitsBadge` (Partner-Status) — bleibt unverändert.
2. Standort-Setup-Banner (nur wenn Gewerke gesetzt, aber kein Standort) — bleibt.
3. 3 KPI-Kacheln: **"Verfügbar im Radius"** (= Anzahl `sichtbareAuktionen`, verlinkt per
   In-Page-Anchor `#ausschreibungen`), "Meine Aufträge", "Bewertung".
4. Quick Actions (Kalender / Karte / Einnahmen / Profil).
5. **Hauptcontent**: `#ausschreibungen` — Liste aller offenen Auktions-Tickets
   (`status === "auktion"`), gefiltert nach Gewerk + Radius, sortiert nach
   Smart-Score/Distanz. Klick → `/dashboard-handwerker/angebot/[id]`.
6. "Meine laufenden Aufträge" — Liste der zugewiesenen Tickets, sekundär.

### `app/dashboard-handwerker/stamm-anfragen/page.tsx`
- Eigene Route, im Sidebar-Menü als "Stamm-Anfragen" (Heart-Icon) sichtbar.
- Lädt `stamm_anfragen` für den eingeloggten HW (`handwerker_id = user.id`),
  gejoint mit `tickets`.
- **"Offen" Sektion** (`status === "gesendet"`): Karten mit Titel, Beschreibung,
  Gewerk/Adresse/Priorität, Frist-Countdown (`formatFrist`), Buttons
  **Annehmen** (Preis-Prompt → `POST /api/stamm-anfragen/[id]/annehmen`) und
  **Ablehnen** (Grund-Prompt → `POST /api/stamm-anfragen/[id]/ablehnen`).
- **"Vergangene" Sektion** (`status !== "gesendet"`): Kompakte Liste mit
  Status-Icon (angenommen/abgelehnt).
- Kein Realtime-Listener — nur Initial-Load + Reload nach Aktion.

### Sidebar (`components/layout/Sidebar.tsx`, HW-Menü)
- Dashboard, Kalender, Karte & Route, **Stamm-Anfragen**, Einnahmen — Top-5.
- "Meine Aufträge", "Verdienst-Rechner", "Mein Profil" — Gruppe "selten".

---

## 2. Ziel-Struktur (neu)

### Geteilte Komponente: `components/handwerker/DirektanfragenInbox.tsx`
Neue, wiederverwendbare Client-Komponente, die die "Offen"-Logik aus
`stamm-anfragen/page.tsx` extrahiert:
- Lädt offene `stamm_anfragen` (`status === "gesendet"`) für den eingeloggten HW.
- Rendert Karten mit Titel/Beschreibung/Gewerk/Adresse/Priorität + Frist-Countdown.
- Annehmen/Ablehnen-Buttons rufen dieselben API-Routen wie bisher.
- **Neu**: Realtime-Subscription auf `stamm_anfragen` (Pattern wie das
  bestehende `tickets`-Listening im Dashboard) → Liste aktualisiert sich live,
  wenn ein Verwalter eine neue Direktanfrage schickt.
- Props: optionale `limit` (Dashboard zeigt z. B. max. 5, volle Seite zeigt alle),
  optionaler `emptyState`-Override (Dashboard vs. Stamm-Anfragen-Seite haben
  leicht unterschiedliche Leertexte), `onCountChange`-Callback (damit das
  Dashboard die Anzahl für die KPI-Kachel kennt, ohne doppelt zu laden).

Beide Seiten (`page.tsx` Dashboard und `stamm-anfragen/page.tsx`) nutzen diese
Komponente für die "Offen"-Ansicht. `stamm-anfragen/page.tsx` behält zusätzlich
die "Vergangene"-Sektion (Historie) — die bleibt nur dort, nicht im Dashboard.

### `app/dashboard-handwerker/page.tsx` — neue Reihenfolge
1. Hero-Greeting + `SichtbarkeitsBadge` — **unverändert**.
2. Standort-Setup-Banner — **unverändert**.
3. KPI-Kacheln (3, angepasst):
   - **Kachel 1 "Offene Anfragen"** (ersetzt "Verfügbar im Radius"): Anzahl
     offener `stamm_anfragen`, Anchor `#direktanfragen`. Akzent-Gradient
     (wie bisher die erste Kachel). Wenn 0: neutral "Aktuell keine offenen
     Anfragen" statt Zahl-Fokus.
   - Kachel 2 "Meine Aufträge" — unverändert.
   - Kachel 3 "Bewertung" — unverändert.
4. Quick Actions — unverändert.
5. **NEUER Hauptcontent**: `#direktanfragen` — `<DirektanfragenInbox limit={5} />`.
   - Empty State (Dashboard-Variante): freundlicher Hinweis, dass neue
     Direktanfragen hier automatisch erscheinen, sobald ein Verwalter den HW
     als Stamm-HW für ein Ticket vorschlägt — kein CTA nötig (passiver Flow).
   - Wenn mehr als 5 offene Anfragen: "Alle anzeigen →" Link zu
     `/dashboard-handwerker/stamm-anfragen`.
6. **NEUE sekundäre Sektion "Fallback läuft"** (`#fallback`, vormals
   `#ausschreibungen`):
   - Nur sichtbar, wenn `auktionenSortiert.length > 0` (nach bestehender
     Gewerk-/Radius-Filterung). Ist die Liste leer, wird die ganze Sektion
     ausgeblendet — kein leerer Kasten, kein "Setze zuerst deine Gewerke"-Block
     mehr auf der Startseite (der gehört jetzt zur Direktanfragen-Logik, s. u.).
   - Erklärender Intro-Text: *"Diese Aufträge konnten nicht direkt vergeben
     werden und stehen offen zur Bewerbung — wer zuerst kommt, bekommt den
     Auftrag."* Macht den Fallback-Charakter explizit (Audit-Befund: aktuell
     wirkt die Auktion wie der Normalfall).
   - Inhalt/Optik der Karten bleibt wie bisher (Timer, Dringlichkeits-Badge,
     Distanz, "Auftrag annehmen →").
   - Die bestehende "Setze zuerst deine Gewerke"-Warnung (wenn
     `!hatStammGewerke`) wandert in die Direktanfragen-Sektion (Kachel 1 /
     `#direktanfragen`), denn ohne Gewerke bekommt der HW *weder*
     Direktanfragen *noch* sieht er Auktionen — das ist die wichtigere,
     übergreifende Warnung und gehört an die prominenteste Stelle.
7. "Meine laufenden Aufträge" — **unverändert**, bleibt letzte Sektion.

### Sidebar
- **Keine Strukturänderung**: "Stamm-Anfragen" bleibt als Menüpunkt (für die
  "Vergangene"-Historie und als Deep-Link), Kalender/Karte/Einnahmen
  unverändert.
- **Optional / Stretch**: Badge mit Anzahl offener Anfragen neben
  "Stamm-Anfragen" im Menü (kleiner roter Punkt o. ä.), analog zu
  Benachrichtigungs-Patterns. Nur umsetzen, wenn ohne große Refactors möglich
  (Sidebar ist eine reine Client-Komponente ohne aktuelle Daten-Fetches) —
  sonst als Folge-Task vermerken statt diesen Sprint aufzublähen.

---

## 3. Migration / Risiken

- Keine DB-Änderungen nötig — `stamm_anfragen` existiert und wird bereits
  genutzt.
- Realtime-Channel-Name für die neue Subscription: `"handwerker-stamm-anfragen-changes"`
  (analog zu `"handwerker-tickets-changes"`), um Namenskollisionen zu vermeiden.
- `DirektanfragenInbox` wird in zwei Seiten eingebunden → bei Änderungen an
  Annehmen/Ablehnen-Logik künftig nur eine Stelle pflegen (DRY-Gewinn).
- Das bisherige Verhalten von `/dashboard-handwerker/stamm-anfragen` bleibt für
  Bestandsnutzer identisch (gleiche Route, gleiche Inhalte, nur "Offen" jetzt
  über die geteilte Komponente).
- Kein Breaking Change für Verwalter-Seite oder APIs — rein UI-seitige
  Refactor + Reihenfolge-Tausch auf der HW-Startseite.

---

## 4. Akzeptanzkriterien

- [x] `/dashboard-handwerker` zeigt offene Stamm-Anfragen (Annehmen/Ablehnen,
      Countdown) als ersten/prominentesten Content-Block nach Hero + KPIs.
- [x] Auktionen erscheinen nur noch, wenn tatsächlich welche im
      Radius/Gewerk vorhanden sind, unter "Fallback läuft" mit erklärendem
      Text.
- [x] KPI-Kachel 1 zeigt die Anzahl offener Direktanfragen statt
      Auktionen-Anzahl.
- [x] `/dashboard-handwerker/stamm-anfragen` funktioniert weiterhin
      unverändert (Offen + Vergangene), nutzt aber die geteilte
      `DirektanfragenInbox`-Komponente für "Offen".
- [x] Realtime-Update: neue Stamm-Anfrage erscheint ohne Reload im Dashboard
      (Channel `"handwerker-stamm-anfragen-changes"` in `DirektanfragenInbox`).
- [ ] `npx tsc --noEmit`: im Sandbox nicht ausführbar (node_modules ist hier
      nur ein ~19 MB Teilbaum ohne `@types/*`/vollständige `typescript`-libs —
      bekannte virtiofs/Sandbox-Einschränkung, nicht durch diesen Sprint
      verursacht). Stattdessen: manuelle Vollprüfung von
      `app/dashboard-handwerker/page.tsx` (Variablen-Referenzen, JSX-Balance,
      Imports) durchgeführt — keine dangling references auf die entfernten
      Variablen (`sichtbareAuktionen`, `auktionenSortiert`,
      `ausgeblendetWegenGewerk`, `imRadius`, `ausserhalb`) gefunden. Echter
      `tsc`/`next build` sollte vor dem nächsten Deploy bei Lennart oder via CC
      laufen.

---

## 5. Follow-up-Finding: `einladungen`-Direktvergabe hat noch keine Inbox

Bei der Umsetzung (#248) wurde geprüft, ob Sprint AN auch die
**generalisierte** Sprint-AM-Direktvergabe (Phase 2, `lib/auction/direktvergabe.ts`,
Tabelle `einladungen`) abdecken sollte — das ist die Mechanik, die greift, wenn
**kein** Stamm-HW hinterlegt ist (`starteDirektvergabe`/`eskaliereDirektvergabe`,
`modus: "direktvergabe"`). Ergebnis: **Nein, das ist ein separater, eigenständiger
Gap**, der nicht einfach in `DirektanfragenInbox` reinpasst:

- `stamm_anfragen` (dieser Sprint): Preis wird vom HW selbst per Prompt
  eingegeben (`annehmen(id)` → Preis-Dialog).
- `einladungen` (Sprint AM Phase 2): Preis ist **systemseitig fix**
  vorgegeben (`empfohlener_preis`, Vollkalkulations-Modell F11) — der HW nimmt
  zu *diesem* Preis an oder lehnt ab, kein Verhandlungs-Schritt.
- Frist/Countdown basiert nicht auf `frist_bis` (wie bei `stamm_anfragen`),
  sondern auf `tickets.direktvergabe_angefragt_am +
  tickets.direktvergabe_timeout_min`.
- `einladungen.status='offen'`-Zeilen existieren in **zwei** Fällen: (a) die
  1:1-sequenzielle Direktvergabe (ticket bleibt `status='offen'` — das ist der
  relevante Fall für eine Inbox) und (b) Mass-Invite-Fallback-Batches (ticket
  `status='auktion'` — das ist bereits die "Fallback läuft"-Sektion). Eine
  Inbox-Query müsste also zusätzlich nach `ticket.status === 'offen'` filtern.
- Aktuell ist Fall (a) für den HW **nur per E-Mail-Link** erreichbar
  (`/dashboard-handwerker/angebot/[id]`), und diese Seite hat **kein
  Ablehnen-Button**, obwohl `/api/einladungen/[id]/ablehnen` existiert und
  sofort eskaliert.

**Empfehlung:** eigener Folge-Sprint ("Sprint AO"), der
1. `/dashboard-handwerker/angebot/[id]` um einen Ablehnen-Button erweitert
   (Route existiert bereits, nur UI fehlt), und
2. eine zweite Karten-Variante in `DirektanfragenInbox` (oder eine
   Schwester-Komponente) für `einladungen`-Direktanfragen ergänzt, mit
   System-Preis-Anzeige statt Preis-Prompt und Timeout-basiertem Countdown.

Damit deckt die `#direktanfragen`-Sektion künftig **beide**
Direktvergabe-Pfade ab — das ist die vollständige Umsetzung des
Audit-2.0-Befunds ("Der eigentliche Sprint-AM-Kernmoment … läuft über
Stamm-Anfragen" greift nur für HW mit Stamm-Beziehung; HW ohne Stamm-HW sehen
den Kernmoment aktuell gar nicht in einer Inbox).
