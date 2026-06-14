-- ════════════════════════════════════════════════════════════════
-- Demo-Daten für Sales-Demos
-- ════════════════════════════════════════════════════════════════
-- Erstellt 3 fake Demo-Handwerker + 5 Showcase-Tickets + 11 Angebote
-- alle markiert mit 'DEMO_' Prefix damit Cleanup leicht möglich.
--
-- Idempotent: alles per ON CONFLICT DO NOTHING / IF NOT EXISTS.
-- Nicht als reguläre Migration ausführen — manuell apply wenn Demo nötig.
--
-- APPLY:   psql ... -f DEMO_DATA_showcase_tickets.sql
--          oder via Supabase-MCP execute_sql
--          oder via SQL-Editor in Studio
--
-- CLEANUP: DELETE FROM angebote WHERE handwerker_id IN
--            (SELECT id FROM profiles WHERE email LIKE 'DEMO_%');
--          DELETE FROM tickets WHERE titel LIKE 'DEMO_%';
--          DELETE FROM profiles WHERE email LIKE 'DEMO_%';
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. Demo-Handwerker-Profile (3 Stück, fake auth)
-- ────────────────────────────────────────────────────────────────
-- profiles.id hat KEINEN FK auf auth.users — daher pure Display-Profile möglich.
-- Diese Profile können sich nicht einloggen, sind nur für Marktplatz-Anzeige.

INSERT INTO public.profiles (id, email, rolle, name, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'DEMO_mueller_sanitaer@reparo-demo.de', 'handwerker', 'Müller Sanitär GbR', now()),
  ('22222222-2222-2222-2222-222222222222', 'DEMO_schmidt_elektro@reparo-demo.de', 'handwerker', 'Schmidt Elektrotechnik', now()),
  ('33333333-3333-3333-3333-333333333333', 'DEMO_lehmann_schlosser@reparo-demo.de', 'handwerker', 'Lehmann Schlüsseldienst 24/7', now())
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 2. Showcase-Tickets (5 Stück)
-- ────────────────────────────────────────────────────────────────
-- Alle als test.verwalter erstellt (a5d4c17c-5d3c-4d3c-b2e4-969f8f1f583e).
-- Verschiedene Status, Dringlichkeiten, Gewerke für volle Demo-Range.

