# Reparo UX-Audit · Claude Code · 24. Mai 2026

> Unabhängige 2. Perspektive. Diese Analyse wurde **bewusst ohne Lesen** der
> bestehenden Cowork-/Pricing-Audits geschrieben, basiert auf Code-Inspektion
> in `app/dashboard-*` + Supabase-DB-Stand vom 24.05.2026. Ich konnte nicht
> live klicken — alle Aussagen sind aus Code, Strings, Layout-Klassen, und
> DB-Inhalten abgeleitet.

## 1. TL;DR

Reparo hat ein erstaunlich rundes Token-System, gute Empty-States und
saubere Auth — aber drei strukturelle Schwächen ziehen die UX runter:
**(1)** Im Handwerker-Bereich existieren 13 separate Pages, aber nur 6
sind in der Sidebar — der Rest sind tote oder dunkle Routen, die nur
über Code-Pfade erreichbar sind. **(2)** Die DB liefert für mehrere
Beta-Features keine Daten (Bewertungen 0, Wohnungen 0, KI-Cache 0) —
viele Empty-States kaschieren noch nicht aktivierte Features als
"Feature ohne Inhalt". **(3)** Das Mieter-`melden`-Wizard ist mit
915 LOC der größte Single-File-Wizard im Projekt — er bündelt zu viel,
und die Schadensmeldung ist für nicht-technische Mieter immer noch
nicht in 30 Sekunden durchklickbar.

Beta-launchable trotzdem: **ja**. Aber vor B2B-Cold-Outreach sollte
der Verwalter-Marktplatz an mind. zwei Stellen entschlackt werden
(s. §6).

## 2. Pro Rolle

### 2.1 Handwerker — Bewertung Nutzerfreundlichkeit 6/10 · Intuitivität 5/10 · Design 7/10

**Was gut funktioniert**

1. Hero-Begrüßung mit Gewerk + Bewertung + Radius ist prägnant
   (`app/dashboard-handwerker/page.tsx:135-159`)
2. Sichtbarkeits-Badge (Bronze/Silber/Gold) als Gamification-Signal —
   das macht den Smart-Score-Mechanismus sichtbar
3. Standort-Setup-Banner ist als Warn-Card prominent, blockt nicht aber
   eskaliert visuell — sehr gute UX-Lösung für "Onboarding mit Lücken"
4. Sprint-L-Empty-State "Setze zuerst deine Gewerke" mit klarer
   Profil-CTA — Lehrbuch
5. Dashboard nutzt sinnvolle 3-KPI-Reihe (Verfügbar / Aufträge /
   Bewertung), erste Kachel scrollt zur Liste — sauber

**Was nicht gut ist**

1. **6 nicht-in-Sidebar-Routen** (`/diagnosen`, `/termine`, `/zeitplan`,
   `/zeitslots`, `/auftraege`, `/verfuegbarkeit`): der HW hat keinen
   konsistenten Pfad zu seinen eigenen Funktionen. `/zeitslots` ist
   645 LOC — also nicht trivial — aber nirgendwo verlinkt.
2. **Zwei Zeit-Konzepte parallel:** `/kalender` (677 LOC) ist Sidebar-Item,
   `TimetableView` unter `/zeitplan` ist die alte Komponente, und
   `/termine` (589 LOC) ist eine separate Liste. Die Sidebar weist nur
   eines davon aus — der Rest ist Drift.
3. Verdienst-Rechner liegt versteckt in der Sektion "Mein Bereich". Für
   den Sales-Pitch ("verdiene XX € pro Monat") wäre das eher prominent.
4. Hero-Begrüßung verwendet `profile.gewerk` (single), die App schreibt
   inzwischen auf `handwerker_gewerke[]`. Das Begrüßungs-Wording bleibt
   bei einem Gewerk hängen, auch wenn der HW drei hat.
5. Wenn der HW NUR Stamm-Gewerke ohne Standort hat, sieht er sowohl
   "Setze deine Gewerke" als auch "Standort einrichten" — zwei
   konkurrierende Warn-Cards. Reihenfolge ist nicht gesteuert.
6. `karte/page.tsx` hat einen "Reparo organisiert deinen Tag — du
   konzentrierst dich aufs Handwerk"-Hero über der Karte, der dort
   redundant wirkt (die Karte zeigt ja gerade die Tagesorganisation).

