-- Voice-AI PoC (23.05.2026)
-- Erweitert tickets um Telemetrie-Felder für die Voice-Pipeline:
-- - eingetragen_via: woher kommt das Ticket (Mieter-Wizard, Verwalter-Wizard, Voice-AI, Admin)
-- - voice_call_recording_url: Vapi-Recording-Link (DSGVO: 90-Tage-Löschfrist via Cron)
-- - voice_call_transcript: vollständiges Transkript für Audit / Quality-Check
--
-- Idempotent: alle Statements per IF NOT EXISTS / DO $$.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS eingetragen_via text;

DO $$
BEGIN
  -- CHECK-Constraint nur ergänzen wenn nicht schon vorhanden, damit
  -- Re-Apply nicht wegen Duplicate-Name failt.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tickets'::regclass
      AND conname  = 'tickets_eingetragen_via_check'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_eingetragen_via_check
      CHECK (eingetragen_via IS NULL OR eingetragen_via IN (
        'mieter-wizard', 'verwalter-wizard', 'voice-ai', 'admin'
      ));
  END IF;
END $$;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS voice_call_recording_url text;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS voice_call_transcript text;

CREATE INDEX IF NOT EXISTS idx_tickets_eingetragen_via
  ON public.tickets(eingetragen_via)
  WHERE eingetragen_via IS NOT NULL;

COMMENT ON COLUMN public.tickets.eingetragen_via IS
  'Quelle der Ticket-Erfassung: mieter-wizard / verwalter-wizard / voice-ai / admin';
COMMENT ON COLUMN public.tickets.voice_call_recording_url IS
  'Vapi-Recording-Link, 90 Tage haltbar (DSGVO-Cron löscht danach)';
COMMENT ON COLUMN public.tickets.voice_call_transcript IS
  'Vollständiges Anruf-Transkript aus Vapi für Audit + Qualitätskontrolle';
