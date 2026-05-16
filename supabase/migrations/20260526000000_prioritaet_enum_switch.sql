-- ============================================================
-- Reparo: tickets.prioritaet auf planbar/zeitnah/notfall vereinheitlichen
-- ============================================================
-- LT-2 aus dem Live-Test-Audit: Die App hatte zwei parallele Enums
-- für dieselbe Sache:
--   - tickets.prioritaet IN ('normal','hoch','dringend')  ← DB-CHECK alt
--   - tickets.dringlichkeit IN ('notfall','zeitnah','planbar')  ← Auktion neu
--   - KI-API liefert notfall/zeitnah/planbar
--   - UI-Labels längst "Planbar/Zeitnah/Notfall"
--
-- Die Compat-Schicht (KI_PRIO_MAP in melden/page.tsx) hat das überbrückt,
-- aber das ist Schuld die früher oder später kollidiert. Diese Migration
-- vereinheitlicht auf planbar/zeitnah/notfall — den Audit-Wunsch-Wert.
--
-- Strategie (sicher):
--   1. CHECK-Constraint ADDITIV erweitern — beide Sets erlaubt
--   2. Backfill bestehender Daten: normal→planbar, hoch→zeitnah, dringend→notfall
--   3. Default auf 'planbar'
--   4. CHECK später (eigene Migration) auf nur neue Werte restriktiv —
--      sobald sicher ist dass kein Code mehr alte Werte schreibt.
--
-- Damit ist die Migration backwards-compatible: alte Bookmarks/Backups
-- mit normal/hoch/dringend funktionieren weiter, neue Inserts nutzen
-- die neuen Werte.
-- ============================================================

-- Schritt 1: CHECK additiv erweitern
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_prioritaet_check;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_prioritaet_check
  CHECK (prioritaet IN ('normal','hoch','dringend','planbar','zeitnah','notfall'));

-- Schritt 2: Backfill — alte Werte auf neue mappen
UPDATE public.tickets
   SET prioritaet = CASE prioritaet
     WHEN 'normal'   THEN 'planbar'
     WHEN 'hoch'     THEN 'zeitnah'
     WHEN 'dringend' THEN 'notfall'
     ELSE prioritaet
   END
 WHERE prioritaet IN ('normal','hoch','dringend');

-- Schritt 3: Default auf 'planbar' (statt 'normal')
ALTER TABLE public.tickets
  ALTER COLUMN prioritaet SET DEFAULT 'planbar';

-- Verifikation (manuell in Studio):
--   SELECT prioritaet, count(*) FROM tickets GROUP BY prioritaet;
--   → erwartet: nur planbar/zeitnah/notfall (oder leer wenn DB neu)
