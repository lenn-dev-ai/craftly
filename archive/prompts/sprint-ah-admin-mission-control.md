# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint AH — Admin-Dashboard Redesign: Mission Control

> Bestätigt 25.05.2026 — Konzept aus `KONZEPT-admin-mission-control.md`
> wird Sprint-Spec.
>
> Aufwand: ~2-3 Tage CC. Niedrig-mittel-prio (kein Beta-Blocker, aber
> Mehrwert für Lennart-Operations).
>
> Reihenfolge: empfohlen NACH Beta-Start, wenn echte Action-Items klar sind.
> Spec ist trotzdem schon final, damit CC ihn nach Beta-Start direkt
> abarbeiten kann.

## Ziel

Admin-Dashboard von „Statisch + Analytics" auf „Live + Aktionsfähig"
umbauen. Lennart sieht auf einen Blick: Was passiert JETZT, wo muss ich
eingreifen, ist alles ok.

## Was raus muss

- Wochentrend-Chart (zu makro, nicht actionable) → optional unter „Reporting"-Tab
- KI-Anomalien-Cards (zu vage) → in Action-Items integrieren wenn echt
- System-Health-Bars (pseudo-professionell) → klein dezent unten
- Statische KPI-Cards (Total-User-Count) → nur dynamische Zahlen oben

## Neue Layout-Struktur

```
app/dashboard-admin/page.tsx
─────────────────────────────────────────────────────
┌─────────────────────────────────────────────────┐
│ 🟢 LIVE                                          │
│ X User online · Y aktive Auktionen · Z Klärungs-Calls │
├─────────────────────────────────────────────────┤
│ ⚠️ BRAUCHEN AKTION                              │
│ ┌─────────────────────────────────────────────┐ │
│ │ • Verwalter "X GmbH" — 3 Tickets ohne Vergabe│ │
│ │ • HW "Müller Sanitär" — 5 Tage offline       │ │
│ │ • Auktion AAAA — 12h ohne Angebot            │ │
│ │ • 2 Mieter ohne Feedback nach Reparatur      │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ 📊 LETZTE 24h                                    │
│ 12 neue Tickets ↑ · 8 vergeben ↑ · 3 abgeschlossen │
│ 2 neue HW registriert · 5 Voice-AI-Calls         │
├─────────────────────────────────────────────────┤
│ 🔧 SYSTEM-STATUS (klein, unten)                  │
│ ✓ DB OK · ✓ API <200ms · ✓ Voice-AI OK · ✓ Resend OK │
└─────────────────────────────────────────────────┘
```

## Backend-Bausteine

### 1. Live-Endpoint `/api/admin/live` (0.5 Tag)

Polling-basiert (alle 30s), nicht SSE (overkill für Admin-only).

```typescript
// app/api/admin/live/route.ts
export async function GET() {
  await assertAdmin();
  const [usersOnline, aktiveAuktionen, voiceCallsLive] = await Promise.all([
    supabase.rpc('count_users_online_last_5min'),
    supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'auktion_offen'),
    supabase.from('voice_calls').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
  ]);
  return Response.json({ usersOnline, aktiveAuktionen, voiceCallsLive });
}
```

**RPC** (neue Migration):
```sql
CREATE OR REPLACE FUNCTION count_users_online_last_5min()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(DISTINCT user_id)::int
  FROM auth.sessions
  WHERE last_active > now() - interval '5 min';
$$;
GRANT EXECUTE ON FUNCTION count_users_online_last_5min() TO authenticated;
```

### 2. Action-Items View (0.5 Tag)

```sql
CREATE OR REPLACE VIEW admin_action_items AS
SELECT
  'verwalter_ohne_vergabe' as type,
  v.id as actor_id,
  v.name as actor_name,
  count(t.id) as metric,
  format('%s offene Tickets ohne Vergabe', count(t.id)) as message
FROM profiles v
JOIN tickets t ON t.verwalter_id = v.id
WHERE v.rolle = 'verwalter'
  AND t.status = 'auktion_offen'
  AND t.created_at < now() - interval '24 hours'
GROUP BY v.id, v.name
HAVING count(t.id) >= 3

UNION ALL

SELECT
  'hw_offline_lang' as type,
  p.id as actor_id,
  p.firmenname as actor_name,
  EXTRACT(DAY FROM now() - p.last_sign_in_at)::int as metric,
  format('%s Tage nicht eingeloggt', EXTRACT(DAY FROM now() - p.last_sign_in_at)::int) as message
FROM profiles p
WHERE p.rolle = 'handwerker'
  AND p.last_sign_in_at < now() - interval '7 days'

UNION ALL

SELECT
  'auktion_ohne_angebot' as type,
  t.id as actor_id,
  t.titel as actor_name,
  EXTRACT(HOUR FROM now() - t.created_at)::int as metric,
  format('Auktion %sh ohne Angebot', EXTRACT(HOUR FROM now() - t.created_at)::int) as message
FROM tickets t
WHERE t.status = 'auktion_offen'
  AND NOT EXISTS (SELECT 1 FROM angebote a WHERE a.ticket_id = t.id)
  AND t.created_at < now() - interval '12 hours'

UNION ALL

SELECT
  'mieter_kein_feedback' as type,
  t.mieter_id as actor_id,
  t.titel as actor_name,
  EXTRACT(DAY FROM now() - t.abgeschlossen_at)::int as metric,
  format('Reparatur seit %s Tagen, kein Feedback', EXTRACT(DAY FROM now() - t.abgeschlossen_at)::int) as message
FROM tickets t
WHERE t.status = 'abgeschlossen'
  AND t.abgeschlossen_at < now() - interval '3 days'
  AND NOT EXISTS (SELECT 1 FROM bewertungen b WHERE b.ticket_id = t.id);

GRANT SELECT ON admin_action_items TO authenticated;

-- RLS analog: nur Admin sieht
CREATE POLICY admin_only_action_items ON ... (kein direkter PolicY auf View, aber Aufruf via RPC mit assertAdmin())
```

