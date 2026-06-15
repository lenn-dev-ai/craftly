-- ════════════════════════════════════════════════════════════════
-- Showcase-Set: Direktvergabe-First-Flow (Sprint AM)
-- Angelegt 2026-06-15 — ersetzt das veraltete DEMO_DATA_showcase_tickets.sql
-- ════════════════════════════════════════════════════════════════
--
-- 7 Tickets auf die 3 Demo-Verwalter verteilt, alle realistischen
-- Berlin-Adressen. Preise und Smart-Scores per Formel berechnet
-- (lib/pricing/auftragswert.ts + lib/auction/smart-score.ts):
--
--   Handwerker-Pool:
--     HW-1 "Demo Handwerker 1"  heizung_sanitaer  lat=52.520 lng=13.405  stundensatz=65
--     HW-2 "Demo Handwerker 2"  elektro           lat=52.497 lng=13.325  stundensatz=60
--     HW-3 "Demo Handwerker 3"  maler             lat=52.541 lng=13.415  stundensatz=55
--     HW-4 "Handwerker 1"       heizung_sanitaer  lat=52.497 lng=13.325  stundensatz=55
--
--   TICKET-ÜBERSICHT:
--     T1  Verwalter 1  "Heizung warm genug?"         zeitnah  heizung_sanitaer  → Direktvergabe läuft (HW-1 invited, offen)
--     T2  Verwalter 1  "Feuchtigkeitsschäden Keller"  planbar  heizung_sanitaer  → Auktion Fallback (beide HW timed out)
--     T3  Verwalter 2  "Schranktüren klemmen"         planbar  schreiner         → Kein HW (auktion, 0 einladungen)
--     T4  Verwalter 2  "Steckdose im Bad"             zeitnah  elektro           → Angebote_da (HW-2 hat geboten)
--     T5  Verwalter 3  "Wohnzimmer streichen"         planbar  maler             → In Bearbeitung (HW-3 zugewiesen)
--     T6  Verwalter 3  "Heizungsanlage ausgefallen"   zeitnah  heizung_sanitaer  → Erledigt + 4-Sterne-Bewertung
--     T7  Verwalter 3  "Lichtschalter im Flur defekt" zeitnah  elektro           → Erledigt + 5-Sterne-Bewertung
--
-- IDEMPOTENT: ON CONFLICT (id) DO NOTHING überall.
-- CLEANUP:    DELETE FROM tickets WHERE id LIKE 'b0000%';
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── Demo-Verwalter-Kurzreferenz ───────────────────────────────────────────────
-- V1: 20000000-0000-4000-a000-000000000001
-- V2: 20000000-0000-4000-a000-000000000002
-- V3: 20000000-0000-4000-a000-000000000003
-- M1: 10000000-0000-4000-a000-000000000001
-- M2: 10000000-0000-4000-a000-000000000002
-- M3: 10000000-0000-4000-a000-000000000003
-- HW1: 30000000-0000-4000-a000-000000000001  (heizung_sanitaer, Mitte, stundensatz=65)
-- HW2: 30000000-0000-4000-a000-000000000002  (elektro, Kreuzberg, stundensatz=60)
-- HW3: 30000000-0000-4000-a000-000000000003  (maler, Prenzlauer Berg, stundensatz=55)
-- HW4: b71bb886-860b-4240-a006-41b7c7060976  (heizung_sanitaer, Kreuzberg, stundensatz=55)

-- ════════════════════════════════════════════════════════════════
-- 1. TICKETS
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.tickets (
  id, titel, beschreibung, status, prioritaet, dringlichkeit, vergabemodus, wohnung,
  erstellt_von, verwalter_id, gewerk,
  einsatzort_adresse, einsatzort_lat, einsatzort_lng,
  surge_faktor,
  direktvergabe_kandidaten, direktvergabe_index,
  direktvergabe_angefragt_am, direktvergabe_timeout_min,
  auktion_start, auktion_ende,
  zugewiesener_hw, kosten_final,
  created_at
) VALUES

