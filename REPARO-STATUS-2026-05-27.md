# Reparo — Produkt-Status & Vision
> Stand: 27.05.2026 · Automatisch generiert aus Codebase + Feedback-Loop

---

## Was ist Reparo?

Reparo ist eine **B2B-SaaS-Plattform für Schadensmeldung und Handwerker-Vergabe** in der Immobilienverwaltung. Es ersetzt E-Mail-Ping-Pong und Excel-Listen zwischen Mieter, Verwalter und Handwerker durch einen strukturierten, KI-unterstützten Workflow.

**Kernversprechen:** Der Verwalter tut nur noch das letzte 1% — Reparo übernimmt alles davor.

**Live unter:** https://reparo-app.netlify.app

---

## Die drei Rollen

### 🏠 Mieter
- Meldet Schäden über einen geführten Wizard (Foto, Beschreibung, Ort, Dringlichkeit)
- Wählt aus Terminvorschlägen des Handwerkers (Doodle-Stil)
- Kann Reklamation einreichen nach Auftrag
- Bekommt KI-generierten Ticket-Titel + Zusammenfassung
- Sieht Status aller seiner Tickets in Echtzeit

### 🏢 Verwalter
- Sieht alle eingehenden Tickets seiner Objekte
- Startet eine Vergabe per Knopfdruck: Notfall (Sofort-Match), Zeitnah (48h-Auktion), Planbar (72h-Auktion)
- Verwaltet Stamm-Handwerker (bevorzugte HW pro Gewerk)
- Sieht Marktplatz: Stamm-HW + alle HW im Radius (bis 50 km)
- Kann Eigentümer, Objekte und Wohneinheiten verwalten
- Bekommt Audit-Trail aller Aktionen

### 🔧 Handwerker
- Erhält Einladungen per E-Mail wenn ein passendes Ticket im Radius ausgeschrieben wird
- Öffnet Angebot-Seite: sieht Festpreis (vom System berechnet) + Ticket-Details
- Nimmt an oder lehnt ab (Reject-Flow folgt)
- Schlägt 3 Termine vor (Doodle), Mieter wählt einen
- Hat eigenen Kalender mit Google Calendar-Sync
- Sieht alle Aufträge, Einnahmen, Bewertungen im Dashboard

---

## Tech-Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (Serverless), Netlify Edge Functions |
| Datenbank | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth (E-Mail + Google OAuth) |
| Hosting | Netlify (auto-deploy auf git push) |
| Karten | Mapbox GL JS (Einsatzort, Radius-Suche) |
| E-Mail | Resend (transactional, 17 Routes) |
| Voice AI | Vapi + Twilio DE-Nummer (vorbereitet, nicht live) |
| KI | OpenAI GPT-4o (Ticket-Analyse, Foto-Prescan) |
| Geocoding | Google Maps API |

---

## Was heute live & funktioniert

### Mieter-Flow ✅
- Schadensmeldung-Wizard (Foto, Beschreibung, Adresse, Dringlichkeit, Gewerk)
- KI-Foto-Prescan: schlägt Gewerk + Dringlichkeit vor bevor Wizard-Start
- KI-Ticket-Analyse: generiert Titel, Zusammenfassung, Tags
- Termin-Auswahl aus HW-Vorschlägen
- Reklamations-Button nach Auftrag
- Wohneinheits-Referenz (Mieter-Nr / Wohnungs-Nr) im Wizard

### Verwalter-Flow ✅
- Ticket-Übersicht (alle Objekte)
- Auktions-Start: Notfall / Zeitnah / Planbar
  - Notfall: Google-Cal-Check der Top-5 HW, sofortiger Auto-Match
  - Zeitnah/Planbar: Einladungs-Zeilen mit Festpreis + E-Mail an HW im Radius
- Marktplatz: Stamm-HW + Pool im Radius (bis 50 km) mit Entfernung-Badge
- Stamm-HW verwaltung (Hinzufügen, Priorität, Gewerk-Zuweisung)
- Verfügbarkeits-Check via Google Calendar (grün/gelb/rot-Badge)
- Objekt-Verwaltung + Eigentümer-Verknüpfung

### Handwerker-Flow ✅
- Dashboard mit offenen Auktionen (Gewerk-gefiltert), Aufträgen, Kalender
- Angebot-Seite: Festpreis vom System (Stundensatz × h × Surge), 1-Klick annehmen
- Termin-Vorschlag (3 Slots, Mieter wählt einen)
- Kalender: eigene Aufträge + Google-Cal-Events + Privat-Blöcke
  - Arbeitszeit-Fenster konfigurierbar (erste/letzte Stunde der Anzeige)
  - Google Calendar OAuth-Verbindung im HW-Profil
- Bewertungen, Einnahmen-Übersicht

### Admin-Flow ✅
- Mission-Control Dashboard (alle Nutzer, Tickets, Transaktionen)
- Feedback-Panel: alle User-Feedbacks mit Status/Triage
- Sichtbarkeits-Score Recompute (täglich via Cron)

