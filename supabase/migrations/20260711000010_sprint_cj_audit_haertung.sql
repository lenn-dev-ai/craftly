-- Sprint CJ — Audit-Härtung (11.07.2026)
--
-- 1) cron_heartbeats: eine Zeile pro Cron, bei jedem Lauf geupsertet
--    (lib/cron/auth.ts::meldeCronHeartbeat). Audit-Fund: Die Netlify-
--    Schedules feuerten tagelang nicht und niemand konnte es sehen —
--    jetzt ist "Scheduler tot" per SQL und Cortex-Wachhund erkennbar.
--
-- 2) REVOKE anon auf Cortex-Funktionen: Die Security-Advisors zeigten,
--    dass anonyme Nutzer cortex_emit/cortex_erinnern ausführen dürfen —
--    damit könnte ein nicht eingeloggter Besucher den Ereignisstrom
--    fluten bzw. Gedächtnis-Inhalte abfragen. Die Trigger-Funktionen
--    laufen weiter als Owner (SECURITY DEFINER), App-Code nutzt den
--    Service-Role-Client. Die is_*-RLS-Helper bleiben bewusst unberührt
--    (werden in Policies evaluiert, die auch öffentliche Pfade treffen).

create table if not exists public.cron_heartbeats (
  name text primary key,
  letzter_lauf timestamptz not null default now(),
  via text
);

alter table public.cron_heartbeats enable row level security;

-- Nur Admins lesen (Cockpit/Debugging); Schreibzugriff ausschließlich
-- über den Service-Role-Client (umgeht RLS).
do $pol$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cron_heartbeats'
      and policyname = 'cron_heartbeats_admin_lesen'
  ) then
    create policy cron_heartbeats_admin_lesen on public.cron_heartbeats
      for select using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.rolle = 'admin'
        )
      );
  end if;
end
$pol$;

revoke execute on function public.cortex_emit(text, text, uuid, jsonb) from anon;
revoke execute on function public.cortex_erinnern(vector, integer) from anon;
revoke execute on function public.cortex_trg_generisch() from anon;
revoke execute on function public.cortex_trg_tickets() from anon;