-- ── T1: Direktvergabe läuft ───────────────────────────────────────────────────
-- Torstr. 14, 10119 Berlin · V1 · M1
-- zeitnah / heizung_sanitaer  → radiusKm=15, surgeFaktor=1.1, estimatedH=2
-- Kandidaten (im 15km-Radius):
--   HW-1  dist=0.78 km  fahrzeit=1 min  anfahrt=0 €  preis=max(80,round(65×2×1.1+0))=143
--   HW-4  dist=6.31 km  fahrzeit=9 min  anfahrt=0 €  preis=max(80,round(55×2×1.1+0))=121
-- durchschnittPreis=(143+121)/2=132
-- SmartScore zeitnah (preis:0.4 naehe:0.35 bew:0.25) × angebotstreue-Default(×1.10):
--   HW-1: preis=(1-(143/132−0.5))×100=41.7  naehe=(1−0.78/15)×100=94.8  bew=60
--         grundScore=41.7×0.4+94.8×0.35+60×0.25=64.86  ×1.1=71.35
--   HW-4: preis=(1-(121/132−0.5))×100=58.3  naehe=(1−6.31/15)×100=57.9  bew=60
--         grundScore=58.3×0.4+57.9×0.35+60×0.25=58.59  ×1.1=64.45
-- → HW-1 ist Top-Kandidat (Index 0), Einladung offen seit ~2 h, timeout=120 min (zeitnah)
(
  'b0000001-0000-4000-8000-000000000001',
  'Heizung gibt kaum noch Wärme ab',
  'Mieter meldet: Heizkörper in allen Räumen wird seit gestern deutlich weniger warm als sonst. Thermostat auf Maximum gestellt, hilft nicht. Andere Mieter im Haus nicht betroffen.',
  'offen', 'zeitnah', 'zeitnah', 'direkt', 'Wohnung 3B',
  '10000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000001',
  'heizung_sanitaer',
  'Torstraße 14, 10119 Berlin', 52.5270, 13.4041,
  1.1,
  '[{"hw_id":"30000000-0000-4000-a000-000000000001","score":71.35,"preis":143},{"hw_id":"b71bb886-860b-4240-a006-41b7c7060976","score":64.45,"preis":121}]'::jsonb,
  0,
  now() - interval '2 hours', 120,
  NULL, NULL,
  NULL, NULL,
  now() - interval '2 hours 5 minutes'
),

-- ── T2: Auktion-Fallback (Direktvergabe erschöpft) ────────────────────────────
-- Kantstr. 88, 10623 Berlin · V1 · M2
-- planbar / heizung_sanitaer  → radiusKm=25, surgeFaktor=1.0, estimatedH=3
-- Kandidaten:
--   HW-4  dist=0.98 km  fahrzeit=1 min  anfahrt=0 €  preis=max(80,round(55×3×1.0+0))=165
--   HW-1  dist=6.09 km  fahrzeit=9 min  anfahrt=0 €  preis=max(80,round(65×3×1.0+0))=195
-- durchschnittPreis=(165+195)/2=180
-- SmartScore planbar (gleiche Gewichte: preis:0.4 naehe:0.35 bew:0.25):
--   HW-4: preis=(1-(165/180−0.5))×100=58.3  naehe=(1−0.98/25)×100=96.1  bew=60
--         grundScore=58.3×0.4+96.1×0.35+60×0.25=71.96  ×1.1=79.15
--   HW-1: preis=(1-(195/180−0.5))×100=41.7  naehe=(1−6.09/25)×100=75.6  bew=60
--         grundScore=41.7×0.4+75.6×0.35+60×0.25=58.14  ×1.1=63.95
-- → HW-4 Index 0 (timed out → abgelaufen → mass_invite), HW-1 Index 1 (timed out → fallback)
-- → naechsterIndex=2 >= length=2 → fuehreMassInviteFallback → status='auktion'
-- → Mass-Invite hat beide Einladungen als 'offen' wieder geöffnet
(
  'b0000001-0000-4000-8000-000000000002',
  'Feuchtigkeitsschäden im Keller',
  'Verwalter: Im Keller von Einheit 7 zeigen sich seit 2 Wochen Feuchtigkeitsflecken an der Nordwand. Keine akute Wasserleckage erkennbar, aber Schimmelgefahr. Bitte Ursache klären und Sanierungsplan erstellen.',
  'auktion', 'planbar', 'planbar', 'direkt', 'Wohnung 7',
  '10000000-0000-4000-a000-000000000002',
  '20000000-0000-4000-a000-000000000001',
  'heizung_sanitaer',
  'Kantstraße 88, 10623 Berlin', 52.5044, 13.3186,
  1.0,
  '[{"hw_id":"b71bb886-860b-4240-a006-41b7c7060976","score":79.15,"preis":165},{"hw_id":"30000000-0000-4000-a000-000000000001","score":63.95,"preis":195}]'::jsonb,
  1,
  now() - interval '27 hours', 1440,
  now() - interval '3 hours', now() + interval '69 hours',
  NULL, NULL,
  now() - interval '1 day 3 hours'
),

