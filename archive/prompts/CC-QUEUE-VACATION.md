# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Claude-Code-Queue für Urlaubs-Zeit

> Optimale Reihenfolge aller offenen Sprints. Pasten in dieser Reihenfolge.
> CC arbeitet ~3-6h pro Sprint, pasten je nach Throughput.

---

## Reihenfolge-Begründung

```
1. Sprint G  ← Verwalter-Wizard (Foundation für alles andere Verwalter-Stream)
2. Sprint H  ← Verwalter-KPIs (zeigt sofort Wert im Dashboard, Sales-relevant)
3. Sprint I  ← Bulk-Import (Sales-Blocker eliminieren)
4. Sprint C  ← Diagnose+Auftrag-Merge (UX-Lücke schließen)
5. Sprint D  ← Wording+RLS-Cleanup (Polish)
6. Sprint E  ← Mieter-Vorgang-Card inline (UX)
7. Sprint J  ← E2E-Tests (CI-Sicherheit, danach alles abgesichert)
```

Wenn CC schnell ist und du zwischendurch reinguckst:
**G→H→I parallel zu C→D→E** ist möglich. J am Ende.

---

## Block 1 — Verwalter-Hardening (Pre-Pivot-Investitionen)

### → CC pasten:

```
Bitte arbeite die folgenden 3 Sprint-Files in dieser Reihenfolge ab:

1. Lies PROMPTS/sprint-g-verwalter-wizard.md und implementiere komplett.
   Wichtig: Migration ticket_eingetragen_von_verwalter via Supabase-MCP anwenden.
   Nach Fertigstellung: commit, dann nächster Sprint.

2. Lies PROMPTS/sprint-h-verwalter-kpis.md und implementiere komplett.
   Wichtig: KPI-Query muss <500ms sein, ggf. Indexe ergänzen.

3. Lies PROMPTS/sprint-i-bulk-import.md und implementiere komplett.
   Wichtig: Schema-Check ob wohnungen-Tabelle aus Sprint F existiert,
   sonst Migration anlegen.

Constraints für alle 3 Sprints:
- Eigenständig durcharbeiten, keine Lennart-Rückfragen (er ist im Urlaub)
- Bei Schema-Migrationen: idempotent (IF NOT EXISTS), per Supabase-MCP
- Commits pro Sprint: einer mit klarem Subject "feat(verwalter): ..."
- Bei Blockern: in BETA-FEEDBACK.md als "CC-BLOCKER" dokumentieren

Nach allen 3 Sprints: kurze Zusammenfassung in BETA-FEEDBACK.md unter
"Iteration 13 — Vacation-Stream-1" eintragen.
```

---

## Block 2 — UX-Polish (Sprint C/D/E)

### → CC pasten (nach Block 1):

```
Bitte arbeite die folgenden 3 Sprint-Files in dieser Reihenfolge ab:

1. Lies PROMPTS/sprint-c-diagnose-auftrag-merge.md und implementiere.
   Hinweis: Konzept-Entscheidung Lennart war "Mergen" (siehe Iteration 11).

2. Lies PROMPTS/sprint-d-wording-rls-cleanup.md und implementiere.
   Constraints: keine RLS-Lockerung, nur Erweiterung wenn nötig.

3. Lies PROMPTS/sprint-e-mieter-vorgang-card.md und implementiere.

Nach allen 3 Sprints: Zusammenfassung in BETA-FEEDBACK.md unter
"Iteration 14 — Vacation-Stream-3".
```

---

## Block 3 — E2E-Tests (Sprint J)

### → CC pasten (nach Block 2):

```
Bitte arbeite PROMPTS/sprint-j-e2e-playwright.md komplett ab.

Wichtig:
- Tests müssen idempotent sein (DB-Cleanup vor jedem Test)
- Tests laufen lokal UND auf Netlify Preview-Deploy
- CI-Integration via GitHub Actions am Ende

Nach Fertigstellung: kurzer Smoke-Test der 3 Flows lokal, dann commit.
Eintrag in BETA-FEEDBACK.md unter "Iteration 15 — E2E-Suite live".
```

---

## Status nach jedem Block

CC soll nach jedem Sprint kurz schreiben:
- ✅ welche Commits gepusht
- ✅ welche Migrationen angewendet
- ⚠️ welche Blocker gefunden (falls)
- 🎯 nächster Sprint startet jetzt

Cowork wird das im Hintergrund mitlesen (via Netlify-Deploy-Watching) und ggf. Status-Doc updaten.

---

## Falls CC stuck ist

**Symptome:**
- Same commit pusht mehrmals (Build-Loop)
- Tests fallen durch und keine Korrektur
- Migration scheitert wiederholt

**Lennart-Aktion:**
- Cowork-Chat: „CC ist stuck bei [Sprint], hier letzter Commit-Hash: [X]"
- Cowork hilft per Supabase-MCP / Netlify-MCP / Chrome zu debuggen

---

## Skip-Logik

Wenn ein Sprint blockiert (z.B. Schema-Konflikt), CC soll:
1. Blocker in BETA-FEEDBACK.md dokumentieren
2. Sprint überspringen, mit nächstem fortfahren
3. Cowork debuggt den blockierten Sprint später

**Nicht stundenlang am gleichen Problem hängen.**

---

## Geschätzte Throughput

| Block | CC-Zeit | Cowork-QA-Zeit |
|---|---|---|
| Block 1 (G+H+I) | ~9-12h | ~30 Min QA pro Sprint |
| Block 2 (C+D+E) | ~6-8h | ~20 Min QA pro Sprint |
| Block 3 (J) | ~8h | ~1h Test-Validierung |

**Total für 2-Wochen-Urlaub:** sehr machbar mit Puffer für 1-2 Iteration-Schleifen.

---

## Was Cowork in der Zwischenzeit baut (parallel zu CC)

- Landing-Page B2B-Refresh (HTML-Mockup für späteren Implement)
- Target-Liste Hausverwaltungen (20 echte Adressen via Chrome-Research)
- Voice-AI-Test-Prompt finalisieren (für Vapi-Setup)
- Iteration auf Sales-Material wenn Insights kommen
- Auto-Loop-Feedback-Reports täglich konsumieren
