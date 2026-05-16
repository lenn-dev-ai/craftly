-- Feedback-System für Beta-User-Loop.
--
-- Jeder eingeloggte User kann via Floating-Button kurzes Feedback
-- absetzen. Reparo (Admin) liest in /dashboard-admin/feedback und
-- bekommt parallel eine Mail. Bewusst minimal — Beta-Tool, kein
-- vollwertiger Support-Tracker.

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  rolle text,
  kontext_url text,
  message text NOT NULL,
  viewed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_unread_idx ON public.feedback (viewed, created_at DESC)
  WHERE viewed = false;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Insert: jeder authenticated User darf, aber nur als sich selbst.
-- Ohne user_id-Constraint könnte ein User Feedback im Namen eines
-- anderen Users platzieren → Verwirrung im Admin-Inbox.
DROP POLICY IF EXISTS feedback_insert_self ON public.feedback;
CREATE POLICY feedback_insert_self ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Select: nur eigene + Admin sieht alle. Eigenes-Lesen erlauben,
-- damit User ggf. später eine "Mein Feedback"-Ansicht bekommen könnte.
DROP POLICY IF EXISTS feedback_select_own_or_admin ON public.feedback;
CREATE POLICY feedback_select_own_or_admin ON public.feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Update: nur Admin (für viewed-Toggle).
DROP POLICY IF EXISTS feedback_update_admin ON public.feedback;
CREATE POLICY feedback_update_admin ON public.feedback
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Delete: nur Admin (Spam-Bereinigung).
DROP POLICY IF EXISTS feedback_delete_admin ON public.feedback;
CREATE POLICY feedback_delete_admin ON public.feedback
  FOR DELETE TO authenticated
  USING (public.is_admin());
