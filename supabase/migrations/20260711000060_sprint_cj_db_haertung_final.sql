-- Sprint CJ Teil 5 — DB-Härtung Abschluss (Audit 11.07.2026)
--
-- (a) Fehlende FK-Covering-Indizes (Advisor unindexed_foreign_keys).
create index if not exists idx_stamm_handwerker_objekt_id on public.stamm_handwerker(objekt_id);
create index if not exists idx_stamm_anfragen_stamm_eintrag_id on public.stamm_anfragen(stamm_eintrag_id);

-- (b) anon-SELECT-Grant auf eindeutig INTERNEN Tabellen entziehen
-- (Advisor pg_graphql_anon_table_exposed). RLS schützt die Zeilen bereits;
-- der Grant-Entzug schließt zusätzlich die Schema-Introspektion über
-- GraphQL. Bewusst NUR Tabellen ohne jeden öffentlichen Lesepfad — Tabellen,
-- die evtl. anonyme Client-Queries bedienen (bewertungen bleibt public
-- lesbar, diagnose_preise, profiles, tickets …), bleiben unangetastet.
-- Eingeloggte Nutzer nutzen die Rolle 'authenticated' und sind nicht betroffen.
revoke select on
  public.cortex_entscheidungen,
  public.cortex_ereignisse,
  public.cortex_gedaechtnis,
  public.cortex_playbooks,
  public.cron_heartbeats,
  public.hw_google_oauth,
  public.ki_analysen_cache,
  public.ki_quota,
  public.geocode_quota,
  public.provisionen,
  public.provision_settings,
  public.feedback_verdicts,
  public.ticket_audit_log,
  public.private_termine,
  public.routen_planung
from anon;

-- (c) cron_config hält das DB-Cron-Secret — komplett abriegeln. Zugriff
-- ausschließlich über den Service-Role-Client (umgeht Grants/RLS). Weder
-- anon noch authenticated brauchen je Zugriff. Live verifiziert: der
-- pg_cron-Scheduler schreibt trotz Lockdown weiter Heartbeats (via='secret').
revoke all on public.cron_config from anon, authenticated;
