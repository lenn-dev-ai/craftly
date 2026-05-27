-- Loop-23 Feedback (27.05.2026) — Mieter-Wizard braucht eindeutigen
-- Identifier (Mieter-Nr / Wohneinheits-Nr / Vertrags-Nr) damit der
-- Verwalter den Ticket-Absender beim Eingang sofort matchen kann.
--
-- Bisherige Spalte tickets.wohnung ist Freitext ("Whg. 3 OG, Bad") und
-- dient der räumlichen Lokalisierung des Schadens — nicht der Mieter-
-- Identifikation. Neue Spalte ist optional (NULL) und additive.
--
-- Lese-Pfad: components/ticket/TicketDetailView.tsx zeigt das Feld
-- prominent als Badge wenn vorhanden.
-- Schreib-Pfad: app/dashboard-mieter/melden/page.tsx Wizard hat das
-- Feld als optionalen Input nach "Wohnung im Haus".

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS wohneinheit_referenz text;

COMMENT ON COLUMN public.tickets.wohneinheit_referenz IS
  'Optionaler Verwalter-interner Identifier (Mieter-Nr / Wohneinheits-Nr / Vertrags-Nr), den der Mieter beim Melden mitgibt. Erlaubt dem Verwalter Direkt-Match auf seinen Bestand ohne Namens-Lookup.';
