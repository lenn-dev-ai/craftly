-- ============================================================
-- Reparo: tickets.frist_warnung_gesendet — Dedup-Marker für 10-Tage-
-- Frühwarnung im abwicklungsfrist-Cron (LT-9).
-- ============================================================
-- Vor dieser Spalte würde der Cron-Job jeden Tag erneut eine Warnung
-- senden — Spam. Marker setzen sobald die erste Warnung raus ist,
-- kein zweiter Send mehr.
-- Cleanup-Logik: bei status='erledigt' bleibt der Marker stehen
-- (egal — Ticket wird nicht mehr betrachtet). Bei status='auktion'
-- (Frist abgelaufen, HW raus) bleibt er auch — wenn der nächste HW
-- übernimmt, ist es ein neuer Auftrag mit eigenem created_at.
-- ============================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS frist_warnung_gesendet boolean NOT NULL DEFAULT false;

-- Index nur sinnvoll wenn nach Warnung-Status gefiltert wird. Der Cron
-- filtert eh nach status + created_at; ein zusätzlicher Index lohnt
-- nicht bei wenigen Hundert Tickets.
