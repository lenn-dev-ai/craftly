# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Reparo Beta-Fix-Sprint — Claude-Code-Prompt

Stand: 17.05.2026, nach Iteration 1 + 2 des persönlichen Beta-Durchgangs.
Direkt in Claude Code (im Reparo-Ordner) reinpasten.

---

## Kontext (in 3 Sätzen)

Reparo ist mitten in der Closed Beta (nur Vertraute, kein Impressum nötig). Lennart hat 12 Punkte Feedback aus Mieter-, Verwalter- und HW-Flow gesammelt — siehe `BETA-FEEDBACK.md`. Pre-Beta-Security ist bis auf D3 (ki_analysen_cache) durch. Du sollst jetzt einen sauberen Fix-Sprint daraus machen — keine „while-I'm-at-it"-Refactors, keine ungefragten Migrationen auf Production.

## Pflicht-Reads (in dieser Reihenfolge)

1. `BETA-FEEDBACK.md` — die 12 Punkte mit Klassifikation
2. `SESSION-STATUS-2026-05-17.md` — DB-Stand, Advisor-Findings, was schon erledigt ist
3. `CLOUD-DEPLOY-NOW.md` — bei Schema-Fragen
4. Bei Bedarf: `lib/ki/schadenserkennung*`, `app/dashboard-mieter/*`, `app/dashboard-verwalter/*`

## Phasenplan — strikt einhalten

### Phase 0 — Konzept-Klärung (BLOCKER, vor jedem Code)

Zwei Feedback-Punkte sind **Konzept-Fragen**, keine Code-Tasks. Bevor du irgendwas implementierst, brauchen wir Lennarts Antwort dazu:

- **#11 Auktion vs. Angebotspreis**: Welches Pricing-Modell soll Reparo wirklich haben?
  - (a) Vollkalkulation: System setzt Preis, HW akzeptiert/lehnt nur
  - (b) Auktion mit Min-/Max-Korridor: System empfiehlt, HW bietet darin
  - (c) Offenes Angebot: HW frei, System rankt nach Bewertung+Preis
  → Du fragst Lennart konkret, listest die Konsequenzen für Pricing-Engine, HW-Marktplatz-UI, Penalty-Logik auf, wartest auf seine Wahl.

- **#12 HW-Sidebar entschlacken**: Welche Funktionen braucht der HW WIRKLICH täglich?
  - Du listest alle aktuellen Sidebar-Items auf
  - Schlägst 3 Gruppen vor (Top-Daily, Wöchentlich, Selten/Sub-Menü)
  - Lennart entscheidet Mapping

Implementier **nichts** zu Pricing oder HW-Sidebar bevor diese zwei Antworten da sind.

### Phase A — Triage-Tabelle (kein Code)

Liefere mir eine Tabelle der 12 Feedback-Punkte mit Spalten:

| # | Punkt | Klasse | Aufwand | Dateien (Vermutung) | Abhängigkeit | Sprint-Reihenfolge |
|---|---|---|---|---|---|---|

Sprint-Reihenfolge-Heuristik:
1. 🟡 D3 (ki_analysen_cache, ist noch im Pre-Beta-Bucket)
2. [BUG] vor [UX] vor [FEATURE]
3. Innerhalb gleicher Klasse: S vor M vor L
4. Konzept-Sachen (#11, #12) erst nach Phase 0

Frag mich danach: „Mit dieser Reihenfolge anfangen?"

### Phase B — Implementation (pro Punkt, nicht batch)

Für jeden Punkt einzeln:

1. Sag was du anfasst (Dateien, geschätzter Diff-Umfang)
2. Wenn UX-Wording oder Logik unklar: kurze Rückfrage statt raten
3. Implementiere
4. `npm run lint` und `npm run typecheck`
5. Wenn passender E2E-Test existiert: laufen lassen
6. Commit mit konventionellem Prefix (`fix:`, `feat:`, `chore:`, `refactor:`)
7. Sag: „Punkt X durch — willst du das jetzt im Browser checken oder gleich nächster?"

### Phase C — Doku-Update (pro Punkt oder am Sprint-Ende)

- `BETA-FEEDBACK.md`: Punkte abhaken/kommentieren mit Commit-Hash
- `SESSION-STATUS-2026-05-17.md`: Sprint-Resultat, Test-Status, was kommt als nächstes
- Neue Findings während des Sprints: in `BETA-FEEDBACK.md` als „Iteration X.Y — während Sprint entdeckt" anhängen, am Sprint-Ende mit Lennart durchgehen

## Constraints (nicht-verhandelbar)

- **Niemals ungefragt Schema-Migrationen schreiben** — Production-DB. Schreib SQL hin und sag „bitte im SQL Editor laufen lassen" oder bitte Cowork das zu übernehmen.
- **Niemals Stripe-/Banking-/KYC-Felder anfassen** ohne explizite Rückfrage.
- **Pro Phase max. eine Frage an Lennart auf einmal.**
- **Keine „while I'm at it"-Refactors** — nur das gewünschte Item.
- **Pricing-Engine nicht anfassen vor Phase-0-Entscheidung #11.**
- **HW-Sidebar nicht anfassen vor Phase-0-Entscheidung #12.**

## Erster Schritt

Starte mit **Phase 0**: stell die zwei Konzept-Fragen (#11 + #12) sauber strukturiert an Lennart, mit Optionen + Konsequenzen. Kein Triage, kein Code.

Wenn die Antworten da sind: Phase A (Triage-Tabelle), dann auf Freigabe warten.

---

## Anhang: Stand der pendierenden Pre-Beta-Items

(Aus SESSION-STATUS — kommen mit in den Sprint, NICHT vergessen)

| Item | Status | Aktion |
|---|---|---|
| `handwerker_bewertungen` SECURITY INVOKER | ✅ done | — |
| HIBP-Toggle | ⏸ gestrichen (Pro Plan) | — |
| `ki_analysen_cache` Policies (D3) | ⏳ pending | Phase B, erstes Item |
| Resend-Domain | ⏸ verschoben | — (Domain existiert nicht) |
| Google OAuth Client | ⏳ pending | Optional vor Beta — friction-saver |
| Stripe Account aktivieren | ⏸ verschoben | Penalty läuft als manual_pending |
| Manual-QA 390px | ⏳ pending | Cowork übernimmt nach Sprint |

Google OAuth + Manual-QA werden in Cowork erledigt — du musst die nicht in deinen Sprint einbauen, aber im SESSION-STATUS-Update am Ende erwähnen, was offen bleibt.