-- ── T3: Kein passender Handwerker (schreiner) ─────────────────────────────────
-- Boxhagener Str. 30, 10245 Berlin · V2 · M3
-- planbar / schreiner  → bildeKandidatenliste() → 0 Treffer → mass_invite sofort
-- → mass_invite findet ebenfalls keinen Schreiner → 0 Einladungen
-- Dashboard-Hinweis: "Keine passenden Handwerker im Umkreis gefunden"
(
  'b0000002-0000-4000-8000-000000000001',
  'Schranktüren klemmen und schließen nicht mehr',
  'Mieter meldet: Schiebetür des Einbauschranks im Schlafzimmer lässt sich nicht mehr richtig schließen, hängt aus der Führung. Kein Notfall, aber nervig. Schreiner gesucht.',
  'auktion', 'planbar', 'planbar', 'direkt', 'Wohnung 5',
  '10000000-0000-4000-a000-000000000003',
  '20000000-0000-4000-a000-000000000002',
  'schreiner',
  'Boxhagener Straße 30, 10245 Berlin', 52.5125, 13.4594,
  1.0,
  '[]'::jsonb,
  0,
  now() - interval '6 hours', 1440,
  now() - interval '6 hours', now() + interval '66 hours',
  NULL, NULL,
  now() - interval '6 hours 10 minutes'
),

-- ── T4: Angebote_da (Verwalter muss vergeben) ─────────────────────────────────
-- Oranienstr. 22, 10999 Berlin · V2 · M2
-- zeitnah / elektro  → radiusKm=15, surgeFaktor=1.1, estimatedH=2
-- Kandidaten:
--   HW-2  dist=6.69 km  fahrzeit=10 min  anfahrt=0 €  preis=max(80,round(60×2×1.1+0))=132
-- durchschnittPreis=132 (1 Kandidat)
-- SmartScore: preis=50.0  naehe=(1−6.69/15)×100=55.4  bew=60
--   grundScore=50×0.4+55.4×0.35+60×0.25=54.39  ×1.1=59.83
-- → Direktvergabe: HW-2 Index 0 → timed out → naechsterIndex=1 >= length=1 → fallback
-- → Mass-Invite: HW-2 erneut eingeladen → HW-2 hat Angebot bei 120 € eingereicht
-- → Auktionslaufzeit 48h (zeitnah) abgelaufen → status='angebote_da'
(
  'b0000002-0000-4000-8000-000000000002',
  'Steckdose im Bad gibt keinen Strom mehr',
  'Mieter meldet: Die Steckdose neben dem Waschbecken im Bad ist seit heute Morgen tot. Sicherung im Kasten überprüft — alles auf ON. Haartrockner und Rasierer können nicht mehr aufgeladen werden.',
  'angebote_da', 'zeitnah', 'zeitnah', 'direkt', 'Wohnung 2C',
  '10000000-0000-4000-a000-000000000002',
  '20000000-0000-4000-a000-000000000002',
  'elektro',
  'Oranienstraße 22, 10999 Berlin', 52.4983, 13.4242,
  1.1,
  '[{"hw_id":"30000000-0000-4000-a000-000000000002","score":59.83,"preis":132}]'::jsonb,
  0,
  now() - interval '50 hours', 120,
  now() - interval '50 hours', now() - interval '2 hours',
  NULL, NULL,
  now() - interval '52 hours'
),

