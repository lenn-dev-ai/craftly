-- Sprint CJ Teil 3b — DB-interner Scheduler (Audit 11.07.2026)
--
-- cron_config: ein selbst-erzeugtes Secret, mit dem sich der DB-interne
-- pg_cron-Scheduler bei den Cron-Endpunkten authentifiziert. Nur die
-- Service-Role liest die Tabelle (RLS an, keine Policy). Der App-seitige
-- Auth-Check (lib/cron/auth.ts) vergleicht gegen genau diesen Wert —
-- damit läuft die Automatik ohne Netlify-ENV und ohne externes Secret.
create table if not exists public.cron_config (
  id int primary key default 1,
  secret text not null,
  erstellt_at timestamptz not null default now(),
  constraint cron_config_singleton check (id = 1)
);

alter table public.cron_config enable row level security;

insert into public.cron_config (id, secret)
values (
  1,
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
on conflict (id) do nothing;

create or replace function public.reparo_cron_trigger(pfade text[])
returns void
language plpgsql
security definer
set search_path = public, net
as $fn$
declare
  s text;
  p text;
begin
  select secret into s from public.cron_config where id = 1;
  if s is null or s = '' then
    raise notice 'reparo_cron: Secret fehlt in cron_config';
    return;
  end if;

  foreach p in array pfade loop
    perform net.http_post(
      url := 'https://reparo-app.de' || p,
      headers := jsonb_build_object('x-cron-secret', s, 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  end loop;
end;
$fn$;

-- Zeitpläne (idempotent — cron.schedule upsertet nach Jobname).
select cron.schedule(
  'reparo-motor', '*/10 * * * *',
  $job$select public.reparo_cron_trigger(array['/api/cron/direktvergabe-eskalation', '/api/auction/check-expired'])$job$
);
select cron.schedule(
  'reparo-stuendlich', '5 * * * *',
  $job$select public.reparo_cron_trigger(array['/api/cron/auto-freigabe', '/api/cron/termin-reminder', '/api/cron/ki-health'])$job$
);
select cron.schedule(
  'reparo-nacht', '45 3 * * *',
  $job$select public.reparo_cron_trigger(array['/api/cron/cortex-reflexe', '/api/cron/cortex-schlaf', '/api/cron/abwicklungsfrist', '/api/cron/bewertungs-reminder', '/api/cron/stille-hw-reaktivierung', '/api/cron/sichtbarkeits-recompute'])$job$
);
select cron.schedule(
  'reparo-morgen', '0 6 * * *',
  $job$select public.reparo_cron_trigger(array['/api/cron/hw-morgen-briefing', '/api/cron/keep-alive'])$job$
);
