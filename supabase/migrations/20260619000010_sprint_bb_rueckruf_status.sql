-- Sprint BB: rueckruf_status für Voice-AI V2 Outbound-Rückruf
-- Tracks ob nach Ticket-Erstellung ein Vapi-Rückruf an den Mieter
-- initiiert wurde (lückenhafte Tickets → KI klärt fehlende Infos).
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS rueckruf_status TEXT
    NOT NULL DEFAULT 'idle'
    CHECK (rueckruf_status IN (
      'idle',          -- Standard, kein Rückruf geplant
      'geplant',       -- Vapi-Call initiiert, Mieter klingelt noch
      'durchgefuehrt', -- Gespräch abgeschlossen, Infos ggf. ergänzt
      'fehlgeschlagen', -- Kein Abnehmer / Vapi-Fehler
      'nicht_noetig'   -- Ticket war vollständig, kein Rückruf nötig
    ));
