# Session-Status zum Ende der Urlaubs-Vorbereitung am 22. Mai 2026

> Erstellt von Claude Code (autonome Session ab 22.05.2026, ~14 Uhr).
> Diese Datei ist die neue Wahrheit für die nächste Claude-Code-Session
> wenn Lennart aus dem Urlaub zurück ist (geplant ~04./05.06.2026).

---

## Urlaubs-Mandat (Lennart, 22.05.2026)

- Beta-Start **NICHT** während Urlaub
- Alle Tokens und Build-Power autonom nutzen
- Beta erstmal außen vor lassen — alles vorantreiben was geht
- Schema-Migrationen NICHT autonom anwenden; als Files ins Repo, applybar nach Rückkehr

Memory-Eintrag: `~/.claude/projects/.../memory/project_urlaub_2026_05.md`

---

## Was in dieser Urlaubs-Vorbereitungs-Session passiert ist

### Sprint C (Diagnose ↔ Auftrag-Merge) — durch

| Phase | Commit | Beschreibung |
|---|---|---|
| C1 | – | Inventur (Code-only): 4 API-Routes, 2 Pages, 1 Komponente, 3 lib-Files; alle Diagnose-Daten leben bereits in `tickets`-Tabelle → kein Schema-Touch nötig |
| C2 | – | Entfällt — keine Migration |
| C3 | `1e9acdd` | 4 Routes von `/api/diagnose/*` nach `/api/auftraege/*` verschoben (git mv); alte Pfade sind Wrapper, Übergang ~2 Wochen |
| C4 | `f3d9d8a` | HW-Sidebar „Diagnosen"-Item raus, Phasen-Indikator (Gemeldet → Auktion → Reparatur → Erledigt) in `TicketDetailView` für Standard-Tickets |

### Dependencies + Tests

| Item | Commit | Beschreibung |
|---|---|---|
| Next.js Update | `0e7f8a3` | 14.2.3 → 14.2.35, schließt alle 14.x-CVEs (Cache Poisoning, Middleware-Bypass, Auth Bypass, SSRF, DoS-Varianten); restliche CVEs sind nur in 15.x+ gefixt → Major-Upgrade-Risiko, Post-Urlaub |
| E2E-URL-Fix | `517e039` | `waitForResponse`-Patterns auf neue `/api/auftraege/*`-Pfade umgestellt; verhindert silent breakage wenn Wrapper später entfernt werden |
| BETA-WELCOME | `b9bf675` | Sprint C/E/F-Updates in der Beta-Tester-Broschüre |
| ws-CVE-Fix | `657dc39` | `npm audit fix` non-breaking: ws 8.20.0 → 8.21.0 (GHSA-58qx-3vcg-4xpx) via realtime-js |
| Perf-Pass | `019a3a6` | Mieter-Dashboard + HW-Termine: serielle Queries → Promise.all; spart 1 bzw. 2 Roundtrips |

### Backlog-Hygiene-Migrationen — als Files vorbereitet (nicht angewandt)

`supabase/migrations/20260605*`:

| Datei | Risiko | Apply nach Rückkehr |
|---|---|---|
| `..._function_search_path_fix.sql` | gering | ✅ direkt — 18 Funktionen mit `SET search_path` |
| `..._add_indexes_for_unindexed_fks.sql` | gering | ✅ direkt — 14 fehlende FK-Indizes |
| `..._drop_verfuegbarkeiten_table.sql` | gering | ✅ direkt — B4-Follow-up mit Sanity-Check |
| `..._unused_indexes_review.sql` | mittel | ⚠️ REVIEW pro Index — manche sind Cron-relevant |
| `..._auth_rls_initplan_refactor.sql` | hoch | ⚠️ Skelett — Helper + profiles als Start, Rest tabellenweise |

Plus: `supabase/migrations/README-2026-06-vacation-prep.md` mit Reihenfolge + Risiko-Übersicht.

---

## Stand der Streams aus dem Master-Vacation-Plan (22.05.2026)

