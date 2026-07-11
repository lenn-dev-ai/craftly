-- Sprint CJ Teil 3a — DB-interner Scheduler (Audit 11.07.2026)
-- Netlify-Schedules feuern nicht, GitHub-Actions-Crons werden auf privaten
-- Repos gedrosselt. pg_cron läuft in der ohnehin immer-aktiven Postgres-DB
-- und ist der zuverlässigste Auslöser. pg_net für den ausgehenden HTTP-Aufruf.
create extension if not exists pg_cron;
create extension if not exists pg_net;