-- ── T5: In Bearbeitung ────────────────────────────────────────────────────────
-- Karl-Marx-Str. 101, 12043 Berlin · V3 · M3
-- planbar / maler  → radiusKm=25, surgeFaktor=1.0, estimatedH=3
-- Kandidaten:
--   HW-3  dist=6.50 km  fahrzeit=10 min  anfahrt=0 €  preis=max(80,round(55×3×1.0+0))=165
-- durchschnittPreis=165 (1 Kandidat)
-- SmartScore: preis=50.0  naehe=(1−6.50/25)×100=74.0  bew=60
--   grundScore=50×0.4+74×0.35+60×0.25=60.9  ×1.1=66.99
-- → HW-3 (Index 0) hat Einladung angenommen → in_bearbeitung
(
  'b0000003-0000-4000-8000-000000000001',
  'Wohnzimmer und Flur frisch streichen',
  'Verwalter: Wohnung wurde neu vermietet, Vorvermietung hat Wände stark beschädigt (Dübellöcher, Abriebspuren). Wohnzimmer + Flur sollen gestrichen werden, Farbe: Weiß RAL 9010.',
  'in_bearbeitung', 'planbar', 'planbar', 'direkt', 'Wohnung 1A',
  '10000000-0000-4000-a000-000000000003',
  '20000000-0000-4000-a000-000000000003',
  'maler',
  'Karl-Marx-Straße 101, 12043 Berlin', 52.4833, 13.4333,
  1.0,
  '[{"hw_id":"30000000-0000-4000-a000-000000000003","score":66.99,"preis":165}]'::jsonb,
  0,
  now() - interval '5 days', 1440,
  NULL, NULL,
  '30000000-0000-4000-a000-000000000003', 165,
  now() - interval '5 days 2 hours'
),

-- ── T6: Erledigt + Bewertung (4 Sterne) ──────────────────────────────────────
-- Brunnenstr. 12, 10115 Berlin · V3 · M1
-- zeitnah / heizung_sanitaer  → radiusKm=15, surgeFaktor=1.1, estimatedH=2
-- Kandidaten:
--   HW-1  dist=0.90 km  fahrzeit=1 min  anfahrt=0 €  preis=max(80,round(65×2×1.1+0))=143
--   HW-4  dist=6.30 km  fahrzeit=9 min  anfahrt=0 €  preis=max(80,round(55×2×1.1+0))=121
-- durchschnittPreis=(143+121)/2=132
-- SmartScore:
--   HW-1: preis=(1-(143/132−0.5))×100=41.7  naehe=(1−0.90/15)×100=94.0  bew=60
--         grundScore=41.7×0.4+94×0.35+60×0.25=64.58  ×1.1=71.04
--   HW-4: preis=(1-(121/132−0.5))×100=58.3  naehe=(1−6.30/15)×100=58.0  bew=60
--         grundScore=58.3×0.4+58×0.35+60×0.25=58.62  ×1.1=64.48
-- → HW-1 (Index 0) invited, akzeptiert, Auftrag erledigt
(
  'b0000003-0000-4000-8000-000000000002',
  'Heizungsanlage ausgefallen — alle Heizkörper kalt',
  'Mieter meldet: Seit heute Morgen 6 Uhr keine Heizung mehr in der gesamten Wohnung. Warmwasser funktioniert noch. Thermostate zeigen Raumtemperatur, Anlage scheint nicht zu reagieren.',
  'erledigt', 'zeitnah', 'zeitnah', 'direkt', 'Wohnung 4',
  '10000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000003',
  'heizung_sanitaer',
  'Brunnenstraße 12, 10115 Berlin', 52.5280, 13.4030,
  1.1,
  '[{"hw_id":"30000000-0000-4000-a000-000000000001","score":71.04,"preis":143},{"hw_id":"b71bb886-860b-4240-a006-41b7c7060976","score":64.48,"preis":121}]'::jsonb,
  0,
  now() - interval '14 days', 120,
  NULL, NULL,
  '30000000-0000-4000-a000-000000000001', 143,
  now() - interval '14 days 1 hour'
),