| Stream | Status | Wer |
|---|---|---|
| 1 — Verwalter-Hardening (Sprint G/H/I) | warten auf Specs | Cowork schreibt Specs, CC implementiert |
| 2 — B2B-Sales-Material (PPTX, PDF, Pricing-Calc) | Cowork | – |
| 3 — Sprint C/D/E/F | ✅ **alle 4 durch** | CC, alles gemerged in `main` |
| 4 — Voice-AI PoC | Spec-Phase, blockiert auf Vapi-Account | Lennart |
| 5 — Quality / E2E (Sprint J) | warten auf Spec | Cowork schreibt Spec, CC implementiert |

CC-seitig sind aktuell **keine offenen Specs**. Falls Cowork G/H/I/J reinpastet (z.B. via `PROMPTS/sprint-g-*.md`), kann ich direkt loslegen.

**Audit-Findings nach `npm audit fix` (Stand 22.05.):** 7 verbleibend, alle breaking-change-blockiert:
- `cookie <0.7.0` via `@supabase/ssr` — Bump auf 0.10.x wäre breaking und der `<=0.5.2-rc.7`-Pin ist genau unser B1/H1-Workaround-Grund (cookie-race). Nicht autonom bumpen.
- `glob` via `@next/eslint-plugin-next` — dev-only CLI-Pfad nicht genutzt, low impact.
- `next` (~14 CVEs) + `postcss` — nur per Major-Upgrade auf 15.5.16+/16.x fixbar; Breaking-Change-Risiko, Post-Urlaub-Entscheidung.

---

## DB-Stand (nicht verändert in dieser Session)

- Schema unverändert; keine Production-Apply-Aktion
- DB-Advisor-Findings unverändert (siehe Migration-Files für die geplanten Fixes)
- 19 Tickets, 1 Diagnose, 1 Projekt, 17 Standard
- Keine aktiven `verfuegbarkeiten`-Rows (alles in `zeitslots` mit `art='wiederkehrend'` ab B4)

---

## Beta-Lauchable-Stand (unverändert)

Aus DB-Code-Security-Sicht weiter aufmachbar (Stand SESSION-STATUS-2026-05-17 + STATUS-BETA-LAUNCHABLE-2026-05-18). Was außerhalb des Code liegt und nicht in dieser Session adressiert wurde:

- Resend-Domain `reparo-app.de` DNS-Verifikation
- Google-OAuth-Client
- Stripe-Account + Connect aktivieren
- 2–3 Beta-Vertraute anwerben

---

## Was Lennart bei Rückkehr findet

1. **Im Repo** (alles auf `main`, deployed):
   - Sprint C komplett (Diagnose ↔ Auftrag gemerged)
   - 5 Migration-Files für DB-Hygiene
   - Aktualisierte BETA-WELCOME.md
   - E2E-Tests konsistent mit neuen API-Pfaden
   - Next.js auf 14.2.35

2. **In Memory** (`~/.claude/projects/.../memory/`):
   - Urlaubs-Status dokumentiert (`project_urlaub_2026_05.md`)
   - alle bisherigen Lessons (Beta-Status, Pricing-Vollkalkulation, Action-Bias-Mandat, etc.)

3. **Bereit für Apply**:
   - 3 Migrationen direkt einspielbar (search_path, FK-Indizes, drop verfuegbarkeiten)
   - 2 Migrationen mit Review-Pass (unused indexes, auth_rls_initplan)

4. **Bereit für nächsten Sprint**:
   - PROMPTS/-Slot frei für G/H/I/J
   - CC bereit, sobald Specs reinkommen

---

## Nächste Schritte (für Lennart bei Rückkehr)

1. **DB-Migrationen** in 5er-Welle anwenden (siehe `supabase/migrations/README-2026-06-vacation-prep.md`)
2. **Sprint G/H/I/J** Specs final reviewen + an CC pasten
3. **Beta-Loop starten** (Vertraute einladen, Feedback-Bubble aktiv)
4. **Pivot-Entscheidung** datenbasiert mit 3–5 Tagen Beta-Feedback
