-- Demo-Seeding: HW-1 Karte & Route — Tickets + Termine mit Berliner Adressen
-- Hintergrund: KarteView liest aus `termine` (für Tages-Route) und `tickets`
--   (zugewiesener_hw, Status ≠ erledigt). Die Showcase-Migration erzeugt zwar
--   Tickets mit HW-1-Einladungen, aber keine `termine`-Rows → Karte leer.
-- Diese Migration fügt 4 Tickets (in_bearbeitung, HW-1 zugewiesen) +
--   5 bestätigte Termine ein (Je 2 für heute + morgen → Route kann berechnet werden).
--
-- HW-1: 30000000-0000-4000-a000-000000000001
-- M1:   10000000-0000-4000-a000-000000000001
-- V1:   20000000-0000-4000-a000-000000000001

-- ════════════════════════════════════════════════════════════════
-- 1. TICKETS — 4 Aufträge für HW-1 mit Berliner Einsatzorten
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.tickets (
  id, titel, beschreibung,
  status, dringlichkeit, dringlichkeit_original, vergabe_modus, wohnung,
  erstellt_von, verwaltungs_id,
  gewerk,
  einsatzort_adresse, einsatzort_lat, einsatzort_lng,
  surge_faktor,
  kandidaten_json,
  direktvergabe_index,
  erstellt_am, geschaetzte_minuten,
  direktvergabe_gestartet_am, direktvergabe_frist_bis,
  zugewiesener_hw, kosten_final,
  created_at
) VALUES

-- ── K1: Heizung Torstraße (Berlin-Mitte) ─────────────────────────────────────
(
  'f0000001-0000-4000-8000-000000000001',
  'Heizkörper Wohnzimmer heizt ungleichmäßig',
  'Mieter meldet: Heizkörper im Wohnzimmer wird oben heiß, unten bleibt er kalt. Entlüftung bereits versucht — Problem bleibt. Bitte prüfen.',
  'in_bearbeitung', 'zeitnah', 'zeitnah', 'direkt', 'Wohnung 3B',
  '10000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000001',
  'heizung_sanitaer',
  'Torstraße 14, 10119 Berlin', 52.5270, 13.4041,
  1.1,
  '[{"hw_id":"30000000-0000-4000-a000-000000000001","score":73.2,"preis":143}]'::jsonb,
  0,
  now() - interval '3 days', 120,
  now() - interval '3 days', now() - interval '2 days',
  '30000000-0000-4000-a000-000000000001', 143,
  now() - interval '3 days 1 hour'
),

-- ── K2: Wasserhahn Bad Kantstraße (Berlin-Charlottenburg) ────────────────────
(
  'f0000001-0000-4000-8000-000000000002',
  'Badezimmer: Wasserhahn tropft dauerhaft',
  'Mieter meldet: Kaltwasserhahn im Badezimmer tropft seit 3 Tagen konstant. Dichtung vermutlich defekt. Bitte reparieren.',
  'in_bearbeitung', 'zeitnah', 'zeitnah', 'direkt', 'Wohnung 7',
  '10000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000001',
  'heizung_sanitaer',
  'Kantstraße 88, 10623 Berlin', 52.5044, 13.3186,
  1.0,
  '[{"hw_id":"30000000-0000-4000-a000-000000000001","score":68.5,"preis":130}]'::jsonb,
  0,
  now() - interval '2 days', 90,
  now() - interval '2 days', now() - interval '1 day',
  '30000000-0000-4000-a000-000000000001', 130,
  now() - interval '2 days 2 hours'
),

-- ── K3: Siphon Küche Boxhagener Str. (Berlin-Friedrichshain) ─────────────────
(
  'f0000001-0000-4000-8000-000000000003',
  'Küche: Siphon unter Spüle undicht',
  'Mieter meldet: Unter der Küchenspüle tropft es aus dem Siphon, Schrank darunter feucht. Bitte dringend prüfen und abdichten.',
  'in_bearbeitung', 'zeitnah', 'zeitnah', 'direkt', 'Wohnung 2A',
  '10000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000001',
  'heizung_sanitaer',
  'Boxhagener Straße 30, 10245 Berlin', 52.5125, 13.4594,
  1.0,
  '[{"hw_id":"30000000-0000-4000-a000-000000000001","score":70.1,"preis":95}]'::jsonb,
  0,
  now() - interval '1 day', 60,
  now() - interval '1 day', now() + interval '1 day',
  '30000000-0000-4000-a000-000000000001', 95,
  now() - interval '1 day 1 hour'
),