-- ── T7: Erledigt + Bewertung (5 Sterne) ──────────────────────────────────────
-- Bergmannstr. 15, 10961 Berlin · V3 · M2
-- zeitnah / elektro  → radiusKm=15, surgeFaktor=1.1, estimatedH=2
-- Kandidaten:
--   HW-2  dist=4.23 km  fahrzeit=6 min  anfahrt=0 €  preis=max(80,round(60×2×1.1+0))=132
-- durchschnittPreis=132 (1 Kandidat)
-- SmartScore: preis=50.0  naehe=(1−4.23/15)×100=71.8  bew=60
--   grundScore=50×0.4+71.8×0.35+60×0.25=60.13  ×1.1=66.14
-- → HW-2 (Index 0) invited, akzeptiert, Auftrag erledigt
(
  'b0000003-0000-4000-8000-000000000003',
  'Lichtschalter im Flur schaltet nicht mehr',
  'Mieter meldet: Lichtschalter im Flur reagiert nicht mehr zuverlässig — manchmal klappt es beim zweiten Drücken, manchmal gar nicht. Sicherheitsrelevant in dunklem Flur.',
  'erledigt', 'zeitnah', 'zeitnah', 'direkt', 'Wohnung 2',
  '10000000-0000-4000-a000-000000000002',
  '20000000-0000-4000-a000-000000000003',
  'elektro',
  'Bergmannstraße 15, 10961 Berlin', 52.4900, 13.3870,
  1.1,
  '[{"hw_id":"30000000-0000-4000-a000-000000000002","score":66.14,"preis":132}]'::jsonb,
  0,
  now() - interval '7 days', 120,
  NULL, NULL,
  '30000000-0000-4000-a000-000000000002', 132,
  now() - interval '7 days 1 hour'
)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- 2. EINLADUNGEN
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.einladungen (id, ticket_id, handwerker_id, status, empfohlener_preis, created_at)
VALUES

-- T1: HW-1 eingeladen (Direktvergabe Index 0, noch offen)
(
  'c0000001-0000-4000-8000-000000000001',
  'b0000001-0000-4000-8000-000000000001',
  '30000000-0000-4000-a000-000000000001',
  'offen', 143,
  now() - interval '2 hours'
),

-- T2: HW-4 (Index 0, timed out → mass_invite re-opened)
(
  'c0000001-0000-4000-8000-000000000002',
  'b0000001-0000-4000-8000-000000000002',
  'b71bb886-860b-4240-a006-41b7c7060976',
  'offen', 165,
  now() - interval '3 hours'
),
-- T2: HW-1 (Index 1, timed out → mass_invite re-opened)
(
  'c0000001-0000-4000-8000-000000000003',
  'b0000001-0000-4000-8000-000000000002',
  '30000000-0000-4000-a000-000000000001',
  'offen', 195,
  now() - interval '3 hours'
),

-- T4: HW-2 hat geboten (angebot)
(
  'c0000002-0000-4000-8000-000000000001',
  'b0000002-0000-4000-8000-000000000002',
  '30000000-0000-4000-a000-000000000002',
  'angebot', 132,
  now() - interval '50 hours'
),

-- T5: HW-3 hat angenommen
(
  'c0000003-0000-4000-8000-000000000001',
  'b0000003-0000-4000-8000-000000000001',
  '30000000-0000-4000-a000-000000000003',
  'angebot', 165,
  now() - interval '5 days'
),

-- T6: HW-1 hat angenommen
(
  'c0000003-0000-4000-8000-000000000002',
  'b0000003-0000-4000-8000-000000000002',
  '30000000-0000-4000-a000-000000000001',
  'angebot', 143,
  now() - interval '14 days'
),

