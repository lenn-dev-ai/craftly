# UX-Audit Kalender-Feature (HW-Perspektive)

**Datum:** 27.05.2026
**Tester:** Cowork (durchgeklickt als demo-handwerker / lennjahn)
**Scope:** `/dashboard-handwerker/kalender` inkl. Google-Cal-Sync (Sprint AE Phase 3)
**Stand:** Live auf `reparo-app.netlify.app`

## TL;DR

Der Kalender funktioniert — Google-Events erscheinen, Layer-Toggles wirken, Klick öffnet das Verfügbarkeits-Modal. Aber: **zwei echte Bugs** (Kollisions-Check fehlt, Mobile-Hint fehlt) und 8–10 Polishing-Lücken die zwischen "funktioniert" und "fühlt sich fertig an" stehen. Nichts davon ist ein Beta-Blocker, aber das Feature wirkt aktuell wie ein MVP, nicht wie ein Tool das ein Handwerker täglich nutzen will.

---

## Bugs (Verhalten falsch)

### B1 — Klick auf belegte Stunde öffnet Verfügbarkeits-Modal trotzdem [P0]
Click auf Donnerstag 12:00 (genau wo der Google-Event `test 1` liegt) öffnet `Verfügbarkeit anbieten` 12:00–14:00. Das überlappt mit einem Google-Termin → HW würde doppelt-buchen.

**Code:** `app/dashboard-handwerker/kalender/page.tsx` Zeilen ~440–460. `istBelegt` prüft nur `tagTermine` + `tagSlots`, NICHT `tagGoogle`.

**Fix (1 Zeile):**
```ts
const istBelegt =
  tagTermine.some(t => overlap(t.von, t.bis, stundeStart, stundeEnde)) ||
  tagSlots.some(sl => overlap(sl.von, sl.bis, stundeStart, stundeEnde)) ||
  tagGoogle.some(g => overlap(g.von, g.bis, stundeStart, stundeEnde))  // NEU
```

### B2 — Klick-Hinweis nur auf Desktop sichtbar [P1]
"Klick auf eine leere Stunde → Verfügbarkeit anbieten" hat `sm:inline` — auf Mobile (390px) unsichtbar. Erstnutzer auf dem Handy wissen nicht, wie sie Verfügbarkeit setzen.

**Fix:** auf Mobile das Hint-Banner ÜBER dem Grid einblenden (wenn `verf.length === 0 && slots.length === 0`).

---

## UX-Lücken (Verhalten OK, Erfahrung lückenhaft)

### U1 — Empty-State fehlt komplett [P1]
Erst-Login als HW: kompletter Kalender leer. Kein "So funktioniert's"-Onboarding, keine Beispiel-Visualisierung, kein "Klick irgendwo, um Verfügbarkeit zu setzen"-Overlay. Lennart's Frust am Anfang ("ich finde den Termin nicht") ist genau das.

### U2 — Kein "Jetzt"-Indikator [P2]
Google-Cal zeigt rote horizontale Linie bei der aktuellen Uhrzeit. Reparo nicht. Für HW der "wo bin ich jetzt im Tag?" wissen will, fehlt der Anker.

### U3 — Feiertage werden nicht visualisiert [P2]
Mo 25.05.2026 ist Pfingstmontag. Google zeigt Banner "Pfingstmontag". Reparo zeigt einfach Mo 25. wie jeden anderen Tag. HW könnte versehentlich Verfügbarkeit am Feiertag setzen.

### U4 — Cal-Verbindung-Status nicht sichtbar [P2]
Nach erfolgreicher Verbindung verschwindet das Banner — danach kein "Verbunden mit lennjahn@gmail.com seit 27.05." Status irgendwo. HW weiß nicht, ob Sync läuft. Auch keine "Verbindung trennen"-Option außer im Profil tief verbuddelt.