### Infrastruktur ✅
- RLS-Policies auf allen Tabellen (Row-Level Security)
- Audit-Trail (alle sensitiven Aktionen geloggt)
- Auto-Feedback-Loop: stündlicher Cron liest neue Feedbacks, triagiert
- Provisions-Berechnung: 5% Standard, 0% Early-Adopter, Surge-Faktor je Dringlichkeit
- Sichtbarkeits-Score pro HW (Basis für Marktplatz-Ranking)
- Reklamations-Tabelle + Status-Maschine (6 Status)
- Stamm-HW-Routing (Stamm-HW bekommt Vorrang vor Auktion)

---

## Preismodell (live)

```
Verwalter zahlt Provision:
- Standard:       5% vom Auftragswert
- Early Adopter:  0% (befristet bis early_adopter_bis)
- Surge-Faktor:   Notfall ×1.20 · Zeitnah ×1.10 · Planbar ×1.00

Festpreis-Berechnung für HW (Vollkalkulations-Modell):
- Zeitnah: HW-Stundensatz × 2h × 1.10 (min. 80 €)
- Planbar: HW-Stundensatz × 3h × 1.00 (min. 80 €)
- Notfall: Stundensatz × 2h × 1.20 (auto-zugewiesen)

HW bekommt vollen Auftragswert ausgezahlt.
Reparo-Gebühr liegt auf Verwalter-Seite.
```

---

## Die Vision (bestätigt 25.05.2026)

### Mieter-First-Workflow
```
Mieter meldet (App-Wizard ODER direkter Anruf)
  → KI macht erste Auswertung des Schadens
  → BEI LÜCKEN: Voice-AI ruft Mieter automatisch zurück
  → Erst wenn Ticket vollständig: Verwalter sieht fertiges Ticket
  → Verwalter: 1-Klick-Vergabe (kein Eingeben, nur Entscheiden)
```

Ziel: **Verwalter macht nur noch das letzte 1%.**

### Voice-AI V2 (Outbound zu Mieter)
- System erkennt unvollständige Tickets
- Vapi ruft Mieter automatisch zurück (max. 3 Versuche)
- KI fragt gezielt die fehlenden Felder ab
- Bei Abbruch: SMS mit Wizard-Link als Fallback
- DSGVO: Opt-in beim Mieter-Onboarding, EU-only Recording

### Marktplatz-Endvision
- Verwalter sieht nicht nur Stamm-HW sondern alle qualifizierten HW im Radius
- Map-View (HW-Pins auf Karte)
- Dynamisches Routing: Routen-Bündelung (HW fährt mehrere Aufträge am gleichen Tag)
- Sichtbarkeits-Score V2: basiert auf Google-Cal-Verbindung + Antwort-Rate (nicht mehr Slot-Angebote)

### B2B-Sales-Ziel
- Hausverwaltungen als Primär-Kunden (nicht Mieter direkt)
- Verwalter bringt alle seine Mieter mit → viraler Effekt
- Target: 16 Berliner Hausverwaltungen identifiziert
- Onboarding: Demo-Account + 60-Min-Walk-through + Early-Adopter-Konditionen

---

## Offene Punkte / In Arbeit

### Kurzfristig (nächste Sprints)

| # | Was | Warum offen |
|---|-----|-------------|
| Sprint AL | Sichtbarkeits-Score V2 (Google-Cal + Antwort-Rate statt Slots) | zeitslots deprecated, neuer Signal-Mix nötig |
| Sprint AL | Einnahmen-Seite auf `tickets`-Basis (statt `zeitslots`) | Migration nach zeitslots-Cleanup |
| Loop-23 Feature | Wohneinheits-Identifier im Verwalter-Ticket-Detail (Badge anzeigen) | Migration live, UI fehlt noch |
| Sprint AC | Voice-AI V2 (Outbound zu Mieter bei Lücken) | Vapi-Account live, Sprint-Spec offen |
| HW-Reject-Flow | Handwerker kann Auftrag ablehnen (Angebot-Seite) | Annehmen funktioniert, Ablehnen fehlt |
| Pool-Endpoint | Gewerk-Array-Filter (`handwerker_gewerke[]`) voll nutzen | Aktuell nur single-gewerk-Match |

### Mittelfristig

| # | Was | Status |
|---|-----|--------|
| Sprint G (Verwalter-Wizard) | Als Admin/Notfall-Tool behalten, nicht mehr Sales-Fokus | Live, aber deprioritisiert |
| Map-View Marktplatz | HW-Pins auf Karte statt Liste | Spec vorhanden, nicht gestartet |
| Bulk-Wohnungs-Import | CSV-Import für Verwalter mit vielen Einheiten | Spec vorhanden (Sprint I) |
| Eigentümer-Portal | Eigentümer sehen Tickets ihrer Objekte (read-only) | Schema live, UI-Stub vorhanden |
| Multi-Entity-Admin | Mehrere Verwaltungsgesellschaften pro Admin | Schema (MEA) live, UI offen |
| Audit-Trail-UI | Verwalter sieht eigene Aktions-History | DB-Schema live, kein Frontend |
| Reklamations-Prozess | Vollständiger Flow nach Einreichung | Button/Modal live, Backend-Folge-Schritte offen |

