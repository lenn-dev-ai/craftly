-- Sprint CJ Teil 6 — Mail-Flut stoppen (12.07.2026)
--
-- Der pg_cron-Scheduler (Teil 3) läuft zuverlässig und stieß in der ersten
-- Nacht ALLE Batch-Benachrichtigungs-Crons an, die vorher (tote
-- Netlify-Schedules) nie feuerten: hw-morgen-briefing (~69 Mails/Tag),
-- bewertungs-reminder (bis ~56), abwicklungsfrist (~10), stille-hw-
-- reaktivierung. In der Closed Beta mit ~80 Test-Accounts ist das nur
-- Rauschen an nicht-echte Empfänger.
--
-- Wir behalten NUR die operative Engine + den Wächter. Die Benachrichtigungs-
-- Batches können jederzeit reaktiviert werden (Endpunkte + Routen bleiben
-- bestehen) — z. B. sobald echte Nutzer live sind.
--
--   reparo-motor       (Vergabe-Eskalation + Auktions-Abschluss) — Kern
--   reparo-stuendlich  (Auto-Freigabe + KI-Health) — ohne termin-reminder
--   reparo-nacht       (Cortex-Reflexe inkl. Wächter + Schlaf-Memo +
--                       Sichtbarkeits-Recompute) — ohne die 3 Mail-Batches
--   reparo-morgen      ENTFERNT (war nur hw-morgen-briefing + redundantes
--                       keep-alive; pg_cron hält die DB ohnehin aktiv)

-- Falls der Job aus einer früheren Migration existiert: abbestellen.
do $$
begin
  perform cron.unschedule('reparo-morgen');
exception when others then null;  -- Job existiert nicht (mehr) → ok
end $$;

select cron.schedule(
  'reparo-stuendlich', '5 * * * *',
  $job$select public.reparo_cron_trigger(array['/api/cron/auto-freigabe', '/api/cron/ki-health'])$job$
);

select cron.schedule(
  'reparo-nacht', '45 3 * * *',
  $job$select public.reparo_cron_trigger(array['/api/cron/cortex-reflexe', '/api/cron/cortex-schlaf', '/api/cron/sichtbarkeits-recompute'])$job$
);
