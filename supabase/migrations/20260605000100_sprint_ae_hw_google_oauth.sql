-- Sprint AE — Google-Calendar-OAuth-Tokens pro Handwerker.
--
-- Tabelle existiert in Production seit dem ersten Sprint-AE-Push (24.05.2026),
-- aber wurde nie als Migration-File ins Repo committed (Drift). Diese
-- Migration ist idempotent (IF NOT EXISTS / safe re-run) und dient als
-- Source-of-Truth für lokale Branches + Disaster-Recovery.
--
-- Schreib-Pfad: ausschließlich Service-Role-Client (lib/google-cal/oauth.ts,
-- app/api/auth/google/callback/route.ts, app/auth/callback/route.ts).
-- Lese-Pfad: HW liest eigene Zeile direkt (Banner, Profil-Page).

CREATE TABLE IF NOT EXISTS public.hw_google_oauth (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  scope text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz,
  last_error text
);

ALTER TABLE public.hw_google_oauth ENABLE ROW LEVEL SECURITY;

-- HW darf nur die eigene OAuth-Zeile lesen (Banner / Profil-Status).
-- Inserts/Updates laufen ausschließlich über Service-Role (kein WITH CHECK).
DROP POLICY IF EXISTS hw_sees_own_oauth ON public.hw_google_oauth;
CREATE POLICY hw_sees_own_oauth ON public.hw_google_oauth
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