### Langfristig / Geplant

| # | Was | Vision |
|---|-----|--------|
| Voice-AI V2 Outbound | Automatischer Mieter-Rückruf bei Lücken | Kern der Mieter-First-Story |
| Routen-Bündelung | HW fährt mehrere Aufträge gebündelt (Tagesplan-Optimierung) | Effizienz für HW, USP für Plattform |
| HW-Rating-System V2 | Öffentliches Profil, Zertifikate, Referenzen | Vertrauen für Verwalter |
| Zahlungs-Abwicklung | In-App-Zahlung statt Direktzahlung | Monetarisierung + Sicherheit |
| Mieter-App (Native) | iOS/Android-App statt Webapp | Langfristig nach Web-Validierung |

### Bekannte Blocker / Ausstehend

| # | Was | Blocker |
|---|-----|---------|
| #4 | Netlify-ENVs (Impressum-Daten) | Lennart muss einpflegen |
| #8 | Resend-Domain (reparo-app.de) | Domain nicht verifiziert |
| #12 | HIBP Password-Check Toggle | Supabase Pro Plan erforderlich |
| #82 | A11Y + Style-Audit sichten | CC-Output liegt vor, Review ausstehend |
| #83–86 | B2B-Sales-Material | LinkedIn-DMs, Email-Templates, Demo-Video, MSA |
| #162 | Smoke-Test Google-Login (Incognito) | Lennart macht manuell |

---

## Abgeschlossene Sprints (Chronologie)

```
Sprint A–B     UX-Fixes + Bid-Flow (Angebot abgeben)
Sprint G       Verwalter-Wizard (deprioritisiert, bleibt als Tool)
Sprint H       Verwalter-Dashboard KPIs
Sprint I       Bulk-Import Spec
Sprint K       Landing-Page B2B-Polish
Sprint L       HW-Gewerk aus Profil (kein freies Eingabefeld mehr)
Sprint M       UI-Konsistenz-Audit + Fixes
Sprint N       Empty-States + Fehlermeldungen
Sprint O       Rollen-Switcher Dropdown
Sprint P       Mobile + A11y-Compliance
Sprint Q       Spezial-Fixes aus Audit
Sprint R       Aufräumen + Pricing-Vereinheitlichung (F11 Vollkalkulation)
Sprint AA      Hotfix Vergabe-Regression
Sprint AE      Google-Cal-Sync für HW (OAuth + Kalender-Anzeige + Auto-Block)
Sprint AF      KI-Schnellauswahl (Foto-Prescan + dynamische Gewerk-Pills)
Sprint AG      Mapbox-Migration (OSM raus)
Sprint AH      Admin-Mission-Control Redesign
Sprint AI      Wizard-Refactor (shared Component)
Sprint AJ      Multi-Role Demo-Account + Rollen-Switcher
Sprint AK      zeitslots-Cleanup (Kalender entrümpeln + Marktplatz-Rebuild + Pool-Read)
Loop-26 Fix    einladungen-Zeilen beim Auction-Start anlegen (empfohlener_preis)
```

---

## Datenbank-Übersicht (Prod)

```
profiles          — Nutzer (Mieter / Verwalter / Handwerker / Admin)
tickets           — Schadensmeldungen mit vollem Lifecycle
objekte           — Immobilien / Liegenschaften
wohneinheiten     — Einzelne Wohnungen in Objekten
einladungen       — HW-Einladungen zu Auktionen + empfohlener_preis
angebote          — HW-Angebote (Annehmen-Aktion)
termine           — Vorgeschlagene + bestätigte Termine
stamm_handwerker  — Bevorzugte HW pro Verwalter + Gewerk
stamm_anfragen    — Direktanfragen an Stamm-HW vor Marktplatz
provisionen       — Provisions-Snapshots pro Auftrag
reklamationen     — Beanstandungen nach Auftrag
eigentuemer       — Eigentümer-Profile
objekt_eigentuemer — Eigentümer-Objekt-Verknüpfung
audit_log         — Aktions-Historie
hw_google_oauth   — Google-Cal-Tokens der Handwerker
feedback          — User-Feedbacks (Loop-Basis)
ki_analysen_cache — GPT-Analyse-Cache (Kostenkontrolle)
ki_quota          — Rate-Limiting für KI-Calls
zeitslots         — DEPRECATED (Privat-Blöcke bleiben, Verfügbarkeit tot)
```

---

## Demo-Accounts (Passwort überall: `BetaReparo2026!`)

| Rolle | E-Mail |
|-------|--------|
| 🏠 Mieter | demo-mieter-1@reparo-demo.de |
| 🏢 Verwalter | demo-verwalter-1@reparo-demo.de |
| 🔧 Handwerker (Sanitär) | demo-handwerker-1@reparo-demo.de |
| 🔧 Handwerker (Elektro) | demo-handwerker-2@reparo-demo.de |

---

*Generiert 27.05.2026 — Lennart Jahn / Reparo*
