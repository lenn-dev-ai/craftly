-- Health-Fix Sprint 2026-06-09: Demo-Handwerker-Profile vervollständigen
-- Vorher: lat/lng null → keine Radius-Treffer; HW-1 & HW-3 ohne Gewerk.
-- Idempotent: UPDATE per E-Mail-Match. Bereits live auf Production angewendet
-- am 2026-06-09 (manuell via SQL-Editor) — File für Reproduzierbarkeit.

-- Demo Handwerker 1 (Sanitär & Heizung, Berlin-Mitte)
UPDATE public.profiles SET
  gewerk            = 'heizung_sanitaer',
  basis_stundensatz = 65,
  lat               = 52.5200,
  lng               = 13.4050,
  radius_km         = 40,
  name              = 'Demo Handwerker 1'
WHERE email = 'demo-handwerker-1@reparo-demo.de';

-- Demo Handwerker 2 (Elektro, Berlin-Kreuzberg)
UPDATE public.profiles SET
  gewerk            = 'elektro',
  basis_stundensatz = 60,
  lat               = 52.4966,
  lng               = 13.3253,
  radius_km         = 40
WHERE email = 'demo-handwerker-2@reparo-demo.de';

-- Demo Handwerker 3 (Maler, Berlin-Prenzlauer Berg)
UPDATE public.profiles SET
  gewerk            = 'maler',
  basis_stundensatz = 55,
  lat               = 52.5408,
  lng               = 13.4147,
  radius_km         = 40
WHERE email = 'demo-handwerker-3@reparo-demo.de';
