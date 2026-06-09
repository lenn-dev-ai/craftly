# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

## Master-Sprint 2026-05-18 — H1 + H2-4 + H5 + M5 + Admin-Dashboard

Bitte arbeite die folgenden Sprints **strikt in dieser Reihenfolge** ab. H1 ist Beta-Blocker und hat absolute Prio. Pro Item ein eigener Commit, damit Reverts sauber moeglich sind.

### Phase 1 — Bugs (Beta-relevant)

Datei: `PROMPTS/auto-fix-2026-05-18-1400.md`
- **H1** — `/api/auction/bid` → 401 (systematischer Auth-Fix nach B1.1-Pattern, ggf. mehrere Routes, Helper in `lib/auth/`)
- **H2/H3/H4** — alte Auktions-Wording-Reste raeumen (in Folge-Commit)

### Phase 2 — UX/Click-Through

Datei: `PROMPTS/auto-fix-2026-05-18-1410.md`
- **H5** — HW-Dashboard-KPI „Offene Ausschreibungen" klickbar (Pattern Commit `29626eb`)
- **M5** — Mieter-Wizard zentrieren (Container-mx-auto-Fix)

### Phase 3 — Admin-Feedback-Dashboard

Datei: `PROMPTS/admin-feedback-dashboard-2026-05-18.md`
- Standalone-HTML (`/Users/lennart/Desktop/Reparo/feedback-dashboard.html`) als Next.js-Route in `app/dashboard-admin/feedback/page.tsx` einbauen
- VERDICTS-Konstanten nach `lib/feedback-verdicts.ts`
- Sidebar + BottomNav-Eintrag „Feedback" im Admin-Bereich
- Mobile-responsive

## Constraints (gelten fuer alle Phasen)

- Pricing-Engine NICHT anfassen
- Niemals ungefragt Schema-Migrationen
- Pro Phase max. 1 Klaerungsfrage an Lennart, dann implementieren
- Netlify-Credits sind seit Top-Up wieder da, Deploys gehen durch

## Reporting

Sag nach jedem erfolgreichen Commit Bescheid. Cowork (im anderen Chat) macht nach jedem Deploy folgende QA und meldet zurueck:
- Nach Phase 1: K1-End-to-End-Test (HW annimmt → Slot vorschlaegt → Mieter waehlt)
- Nach Phase 2: HW-Dashboard-KPI-Klick + Mieter-Wizard-Centering visuell
- Nach Phase 3: Login als Admin → Sidebar zeigt Feedback → Klick → Liste lädt → Mark-viewed-Toggle funktioniert
