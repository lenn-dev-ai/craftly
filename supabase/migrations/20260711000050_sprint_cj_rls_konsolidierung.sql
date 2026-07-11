-- Sprint CJ Teil 4 — RLS-Policy-Konsolidierung (Audit 11.07.2026)
--
-- Advisor multiple_permissive_policies: mehrere permissive Policies je
-- (Tabelle, Kommando) werden pro Zeile einzeln ausgewertet. Da permissive
-- Policies per OR kombiniert werden, ist das Zusammenführen in EINE Policy
-- mit OR-verknüpften Bedingungen semantisch verlustfrei — der Zugriff
-- bleibt Byte-für-Byte identisch, nur schneller.
--
-- Bewusst NICHT angefasst: Überlappungen zwischen einer Admin-`ALL`-Policy
-- und rollenspezifischen `SELECT`-Policies (stamm_*, ticket_reklamationen).
-- Das ist ein benignes Standardmuster und nur durch Aufsplitten der
-- ALL-Policy in einzelne Kommandos auflösbar — das würde die Policy-Zahl
-- erhöhen statt senken. Alle auth.uid()-Aufrufe bleiben als (select …)
-- gewrappt (initplan-Optimierung aus Teil 2).

begin;

-- ============ angebote SELECT (3 → 1) ============
drop policy if exists "Verwalter sieht Angebote seiner Tickets" on public.angebote;
drop policy if exists "Verwalter sieht Angebote zugewiesener Tickets" on public.angebote;
drop policy if exists "angebote_select" on public.angebote;
create policy "angebote_select" on public.angebote for select using (
  (exists (select 1 from tickets t join profiles p on p.id = (select auth.uid())
           where t.id = angebote.ticket_id
             and (t.erstellt_von = (select auth.uid()) or p.rolle = 'admin')))
  or (exists (select 1 from tickets t
              where t.id = angebote.ticket_id and t.verwalter_id = (select auth.uid())))
  or ((select auth.uid()) = handwerker_id
      or exists (select 1 from tickets t
                 where t.id = angebote.ticket_id and t.erstellt_von = (select auth.uid())))
);

-- ============ angebote UPDATE (3 → 1) ============
drop policy if exists "Verwalter aendert Angebote" on public.angebote;
drop policy if exists "angebote_update" on public.angebote;
drop policy if exists "angebote_update_handwerker_self" on public.angebote;
create policy "angebote_update" on public.angebote for update
  using (
    (exists (select 1 from tickets t where t.id = angebote.ticket_id and t.erstellt_von = (select auth.uid())))
    or ((select auth.uid()) = handwerker_id)
  )
  with check (
    (exists (select 1 from tickets t where t.id = angebote.ticket_id and t.erstellt_von = (select auth.uid())))
    or ((select auth.uid()) = handwerker_id)
  );

-- ============ bewertungen SELECT (2 → 1, exakte Dublette) ============
drop policy if exists "bewertungen_select_visible" on public.bewertungen;
-- bewertungen_select (using true) bleibt bestehen.

-- ============ eigentuemer ALL (2 → 1) ============
drop policy if exists "eigentuemer_admin_all" on public.eigentuemer;
drop policy if exists "eigentuemer_verwalter_all" on public.eigentuemer;
create policy "eigentuemer_all" on public.eigentuemer for all
  using (is_admin() or (verwalter_id = (select auth.uid())))
  with check (is_admin() or (verwalter_id = (select auth.uid())));

-- ============ hw_google_oauth ALL (2 → 1) ============
drop policy if exists "hw_google_oauth_admin" on public.hw_google_oauth;
drop policy if exists "hw_google_oauth_own" on public.hw_google_oauth;
create policy "hw_google_oauth_all" on public.hw_google_oauth for all
  using (is_admin() or (user_id = (select auth.uid())))
  with check (is_admin() or (user_id = (select auth.uid())));

