# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC-Queue Tag 5 — Sprint M/N/O/P (Polish-Block)

> Nach Tag 4 (C/D/E/L) als nächsten Block pasten.
> Inhalt: UI-Konsistenz + Empty-States + Rollen-Dropdown + Mobile/A11y.
> Aufwand: ~13-17h CC (P ist der größte).

## Paste-Block

```
Tag 5 — Polish-Block (UX-Konsistenz + Mobile + A11y).

Bitte arbeite die folgenden 4 Sprint-Files in dieser Reihenfolge ab:

1. PROMPTS/sprint-m-ui-konsistenz.md
   → UI-Konsistenz-Audit + Design-Tokens konsolidieren
   → STYLE-AUDIT.md schreiben
   → Mini-Cleanup: wizardSteps-Array hat toten Eintrag "dringlichkeit" (rauswerfen)
   → Commit: "feat(ui): Konsistenz-Pass über alle 4 Rollen (Sprint M)"

2. PROMPTS/sprint-n-empty-states.md
   → Shared EmptyState-Component bauen
   → 9 Stellen mit Empty-States ausrollen
   → Shared Error-Handler + Toast-Integration
   → Commit: "feat(ux): Empty-States + Fehler-Texte einheitlich (Sprint N)"

3. PROMPTS/sprint-o-rollen-switcher.md
   → Rollen-Switcher als Dropdown (für Admin sichtbar, sonst hidden)
   → A11y: ESC + Click-outside + Keyboard-Nav
   → Commit: "feat(layout): Rollen-Switcher als Dropdown (Sprint O)"

4. PROMPTS/sprint-p-mobile-a11y.md
   → WCAG 2.1 AA + Mobile-Optimierung
   → A11Y-AUDIT.md schreiben (Lighthouse-Scores pro Page)
   → Semantik + ARIA + Keyboard + Responsive + Kontrast
   → Pflicht vor Public-Launch (BFSG ab 28.06.2025)
   → Commit: "feat(a11y): WCAG 2.1 AA-Compliance + Mobile-Pass (Sprint P)"

5. PROMPTS/sprint-q-filter-persistence-und-tabs.md
   → Q1: Filter-Persistence Verzeichnis ↔ Marktplatz via URL-Params
   → Q2: Stufenweise Dashboards (Akkordeon) für Admin + HW
   → Audit-2-Findings die in M/N/O/P nicht abgedeckt waren
   → 2 Commits: "feat(ux): Filter-Persistence (Sprint Q1)" + "feat(ux): Stufenweise Dashboards (Sprint Q2)"

GLOBALE CONSTRAINTS (unverändert):
- Eigenständig durcharbeiten, keine Lennart-Rückfragen
- Pricing-Engine NICHT anfassen
- Stripe/Banking-Code NICHT anfassen
- Visuell darf NICHTS schlechter aussehen (Beta-Tester wären verwirrt)
- Bei Blockern: in BETA-FEEDBACK.md als "CC-BLOCKER Sprint [X]" dokumentieren

REPORTING in BETA-FEEDBACK.md:
"Iteration 18 — Tag 5 Polish-Block" mit Commit-Hashes pro Sprint
plus Lighthouse-Score-Übersicht aus Sprint P.

WICHTIG für Sprint P:
- Bei Mobile-Issues "Container überdehnt sich" (Feedback f443670f) explizit fixen
- Kontrast-Issues bei ink-faint auf weiß sind die häufigsten

Starte mit Sprint M (Audit-Run).
```
