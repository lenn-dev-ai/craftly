# Beta-Feedback (intern, Lennart)

> Live-Notizen während des persönlichen Beta-Durchgangs am 17.05.2026.
> Wächst inkrementell. Claude Code soll daraus später einen Fix-Sprint
> bauen — vorher mit Lennart priorisieren.

---

## Iteration 1 — 17.05.2026 (Mieter-Flow)

### Mieter-Schadensmeldung

- **[F1, ✅ b964e9b] Schnellauswahl in der Schadensmeldung**: gelabelt als "Hilfe für den Anfang (optional)" mit Hinweis "Setzt einen Beispieltext ein, den du danach noch anpasst". Bleibt drin als Inspiration, ist aber jetzt klar entkoppelt von Pflicht-Auswahl.
- **[F2, ✅ b964e9b] Dringlichkeit „kann warten"**: PRIO_SUB.planbar umbenannt zu "Diese Woche OK". Konkreter Zeitrahmen statt resignativem Wording.
- **[F3, ✅ dffdca0] Wasserschaden / Feuchtigkeit → falsche KI-Tipps**: API-Wert `schadensart="sanitaer"` (laut SYSTEM_PROMPT) hatte keinen passenden UI-Key in `KI_ANALYSEN`. Neues `SCHADENSART_API_TO_UI`-Mapping, plus dach/fassade/boden in der UI-Map ergänzt.
- **[F4, ✅ b964e9b] Geschätzte Zeit vs. Dringlichkeit**: Label "Geschätzte Zeit" → "Typische Dauer" / "Typische Reparaturdauer" — entkoppelt die Anzeige sauber von der Dringlichkeitsstufe. Keine Mieter-Eingabe für Zeit (war es schon nicht, nur Wording unsauber). Disclaimer im UI bleibt.
- **[F5, ✅ 58023e0] Handwerker-Auswahl beim Mieter springt zu Verwalter**: Code-Check-Befund: Admin-Accounts (wie Lennart) hatten in `TicketDetailView` immer `isVerwalter = true`, selbst in Mieter-Sicht — der „Handwerker auswählen"-Button war sichtbar und routete auf Verwalter-Pfad. Fix: `isVerwalter`/`isHandwerker` koppeln jetzt zusätzlich an `useActiveRole()` aus dem ActiveRoleContext.

### Beta-übergreifend

- **[F6, ✅ 11a4e94] Feedback-Bubble**: Hover/Focus-Tooltip neben dem Button ("Feedback ans Reparo-Team"), `title`-Attribut, und Subtext im Modal ergänzt ("Dein Feedback geht direkt an das Reparo-Team — wir lesen jede Nachricht").

---

## Iteration 2 — 17.05.2026 (Verwalter + Handwerker)

### Verwalter

- **[F7, ✅ 4681006] Schadensmeldungs-Detailansicht zu grob**: Drei neue Kontext-Karten unterhalb des Headers, nur in Verwalter-Sicht — Objekt (name/adresse/plz/einheiten + Wohnung), Mieter (name/email/telefon, Join via `profiles!erstellt_von`), KI-Einschätzung (schadensart, vorhergesagtes Gewerk, confidence in Prozent). `ki_confidence`/`ki_schadensart` zusätzlich im Ticket-Type aufgenommen.
- **[F8, ✅ 92c672b] Effektivpreis-Berechnung bei Dringlichkeits-Wechsel**: `effektivPreisFinal = effektivPreis × AUKTIONS_CONFIGS[d].surgeFaktor` im sortiert-useMemo (mit `dringlichkeit` als Dep) — Anzeige und Sort ändern sich live beim Umschalten.
- **[F9, ✅ 29626eb] Dashboard-Status-Kacheln klickbar**: Kpi-Komponente um optionalen `href`-Prop erweitert. Drei Status-Kacheln (Eingegangen / Laufende Auktionen / In Arbeit) verlinken auf `/dashboard-verwalter/tickets?status=…` — die Tickets-Seite las den Param bereits.
- **[F10, ✅ 259bf59] „Termin buchen" beim HW landet im Marktplatz**: Button-Wording „Verfügbare Slots", navigiert mit `?hw=<id>`-Filter. Marktplatz filtert seine Slot-Liste und zeigt einen Banner mit „Filter entfernen".
- **[F11, ✅ 623ac7b] Auktion vs. Angebotspreis (Phase-0-Entscheidung: Vollkalkulation)**: HW-Marktplatz-UI bekommt kein freies Festpreis-Feld mehr; stattdessen wird der `empfohlener_preis` der HW-Einladung als read-only-System-Preis angezeigt. Submit-Pfad nutzt diesen Wert. Wording "Angebot abgeben" → "Auftrag annehmen". Pricing-Engine + Penalty-Logik bleiben unangetastet.

