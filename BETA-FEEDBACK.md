# Beta-Feedback (intern, Lennart)

> Live-Notizen während des persönlichen Beta-Durchgangs am 17.05.2026.
> Wächst inkrementell. Claude Code soll daraus später einen Fix-Sprint
> bauen — vorher mit Lennart priorisieren.

---

## Iteration 1 — 17.05.2026 (Mieter-Flow)

### Mieter-Schadensmeldung

- **Schnellauswahl in der Schadensmeldung**: Nicht wirklich sinnvoll und zu ungenau, um daraus einen Schaden zu generieren / sinnhaft auszuschreiben. *Möglicher Fix: Schnellauswahl entfernen oder die Vorschläge granularer machen, oder als reine Inspiration / Filterhilfe (nicht Pflicht-Eingabe) deklarieren.*
- **Dringlichkeit „kann warten"**: Wird de facto niemand wählen, weil zu unsicher. *Möglicher Fix: Stufe umbenennen (z.B. „im nächsten Monat OK" o.ä.) oder weglassen — Default auf „planbar".*
- **Wasserschaden / Feuchtigkeit → KI-Soforttipp zeigt Heizungs-Tipps**: Klassifikations-Bug in der Schadenserkennung. *Fix: Mapping zwischen Schadens-Stichwörtern und Gewerk-Tipps prüfen — wahrscheinlich falsche Zuordnung in `lib/ki/schadenserkennung` o.ä.*
- **Geschätzte Zeit im Verhältnis zur Dringlichkeit**: Sollten sich gegenseitig bedingen. **Logik-Frage:** Macht es überhaupt Sinn, beim Mieter schon eine Zeitangabe abzufragen? Risiko: jeder klickt „dringend" damit die kürzeste Zeit kommt → System wird unbrauchbar. *Mögliche Optionen:* (a) Zeit nur als verwalter-/HW-seitige Schätzung, nicht Mieter-Eingabe, (b) Zeit als rein informative Info ohne Bindung an die Priorität, (c) komplett weglassen beim Mieter.
- **Handwerker-Auswahl beim Mieter**: Mieter kann HW auswählen, springt dann zum Verwalter — **warum?** *Unklar ob Feature („Wunsch-HW") oder UI-Bug. Code-Check in Mieter-Wizard nötig.*

### Beta-übergreifend

- **Feedback-Bubble**: *Lennarts Frage:* wozu und wo geht das Feedback hin? *Antwort aus dem Code:* Geht in `public.feedback` (heute angelegt, Block 4), Admin-Inbox dafür ist gebaut. *Aber:* offensichtlich nicht selbsterklärend im UI. *Fix-Idee:* Tooltip / kurze Erklärung beim Klick („Dein Feedback geht direkt an das Reparo-Team").

---

## Backlog-Ideen aus dem Beta-Durchgang

- **KI-gesteuerte Feedback-Auswertung im Beta-Loop**: Feedback aus der Bubble automatisch von Claude vorklassifizieren („Bug / UX / Feature-Wunsch") und bei Sinnhaftigkeit + manueller Lennart-Freigabe direkt in einen Fix-Branch packen. *Größerer Build, post-Beta, aber sehr schöner Loop.*
- **Onboarding-Broschüre für externe Beta-Tester**: Was ist Reparo, was ist die Aufgabe, was ist zu tun? Inklusive Demo-Accounts (Mieter, Verwalter, HW) und Login-Daten. *Quick-Win für nächste Iteration, sobald Mieter-Flow gefixt.*

---

## Konvention für weitere Iterationen

Lennart pinged „Feedback Iteration X" → ich ergänze hier eine neue Sektion mit Datum + getestetem Bereich (Verwalter, HW, Admin, Kalender, etc.). Am Ende der Beta wird das in saubere GitHub-Issues + Fix-Branches überführt (drüben in Claude Code).