-- ============ nachrichten SELECT (2 → 1) ============
drop policy if exists "nachrichten_select" on public.nachrichten;
drop policy if exists "nachrichten_select_beteiligte" on public.nachrichten;
create policy "nachrichten_select" on public.nachrichten for select using (
  (exists (select 1 from tickets t
           where t.id = nachrichten.ticket_id
             and (t.erstellt_von = (select auth.uid()) or t.zugewiesener_hw = (select auth.uid()))))
  or ((select auth.uid()) in (
        select tickets.erstellt_von from tickets where tickets.id = nachrichten.ticket_id
        union
        select tickets.zugewiesener_hw from tickets where tickets.id = nachrichten.ticket_id)
      or exists (select 1 from profiles
                 where profiles.id = (select auth.uid())
                   and profiles.rolle = any (array['verwalter','admin'])))
);

-- ============ nachrichten INSERT (2 → 1) ============
drop policy if exists "nachrichten_insert" on public.nachrichten;
drop policy if exists "nachrichten_insert_beteiligte" on public.nachrichten;
create policy "nachrichten_insert" on public.nachrichten for insert with check (
  ((select auth.uid()) = absender_id)
  or (((select auth.uid()) = absender_id) and (
        ((select auth.uid()) in (
           select tickets.erstellt_von from tickets where tickets.id = nachrichten.ticket_id
           union
           select tickets.zugewiesener_hw from tickets where tickets.id = nachrichten.ticket_id))
        or exists (select 1 from profiles
                   where profiles.id = (select auth.uid())
                     and profiles.rolle = any (array['verwalter','admin']))))
);

-- ============ termine SELECT (2 → 1) ============
drop policy if exists "termine_select" on public.termine;
drop policy if exists "termine_select_beteiligte" on public.termine;
create policy "termine_select" on public.termine for select using (
  ((select auth.uid()) = handwerker_id
   or exists (select 1 from tickets t where t.id = termine.ticket_id and t.erstellt_von = (select auth.uid())))
  or ((select auth.uid()) = handwerker_id
      or (select auth.uid()) in (select tickets.erstellt_von from tickets where tickets.id = termine.ticket_id))
);

-- ============ termine INSERT (3 → 1; 2× public + 1× authenticated → public) ============
-- Die authenticated-Bedingung greift bei public nur für eingeloggte Nutzer
-- (anon hat kein auth.uid()) — Zusammenlegen unter public ist äquivalent.
drop policy if exists "termine_insert" on public.termine;
drop policy if exists "termine_insert_beteiligte" on public.termine;
drop policy if exists "verwalter_insert_termine" on public.termine;
create policy "termine_insert" on public.termine for insert with check (
  ((select auth.uid()) = handwerker_id)
  or ((select auth.uid()) = handwerker_id
      or (select auth.uid()) in (select tickets.erstellt_von from tickets where tickets.id = termine.ticket_id))
  or ((select auth.uid()) in (select tickets.zugewiesener_hw from tickets where tickets.id = termine.ticket_id)
      or (select auth.uid()) in (select tickets.erstellt_von from tickets where tickets.id = termine.ticket_id))
);

-- ============ ticket_reklamationen SELECT (2 → 1; Admin-ALL bleibt) ============
drop policy if exists "reklamationen_mieter_select" on public.ticket_reklamationen;
drop policy if exists "reklamationen_verwalter_select" on public.ticket_reklamationen;
create policy "reklamationen_select" on public.ticket_reklamationen for select using (
  (mieter_id = (select auth.uid()))
  or exists (select 1 from tickets t
             where t.id = ticket_reklamationen.ticket_id and t.verwalter_id = (select auth.uid()))
);

-- ============ stamm_handwerker ALL (2 → 1; hw-SELECT bleibt) ============
drop policy if exists "stamm_admin_all" on public.stamm_handwerker;
drop policy if exists "stamm_verwalter_all" on public.stamm_handwerker;
create policy "stamm_handwerker_all" on public.stamm_handwerker for all
  using (is_admin() or (verwalter_id = (select auth.uid())))
  with check (is_admin() or (verwalter_id = (select auth.uid())));

-- ============ stamm_anfragen SELECT (2 → 1; Admin-ALL bleibt) ============
drop policy if exists "stamm_anfragen_hw_select" on public.stamm_anfragen;
drop policy if exists "stamm_anfragen_verwalter_select" on public.stamm_anfragen;
create policy "stamm_anfragen_select" on public.stamm_anfragen for select using (
  (handwerker_id = (select auth.uid()))
  or exists (select 1 from tickets t
             where t.id = stamm_anfragen.ticket_id and t.verwalter_id = (select auth.uid()))
);

commit;
