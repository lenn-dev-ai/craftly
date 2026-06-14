-- Sprint AL — Handwerker-Self-Service-Abschluss (Audit Quick-Win → Feature #216)
--
-- Bisher konnte nur der Verwalter ein Ticket per "Abschließen"-Button von
-- in_bearbeitung -> erledigt setzen. Handwerker hatten keinen eigenen
-- Abschluss-Workflow — sie mussten den Verwalter informieren (Chat) und
-- warten.
--
-- Neuer Zwischenstatus "fertiggestellt_hw": Der Handwerker meldet seine
-- Arbeit als abgeschlossen (optional mit Kommentar). Der Verwalter sieht
-- im Ticket einen Hinweis-Banner und kann entweder bestätigen
-- (-> erledigt, bestehende abschliessen()-Logik mit Endkosten) oder
-- zurückweisen (-> zurück zu in_bearbeitung, HW wird per Chat informiert).
--
-- RLS: keine neue Policy nötig — die bestehende tickets_update-Policy
-- erlaubt bereits "auth.uid() = zugewiesener_hw" ohne Spalten-Einschränkung
-- (gleiches Vertrauensmodell wie Verwalter/Mieter-Updates).

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (status = ANY (ARRAY[
    'gemeldet'::text,
    'offen'::text,
    'rueckfrage'::text,
    'auktion'::text,
    'angebote_da'::text,
    'in_bearbeitung'::text,
    'fertiggestellt_hw'::text,
    'erledigt'::text,
    'reklamiert'::text
  ]));

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS hw_abschluss_kommentar text,
  ADD COLUMN IF NOT EXISTS hw_abschluss_am timestamptz;

COMMENT ON COLUMN public.tickets.hw_abschluss_kommentar IS
  'Optionaler Kommentar des Handwerkers beim Self-Service-Abschluss (Status fertiggestellt_hw). Wird dem Verwalter im Bestätigungs-Banner angezeigt.';

COMMENT ON COLUMN public.tickets.hw_abschluss_am IS
  'Zeitpunkt, zu dem der Handwerker die Arbeit als abgeschlossen markiert hat (Status -> fertiggestellt_hw).';
