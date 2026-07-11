-- Sprint CJ Teil 2 — RLS-Performance-Hygiene (Audit 11.07.2026)
--
-- Supabase-Performance-Advisors: 51 Policies werten auth.uid() pro ZEILE
-- neu aus (auth_rls_initplan). Fix: auth.uid() → (select auth.uid()) —
-- Postgres zieht die Subquery als InitPlan einmal pro Query hoch.
-- Die Umschreibung läuft generisch über pg_policies: nur Ausdrücke, die
-- ein UNGEWRAPPTES auth.uid() enthalten, werden neu gesetzt; ALTER POLICY
-- ohne USING/WITH CHECK-Klausel lässt den jeweils anderen Teil unberührt.
--
-- Außerdem: Doppel-Index auf provisionen(ticket_id) entfernen —
-- provisionen_ticket_id_unique bleibt (Upsert-Ziel onConflict: ticket_id),
-- uq_provisionen_ticket fliegt (Constraint- und Index-Variante abgedeckt).

do $mig$
declare
  p record;
  befehl text;
  qual_neu text;
  check_neu text;
  umgeschrieben int := 0;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (qual is not null and qual ~ 'auth\.uid\(\)' and qual !~ 'SELECT auth\.uid\(\)')
        or
        (with_check is not null and with_check ~ 'auth\.uid\(\)' and with_check !~ 'SELECT auth\.uid\(\)')
      )
  loop
    befehl := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    qual_neu := null;
    check_neu := null;

    if p.qual is not null and p.qual ~ 'auth\.uid\(\)' and p.qual !~ 'SELECT auth\.uid\(\)' then
      qual_neu := replace(p.qual, 'auth.uid()', '(select auth.uid())');
      befehl := befehl || format(' using (%s)', qual_neu);
    end if;
    if p.with_check is not null and p.with_check ~ 'auth\.uid\(\)' and p.with_check !~ 'SELECT auth\.uid\(\)' then
      check_neu := replace(p.with_check, 'auth.uid()', '(select auth.uid())');
      befehl := befehl || format(' with check (%s)', check_neu);
    end if;

    execute befehl;
    umgeschrieben := umgeschrieben + 1;
  end loop;

  raise notice 'RLS-initplan: % Policies umgeschrieben', umgeschrieben;
end
$mig$;

-- Doppel-Index (beide UNIQUE auf ticket_id): eine Variante reicht.
do $idx$
begin
  if exists (select 1 from pg_constraint where conname = 'uq_provisionen_ticket') then
    alter table public.provisionen drop constraint uq_provisionen_ticket;
  elsif exists (select 1 from pg_indexes where schemaname='public' and indexname = 'uq_provisionen_ticket') then
    drop index public.uq_provisionen_ticket;
  end if;
end
$idx$;
