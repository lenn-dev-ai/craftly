# Loop-Iteration-27 — 09.06.2026

## Kontext

Supabase-Projekt war ~13 Tage pausiert (Free-Tier Auto-Pause nach
Inaktivität). Dadurch waren 5 Feedbacks vom 27.05.26 unverarbeitet
("WARTET COWORK", kein Verdict). Projekt wurde reaktiviert
(`restore_project`, project_id `gkojaogdzzyuboajwyom`), jetzt
ACTIVE_HEALTHY. Dieser Loop triagiert die 5 offenen Feedbacks.

## Feedbacks (5 neue seit 27.05., alle WARTET COWORK)

| ID | Datum | Rolle | URL | Message |
|----|-------|-------|-----|---------|
| d3495b20 | 27.05.26 | Admin | /dashboard-handwerker/angebot/f90c3a69-c4fe-4935-b5c2-08434d9a1a19 | Was muss passieren, damit wir ein System Preis bekommen? |
| — | 27.05.26 | Admin | /dashboard-handwerker#ausschreibungen | verfügbar im radius 1 aber ich kann nicht draufklicken... |
| — | 27.05.26 | Admin | /dashboard-verwalter/marktplatz | Warum muss ich handwerker erst als stammhandwerker anlegen... |
| — | 27.05.26 | Admin | /dashboard-mieter/melden | Hier fehlt mieter nummer |
| — | 27.05.26 | HW | /dashboard-handwerker | Warum steht hier Hallo Mieter wenns handwerker ist? |

## Triage

### d3495b20 — ERLEDIGT (Loop-26)
System-Preis (Festpreis) wird jetzt auf der Angebot-Seite angezeigt.
Behoben in Loop-26 (commit aff1032 + 7186097). Live verifiziert am
09.06.2026: zeigt 121€ Festpreis korrekt.

### "verfügbar im radius 1 aber ich kann nicht draufklicken" — BEREITS GEFIXT (Loop-25 / H5)
Root Cause war ein `<div>` ohne Link/Klick-Handler. Bereits in Loop-25
(H5-Fix) behoben: Die Kachel "Verfügbar im Radius" ist ein `<a
href="#ausschreibungen">` mit Hover-Styling und scrollt zur
Ausschreibungs-Liste. Am 09.06.2026 im Code verifiziert — kein
weiterer Handlungsbedarf. Das Feedback war vor dem Fix eingegangen.

### "Warum erst Stamm-HW anlegen?" — KONZEPT-KLARSTELLUNG (UX)
Der Marktplatz zeigt Stamm-HW UND Pool-HW. Stamm-HW ist
optional/bevorzugt. Die Auktionslogik läuft auch ohne Stamm-HW
(Radius-Matching im Pool). Problem: UI-Text im Marktplatz macht das
nicht klar.
Empfehlung: Tooltip/Erklär-Text auf Marktplatz-Seite "Stamm-HW =
bevorzugt, Pool = alle verfügbaren HW im Radius". Sprint AL oder
Loop-28.

### "Hier fehlt mieter nummer" — FEATURE (M)
Wohneinheits-Referenz im Mieter-Melden-Wizard.
Migration `loop23_tickets_wohneinheit_referenz` ist live (Spalte
existiert), aber UI-Feld fehlt noch im Wizard.
Empfehlung: Im Ticket-Wizard nach "Adresse" ein optionales Feld
"Wohneinheit / Mieternummer" einfügen. Sprint AL.

### "Hallo Mieter wenns Handwerker" — BEREITS GEFIXT
Sprint AJ hat den Rollen-Switcher + Begrüßung korrigiert. Heute live:
"Hallo, [Name]" ohne Rollen-Präfix. Kein Handlungsbedarf. Das
Feedback war vor dem Fix eingegangen.

## Health-Fix Sprint (parallel zu dieser Triage)

Im Rahmen des Health-Checks vom 09.06.2026 wurden zusätzlich
folgende Punkte direkt gefixt:

- Demo-HW-Profile (1/2/3): Gewerk, Stundensatz, Berlin-Koordinaten,
  Radius gesetzt (SQL-Migration auf Production angewendet) — behebt
  die Admin-Warnung "HW ohne Gewerk" und ermöglicht Radius-Matching
  für die Demo-Accounts.
- Landing Page: Bid-/Auktions-Sprache durch Festpreis-/
  Vollkalkulations-Sprache ersetzt (Stundenauktion → intelligente
  Schadensmeldung, "Verwalter bieten" → "Verwalter buchen dich direkt
  zum Festpreis", etc.)
- Anti-Pause-Cron `/api/cron/keep-alive` + Netlify-Scheduled-Function
  (täglich 06:00 UTC) gegen erneutes Supabase-Auto-Pause.
- Resend-Health-Check liefert jetzt einen `reason`-String, der im
  Mission-Control-Tooltip/Text angezeigt wird, statt nur rot/grün.

## Resend-Pause (Nachzieher 09.06.2026 abends)

Verifikation des Resend-Status zeigte: API-Key valide (HTTP 200 auf
`GET /domains`), aber **keine verifizierte Domain** im Account
(`data: []`). Default `RESEND_FROM_EMAIL = noreply@reparo-app.de` ist
also bei Resend unbekannt → jeder echte Mail-Versand schlüge still
fehl. Der vorherige Health-Check hätte `ok: true` zurückgegeben
(falsches Grün).

Entscheidung: Resend pausieren, bis Domain `reparo-app.de` bei Resend
verifiziert ist (DNS-Records). Umgesetzt als Feature-Flag:

- `RESEND_PAUSED=1` (Netlify-Env muss noch gesetzt werden!) →
  `sendEmail()` skipt ohne Warnung, Health-Check meldet
  `{ ok: true, paused: true, reason: "Pausiert — keine verifizierte
  Domain" }`.
- Mission-Control-Dot zeigt jetzt drei Zustände: 🟢 ok, 🟡 paused
  (amber), 🔴 error.
- Zusätzlich: Health-Check prüft auch ohne Pause-Flag, dass mind. 1
  verifizierte Domain existiert — sonst rot mit Grund. Verhindert
  falsches Grün bei künftigem Reaktivieren.

Wenn Domain verified ist: `RESEND_PAUSED` entfernen (oder auf 0
setzen), Domain als `RESEND_FROM_EMAIL` eintragen.

## Status: Loop-27 DURCH

- d3495b20: ERLEDIGT (Loop-26, verifiziert)
- HW-Kachel-Klick: BEREITS GEFIXT (Loop-25), verifiziert
- "Hallo Mieter/Handwerker": BEREITS GEFIXT (Sprint AJ)
- Demo-HW-Profile: GEFIXT (dieser Loop, SQL-Migration live)
- Resend-Status: GEFIXT (dieser Loop, reason sichtbar)
- Landing-Page-Sprache: GEFIXT (dieser Loop)
- Anti-Pause-Cron: GEFIXT (dieser Loop)

Pending (Folge-Sprints):
- Marktplatz-Erklär-Text Stamm-HW vs. Pool (Loop-28 / Sprint AL)
- Wohneinheit/Mieternummer-Feld im Melden-Wizard (Sprint AL)