### 2.2 Verwalter — Bewertung Nutzerfreundlichkeit 7/10 · Intuitivität 7/10 · Design 8/10

**Was gut funktioniert**

1. Dashboard hat klare Hero-Aktion-Hierarchie: Header → Live-Counter →
   KPIs (Sprint H) → "Wartet auf deine Entscheidung" → Ticket-Listen.
   Das ist die beste Informationsdichte aller vier Rollen.
2. Sprint-G `+ Neues Ticket`-Button neben "Handwerker-Marktplatz" oben
   rechts ist ein guter direkter Pfad — kein Submenü
3. Throughput-Chart (Sprint H) gibt Verwaltern den Trend-Indikator, den
   sie für Reporting brauchen
4. Marktplatz-Slot-Cards mit Wochenstruktur-Badge und "Auf Anfrage"-Pill
   ist konzeptuell elegant
5. Wohnungen-Listen-View hat graceful Pre-Migration-Warning ("Tabelle
   existiert noch nicht") — Beta-Tester sieht keinen Crash

**Was nicht gut ist**

1. **Sidebar-Reihenfolge ist nicht Workflow-getrieben:** "Marktplatz"
   ist vor "Handwerker" — aber im Realfall klickt der Verwalter
   zuerst auf "Tickets", dann auf "Handwerker", dann auf "Marktplatz".
   Aktuelle Reihenfolge spiegelt eher Feature-Reihenfolge.
2. **Marktplatz mit 503 LOC** ist die längste Verwalter-Page. Mehrere
   Kacheln-KPIs + virtueller-Wochenstruktur-Generator + Gebot-Modals +
   Filter — das ist zu viel auf einem Screen.
3. **`/neues-ticket` (Sprint G) duplicate-isiert den Mieter-Wizard.**
   Statt einer einzigen `<TicketWizard variant="verwalter|mieter">`-
   Komponente existieren jetzt zwei parallele Implementierungen (915
   LOC Mieter, 361 LOC Verwalter) — Pflege-Risiko bei jeder KI-Prompt-
   oder Feld-Änderung.
4. Reporting-Page zeigt KPIs, aber **keine Filter-Möglichkeit nach
   Zeitraum** (nur "Dieser Monat" implizit). Für Hausverwaltungen die
   Quartals-Reports brauchen ist das nicht ausreichend.
5. Verwalter-Tickets-Liste hat Status-Filter-Chips, aber **keinen
   Sort-Toggle** (älteste/neueste, Prio nach Datum, etc.). Bei 24
   Tickets in der DB schon spürbar.
6. **Empty-State "Wartet auf deine Entscheidung"** ist nur sichtbar
   wenn `hatPipelineAction === true`. Wenn der Pool leer ist, sieht
   der Verwalter eine leere Sektion ohne CTA — nicht ideal.

### 2.3 Mieter — Bewertung Nutzerfreundlichkeit 6/10 · Intuitivität 6/10 · Design 7/10

**Was gut funktioniert**

1. Sidebar mit 4 Items ist die schlankste — Mieter werden nicht
   überfordert
2. Sprint-E HW+Termin inline auf der Vorgang-Card (`page.tsx:198-221`)
   ist genau die Information, die ein Mieter sucht
3. Schaden-melden-Quick-Select-Pills (F1) sind gut gelabelt als
   "Hilfe für den Anfang (optional)" — keine Pflicht
4. Phasen-Indikator (Gemeldet → Auktion → Reparatur → Erledigt) gibt
   Mietern ein klares mentales Modell
5. "Alles in Ordnung 🎉"-Empty-State für 0 Tickets (Sprint N) hat
   positive Stimmung

**Was nicht gut ist**

1. **915 LOC `melden/page.tsx`** ist mit Abstand die komplexeste Page
   im Repo. Da gehört Code in Sub-Komponenten (Foto-Step, KI-Analyse,
   Ort-Step). Wartbarkeitsrisiko.
2. **KI-Analyse-Schritt mit Animation** läuft bis zu 5 Sekunden
   (`setAnalyseProgress`-Interval). Ein Mieter, der "Heizung kaputt"
   tippt, will nicht 5 Sekunden auf eine Loading-Animation starren —
   die KI-Klassifikation könnte mit dem Speichern parallelisiert
   werden.
3. **Foto-Upload ist optional, aber prominent in Step 1.** Ohne Foto
   gibt's nur Regex-Fallback statt KI-Vision — die KI-Qualität sinkt
   stark. Mieter sollten wissen "mit Foto wird's besser" — das wird
   im Wizard nicht klar genug kommuniziert.
4. **Profil-Page hat Wohnungs-Adresse als Freitext-Feld**, obwohl die
   `wohnungen`-Tabelle existiert (Sprint I). Wenn der Verwalter
   Wohnungen hochlädt und dem Mieter zuordnet, sollte das Profil
   automatisch befüllt sein. Heute: jeder Mieter tippt seine eigene
   Adresse.
5. Dringlichkeit ist im Wizard nur 3-Stufen-Buttons ohne Erklärung,
   was "Notfall" tatsächlich auslöst (sofortige Auktion vs. 24h vs.
   Diese Woche). Mieter wählen nach Bauchgefühl.
6. Tickets-Liste-Page (`/dashboard-mieter/tickets`) und Dashboard-Page
   duplizieren beide die Ticket-Karten. Doppelte Pflege bei jeder
   Card-Änderung.

### 2.4 Admin — Bewertung Nutzerfreundlichkeit 5/10 · Intuitivität 4/10 · Design 6/10

**Was gut funktioniert**

1. KI-Anomalien + Empfehlungen als prominenter Block (jetzt als
   Akkordeon, Sprint Q2)
2. Klickbare KPI-Kacheln verlinken nach `/dashboard-admin/nutzer?rolle=…`
   und `/dashboard-verwalter/tickets?status=…` — gute Drill-Down-UX
3. Feedback-Dashboard ist die ehrlichste UI im Projekt — 43 echte
   Feedback-Items mit Filter/Status/Owner-Heuristik
4. Rollen-Switcher (Sprint O) als Dropdown statt Chips ist sauber

**Was nicht gut ist**

1. **Sidebar zeigt nur 4 Items** (Dashboard, Feedback, Penalties,
   Verwaltung), aber im Code existieren **8 Admin-Pages** (nutzer,
   diagnose-preise, aktivitaet, system, ticket-Dir extra). Die
   anderen 4 sind nur via Direct-URL oder Drill-Down erreichbar —
   für einen Admin der "alle Tools sehen" will: kaputt.
2. "Verwaltung"-Sidebar-Item führt direkt zu `/dashboard-verwalter` —
   semantisch verwirrend (Admin ist NICHT Verwalter). Wenn das ein
   Rollen-Wechsel-Shortcut sein soll, gehört es zum RollenWechsel-
   Dropdown, nicht zur Sidebar.
3. `dashboard-admin/system` (189 LOC, System-Health-Page) ist nicht in
   der Sidebar — Lennart kommt da nur via `/dashboard-admin` → Klick
   auf eine versteckte Verlinkung hin (falls überhaupt verlinkt).
4. `dashboard-admin/nutzer` ist eine 338-LOC-Page für User-Management,
   aber **das einzige "Aktion"-Pattern für Admin ist klick-auf-KPI**.
   Wo ist der "Benutzer einladen"-Button?
5. **Penalties-Page (206 LOC) ohne Daten** — `nachtraege` hat 3 Rows,
   aber Penalties-bezogene Felder (`penalty_status`, `_charge_id`)
   sind in `tickets`, nicht in einer Penalties-Liste. Page existiert,
   ist verlinkt, aber zeigt vermutlich leeren Zustand für Lennart.
6. Diagnose-Preise (302 LOC) verwaltet `diagnose_preise` (8 rows). Das
   ist tatsächlich genutzt — könnte aber **in den Verwalter-Reporting-
   Bereich gehören**, nicht zur Admin-Sicht. Verwalter sind die, die
   Preise auch tatsächlich sehen wollen.

## 3. Marketing-Landing (/hausverwaltungen)

**Bewertung: 7/10**

Die `hausverwaltungen`-Landing (Sprint K) ist solide:

- ✅ Story-Arc steht (Hero → Problem → Solution → USP → Pricing → Trust → CTA)
- ✅ Server-Komponente, 97 KB First-Load — die einzige Page mit echter
  Performance-Headroom
- ✅ CTAs zeigen auf `mailto:` als pragmatische Pre-Calendly-Lösung

**Schwächen aus UX-Sicht:**

1. **Pricing-Tiers Starter/Pro/Enterprise** mit fest gesetzten Zahlen
   (49 €, 149 €, individuell) ohne Annahmen oder ROI-Rechner. Ein
   Verwalter mit 200 Einheiten sieht "Pro" → klickt → bekommt eine
   E-Mail-Maske statt einen Calculator. Conversion-Lücke.
2. **"Vergessen Sie das ‚ich frag mal Harald'"** ist ein guter Hook,
   aber ohne sozialen Proof daneben (Logo-Wand, Case-Study, Quote)
   wirkt es wie Behauptung statt Beweis.
3. **Solution-Flow 3-Step** ist textlastig (3×40-Wörter-Paragraphen).
   Ein Verwalter im Cold-Mail-Funnel scannt — er liest nicht.
4. **Hero-CTA "30-Min-Demo buchen"** ist gut, aber **Secondary-CTA
   "Bereits Kunde? Anmelden"** suggeriert, dass es Kunden gibt. Bei
   Closed-Beta ist das streng genommen falsch.
5. Security-Strip mit 4 Icons hat keine Erklärung, wo Reparo gehostet
   ist (welche EU-Region, welcher Hyperscaler). Für Verwalter mit
   DSGVO-Audit-Erfahrung zu vage.

## 4. Risiko-Liste sortiert nach Severity

### CRITICAL (vor Beta-Tester-Einladung beheben)

| # | Risk | Wo |
|---|---|---|
| C1 | **Mieter-Wizard ohne Foto liefert nur Regex-KI** — Mieter wissen nicht, dass ihre Meldung qualitativ schlechter wird ohne Bild. Verwalter bekommt Tickets mit "sonstiges"-Gewerk und muss manuell zuordnen. | `app/dashboard-mieter/melden/page.tsx:263-275` |
| C2 | **Tote HW-Routen** (`/zeitslots`, `/termine`, `/diagnosen`, `/auftraege`, `/zeitplan`) — wenn jemand vom alten Bookmark kommt, sieht er Pages ohne Sidebar-Verlinkung zurück. Verwirrungs-Risiko hoch. | `app/dashboard-handwerker/*/page.tsx` |
| C3 | **Verwalter-Wizard duplicate Code zum Mieter-Wizard** — KI-Klassifikation, Gewerk-Mapping, Adress-Picker doppelt implementiert. Bei nächster Schema-Änderung kann eine Seite divergieren. | `app/dashboard-verwalter/neues-ticket/page.tsx` |

### HIGH (vor B2B-Cold-Outreach beheben)

| # | Risk | Wo |
|---|---|---|
| H1 | **Admin-Sidebar mit 4 Items, Code mit 8 Pages** — Admin kann nicht alle Tools navigieren | `components/layout/Sidebar.tsx:57-61` |
| H2 | **Wohnungen-Migration nicht angewandt** — Bulk-Import wirft Fehler bei Submit (Spalte fehlt). Mitigation ist Warn-Banner, aber kein Admin sieht ohne Apply einen Erfolgs-Pfad. | DB `wohnungen` 0 rows + Migration 20260605000060 pending |
| H3 | **Pricing-Tiers ohne ROI-Calculator** auf /hausverwaltungen — Conversion-Lücke | `app/hausverwaltungen/page.tsx` Pricing-Sektion |
| H4 | **Reporting hat keine Zeitraum-Filter** — Verwalter mit Quartals-Reporting-Bedarf bleibt außen vor | `app/dashboard-verwalter/reporting/page.tsx` |
| H5 | **Verwalter-Tickets-Liste hat keinen Sort-Toggle** — bei 24+ Tickets spürbar | `app/dashboard-verwalter/tickets/page.tsx` |

### MEDIUM

| # | Risk | Wo |
|---|---|---|
| M1 | HW-Hero-Begrüßung nutzt single `profile.gewerk`, App nutzt `handwerker_gewerke[]` — inkonsistent | `app/dashboard-handwerker/page.tsx:139` |
| M2 | Karte-Page hat redundanten Hero über der Karte | `app/dashboard-handwerker/karte/page.tsx` |
| M3 | Mieter-Profil-Adresse als Freitext trotz `wohnungen`-Tabelle | `app/dashboard-mieter/profil/page.tsx` |
| M4 | "Verwaltung"-Item in Admin-Sidebar suggeriert Rolle ≠ Admin | `components/layout/Sidebar.tsx:60` |
| M5 | Mieter-Dashboard + `/tickets` duplizieren Ticket-Cards | `app/dashboard-mieter/page.tsx` + `tickets/page.tsx` |
| M6 | Marketing-Page-Sub-CTA "Bereits Kunde? Anmelden" suggeriert Kunden trotz Closed-Beta | `app/hausverwaltungen/page.tsx` |
| M7 | 2 Profile mit `rolle = null` in der DB (`demo.hw2`, `demo.hw3`) — DB-Hygiene | `public.profiles` |

### LOW

| # | Risk |
|---|---|
| L1 | KI-Animation 5 Sek wirkt unnötig lang |
| L2 | Dringlichkeit-Buttons ohne Erklärung was "Notfall" auslöst |
| L3 | `bewertungen`-Tabelle 0 rows — Bewertungs-Feature nicht aktiv |
| L4 | `handwerker_stats` 0 rows — Cron-getriebenes Feature läuft vermutlich nicht |
| L5 | Security-Strip auf /hausverwaltungen vage (kein Hoster genannt) |
| L6 | Diagnose-Preise wären besser im Verwalter-Bereich als im Admin |

## 5. Konkrete Quick-Fixes (in 1-2h umsetzbar)

1. **Tote HW-Routen entweder droppen oder verlinken** (~30 Min): pro Page
   entscheiden — Redirect zum Kalender (wie `verfuegbarkeit`) oder in
   Sidebar-Group "Selten" rein.
2. **HW-Hero-Begrüßung auf `handwerker_gewerke[]`** umstellen
   (~15 Min): wenn Array gesetzt, formatGewerk der ersten 2 zeigen.
3. **Admin-Sidebar um Nutzer + System + Aktivität + Diagnose-Preise
   erweitern** (~15 Min): die 4 fehlenden Items reinhängen.
4. **Marketing-Page CTA-Wording fixen** (~5 Min): "Bereits Kunde?
   Anmelden" → "Schon ein Test-Account? Anmelden".
5. **Verwalter-Tickets-Liste Sort-Toggle** (~30 Min): einfaches
   Select über der Liste, lokaler State reicht.
6. **`profile.gewerk`-Single weiter füllen aus `handwerker_gewerke[0]`**
   beim Save (~10 Min): Sync zwischen Single + Array vermeidet Drift.
7. **Quick-Select-Pills im Mieter-Wizard standardmäßig anbieten ohne
   "optional"-Suffix** (~15 Min): direkt mit Beispieltext starten, der
   überschreibbar ist.
8. **Mieter-Tickets-Page entfernen, Dashboard übernimmt die Liste**
   (~20 Min): eine Quelle für Ticket-Anzeige, nicht zwei.
9. **DB-Cleanup `rolle IS NULL`** (~5 Min Admin-Query): `demo.hw2` +
   `demo.hw3` entweder auf `handwerker` setzen oder löschen.
10. **Auf `/hausverwaltungen` einen ROI-Calculator-Link** zur
    `Reparo-Pricing-Calculator.html` setzen (~10 Min): die HTML existiert
    schon, sie ist nur nicht verlinkt.

## 6. Empfehlung für Lennart bei Rückkehr

In dieser Reihenfolge:

1. **C1, C2, C3** beheben — das sind die drei strukturellen Schmerzen
2. **H1, H2** zusammen mit den Migrations-Apply (8 Files liegen vor)
3. Quick-Fixes 1-10 in einer 2-Stunden-Polish-Session
4. **Dann** Beta-Tester einladen (3-5 Vertraute, nicht mehr)

Reparo ist näher an "ready" als die Anzahl offener Sprints suggeriert.
Was fehlt, ist Aufräumen — kein neuer Code.

---

**Autor:** Claude Code, autonom während Lennarts Urlaub.
**Methode:** Static Code Review + Supabase-DB-Snapshot + Routen-Inventur.
**Limitation:** Keine Live-Klicks, kein visueller Vergleich. Hot-Pfade
sind aus Strings/Klassen geschlossen, nicht von einem realen Browser-Run.
