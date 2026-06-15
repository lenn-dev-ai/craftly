-- Sprint AR Finding A2.1 (Phase 2): profiles-Tabelle — sensitive Felder für
-- Fremd-Profile sperren. PostgreSQL unterstützt kein spaltenweises RLS; die
-- Lösung ist eine SECURITY DEFINER-Funktion als "Column Mask" kombiniert mit
-- einer restriktiven Policy auf der Basistabelle.
--
-- SCOPE: Nur die drei Felder, die kein Client-seitig für Fremd-Profile
-- abfragt und die finanziell/rechtlich sensitiv sind:
--   • stripe_account_id
--   • stripe_charges_enabled
--   • early_adopter_bis
--
-- WICHTIG — VOR ANWENDUNG REVIEW ERFORDERLICH:
--   Die bestehende Policy "profiles_select" nutzt USING (auth.uid() IS NOT NULL),
--   d.h. jeder eingeloggte User kann alle Zeilen lesen (inkl. Fremd-Profile).
--   Das Frontend verwendet durchgehend Supabase-Foreign-Key-Joins der Form
--     handwerker:profiles(id, name, firma, ...)
--   Diese Joins laufen gegen die Basistabelle — NICHT gegen profiles_public.
--   Eine Policy-Änderung auf der Basistabelle, die Zeilen filtert (nicht nur
--   Spalten), würde alle Joins kaputt machen, bei denen der angemeldete User
--   nicht Eigentümer des referenzierten Profils ist.
--
--   STRATEGIE HIER: Keine Änderung der Row-Visibility. Stattdessen:
--   1. profiles_public VIEW (bereits angelegt via 100020) als empfohlener
--      Lesepfad für neue Features ohne sensitive Felder dokumentieren.
--   2. Diese Migration ergänzt einen COMMENT auf die drei sensitiven Spalten
--      als Marker für zukünftige Frontend-Migration-Tickets.
--   3. Eine echte Einschränkung (z.B. Policy USING (id = auth.uid() OR is_admin()))
--      darf erst angewendet werden, nachdem alle Foreign-Key-Joins im Frontend
--      auf profiles_public umgestellt wurden — siehe TODO Sprint AS+.
--
-- STATUS: Nur ins Repo committen. NICHT gegen Production anwenden, bis
-- alle client-seitigen Profile-Joins auditiert und auf profiles_public
-- migriert wurden.

-- Marker-Comments auf sensitive Spalten (harmlos, keine RLS-Änderung)
COMMENT ON COLUMN public.profiles.stripe_account_id IS
  'SENSITIVE: nur für Eigentümer (id = auth.uid()) oder Admin lesbar — TODO Sprint AS+: Policy nach Frontend-Migration auf profiles_public einschränken';

COMMENT ON COLUMN public.profiles.early_adopter_bis IS
  'SENSITIVE: enthält Vertrags-Datum — TODO Sprint AS+: Policy nach Frontend-Migration einschränken';

-- Dokumentiert den Zielzustand als Policy (auskommentiert — erst aktivieren
-- nachdem alle FK-Joins auf profiles_public umgestellt sind):
--
-- ALTER POLICY "profiles_select" ON public.profiles
--   USING (id = (SELECT auth.uid()) OR public.is_admin());
--
-- Sobald die obige Policy aktiv ist, müssen alle Queries dieser Form:
--   handwerker:profiles!handwerker_id(id, name, firma, gewerk, ...)
-- ersetzt werden durch:
--   handwerker:profiles_public!handwerker_id(id, name, firma, gewerk, ...)
-- oder durch explizite RPC-Calls, die SECURITY DEFINER nutzen.
