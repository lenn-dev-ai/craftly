-- Sprint AS Finding D16: zeitslot_gebote — keine aktiven Code-Referenzen mehr.
-- Yield-Management-Feature (Sprint K/L) wurde nie live ausgerollt.
-- lib/yield-management.ts (einziger Consumer) in Sprint AS gelöscht.
-- Tabelle zeitslots bleibt (HW-Kalender-Feature noch aktiv).

DROP TABLE IF EXISTS public.zeitslot_gebote CASCADE;
