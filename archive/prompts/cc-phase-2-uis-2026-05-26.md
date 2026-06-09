# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC-Commit-Prompt — Phase-2-UIs (26.05.2026 morgens)

> Cowork hat 3 Phase-2-UIs gebaut: Sprint U Mieter-Reklamation, Sprint V
> Stamm-HW-Verwaltung, Sprint W Eigentümer-Verwaltung. Plus Sidebar-Links.
> Alles auf Disk, wartet auf CC-Commit + Push.

## Neue + geänderte Files

### Sprint U — Mieter-Reklamation
- `app/api/tickets/[id]/reklamieren/route.ts` (NEU)
- `components/ticket/ReklamationButton.tsx` (NEU)
- `components/ticket/TicketDetailView.tsx` (Edit: 1 import + 1 conditional-render nach Bewertungs-Block)

### Sprint V — Stamm-HW-Verwaltung
- `app/dashboard-verwalter/stamm-handwerker/page.tsx` (NEU)

### Sprint W — Eigentümer-Verwaltung
- `app/dashboard-verwalter/eigentuemer/page.tsx` (NEU)

### Sidebar
- `components/layout/Sidebar.tsx` (Edit: 2 neue Verwalter-Items)

## Commit

```bash
cd ~/Desktop/Reparo
rm -f .git/index.lock

git add app/api/tickets/\[id\]/reklamieren/route.ts \
        components/ticket/ReklamationButton.tsx \
        components/ticket/TicketDetailView.tsx \
        app/dashboard-verwalter/stamm-handwerker/page.tsx \
        app/dashboard-verwalter/eigentuemer/page.tsx \
        components/layout/Sidebar.tsx

git commit -m "feat(phase-2): Sprint U Reklamation + Sprint V Stamm-HW + Sprint W Eigentümer (UIs live)"

git push
```

## Was Lennart nach Deploy sehen wird

**Mieter** (`/dashboard-mieter/ticket/[id]`):
- Bei Status erledigt/abgenommen: neue Box „Reparatur war nicht ok?" mit Button → Modal → POST `/api/tickets/[id]/reklamieren` → Status wechselt auf `reklamiert` + Audit-Log

**Verwalter** (Sidebar):
- Neuer Menu-Eintrag „Stamm-HW" → `/dashboard-verwalter/stamm-handwerker` mit Liste + „+ Stamm-HW hinzufügen"-Modal (HW + optional Objekt + Gewerk + Prio + Frist)
- Neuer Menu-Eintrag „Eigentümer" → `/dashboard-verwalter/eigentuemer` mit Eigentümer-CRUD + Wohnungs-Zuordnungs-Tabelle (Dropdown + MEA-Promille inline)

## Bekannte Limits (Phase 3 wenn Bedarf)

- Sprint V Routing-Integration: Stamm-HW-Helper `lib/auction/stamm-routing.ts` ist nicht aus `/api/auction/start` aufgerufen. Neue Tickets gehen weiterhin direkt in Marktplatz, auch wenn Stamm-HW existiert. Aufruf-Integration ist ~30 Min Code.
- Sprint W PDF-Engine: react-pdf + Quartals-Cron sind nicht gebaut. Aktuell nur Stammdaten-Erfassung.
- Sprint U Reklamations-Workflow auf Verwalter-Seite: Verwalter sieht reklamierte Tickets nur über generische Ticket-Liste (Status-Filter „reklamiert"). Eigener Reklamations-Tab im Admin/Verwalter-Dashboard kommt später.

## Sanity-Checks nach Deploy

```bash
# Mieter-Sicht: als Demo-Mieter-1 ein erledigtes Ticket öffnen → "Reparatur war nicht ok?"-Box sichtbar
# Verwalter-Sicht: als Demo-Verwalter-1 in Sidebar → "Stamm-HW" + "Eigentümer" sichtbar
# DB-Smoke nach erster Test-Reklamation:
SELECT count(*) FROM ticket_reklamationen;
SELECT count(*) FROM stamm_handwerker WHERE verwalter_id = '<deine-id>';
SELECT count(*) FROM eigentuemer WHERE verwalter_id = '<deine-id>';
```

## Bei Build-Failure (Cowork-erprobtes Pattern)

1. Im Netlify-Dashboard auf den failed Deploy → "Why did it fail?" oder Build-Log
2. Erste rote Zeile → Cowork sagen, dann Hotfix-Commit
3. Wenn lokaler `npm run build` grün ist, ist es vermutlich Linux-case-sensitivity oder TS-strict-Modus
