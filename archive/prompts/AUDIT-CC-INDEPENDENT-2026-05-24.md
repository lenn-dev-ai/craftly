# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC-Audit-Prompt — Unabhängige 2. Meinung

> Pastet du in Claude Code. CC soll SELBST auditieren ohne Cowork-Findings
> zu kennen. Lennart vergleicht später die zwei Audits.

## Paste-Block für Claude Code

```
Bitte mach ein detailliertes UX-Audit der Reparo-Production-App.
WICHTIG: ignoriere alle existierenden Audit-Dokumente (Reparo-UX-Audit-*.md,
CRITICAL-Pricing-*.md). Bilde dir eine EIGENE Meinung. Lennart will eine
unabhängige 2. Perspektive.

═══════════════════════════════════════════════════════
SETUP
═══════════════════════════════════════════════════════

Production-URL: https://reparo-app.netlify.app
Test-Logins (alle Passwort: BetaReparo2026!):
- test.verwalter@craftly-test.de
- test.handwerker@craftly-test.de
- test.mieter@craftly-test.de

Du hast Code-Zugriff im Repo + Supabase-MCP für DB-Inspektion.

═══════════════════════════════════════════════════════
AUFGABE
═══════════════════════════════════════════════════════

Schreibe ein Audit-Dokument nach Reparo-UX-Audit-CC-2026-05-24.md mit
folgender Struktur:

1. TL;DR (3-5 Sätze)
2. Pro Rolle (Handwerker, Verwalter, Mieter, Admin):
   - Was gut funktioniert (5-8 Punkte)
   - Was nicht gut ist (5-8 Punkte)
   - Bewertung 1-10 für Nutzerfreundlichkeit, Intuitivität, Design
3. Marketing-Landing-Audit (/hausverwaltungen)
4. Gesamt-Risiko-Liste sortiert nach Severity (CRITICAL / HIGH / MEDIUM / LOW)
5. Konkrete Quick-Fix-Vorschläge (was du in 1-2h beheben könntest)

═══════════════════════════════════════════════════════
METHODIK — wichtig
═══════════════════════════════════════════════════════

Du kannst NICHT live im Browser klicken (kein Chrome-MCP). Stattdessen:

a) Code-Inspektion: app/dashboard-*/page.tsx pro Rolle durchgehen
b) DB-Inspektion via Supabase-MCP: Sind Sample-Daten realistisch?
   Gibt es leere Tabellen die sichtbar als Empty-State erscheinen?
c) Lighthouse-Score via curl auf Production: ist die Performance ok?
d) Screenshot-Beschreibungen aus dem Code ableiten:
   - welche Strings werden angezeigt?
   - welche Farben/Klassen?
   - welche Buttons/Actions?

═══════════════════════════════════════════════════════
KRITIK-FOKUS — bitte ungeschont
═══════════════════════════════════════════════════════

Lennart will EHRLICHE Kritik. Wenn etwas:
- Nicht intuitiv ist → sag es
- Inkonsistente Wording hat → sag es
- Tote Features hat (Code ohne UI) → sag es
- Performance-Probleme zeigt → sag es
- Sicherheits-Sorgen erweckt → sag es
- Design-mäßig „studentisch" wirkt → sag es

KEINE Sales-Brille. Du bist UX-Auditor, nicht Cheerleader.

═══════════════════════════════════════════════════════
WAS DU NICHT TUN SOLLST
═══════════════════════════════════════════════════════

- KEINE existierenden Audit-Dokumente lesen vor deinem Audit
- KEINE Cowork-Findings übernehmen
- KEINE bekannten Sprint-Specs als Lösung referenzieren (du bist
  Auditor, nicht Sprint-Planner)
- KEINEN Code anfassen — nur LESEN und BEWERTEN
- KEINE Commits

═══════════════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════════════

1 Datei: Reparo-UX-Audit-CC-2026-05-24.md im Reparo-Root.
Länge: 4-8 Seiten, kondensiert.
Sprache: Deutsch.
Ton: Professionell, kritisch wo nötig, konkret immer.

═══════════════════════════════════════════════════════
ZEITLIMIT
═══════════════════════════════════════════════════════

~30 Minuten. Nicht stundenlang in jeden Code-File einsteigen.
Bilde dir einen schnellen Eindruck, dokumentiere ihn.

Wenn du fertig bist: commit "docs(audit): Reparo-UX-Audit-CC-2026-05-24"
und sag Cowork Bescheid mit dem Commit-Hash.
```

## Was Lennart dann macht

1. Wartet bis CC fertig ist (~30 Min)
2. Liest die zwei Audits parallel:
   - `Reparo-UX-Audit-Cowork-2026-05-24.md`
   - `Reparo-UX-Audit-CC-2026-05-24.md`
3. Wo beide Audits dasselbe sagen → starkes Signal, sofort handeln
4. Wo Audits widersprechen → Lennart entscheidet, beide haben ein Argument
5. Pastet dann den ChatGPT-Prompt (siehe `Reparo-Audit-Prompt-ChatGPT.md`) für 3. Meinung
6. Trianguliert alle drei Audits — daraus kommt die wahre Roadmap

## Erwartung an CC

CC wird:
- Viele Cowork-Findings unabhängig reproduzieren (Validierung)
- Manche andere Findings haben (blinde Flecken aufdecken)
- Manche Cowork-Findings widerlegen (zu pessimistisch oder optimistisch)

Genau das ist der Wert dieser Übung.