-- ── K4: Jahreswartung Greifswalder Str. (Berlin-Prenzlauer Berg) ─────────────
(
  'f0000001-0000-4000-8000-000000000004',
  'Jährliche Heizungswartung — Brenner & CO-Check',
  'Verwalter: Pflichttermin für Jahresinspektion der Gasheizung. Bitte Brenner, Dichtungen, CO-Messung und Abgaswerte prüfen und dokumentieren.',
  'in_bearbeitung', 'planbar', 'planbar', 'direkt', 'Keller',
  '10000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000001',
  'heizung_sanitaer',
  'Greifswalder Straße 45, 10405 Berlin', 52.5290, 13.4450,
  1.0,
  '[{"hw_id":"30000000-0000-4000-a000-000000000001","score":65.8,"preis":175}]'::jsonb,
  0,
  now() - interval '4 days', 180,
  now() - interval '4 days', now() + interval '3 days',
  '30000000-0000-4000-a000-000000000001', 175,
  now() - interval '4 days 1 hour'
)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- 2. TERMINE — 5 bestätigte Termine für HW-1
--    Heute (2 Stops → Route wird berechnet) + morgen (2) + nächste Woche (1)
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.termine (
  id, handwerker_id, ticket_id,
  titel, datum, von, bis,
  status,
  einsatzort_adresse, einsatzort_lat, einsatzort_lng
) VALUES

-- ── Heute: Torstraße 09:00-11:00 ─────────────────────────────────────────────
(
  'e1000001-0000-4000-8000-000000000001',
  '30000000-0000-4000-a000-000000000001',
  'f0000001-0000-4000-8000-000000000001',
  'Heizkörper Wohnzimmer — Entlüftung & Check',
  CURRENT_DATE, '09:00', '11:00',
  'bestaetigt',
  'Torstraße 14, 10119 Berlin', 52.5270, 13.4041
),

-- ── Heute: Boxhagener Str. 13:00-14:00 ──────────────────────────────────────
(
  'e1000001-0000-4000-8000-000000000002',
  '30000000-0000-4000-a000-000000000001',
  'f0000001-0000-4000-8000-000000000003',
  'Siphon Küche — Dichtung ersetzen',
  CURRENT_DATE, '13:00', '14:00',
  'bestaetigt',
  'Boxhagener Straße 30, 10245 Berlin', 52.5125, 13.4594
),

-- ── Morgen: Kantstraße 09:00-10:30 ──────────────────────────────────────────
(
  'e1000001-0000-4000-8000-000000000003',
  '30000000-0000-4000-a000-000000000001',
  'f0000001-0000-4000-8000-000000000002',
  'Wasserhahn Bad — Dichtung erneuern',
  CURRENT_DATE + 1, '09:00', '10:30',
  'bestaetigt',
  'Kantstraße 88, 10623 Berlin', 52.5044, 13.3186
),

-- ── Morgen: Greifswalder Str. 14:00-17:00 ───────────────────────────────────
(
  'e1000001-0000-4000-8000-000000000004',
  '30000000-0000-4000-a000-000000000001',
  'f0000001-0000-4000-8000-000000000004',
  'Heizungswartung — Jahresinspektion',
  CURRENT_DATE + 1, '14:00', '17:00',
  'bestaetigt',
  'Greifswalder Straße 45, 10405 Berlin', 52.5290, 13.4450
),

-- ── Nächste Woche Montag: Torstraße Nachkontrolle ───────────────────────────
(
  'e1000001-0000-4000-8000-000000000005',
  '30000000-0000-4000-a000-000000000001',
  'f0000001-0000-4000-8000-000000000001',
  'Heizkörper Torstraße — Nachkontrolle',
  CURRENT_DATE + 6, '10:00', '11:30',
  'bestaetigt',
  'Torstraße 14, 10119 Berlin', 52.5270, 13.4041
)
ON CONFLICT (id) DO NOTHING;
