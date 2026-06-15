# Sprint AM Phase 3 — Spec: Mass-Invite-Fallback (UI) + Marktplatz-Anpassungen

> Folgespec zu Phase 1 (Preisformel, #229) und Phase 2 (generalisierte
> sequenzielle Direktvergabe, #231/#234, live smoke-getestet in #239).
> Basis: `KONZEPT-handwerker-direktbuchung-doctolib.md`, Abschnitt 9
> ("Phase 3 (~2 Tage): Mass-Invite-Auktion zu echtem Fallback umbauen +
> UI-Anpassungen im Marktplatz"). Status: SPEC, bereit zur Umsetzung.

## 1. Bestandsaufnahme — was Phase 2 bereits liefert

Beim Lesen von `lib/auction/direktvergabe.ts` (Stand nach #231/#234) zeigt
sich: der **Backend-Teil** von Phase 3 ist faktisch schon erledigt.

- `starteDirektvergabe()` geht NUR auf Mass-Invite (`modus="mass_invite"`,
  `status="auktion"`), wenn (a) die Kandidatenliste leer ist oder (b) alle
  Top-10 im relevanten Zeitfenster Google-Cal-blockiert sind. Der Normalfall
  ist sequenzielle Direktvergabe (`status` bleibt `"offen"`).
- `eskaliereDirektvergabe()` (vom 5-Minuten-Cron
  `direktvergabe-eskalation.mts` aufgerufen) eskaliert bei Ablehnung/Timeout
  zum nächsten Kandidaten und ruft `fuehreMassInviteFallback()` erst, wenn
  `naechsterIndex >= MAX_ESKALATIONEN` (=3) **oder** die Kandidatenliste
  erschöpft ist.
- `fuehreMassInviteFallback()` setzt `status="auktion"`, öffnet das
  Auktionsfenster (`auktion_start`/`auktion_ende`) und ruft die bestehende
  `fuehreMassInviteAus()` — Mass-Invite ist also bereits "nur
  sichtbar/aktiv nach N Ablehnungen", **nicht** mehr der Standardweg.

➡️ **Der Mass-Invite-Fallback-Mechanismus selbst braucht in Phase 3 keine
Backend-Änderung mehr.** Phase 3 reduziert sich auf die in Abschnitt 9
zweite Hälfte genannten **UI-Anpassungen im Marktplatz** plus zwei in #239
gefundene UI-Copy-Inkonsistenzen plus einen Demo-Daten-Edge-Case.

## 2. Scope Phase 3

### A) Marktplatz: Live-Status für laufende Direktvergabe

**Datei:** `app/dashboard-verwalter/marktplatz/page.tsx`

Aktuell zeigt die Ticket-Karte (Zeilen ~417-480) für `status === "offen"`
keine Information darüber, dass im Hintergrund bereits eine
Direktvergabe-Anfrage läuft — der Verwalter sieht nur "Neue Meldung" /
"Auction"-Button, obwohl `/api/auction/start` ggf. längst eine
Direktvergabe-Anfrage an HW X gestellt hat.

**Änderung:**

1. `OffenesTicket`-Interface (Zeilen ~26-38) erweitern um:
   ```ts
   direktvergabe_kandidaten: { hw_id: string; score: number; preis: number }[] | null
   direktvergabe_index: number | null
   direktvergabe_angefragt_am: string | null
   direktvergabe_timeout_min: number | null
   ```
2. Supabase-Select (Zeile ~137) entsprechend erweitern.
3. Für den aktuell angefragten Kandidaten (`direktvergabe_kandidaten[direktvergabe_index]`)
   den HW-Namen nachladen — entweder per Zusatz-Query (`profiles.id in (...)`,
   gebatcht für alle sichtbaren Tickets) oder per Supabase-Join, falls FK
   vorhanden. Ergebnis: Map `hw_id -> name`.
4. Neue Badge/Zeile in der Ticket-Karte, wenn `status === "offen"` UND
   `direktvergabe_kandidaten` nicht leer ist:
   > "🔄 wird automatisch vergeben — voraussichtlich an **{HW-Name}** zu
   > **{Preis} €**"

   Darunter optional eine kleine Restzeit-Anzeige, berechnet aus
   `direktvergabe_angefragt_am + direktvergabe_timeout_min` (z. B. "Antwort
   erwartet bis 14.06., 18:40 Uhr" oder ein relativer Countdown
   "noch ca. 2 Std."). Reine Anzeige, kein Live-Polling nötig — ein
   Seiten-Reload reicht (Marktplatz wird ohnehin häufig neu geladen).
5. Wenn `status === "auktion"` (Mass-Invite-Fallback aktiv), zusätzlich zur
   bestehenden "Auktion"-Badge ein Hinweistext:
   > "Direktvergabe an {N} Handwerker ohne Antwort — jetzt offene
   > Bieter-Auktion (Mass-Invite)."

   So wird für den Verwalter sichtbar, *warum* ein Ticket im
   Auktions-Modus ist (Fallback nach N Ablehnungen, nicht der Normalfall).

### B) UI-Copy-Fixes (aus #239-Smoke-Test)

**B1 — Auction-starten-Modal** (`marktplatz/page.tsx`, `AuctionStartOption`,
Zeilen ~730-787):

Aktuell (veraltet, beschreibt das alte Mass-Invite-Bieter-Modell):

- Zeitnah: *"🟡 Zeitnah — 6 Stunden Auction-Fenster, mittlerer Radius. HW
  bieten ab — du pickst das beste."*
- Planbar: *"🟢 Planbar — 72 Stunden Auction-Fenster, voller Radius —
  maximale HW-Auswahl."*

Neu (Direktvergabe-Sprache, analog Notfall-Text):

- Zeitnah: *"🟡 Zeitnah — System berechnet den besten Preis und fragt
  automatisch den passendsten Handwerker an (Antwortfrist ca. 2 Std.). Erst
  bei wiederholter Absage öffnet sich eine breitere Auktion."*
- Planbar: *"🟢 Planbar — System berechnet den besten Preis und fragt
  automatisch den passendsten Handwerker an (Antwortfrist ca. 24 Std.).
  Erst bei wiederholter Absage öffnet sich eine breitere Auktion."*

Notfall-Copy bleibt unverändert (war bereits korrekt, Vorbild für die
neuen Texte).

**B2 — Mieter-Wizard Schritt 5/5** (`app/dashboard-mieter/melden/page.tsx`,
Zeile ~939):

Aktuell: *"Passende Handwerker-Stunden werden auf dem Marktplatz gebucht"*

Neu: *"Wir berechnen automatisch den besten Preis und fragen den
passendsten Handwerker für dich an"*

(konsistent mit der neuen Direktvergabe-Sprache aus B1, vermeidet den
Eindruck eines manuellen Buchungsschritts durch den Mieter).

### C) Edge-Case: 0-Kandidaten-Tickets (Demo-Daten-Lücke, #239-Fund)

Ticket `bbe65fb5` (Gewerk `schreiner`) landete via
`starteDirektvergabe()` → `modus="mass_invite"` (0 Kandidaten im Radius) →
`fuehreMassInviteAus()` direkt in `status="auktion"` mit **0**
`einladungen`-Zeilen — kein Crash, aber das Ticket "verschwindet" für den
Verwalter in einem Zustand ohne erkennbaren nächsten Schritt
(Auktion läuft, aber niemand wurde eingeladen, niemand kann bieten).

**Änderung (UI, kein neuer Status nötig):** Im Marktplatz, wenn
`status === "auktion"` UND `einladungen(count) === 0`:

> ⚠️ "Keine passenden Handwerker im Umkreis gefunden ({Gewerk}). Auktion
> läuft, aber es wurden noch keine Handwerker eingeladen — prüfe Gewerk /
> Umkreis oder lade Handwerker manuell ein."

mit Link/Button zur bestehenden "Handwerker manuell einladen"-Funktion
(falls vorhanden — sonst Verweis auf Handwerker-Verwaltung). Dies ist eine
reine Sichtbarkeits-Verbesserung; die zugrunde liegende Ursache
("kein Schreiner-HW in der DB") ist ein Daten-/Onboarding-Thema, kein
Code-Defekt, und wird hier nicht behoben.

## 3. Nicht im Scope

- Kein neues DB-Schema, keine neuen Spalten (alle benötigten
  `direktvergabe_*`-Felder existieren bereits aus Phase 2).
- Kein Live-Polling/WebSocket für den Countdown — statische Anzeige,
  aktualisiert bei Page-Reload.
- Kein "Gegenvorschlag"-Escape-Hatch für HW (laut KONZEPT Abschnitt 8
  explizit auf eine spätere Phase verschoben).
- Keine Änderung an `eskaliereDirektvergabe`/`fuehreMassInviteFallback`
  selbst (siehe Abschnitt 1 — bereits korrekt implementiert).

## 4. Aufwandsschätzung

Deutlich unter der ursprünglichen KONZEPT-Schätzung (~2 Tage), da der
Backend-Teil bereits erledigt ist:

- A) Marktplatz Live-Status-Badge + HW-Namen-Lookup: ~0,5 Tag
- B) Copy-Fixes (2 Stellen): ~0,5 Std.
- C) "0 Kandidaten"-Hinweis im Marktplatz: ~0,5 Std.
- Smoke-Test (Marktplatz mit Test-Account, beide Tickets aus #239 als
  Referenz: `27487027...` für Direktvergabe-Badge, `bbe65fb5...` für
  0-Kandidaten-Hinweis): ~0,5 Std.

**Gesamt: ~1 Tag.**

## 5. Offene Fragen

- Soll der Restzeit-Hinweis (Abschnitt 2A) als absolute Uhrzeit oder
  relative Dauer ("noch ca. X Std.") angezeigt werden? Empfehlung: relative
  Dauer (sprachlich einfacher, keine Zeitzonen-Fallstricke im UI).
- Gibt es bereits eine "Handwerker manuell einladen"-Funktion im
  Marktplatz, auf die der 0-Kandidaten-Hinweis (Abschnitt 2C) verlinken
  kann, oder müsste diese erst gebaut werden? Falls nicht vorhanden, reicht
  für Phase 3 ein reiner Hinweistext ohne Aktion — die Funktion selbst wäre
  dann ein separater Backlog-Eintrag.
