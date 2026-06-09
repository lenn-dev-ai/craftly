# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint T — B2B-Trust-Package (Audit-Trail + Freigabegrenzen + RBAC)

> Strategischer Sprint aus `Reparo-B2B-Vertrauens-Roadmap-2026-05-24.md`.
> Adressiert ChatGPT-Audit-Hauptkritik („kaufentscheidende B2B-Signale fehlen").
>
> Aufwand: **MVP 3-5 Tage CC**, vollwertig 2-3 Wochen.
>
> Voraussetzung: Beta läuft, 3-5 Verwalter-Kunden, konkretes Feedback wo
> Audit-Anforderungen bestehen. **Nicht vor Beta bauen.**

## Ziel

Drei B2B-Vertrauens-Bausteine, die Casavi/Wohnmonitor/vermietet.de standard
haben und ohne die Reparo bei größeren Verwaltungen nicht gekauft wird:

1. **Audit-Trail** — unveränderliche History pro Ticket
2. **Freigabegrenzen** — Vier-Augen-Prinzip bei großen Aufträgen
3. **RBAC** — Rollen innerhalb Verwaltung (Sachbearbeiter ↔ Geschäftsführer)

Plus SLA-Definitionen als Marketing-Statement (technisch nur Logging).

## MVP-Scope (3-5 Tage, baue zuerst)

### 1. Audit-Trail (1-2 Tage)

**Neue Tabelle:**
```sql
CREATE TABLE public.ticket_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  actor_role text NOT NULL,
  event_type text NOT NULL,  -- 'created', 'status_change', 'angebot_angenommen', 'export', ...
  event_data jsonb,           -- snapshot des relevanten States
  ip_addr inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_audit_log_ticket ON ticket_audit_log(ticket_id, created_at DESC);

-- RLS: Verwalter sieht nur Logs seiner Tickets
ALTER TABLE ticket_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY verwalter_eigene_audit ON ticket_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.verwalter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.rolle = 'admin')
  );

-- INSERT: nur Server-Side (Service-Role) — UI-Code soll nie direkt schreiben
REVOKE INSERT ON ticket_audit_log FROM authenticated;
```

**Logging-Helper:** `lib/audit/logTicketEvent.ts`

```typescript
export async function logTicketEvent(opts: {
  ticketId: string;
  eventType: AuditEventType;
  eventData?: Record<string, unknown>;
  actorUserId?: string;
  request?: Request;
}) {
  await supabaseAdmin.from('ticket_audit_log').insert({
    ticket_id: opts.ticketId,
    actor_user_id: opts.actorUserId,
    actor_role: await getRoleForUser(opts.actorUserId),
    event_type: opts.eventType,
    event_data: opts.eventData ?? {},
    ip_addr: opts.request?.headers.get('x-forwarded-for')?.split(',')[0],
    user_agent: opts.request?.headers.get('user-agent'),
  });
}
```

**Integrationsstellen** (alle API-Routes):
- `/api/tickets/create` → `logTicketEvent(... 'created')`
- `/api/tickets/[id]/status` → `'status_change'`
- `/api/auction/close` → `'angebot_angenommen'`
- `/api/tickets/[id]/export` → `'export'`
- `/api/admin/*` für Admin-Aktionen

**UI:** Ticket-Detail-Page bekommt Tab „Verlauf" → chronologische Liste
mit Akteur + Aktion + Timestamp.

### 2. Freigabegrenze: >1000 € braucht 2. Signatur (1-2 Tage)

**Schema:**
```sql
ALTER TABLE tickets ADD COLUMN freigabe_status text DEFAULT 'nicht_erforderlich';
-- Werte: 'nicht_erforderlich', 'erste_signatur', 'freigegeben', 'abgelehnt'

ALTER TABLE tickets ADD COLUMN freigabe_erste uuid REFERENCES auth.users(id);
ALTER TABLE tickets ADD COLUMN freigabe_erste_at timestamptz;
ALTER TABLE tickets ADD COLUMN freigabe_zweite uuid REFERENCES auth.users(id);
ALTER TABLE tickets ADD COLUMN freigabe_zweite_at timestamptz;

CREATE TABLE public.verwaltung_freigabe_config (
  verwalter_id uuid PRIMARY KEY REFERENCES auth.users(id),
  schwellwert_euro int NOT NULL DEFAULT 0,  -- 0 = keine Freigabe nötig
  vier_augen_ueber int,                      -- >= schwellwert_euro
  einzeln_bis int                            -- <= einzeln_bis: Sachbearbeiter allein
);
```

**Workflow:**
1. Verwalter konfiguriert in Settings: „Auftrag-Vergabe ab 1000 € braucht 2 Signaturen"
2. Bei `/api/auction/close` wird Schwellwert geprüft
3. Wenn überschritten + nur 1 Signatur: Status `erste_signatur`, Email an alle Geschäftsführer der Verwaltung
4. Zweiter Signatur-Click → `freigegeben` → Auktion wird tatsächlich geschlossen
5. Audit-Log dokumentiert beide Signaturen

### 3. RBAC innerhalb Verwaltung (1 Tag)

**Schema:**
```sql
ALTER TABLE profiles ADD COLUMN verwalter_org_role text;
-- Werte für rolle='verwalter':
--   'sachbearbeiter' (Standard, kann Tickets bearbeiten aber nicht freigeben)
--   'geschaeftsfuehrer' (kann Freigaben erteilen, Settings ändern)
--   'admin' (alles + User-Management)

ALTER TABLE profiles ADD COLUMN parent_verwalter_id uuid REFERENCES auth.users(id);
-- Für Sub-Accounts unter einer Mutter-Verwaltung
```

**RLS-Erweiterungen:**
- Sachbearbeiter darf Tickets seines `parent_verwalter_id`-Pools lesen/bearbeiten
- Nur `geschaeftsfuehrer` + `admin` dürfen Freigabe-Config ändern
- Nur Sachbearbeiter + Höher dürfen Tickets vergeben

**UI:** Neue Settings-Page für Verwalter-Admin:
- Sub-User einladen mit Rolle
- Freigabegrenzen konfigurieren
- Audit-Trail-Export (CSV/PDF)

## Vollwert-Scope (Post-MVP, ~2 Wochen extra)

### 4. SLA-Definitionen

- DB: `verwaltung_sla_config` (Vergabe-Zeit-Garantie, Reparatur-Zeit, Uptime-Targets)
- UI: Ampel-System im Admin-Dashboard pro SLA
- Auto-Eskalation: Email/Slack wenn SLA verletzt
- Marketing: SLA-Statement in Landing-Page + im Vertrag

### 5. Rollen-Audit-Reports

Monatlicher CSV/PDF-Report pro Verwaltung:
- Welche User haben welche Aktionen ausgeführt
- Freigaben pro User
- Audit-Trail-Excerpt für Wirtschaftsplan

### 6. Vier-Augen-Workflow erweitert

- Konfigurierbar pro Gewerk (z.B. Heizung-Notfall keine Freigabe, Sanierung >1000 € Freigabe)
- Eskalations-Pfade (wenn Geschäftsführer 24h nicht reagiert → Stellvertreter)

## Implementation-Schritte (MVP)

1. Migrations schreiben + applyen via Supabase-MCP
2. Audit-Helper bauen + in alle relevanten API-Routes integrieren
3. Freigabe-Workflow in `/api/auction/close` integrieren
4. RBAC-Checks in alle Verwalter-Routes
5. Settings-Page mit Sub-User-Verwaltung + Freigabe-Config
6. Verlauf-Tab in Ticket-Detail-Page
7. Smoke-Tests mit Demo-Daten

## Tests (MVP)

- Audit: Jede Status-Änderung erzeugt 1 Audit-Eintrag
- Freigabe: 1500 € Auktion → erste Signatur → kein Close → zweite Signatur → Close
- RBAC: Sachbearbeiter kann nicht freigeben (UI Button hidden + API 403)
- Performance: Audit-Insert <50ms (Index auf ticket_id)

## Constraints

- KEINE Breaking-Changes für bestehende Tickets (Default `nicht_erforderlich`)
- Bestehende RLS-Policies erweitern, nicht ersetzen
- KEIN UI-Redesign — neue Felder als Tabs / Settings-Sektionen

## Commit-Struktur

1. `feat(audit): ticket_audit_log table + logging helper (Sprint T 1/3)`
2. `feat(freigabe): vier-augen-prinzip für tickets >schwellwert (Sprint T 2/3)`
3. `feat(rbac): verwalter-org-rollen + sub-user-mgmt (Sprint T 3/3)`

## Erfolg

- ChatGPT-Audit-Hauptkritik adressiert
- Cold-Outreach an Verwaltungen mit >100 Wohnungen kann „SLA + Audit + Freigabe" als Sales-Argument nutzen
- Erste WEG-Verwalter-Pilots möglich (Audit-Trail = WEG-Pflicht)
