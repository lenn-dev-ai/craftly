# Loop Iteration 28 — 18. Juni 2026

## Kontext
- **Sprint**: Sprint AX (Handwerker-Agent) abgeschlossen
- **Commit**: `5216ef8` — feat(sprint-ax): Handwerker-Agent — alle 4 Phasen
- **Triagierte Feedbacks**: 9 neue Einträge aus Lennarts Live-Nutzung am 18.06.

## Neu eingegangene Feedbacks (9)

| ID (Kurzform) | Typ | Sev | Bereich | Inhalt |
|---|---|---|---|---|
| `590006f1` | Bug | medium | ki | KI-Briefing zeigt falsche Temperatur — HW sagte "wir haben heute 29°C" |
| `15576206` | Duplikat | low | ki | Duplikat des Wetter-Feedbacks oben |
| `e5bf6bbb` | Bug | medium | karte | Route verbindet Punkte nicht + keine Wegbeschreibung |
| `dd19869e` | UX | low | karte | Route nicht nachvollziehbar dargestellt |
| `9938e674` | **Bug** | **blocker** | einladungen | **"Auftrag annehmen" → Fehler "Ungültige Eingabe"** |
| `699cd255` | Bug | high | verwalter | Auktions-Countdown noch auf Angebot-Seite sichtbar |
| `f71e4c59` | Feature | medium | verwalter | Wohnungs-Import: Download-Vorlage (CSV) fehlt |
| `ea6c8b00` | Bug | high | verwalter | Verwalter-Dashboard zeigt noch Auktions-Sprache |
| `df7233b3` | UX | low | nav | Abmelden-Button ganz unten im Menü |

## Diagnose

### 9938e674 — P0 Blocker: "Ungültige Eingabe" beim Annehmen
**Root Cause gefunden:**

Das Demo-Ticket `b0000001-...-002` hat `status='auktion'` statt `status='offen'`. Daher evaluiert die Angebot-Seite `isDirektvergabe = false` und schickt die Anfrage an `/api/auftraege/annehmen`. Diese Route hat ein Zod-Schema (`angebotAnnehmenSchema`) das die optionalen String-Felder als `z.string().optional()` definiert — Zod akzeptiert `undefined`, aber **nicht `null`**. Das Frontend sendet `fruehester_termin: null` (wegen `fruehesterTermin || null`) → Zod validiert auf 400 mit `{ error: "Ungültige Eingabe" }`.

**Fix (Sprint AY-1):**
```typescript
// lib/schemas.ts — vorher:
fruehester_termin: z.string().max(100).optional(),

// nachher:
fruehester_termin: z.string().max(100).nullable().optional(),
```
Gleiches für `geschaetzte_dauer` und `nachricht`.

### 699cd255 — Auktions-Countdown
`timeLeft()` in `angebot/[id]/page.tsx` zeigt Badge wenn `ticket.auktion_ende` gesetzt — aber im Direktvergabe-Modell gibt es keine Auktionsfrist. Das Demo-Ticket `b0000001-...-002` hat `status='auktion'` und damit evtl. ein `auktion_ende`.

**Fix (Sprint AY-2):** `timeLeft()`-Funktion + `{tl && ...}`-Badge entfernen.

### ea6c8b00 — Verwalter-Dashboard Auktions-Sprache
5 Stellen im Verwalter-Dashboard sprechen noch von "Auktion":
- "Stundenslots buchen, Auktionen starten" → "Direktanfragen freigeben, HW auswählen"
- "Auktion ohne Vergabe" → "Keine Vergabe — erneut ausschreiben"
- KPI Sub-Label "Auktion" → "Marktplatz"
- "Auktion (Fallback)" → "Marktplatz (Fallback)"
- "Auktions-Ersparnis" → "System-Ersparnis"

**Fix (Sprint AY-3):** Direkt in `dashboard-verwalter/page.tsx` erledigt.

### 590006f1 — KI-Wetter falsch
Open-Meteo API in `/api/hw/tages-briefing/route.ts` — könnte falscher Startort oder veraltete Daten sein. Lennart erwähnte "wir haben heute 29°C" was für Berlin am 18.06. realistisch klingt. Zu untersuchen: hat Demo-HW korrekte `startort_lat`/`startort_lng` in der DB?

**Status:** `waiting` — nicht akut, weiter untersuchen.

### e5bf6bbb / dd19869e — Route-Bugs
Beide durch Sprint AX (Mapbox-Directions) bereits behoben → `done`.

## Verdicts (alle in feedback_verdicts gespeichert)

```
9938e674 → bug/blocker/einladungen → waiting (Sprint AY-1 geplant)
699cd255 → bug/high/verwalter   → waiting (Sprint AY-2 geplant)
ea6c8b00 → bug/high/verwalter   → waiting (Sprint AY-3 geplant)
590006f1 → bug/medium/ki        → waiting (untersuchen)
15576206 → question/low/ki      → done (Duplikat ignoriert)
e5bf6bbb → bug/medium/karte     → done (Sprint AX behoben)
dd19869e → ux/low/karte         → done (Sprint AX behoben)
f71e4c59 → feature/medium/verw. → backlog (Sprint I)
df7233b3 → ux/low/nav           → backlog
```

## Sprint AY — Bug-Fix-Sprint (aus Loop 28)

**Umfang:**
- **AY-1 (P0)**: `lib/schemas.ts` — Zod-Schema null-tolerant ✅ DONE in dieser Session
- **AY-2 (HIGH)**: `angebot/[id]/page.tsx` — Countdown entfernen ✅ DONE in dieser Session
- **AY-3 (HIGH)**: `dashboard-verwalter/page.tsx` — Wording-Pass ✅ DONE in dieser Session

**Commit:** `git add -A && git commit -m "fix(sprint-ay): Zod-null-Bug + Countdown + Verwalter-Wording"`

## Nächste Prioritäten

1. **Push** Sprint AY (Lennart: Terminal → `git push`)
2. **Wetter-Bug untersuchen** — `startort_lat/lng` für Demo-HW prüfen
3. **Demo-Ticket b0000001-...-002 reparieren** — status sollte `offen` sein oder Einladung entfernen
4. **Smoke-Test**: `/angebot/{einladung_ticket}` → "Annehmen" → kein Fehler mehr
5. **Pending Tasks**: #225 (Google-Login Smoke), #228 (Infra: Netlify/Resend/HIBP)