### 3. Activity-24h-Endpoint (0.5 Tag)

```typescript
// app/api/admin/activity/route.ts
const since = new Date(Date.now() - 24 * 3600_000);
const [newTickets, vergeben, abgeschlossen, newHW, voiceCalls] = await Promise.all([
  supabase.from('tickets').select('id', { count: 'exact', head: true }).gte('created_at', since.toISOString()),
  supabase.from('tickets').select('id', { count: 'exact', head: true }).gte('vergeben_at', since.toISOString()),
  supabase.from('tickets').select('id', { count: 'exact', head: true }).gte('abgeschlossen_at', since.toISOString()),
  supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('rolle', 'handwerker').gte('created_at', since.toISOString()),
  supabase.from('voice_calls').select('id', { count: 'exact', head: true }).gte('created_at', since.toISOString()),
]);
```

Trend-Pfeil: vergleichen mit vorigen 24h, ↑ oder ↓ oder = anzeigen.

### 4. System-Status-Endpoint (0.5 Tag)

```typescript
// app/api/admin/health/route.ts
const dbLatency = await measureDbLatency();
const apiLatency = await measureApiAvg();
const voiceAi = await pingVapiHealth();
const resend = await pingResendHealth();
return Response.json({ db: dbLatency < 50, api: apiLatency < 200, voiceAi, resend });
```

## Frontend (1 Tag)

`app/dashboard-admin/page.tsx` komplett refactor:

```tsx
'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

export default function AdminMissionControl() {
  const { data: live } = useSWR('/api/admin/live', fetcher, { refreshInterval: 30_000 });
  const { data: actions } = useSWR('/api/admin/action-items', fetcher, { refreshInterval: 60_000 });
  const { data: activity } = useSWR('/api/admin/activity', fetcher, { refreshInterval: 5 * 60_000 });
  const { data: health } = useSWR('/api/admin/health', fetcher, { refreshInterval: 60_000 });

  return (
    <main className="p-6 space-y-6">
      <LiveStatusCard data={live} />
      <ActionItemsCard items={actions} />
      <ActivityCard data={activity} />
      <SystemHealthBar data={health} />
    </main>
  );
}
```

Komponenten:
- `LiveStatusCard` — grüner Pulse-Dot, 3 große Zahlen
- `ActionItemsCard` — Liste mit Icon + Message + Click → Detail-Seite
- `ActivityCard` — 5 Zahlen mit Trend-Pfeil
- `SystemHealthBar` — kompakte Statusleiste, grün/gelb/rot

## Migrations

1. `20260605000200_count_users_online_rpc.sql`
2. `20260605000210_admin_action_items_view.sql`

## Tests

- E2E: Admin loggt sich ein, sieht Live-Section mit ≥1 Zahl >0
- Manuell: Test-Ticket ohne Vergabe >24h erstellen → erscheint in Action-Items
- Performance: alle 4 Endpoints zusammen <300ms

## Constraints

- Bestehende Admin-Routes (`/dashboard-admin/feedback`, `/dashboard-admin/users`) bleiben
- Auto-Loop-Dashboard (`/dashboard-admin/feedback`) bleibt separate Route
- Wochentrend-Chart wird in `/dashboard-admin/reporting` verschoben (NICHT gelöscht)

## Commit-Struktur

1. `feat(admin): live + action-items + activity endpoints (Sprint AH backend)`
2. `feat(admin): mission-control layout refactor (Sprint AH frontend)`
3. `migration: admin_action_items view + count_users_online RPC`

## Erfolg

- Lennart öffnet Admin → weiß in 5 Sek ob System lebt + ob er eingreifen muss
- Designer-Audit „Mission Control statt Analytics Playground" ist umgesetzt
- Wochentrend-Chart und vage KI-Anomalien sind aus dem Hauptview raus