### Handwerker

- **[F12, ✅ 7fd9c4f] Sidebar-Navigation gruppiert**: `MenuItem`-Typ um `gruppe: "selten"` erweitert. 11 Top-Level-Items → 6 Top-Daily + 5 in „Mein Bereich"-Untersektion. Keine Routen gelöscht.

---

## Backlog-Ideen aus dem Beta-Durchgang

- **KI-gesteuerte Feedback-Auswertung im Beta-Loop**: Feedback aus der Bubble automatisch von Claude vorklassifizieren („Bug / UX / Feature-Wunsch") und bei Sinnhaftigkeit + manueller Lennart-Freigabe direkt in einen Fix-Branch packen. *Größerer Build, post-Beta, aber sehr schöner Loop.*
- **Onboarding-Broschüre für externe Beta-Tester**: Was ist Reparo, was ist die Aufgabe, was ist zu tun? Inklusive Demo-Accounts (Mieter, Verwalter, HW) und Login-Daten. *Quick-Win für nächste Iteration, sobald Mieter-Flow gefixt.*

---

## Iteration 3 — 17.05.2026 (Cowork Browser-Probe nach Sprint)

### Regressions-Befund während QA

- **[F3.1, ✅ 5dccc98] Wasserschaden-Tipp-Regression**: Root-Cause war nicht die Tipp-Datenbank, sondern die Lookup-Reihenfolge in `melden/page.tsx` — `reverseGewerkKey` schlug `kiResult`. Da `heizung` und `wasser` beide `gewerk="heizung_sanitaer"` haben, traf das Reverse-Lookup durch Iterationsreihenfolge zuerst `heizung`. Fix: `kiResult` (Schadensart-Klassifikation) jetzt authoritativ, `reverseGewerkKey` nur noch Fallback. Nebenwirkung: „Typische Dauer" bei Wasserschaden zeigt jetzt 2-8 h (vorher 12-48 h aus dem heizung-Eintrag). Cowork-Repro nach Deploy bestätigt grün.

### Bestätigte Sprint-Fixes (gesichtet von Cowork)

- ✅ F12, F5, F11, F10, F9, F6, F1, F2, F4 — alle visuell + funktional bestätigt
- ⏸ F8 — wegen 1-HW-Datenlage nicht visuell testbar, Code in Build clean
- ⚠️ F7 — Mieter-Karte da, Objekt-/KI-Karten fehlen visuell (vermutlich dünne Daten, sollte mit echtem Mieter-Profil + Objekt-Verknüpfung gegenprüfen)

### Optional weitere Beobachtungen

- **„TYPISCHE DAUER: ca. 12-48 Stunden" bei Dringlichkeit „Notfall"**: System-Schätzung passt nicht zur User-Wahl „Sofort". Nicht zwingend Bug, aber UX-Inkonsistenz. Erwägen ob Dauer sich an Dringlichkeit anpassen sollte oder ob der Disclaimer ausreicht.
- **390 px Mobile-Test**: Aus Cowork heraus nicht durchführbar (macOS Chrome Mindest-Window-Breite ist 1026 px). Test muss Lennart selbst in Chrome DevTools Device Mode (`Cmd+Option+I` → Toolbar oben links → iPhone 13 Pro) durchführen.

---

## Konvention für weitere Iterationen

Lennart pinged „Feedback Iteration X" → ich ergänze hier eine neue Sektion mit Datum + getestetem Bereich (Verwalter, HW, Admin, Kalender, etc.). Am Ende der Beta wird das in saubere GitHub-Issues + Fix-Branches überführt (drüben in Claude Code).
