# Entschlackungs-Report (Audit 2.0)

> Folge-Audit zum großen E2E-Strategie-Audit (#204/#212). Fokus diesmal:
> (A) totes/ungenutztes Code, (B) ungenutzte DB-Tabellen/Demo-Daten,
> (C) strategischer Mehrwert bestehender Features pro Zielgruppe gegen die
> aktuelle "Doctolib der Reparaturen"-Strategie (Sprint AM / generalisierte
> Direktvergabe, siehe `KONZEPT-handwerker-direktbuchung-doctolib.md` und
> `SPRINT-AM-PHASE3-SPEC.md`).
>
> Status: Audit abgeschlossen (#241-#243). Dieser Report bündelt die
> Ergebnisse und priorisiert die Umsetzung (#245 ff.).

---

## Teil A — Code/Feature-Audit (#241)

### Kategorie A: Toter Code — sicher löschbar

| Datei | Umfang | Begründung |
|---|---|---|
| `components/handwerker/TimetableView.tsx` | ~600 LOC | 0 Referenzen im gesamten Code. Relikt aus der alten Zeitslot-Welt (vor Sprint AK). |
| `app/dashboard-verwalter/marktplatz-archiv/page.tsx` | 504 LOC | Explizit als "Backup/Archiv" markierte Alt-Seite, importiert tote `Zeitslot`/`ZeitslotGebote`-Typen und `zeitslot_gebote`. Keine Verlinkung mehr. |

➡️ Beide Dateien können ersatzlos gelöscht werden (siehe #245).

### Kategorie B: Legacy/Teilweise tot — braucht Rework statt Löschen

| Datei/Bereich | Befund | Empfehlung |
|---|---|---|
| `lib/yield-management.ts` | Großteil der Funktionen (`berechneDynamischenPreis`, `tageszeitFaktor`, `wochentagFaktor`, `nachfrageFaktor`, `knappheitsFaktor`, `lueckenRabatt`, `erkenneLuecken`, `EinnahmenPrognose`-Typen) sind tot. Nur `berechneEinnahmenPrognose` + `GEWERK_BASIS_PREISE` werden noch in `einnahmen/page.tsx` genutzt. | Toten Code entfernen; prüfen ob `berechneEinnahmenPrognose` intern noch tote Faktor-Funktionen aufruft (dann mit-bereinigen); `GEWERK_BASIS_PREISE` ggf. durch `lib/pricing/auftragswert.ts` ablösen, um eine einheitliche Preisquelle zu haben. |
| `app/dashboard-handwerker/einnahmen/page.tsx` | Referenziert noch `zeitslots`/`zeitslot_gebote` (Zeilen ~33-52) und verlinkt auf den (bereits zu Redirect degradierten) Pfad `/dashboard-handwerker/zeitslots` (Zeilen ~253/264). | Diese Referenzen entfernen/auf aktuelle Datenquellen (Direktvergabe/Provisionen) umstellen — Seite bleibt, aber Datenbasis modernisieren. |
| `lib/email/templates.ts:519` | Onboarding-Mailtext "Lege Zeitslots an, damit der Kalender deine Verfügbarkeit kennt" ist veraltet (Zeitslot-Konzept existiert nicht mehr). | Kleiner Text-Fix: Hinweis auf Google-Cal-Verbindung bzw. Arbeitszeiten-Konfiguration umformulieren. |

### Kategorie C: Aktiv & strategisch zentral — KEEP

- `lib/auction/direktvergabe.ts`, `lib/auction/auction-manager.ts` — Herzstück Sprint AM.
- K1-Doodle (`/api/termine/vorschlagen`, `/api/termine/select-slot`, UI in `TicketDetailView.tsx`) — bewusster Fallback für HW ohne Google-Kalender.
- `app/dashboard-verwalter/tickets/[id]/handwerker/page.tsx` (Mass-Invite-Auswahl-UI) — Fallback-UI, weiterhin verlinkt.
- `app/dashboard-handwerker/angebot/[id]/page.tsx` — K1.1 Doodle-Angebotsabgabe.
- `lib/route-optimizer.ts` — von Mass-Invite-Auswahlseite genutzt.

---

## Teil B — DB-Schema-Audit (#242)

29 Tabellen in `public` geprüft (Supabase-Projekt `gkojaogdzzyuboajwyom`) gegen Code-Referenzen (Grep über `**/*.{ts,tsx}` + Migrationen). **Hinweis:** `list_tables`-Zeilenzahlen für `profiles`/`objekte` zeigten 0, sind aber bekanntermaßen aktiv befüllt — Row-Counts aus dem MCP-Tool sind unzuverlässig/stale; Code-Referenzen waren das verlässliche Signal.

### Tabellen ohne jegliche Code-Referenz → DROP-Kandidaten

| Tabelle | Ursprung | Befund |
|---|---|---|
| `handwerker_stats` | `supabase/migrations/20240401000000_yield.sql` (altes Yield-Management-Sprint) | Tabelle inkl. RLS-Policies existiert, wird aber von keiner App-Datei referenziert. 0 Zeilen. Relikt aus abgebrochenem Yield-Sprint (siehe auch `lib/yield-management.ts` oben). |
| `reporting_config` | nicht in aktiven Migrationen, nur in `archive/prompts/sprint-w-eigentuemer-reporting.md` erwähnt | Nie implementiert. 0 Zeilen. |
| `reports_archive` | gleicher Ursprung wie `reporting_config` | Nie implementiert. 0 Zeilen. |

➡️ Alle drei können per Migration (`DROP TABLE IF EXISTS ...`) entfernt werden — kein Code hängt davon ab.

### Tabellen mit geringer, aber aktiver Nutzung → KEEP

- `private_termine`, `provision_settings`, `diagnose_preise`, `routen_planung`, `eigentuemer`, `stamm_handwerker`/`stamm_anfragen`, `nachtraege`, `provisionen` — alle mit bestätigten Code-Referenzen in aktiven Features.
- `zeitslots`/`zeitslot_gebote` — 0 Zeilen, aber noch in 4 aktiven Dateien referenziert (Kalender-Privatblocks, Scoring, Cron) + 1 toter Datei (`marktplatz-archiv`, → Kategorie A). Nach Entfernung der toten Datei erneut prüfen, ob die verbleibenden Referenzen reduzierbar sind — aktuell aber **nicht** löschen.

---

## Teil C — Strategischer Feature-Wert-Check pro Zielgruppe (#243)

Vollständige Tabelle siehe Sub-Agent-Output; hier die Kernbefunde.

### Mieter
Kern-Workflow (Tickets, Schaden melden) ist strategisch hoch bewertet. **Parallel-Route** `melden` vs. `melden-neu` (beide aktiv, Sprint-AI-Relikt) sollte konsolidiert werden.

### Verwalter
Tickets, Marktplatz und Stamm-HW sind Kern-Treiber für Sprint AM. **Größte Lücke:** Der Marktplatz zeigt dem Verwalter noch nicht den laufenden Direktvergabe-Status (Phase-3-Spec liegt vor, Umsetzung steht aus). **Fraglich für die aktuelle Phase:** `eigentuemer` (Sprint W) und `reporting`/MEA (Sprint W/T) — adressieren eine WEG-Verwalter-Persona, die nicht zum aktuellen Fokus (HW-Akquise, wenige Test-Verwalter) passt. Parallel-Route `neues-ticket` vs. `neues-ticket-neu` ebenfalls Konsolidierungskandidat. `marktplatz-archiv` bestätigt tot (s. Teil A).

### Handwerker — wichtigster strategischer Befund
Die Dashboard-Startseite zeigt aktuell primär "offene Ausschreibungen" (Auktion/Mass-Invite) — das **alte Bieter-Modell**. Der eigentliche Sprint-AM-Kernmoment ("Dir wurde Auftrag X zu Y € automatisch vorgeschlagen — Annehmen/Ablehnen") läuft über Stamm-Anfragen, ist aber im Nebenmenü versteckt. Das ist eine **Inversion der Doctolib-Strategie**: der Ausnahmefall (Fallback-Auktion) bekommt die Hauptbühne, der Normalfall (Direktvergabe-Inbox) nicht. Dies ist der größte Hebel für "strategische Kohärenz" im gesamten Audit.

### Admin
Mission-Control, Feedback, Nutzer = hoch (Beta-Monitoring). `aktivitaet` (KI-Trendanalyse) bei kleinen Fallzahlen wenig aussagekräftig. `system`-Health-Check misst noch "Angebote/Ticket" (altes Modell) statt Direktvergabe-KPIs (Annahmequote 1. Kandidat, Eskalationstiefe, Mass-Invite-Fallback-Quote).

---

## Umsetzungsplan / Priorisierung

### Sofort umsetzbar, risikoarm (→ #245, "Sichere Code-Aufräumarbeiten")
1. `components/handwerker/TimetableView.tsx` löschen (0 Referenzen).
2. `app/dashboard-verwalter/marktplatz-archiv/page.tsx` löschen (0 Referenzen, explizit Backup).
3. DB-Migration: `DROP TABLE IF EXISTS handwerker_stats, reporting_config, reports_archive` (+ zugehörige Policies).
4. Text-Fix `lib/email/templates.ts:519` (Zeitslot-Wording entfernen).
5. `lib/yield-management.ts` toten Code entfernen, `einnahmen/page.tsx`-Referenzen auf `zeitslots`/`zeitslot_gebote` bereinigen.

### Mittlere Priorität — strategische Kohärenz (Sprint AM Phase 3 + Folge-Sprint)
6. **HW-Dashboard-Startseite umbauen**: Stamm-Anfragen/Direktvergabe-Inbox als primären Content, Auktionen/Mass-Invite nur noch als "Fallback läuft"-Sektion. Größter Einzel-Hebel für Strategie-Kohärenz.
7. Marktplatz Phase-3-UI umsetzen (Live-Direktvergabe-Status für Verwalter) — Spec liegt bereits vor.
8. Parallel-Wizard-Routen konsolidieren: `melden`/`melden-neu`, `neues-ticket`/`neues-ticket-neu`.
9. Admin System-Health-Metrik von "Angebote/Ticket" auf Direktvergabe-KPIs umstellen.

### Niedrige Priorität / "zu früh gebaut" — vorerst ausblenden statt weiterbauen
10. `eigentuemer`- und `reporting`/MEA-Feature (Sprint W/T) hinter Feature-Flag legen oder aus der Sidebar für die aktuelle Beta-Phase ausblenden — Code bleibt erhalten, aber kein weiterer Ausbau, bis WEG-Verwalter-Persona tatsächlich Teil der Strategie wird.
11. `aktivitaet`-Trendanalyse (Admin) — keine Priorität, solange Fallzahlen klein sind.

---

## Status der Umsetzung (#245)

Punkte 1-4 sowie der risikoarme Teil von Punkt 5 wurden umgesetzt:

1. ✅ `components/handwerker/TimetableView.tsx` gelöscht.
2. ✅ `app/dashboard-verwalter/marktplatz-archiv/page.tsx` gelöscht (inkl. Anpassung der Kommentare in `marktplatz/page.tsx` und `zeitplan/page.tsx`, die auf die alte Backup-Seite verwiesen).
3. ✅ DB-Migration `20260615000000_audit2_drop_unused_tables.sql` erstellt und live angewendet: `handwerker_stats`, `reporting_config`, `reports_archive` entfernt (alle ohne FK-Eingang von anderen Tabellen, sicher per CASCADE).
4. ✅ Onboarding-Mailtext in `lib/email/templates.ts` (Zeile ~519) von "Lege Zeitslots an…" auf Google-Cal/Arbeitszeiten-Wording umgestellt.
5. ⚠️ Teilweise: `lib/yield-management.ts` wurde entschlackt — alle toten Faktor-Funktionen (`tageszeitFaktor`, `wochentagFaktor`, `nachfrageFaktor`, `knappheitsFaktor`, `lueckenRabatt`, `erkenneLuecken`, `berechneDynamischenPreis`) und die zugehörigen Typen entfernt; übrig bleiben nur `GEWERK_BASIS_PREISE` und `berechneEinnahmenPrognose`, die `einnahmen/page.tsx` aktiv nutzt.
   Der **Rework von `app/dashboard-handwerker/einnahmen/page.tsx`** selbst (Ablösung der `zeitslots`/`zeitslot_gebote`-Datenbasis durch Provisionen/Tickets) wurde **bewusst nicht** im Rahmen dieser "sicheren Aufräumarbeiten" gemacht — das ist ein funktionaler Umbau einer aktiv verlinkten Seite, kein risikoarmes Cleanup. Die Seite selbst markiert das bereits korrekt als offenes "Sprint AL"-Vorhaben (Übergangs-Banner im Code). Empfehlung: als eigener Sprint/Task einplanen, sobald Sprint-AM-Direktvergabe-Daten (Provisionen) eine sinnvolle neue Datengrundlage für die Einnahmen-Übersicht liefern.

Punkte 6-11 (HW-Dashboard-Umbau, Marktplatz-Phase-3-UI, Routen-Konsolidierung, Eigentümer/Reporting ausblenden, Admin-Health-KPIs) sind strukturelle/strategische Änderungen und bleiben als Backlog-Einträge für künftige Sprints offen.

---

*Erstellt im Rahmen von Audit 2.0 (#241-#245).*
