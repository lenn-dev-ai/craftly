-- Sprint BG — Verwaltungsanliegen-Flag (kein Gebäudeschaden).
--
-- Prod-Befund 05.07.2026: Ticket "Mietschuldenfreiheitsbescheinigung
-- angefordert" (via Voice-AI) lief durch den Handwerker-Vergabe-Flow
-- inkl. KI-Preis-Schätzung und "Handwerker buchen"-CTA, obwohl es ein
-- reiner Verwaltungsvorgang ist.
--
-- kein_schaden = true bedeutet: Verwaltungsanliegen (Bescheinigung,
-- Vertragsfrage, Korrespondenz, ...) — Auto-Vergabe überspringt das
-- Ticket, das Verwalter-Dashboard zeigt statt Preis-Schätzung und
-- "Handwerker buchen" eine "Als Verwaltungsanliegen bearbeiten"-Aktion.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS kein_schaden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tickets.kein_schaden IS
  'true = Verwaltungsanliegen (kein Gebäudeschaden) — keine Handwerker-Vergabe, keine Preis-Schätzung.';
