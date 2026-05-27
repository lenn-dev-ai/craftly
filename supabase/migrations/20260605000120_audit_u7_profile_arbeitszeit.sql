-- Audit-U7 (27.05.2026) — Arbeitszeit-Fenster pro HW.
--
-- Production hat diese Spalten per Studio bekommen (Sprint AK / commit
-- 78e265e, U7-Block), aber kein Migration-File im Repo. Idempotente
-- Backfill für lokale Branches + Disaster-Recovery.
--
-- Lese-Pfad: app/dashboard-handwerker/kalender/page.tsx ersetzt die alten
-- STUNDE_VON/BIS-Konstanten durch arbVon/arbBis aus dem Profil. Schreib-
-- Pfad: app/dashboard-handwerker/profil/page.tsx Card "Arbeitszeit-Fenster"
-- mit zwei Number-Inputs. Fallback auf 7/20 wenn ungültig (Component-Logik).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS arbeitszeit_von smallint DEFAULT 7,
  ADD COLUMN IF NOT EXISTS arbeitszeit_bis smallint DEFAULT 20;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_arbeitszeit_range_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_arbeitszeit_range_check
  CHECK (
    arbeitszeit_von IS NULL OR (arbeitszeit_von >= 0 AND arbeitszeit_von <= 23)
  ) NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_arbeitszeit_range_check;