### U5 — Termine-Toggle zu unspezifisch [P3]
Toggle "Termine" steuert alles was ein Auftrag/Termin ist — wenn HW ausschaltet, verschwinden auch bezahlte Aufträge. Aufträge sollten m.E. immer sichtbar sein, nicht togglebar.

### U6 — Google-Event-Klick öffnet Google im neuen Tab [P3]
Funktional korrekt (HW kann dort editieren), aber kontextueller Bruch. Mindestens: Hover-Tooltip mit "Öffnet Google Kalender" als Erwartungsmanagement.

### U7 — Stunden-Achse fix 07:00–20:00 [P3]
Was wenn HW Notdienst macht oder erst ab 10:00 startet? Kein Settings für Arbeitszeit-Fenster. Auch nicht scrollbar nach 20:00.

### U8 — Verfügbarkeit-Modal defaultet zu 2h-Block [P3]
Klick auf 12:00 → Modal mit 12:00–14:00. Hardcoded. Sollte aus Profil kommen (typische Auftragsdauer).

### U9 — Mobile: Spalten zu schmal [P3]
7 Tage parallel auf 390px = ~50px pro Spalte. Termin-Titel werden abgeschnitten ("test 1" wird zu "te…"). Lösung: auf Mobile auf Tages-Ansicht switchen (Slider statt Wochengrid) ODER nur 3 Tage zeigen.

### U10 — Floating-Burger überlappt Stunden-Label auf Mobile [P3]
Beim Mobile-Test sah ich den Burger-Button (Hamburg) leicht über dem `12:00`-Label. Z-Index-Stack-Bug.

---

## Feature-Gaps (was fehlt aus HW-Erwartung)

### F1 — Auto-Block bei Google-Event fehlt
HW erwartet, dass wenn er einen privaten Termin in Google hat, Reparo ihn automatisch als "belegt" markiert (= keine Auftrags-Vorschläge in dieser Zeit). Aktuell ist Google-Layer rein dekorativ. Auctions würden ihm Termine vorschlagen die direkt mit Privat-Termin kollidieren.

### F2 — Kein "Privater Termin"-Eintrag in Reparo
HW kann nur: Verfügbarkeit setzen ODER warten dass ein Auftrag erscheint. Wenn er einen privaten Block in Reparo eintragen will (Mittagspause, Arzttermin) → muss er das in Google machen.

### F3 — Datum-Picker fehlt
Nur ‹ Heute › — kein Sprung zu spezifischem Datum (z.B. 1. August). Bei längerer Planungssicht umständlich.

### F4 — Wochenview-Wechsel zu Monat/Tag fehlt
Nur Woche möglich. Für Übersicht wäre Monat hilfreich, für Detail Tag.

---

## Empfehlung Priorisierung

| Priorität | Items | Zeit |
|---|---|---|
| **Sofort fixen (1h)** | B1 (Kollisions-Check), B2 (Mobile-Hint), U4 (Verbindungsstatus) | 1h |
| **Diese Woche** | U1 (Empty-State), U2 (Jetzt-Linie), F1 (Auto-Block Google) | 3-4h |
| **Sprint AK** | U3 (Feiertage), U7 (Arbeitszeit-Config), F2 (Privat-Termin), F3 (Datum-Picker), U9 (Mobile-Layout) | 1-2 Tage |
| **Backlog** | U5/U6/U8/U10/F4 | nice-to-have |

## Positive Aspekte

- **Google-Sync funktioniert** sauber — Events erscheinen unmittelbar nach Reload
- **Visual-Hierarchie** zwischen Termine/Slots/Google ist klar (Farben differenzieren)
- **Wochen-Navigation** ist schnell + intuitiv
- **Modal-Flow** für Verfügbarkeit ist klar formuliert ("Diese Zeit zur Verfügung stellen — Verwalter sehen das im Marktplatz")
- **Heute-Markierung** (Mi 27. in accent) ist gut sichtbar
- **Layer-Toggles** als Chips über dem Grid sind discoverable