INSERT INTO public.tickets (
  id, titel, beschreibung, status, prioritaet, vergabemodus, wohnung,
  erstellt_von, verwalter_id, gewerk, einsatzort_adresse,
  einsatzort_lat, einsatzort_lng, dringlichkeit, auktion_start, auktion_ende,
  ki_confidence, ki_schadensart, preiskorridor_min, preiskorridor_max, created_at
)
VALUES
  -- Ticket 1: NOTFALL Wasserschaden (Auktion läuft, gleich 3 Angebote)
  (
    'aaaa1111-aaaa-1111-aaaa-111111111111',
    'DEMO_Wasserrohrbruch Küche',
    'Mieter meldet akut: Wasser läuft seit 30 Min unter Spüle aus, Boden bereits geflutet. Haupthahn nicht zu finden.',
    'auktion', 'notfall', 'auktion', 'Wohnung 4A',
    '55efc4c2-6851-4cf6-9936-68e6f9a88500', 'a5d4c17c-5d3c-4d3c-b2e4-969f8f1f583e',
    'wasser', 'Brunnenstraße 12, 10119 Berlin',
    52.5305, 13.4036, 'notfall',
    now() - interval '15 minutes', now() + interval '11 hours 45 minutes',
    0.94, 'Rohrbruch / Leckage', 180, 320, now() - interval '20 minutes'
  ),
  -- Ticket 2: Zeitnah Heizung defekt (Auktion läuft, 2 Angebote)
  (
    'aaaa2222-aaaa-2222-aaaa-222222222222',
    'DEMO_Heizung kalt im Wohnzimmer',
    'Mieter meldet: Heizkörper im Wohnzimmer wird seit 2 Tagen nicht warm, andere Räume OK. Vermutlich Thermostat oder Luft im Heizkörper.',
    'auktion', 'zeitnah', 'auktion', 'Wohnung 12',
    '55efc4c2-6851-4cf6-9936-68e6f9a88500', 'a5d4c17c-5d3c-4d3c-b2e4-969f8f1f583e',
    'heizung', 'Pappelallee 7, 10437 Berlin',
    52.5475, 13.4156, 'zeitnah',
    now() - interval '2 hours', now() + interval '22 hours',
    0.81, 'Heizungs-Funktionsstörung', 95, 180, now() - interval '2 hours 5 minutes'
  ),
  -- Ticket 3: Planbar Schloss klemmt (Auktion läuft, 4 Angebote breit)
  (
    'aaaa3333-aaaa-3333-aaaa-333333333333',
    'DEMO_Wohnungstür-Schloss klemmt',
    'Mieter beschreibt: Schloss lässt sich nur mit Mühe öffnen, Schlüssel hängt. Funktioniert noch, aber unangenehm. Kein Notfall.',
    'auktion', 'planbar', 'auktion', 'Wohnung 2B',
    '55efc4c2-6851-4cf6-9936-68e6f9a88500', 'a5d4c17c-5d3c-4d3c-b2e4-969f8f1f583e',
    'schloss', 'Gleimstraße 33, 10437 Berlin',
    52.5468, 13.4068, 'planbar',
    now() - interval '1 day', now() + interval '48 hours',
    0.76, 'Schließzylinder-Verschleiß', 65, 140, now() - interval '1 day 5 minutes'
  ),
  -- Ticket 4: Abgeschlossen (zeigt Lifecycle)
  (
    'aaaa4444-aaaa-4444-aaaa-444444444444',
    'DEMO_Steckdose Bad defekt — ABGESCHLOSSEN',
    'War: Steckdose im Bad ohne Strom, Mieter konnte Föhn nicht benutzen. Diagnose: FI-Schutzschalter ausgelöst, Defekt am Anschluss.',
    'abgeschlossen', 'zeitnah', 'auktion', 'Wohnung 8',
    '55efc4c2-6851-4cf6-9936-68e6f9a88500', 'a5d4c17c-5d3c-4d3c-b2e4-969f8f1f583e',
    'strom', 'Schönhauser Allee 88, 10439 Berlin',
    52.5520, 13.4153, 'zeitnah',
    now() - interval '8 days', now() - interval '7 days',
    0.88, 'Elektroinstallation defekt', 110, 200,
    now() - interval '8 days'
  ),
  -- Ticket 5: Diagnose-Auftrag (zeigt KI-Diagnose-Feature)
  (
    'aaaa5555-aaaa-5555-aaaa-555555555555',
    'DEMO_Feuchte Wand Schlafzimmer — Diagnose nötig',
    'Mieter meldet braune Verfärbungen + leichten Modergeruch an Außenwand Schlafzimmer. Ursache unklar — könnte Wasser von oben, Kondensation oder Schimmelpilz sein. Vor-Ort-Befund nötig.',
    'auktion', 'zeitnah', 'auktion', 'Wohnung 6C',
    '55efc4c2-6851-4cf6-9936-68e6f9a88500', 'a5d4c17c-5d3c-4d3c-b2e4-969f8f1f583e',
    'sonstiges', 'Lychener Straße 24, 10437 Berlin',
    52.5470, 13.4220, 'zeitnah',
    now() - interval '6 hours', now() + interval '18 hours',
    0.62, 'Feuchtigkeitsschaden (unklar)', 150, 400, now() - interval '6 hours 10 minutes'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 3. Angebote — Marktplatz-Showcase
-- ────────────────────────────────────────────────────────────────

-- ─── Ticket 1 NOTFALL Wasser — 3 Angebote ───
INSERT INTO public.angebote (
  id, ticket_id, handwerker_id, preis, fruehester_termin, nachricht,
  status, created_at, smart_score, geschaetzte_dauer
)
VALUES
  -- Angebot 1.1: günstigster aber später
  ('b1a11111-b1a1-1111-b1a1-111111111111',
   'aaaa1111-aaaa-1111-aaaa-111111111111',
   '11111111-1111-1111-1111-111111111111',
   195.00, current_date + 1, 'Komme morgen früh 8 Uhr, bringe Notreparatur-Kit mit.',
   'eingereicht', now() - interval '12 minutes', 0.72, '1–2 Stunden'),
  -- Angebot 1.2: teurer aber HEUTE — EMPFOHLEN
  ('b1a22222-b1a1-2222-b1a1-222222222222',
   'aaaa1111-aaaa-1111-aaaa-111111111111',
   '22222222-2222-2222-2222-222222222222',
   285.00, current_date, 'In 45 Min vor Ort. Notdienst-Aufschlag inklusive, keine versteckten Kosten.',
   'eingereicht', now() - interval '8 minutes', 0.91, '1 Stunde'),
  -- Angebot 1.3: mittel
  ('b1a33333-b1a1-3333-b1a1-333333333333',
   'aaaa1111-aaaa-1111-aaaa-111111111111',
   '33333333-3333-3333-3333-333333333333',
   240.00, current_date, 'Bin in 90 Min da. Erfahrener Sanitärbetrieb, 24/7-Service.',
   'eingereicht', now() - interval '5 minutes', 0.83, '1–1,5 Stunden')
ON CONFLICT (id) DO NOTHING;

-- ─── Ticket 2 Heizung — 2 Angebote ───
INSERT INTO public.angebote (
  id, ticket_id, handwerker_id, preis, fruehester_termin, nachricht,
  status, created_at, smart_score, geschaetzte_dauer
)
VALUES
  ('b2a11111-b2a1-1111-b2a1-111111111111',
   'aaaa2222-aaaa-2222-aaaa-222222222222',
   '11111111-1111-1111-1111-111111111111',
   120.00, current_date + 2, 'Standard-Check + Entlüften + ggf. Thermostat. Pauschal.',
   'eingereicht', now() - interval '1 hour 30 minutes', 0.79, '45 Min – 1 Std'),
  ('b2a22222-b2a1-2222-b2a1-222222222222',
   'aaaa2222-aaaa-2222-aaaa-222222222222',
   '22222222-2222-2222-2222-222222222222',
   149.00, current_date + 1, 'Morgen Nachmittag möglich. Habe alle gängigen Thermostate auf Lager.',
   'eingereicht', now() - interval '50 minutes', 0.86, '1 Stunde')
ON CONFLICT (id) DO NOTHING;

-- ─── Ticket 3 Schloss — 4 Angebote (breit gefächert) ───
INSERT INTO public.angebote (
  id, ticket_id, handwerker_id, preis, fruehester_termin, nachricht,
  status, created_at, smart_score, geschaetzte_dauer
)
VALUES
  ('b3a11111-b3a1-1111-b3a1-111111111111',
   'aaaa3333-aaaa-3333-aaaa-333333333333',
   '33333333-3333-3333-3333-333333333333',
   75.00, current_date + 3, 'Reinigung + Schmierung. Falls Zylindertausch nötig: separate Kalkulation.',
   'eingereicht', now() - interval '20 hours', 0.84, '30 Min'),
  ('b3a22222-b3a1-2222-b3a1-222222222222',
   'aaaa3333-aaaa-3333-aaaa-333333333333',
   '11111111-1111-1111-1111-111111111111',
   89.00, current_date + 2, 'Komplettcheck inkl. Material. Auch Tausch falls nötig — Pauschale.',
   'eingereicht', now() - interval '12 hours', 0.78, '30–45 Min'),
  ('b3a33333-b3a1-3333-b3a1-333333333333',
   'aaaa3333-aaaa-3333-aaaa-333333333333',
   '22222222-2222-2222-2222-222222222222',
   135.00, current_date + 1, 'Premium-Schließzylinder im Tausch enthalten. Auf Wunsch Sicherheits-Upgrade.',
   'eingereicht', now() - interval '8 hours', 0.72, '1 Stunde'),
  -- nachrichtlich später eingegangen, zeigt Auktions-Dynamik
  ('b3a44444-b3a1-4444-b3a1-444444444444',
   'aaaa3333-aaaa-3333-aaaa-333333333333',
   '33333333-3333-3333-3333-333333333333',
   62.00, current_date + 4, 'Aktion: Schmierung + Justage zum Sonderpreis. Eilig nicht möglich.',
   'eingereicht', now() - interval '3 hours', 0.81, '20–30 Min')
ON CONFLICT (id) DO NOTHING;

-- ─── Ticket 4 Strom abgeschlossen — 1 Angebot, angenommen ───
INSERT INTO public.angebote (
  id, ticket_id, handwerker_id, preis, fruehester_termin, nachricht,
  status, created_at, smart_score, geschaetzte_dauer
)
VALUES
  ('b4a11111-b4a1-1111-b4a1-111111111111',
   'aaaa4444-aaaa-4444-aaaa-444444444444',
   '22222222-2222-2222-2222-222222222222',
   175.00, current_date - 7, 'FI-Reset + Steckdosen-Tausch + Sicherheitsprüfung.',
   'angenommen', now() - interval '8 days', 0.92, '45 Min – 1 Std')
ON CONFLICT (id) DO NOTHING;

-- Ticket 4 final-Kosten (war abgeschlossen)
UPDATE public.tickets
SET kosten_final = 175.00, zugewiesener_hw = '22222222-2222-2222-2222-222222222222'
WHERE id = 'aaaa4444-aaaa-4444-aaaa-444444444444';

-- ─── Ticket 5 Diagnose — 1 Angebot (Diagnose-Termin) ───
INSERT INTO public.angebote (
  id, ticket_id, handwerker_id, preis, fruehester_termin, nachricht,
  status, created_at, smart_score, geschaetzte_dauer
)
VALUES
  ('b5a11111-b5a1-1111-b5a1-111111111111',
   'aaaa5555-aaaa-5555-aaaa-555555555555',
   '11111111-1111-1111-1111-111111111111',
   85.00, current_date + 1, 'Vor-Ort-Diagnose mit Feuchtemessgerät + Foto-Doku. Sanierungs-Angebot folgt nach Befund.',
   'eingereicht', now() - interval '4 hours', 0.79, '45 Min')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ════════════════════════════════════════════════════════════════
-- VERIFIKATION
-- ════════════════════════════════════════════════════════════════
SELECT
  (SELECT count(*) FROM public.profiles WHERE email LIKE 'DEMO_%') AS demo_handwerker,
  (SELECT count(*) FROM public.tickets WHERE titel LIKE 'DEMO_%') AS demo_tickets,
  (SELECT count(*) FROM public.angebote WHERE handwerker_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  )) AS demo_angebote;

-- Erwartung: 3 / 5 / 11