-- T7: HW-2 hat angenommen
(
  'c0000003-0000-4000-8000-000000000003',
  'b0000003-0000-4000-8000-000000000003',
  '30000000-0000-4000-a000-000000000002',
  'angebot', 132,
  now() - interval '7 days'
)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- 3. ANGEBOTE
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.angebote (
  id, ticket_id, handwerker_id, preis, status,
  smart_score, entfernung_km, fahrzeit_min, ist_routen_bonus,
  nachricht, created_at
) VALUES

-- T4: HW-2, preis=120 (leicht unter empfohlenem Systempreis von 132)
(
  'd0000002-0000-4000-8000-000000000001',
  'b0000002-0000-4000-8000-000000000002',
  '30000000-0000-4000-a000-000000000002',
  120, 'eingereicht',
  59.83, 6.69, 10, false,
  'Kann morgen früh um 8 Uhr vorbeikommen.',
  now() - interval '46 hours'
),

-- T5: HW-3, preis=165 (Systempreis), angenommen
(
  'd0000003-0000-4000-8000-000000000001',
  'b0000003-0000-4000-8000-000000000001',
  '30000000-0000-4000-a000-000000000003',
  165, 'angenommen',
  66.99, 6.50, 10, false,
  'Gerne — ich bringe alle Materialien mit.',
  now() - interval '4 days 22 hours'
),

-- T6: HW-1, preis=143, angenommen
(
  'd0000003-0000-4000-8000-000000000002',
  'b0000003-0000-4000-8000-000000000002',
  '30000000-0000-4000-a000-000000000001',
  143, 'angenommen',
  71.04, 0.90, 1, false,
  'Bin in 20 Minuten da.',
  now() - interval '13 days 23 hours'
),

-- T7: HW-2, preis=132, angenommen
(
  'd0000003-0000-4000-8000-000000000003',
  'b0000003-0000-4000-8000-000000000003',
  '30000000-0000-4000-a000-000000000002',
  132, 'angenommen',
  66.14, 4.23, 6, false,
  'Komme heute Nachmittag vorbei.',
  now() - interval '6 days 22 hours'
)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- 4. BEWERTUNGEN
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.bewertungen (id, ticket_id, handwerker_id, bewerter_id, sterne, kommentar, created_at)
VALUES

-- T6: Verwalter bewertet HW-1 mit 4 Sternen
(
  'e0000003-0000-4000-8000-000000000002',
  'b0000003-0000-4000-8000-000000000002',
  '30000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000003',
  4,
  'Schnell vor Ort, Problem gefunden und behoben. Kleinigkeit: ein Ersatzteil musste nachbestellt werden, daher einen Tag länger als geplant.',
  now() - interval '12 days'
),

-- T7: Verwalter bewertet HW-2 mit 5 Sternen
(
  'e0000003-0000-4000-8000-000000000003',
  'b0000003-0000-4000-8000-000000000003',
  '30000000-0000-4000-a000-000000000002',
  '20000000-0000-4000-a000-000000000003',
  5,
  'Perfekt! Kam pünktlich, hat den Schalter schnell ausgetauscht und den Bereich sauber hinterlassen. Sehr empfehlenswert.',
  now() - interval '6 days'
)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- 5. HANDWERKER-STATS AKTUALISIEREN
-- ════════════════════════════════════════════════════════════════
-- Abgeschlossene Aufträge aus T6 (HW-1) und T7 (HW-2) spiegeln sich
-- in den Profil-Kennzahlen wider, damit Einnahmen- und Sichtbarkeits-
-- Dashboards nicht bei 0 bleiben.

UPDATE public.profiles SET
  auftraege_anzahl = 1,
  bewertung_avg    = 4.0
WHERE id = '30000000-0000-4000-a000-000000000001';  -- HW-1

UPDATE public.profiles SET
  auftraege_anzahl = 1,
  bewertung_avg    = 5.0
WHERE id = '30000000-0000-4000-a000-000000000002';  -- HW-2

COMMIT;
