-- Sprint AM Phase 2a — Schema-Grundlage für die generalisierte
-- sequenzielle Direktvergabe (siehe SPRINT-AM-PREISFORMEL-DIREKTVERGABE.md,
-- Abschnitt "Phase 2").
--
-- 1) Neue Tracking-Spalten auf tickets für die Direktvergabe-Kette:
--    - direktvergabe_kandidaten: geordnete Kandidatenliste
--      [{hw_id, score, preis}, ...], von bildeKandidatenliste() einmalig
--      berechnet und dann der Reihe nach abgearbeitet.
--    - direktvergabe_index: Zeiger auf den aktuell angefragten Kandidaten
--      (0-basiert). >= 3 oder >= kandidaten.length -> Mass-Invite-Fallback.
--    - direktvergabe_angefragt_am: Zeitpunkt der aktuellen Anfrage, Basis
--      für die Timeout-Eskalation (Cron "direktvergabe-eskalation").
--    - direktvergabe_timeout_min: Timeout in Minuten, gestaffelt nach
--      Dringlichkeit (notfall=15, zeitnah=120, planbar=1440).
--
-- 2) einladungen.status bekommt den neuen Wert 'abgelaufen' (Timeout ohne
--    Reaktion des HW -> Eskalation zum nächsten Kandidaten / Fallback).
--
-- 3) protect_ticket_fields(): Architektur-Entscheidung für Phase 2 ist,
--    dass ALLE Schreibzugriffe auf die neuen direktvergabe_*-Spalten
--    entweder
--      a) im Verwalter-Kontext laufen (auth.uid() = old.verwalter_id,
--         z.B. /api/auction/start beim initialen Aufbau der
--         Kandidatenliste) — dieser Zweig ist bereits unrestricted und
--         braucht keine Whitelist-Erweiterung, oder
--      b) per Service-Role laufen (Cron "direktvergabe-eskalation",
--         /api/einladungen/[id]/annehmen, /api/einladungen/[id]/ablehnen
--         — analog dem bestehenden Muster in
--         /api/stamm-anfragen/[id]/annehmen) — auth.uid() ist dann NULL
--         und der Trigger gibt ganz am Anfang `return new` zurück.
--
--    Die einzige tatsächlich nötige Trigger-Änderung ist daher eine
--    Defense-in-Depth-Ergänzung im MIETER-Zweig (auth.uid() =
--    old.erstellt_von): die 4 neuen Spalten werden dort wie alle anderen
--    internen Vergabe-Felder auf den alten Wert zurückgesetzt, damit ein
--    Mieter sie nicht über einen generischen Ticket-Update-Endpunkt
--    manipulieren kann (z.B. direktvergabe_index zurücksetzen, um sich
--    erneut an Position 0 der Kette zu drängen).
--
--    Der HW-Zweig (auth.uid() = old.zugewiesener_hw) braucht ebenfalls
--    keine Änderung: er macht "new := old" und übernimmt nur explizit
--    gelistete Felder — neue Spalten werden also automatisch auf den
--    alten Wert zurückgesetzt. Zudem ist old.zugewiesener_hw beim Start
--    einer Direktvergabe-Kette NULL, der Zweig greift für die
--    Annahme-Transition also ohnehin nicht (auth.uid() = NULL ist nie
--    wahr) — die Annahme läuft bewusst über Service-Role (s.o.).

-- 1) Neue Spalten auf tickets
alter table public.tickets
  add column if not exists direktvergabe_kandidaten jsonb,
  add column if not exists direktvergabe_index int not null default 0,
  add column if not exists direktvergabe_angefragt_am timestamptz,
  add column if not exists direktvergabe_timeout_min int;

comment on column public.tickets.direktvergabe_kandidaten is
  'Sprint AM Phase 2: geordnete Kandidatenliste [{hw_id, score, preis}, ...] für die sequenzielle Direktvergabe. NULL = altes Mass-Invite-Flow (Bestandstickets bei Umstellung laufen unverändert aus).';
comment on column public.tickets.direktvergabe_index is
  'Sprint AM Phase 2: 0-basierter Zeiger auf den aktuell angefragten Kandidaten in direktvergabe_kandidaten. >= 3 oder >= Listenlänge -> Mass-Invite-Fallback.';
comment on column public.tickets.direktvergabe_angefragt_am is
  'Sprint AM Phase 2: Zeitpunkt der aktuellen Direktvergabe-Anfrage an Kandidat[direktvergabe_index]. Basis für die Timeout-Eskalation (Cron direktvergabe-eskalation).';
comment on column public.tickets.direktvergabe_timeout_min is
  'Sprint AM Phase 2: Timeout in Minuten für die aktuelle Direktvergabe-Anfrage, gestaffelt nach Dringlichkeit (notfall=15, zeitnah=120, planbar=1440).';

-- 2) einladungen.status: neuer Wert 'abgelaufen' für Timeout-Eskalation
alter table public.einladungen
  drop constraint if exists einladungen_status_check;

alter table public.einladungen
  add constraint einladungen_status_check
  check (status in ('offen', 'angebot', 'abgelehnt', 'abgelaufen'));

-- 3) protect_ticket_fields(): Mieter-Zweig um die 4 neuen Spalten ergänzen
--    (Defense-in-Depth, siehe Begründung oben). Ansonsten unverändert
--    gegenüber 20260614000020_fix_protect_ticket_fields_hw_abschluss.sql.
create or replace function public.protect_ticket_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_befund_text     text;
  v_befund_fotos    text[];
  v_befund_aufwand  numeric;
  v_projekt_angebot numeric;
  v_leistungsumfang text[];
  v_status          text;
  v_korridor_min    numeric;
  v_korridor_max    numeric;
  v_hw_kommentar    text;
  v_hw_abschluss_am timestamptz;
begin
  if auth.uid() is null then return new; end if;
  if pg_trigger_depth() > 1 then return new; end if;
  if public.is_admin() then return new; end if;

  if auth.uid() = old.verwalter_id then
    new.erstellt_von := old.erstellt_von;
    new.verwalter_id := old.verwalter_id;
    return new;
  end if;

  if old.verwalter_id is null and public.is_verwalter() then
    new.erstellt_von := old.erstellt_von;
    if new.verwalter_id is not null and new.verwalter_id <> auth.uid() then
      new.verwalter_id := old.verwalter_id;
    end if;
    return new;
  end if;

  if auth.uid() = old.erstellt_von then
    if old.status != 'offen' then
      raise exception 'Mieter darf Ticket nach Status-Wechsel nicht mehr ändern (status=%)', old.status;
    end if;
    new.status := old.status;
    new.zugewiesener_hw := old.zugewiesener_hw;
    new.kosten_final := old.kosten_final;
    new.surge_faktor := old.surge_faktor;
    new.verwalter_id := old.verwalter_id;
    new.erstellt_von := old.erstellt_von;
    new.auktion_start := old.auktion_start;
    new.auktion_ende := old.auktion_ende;
    new.vorkaufsrecht_bis := old.vorkaufsrecht_bis;
    new.befund_text := old.befund_text;
    new.befund_fotos := old.befund_fotos;
    new.befund_aufwand_stunden := old.befund_aufwand_stunden;
    new.projekt_angebot := old.projekt_angebot;
    new.leistungsumfang := old.leistungsumfang;
    new.preiskorridor_min := old.preiskorridor_min;
    new.preiskorridor_max := old.preiskorridor_max;
    new.diagnosegebuehr_angerechnet := old.diagnosegebuehr_angerechnet;
    new.diagnose_ticket_id := old.diagnose_ticket_id;
    new.ticket_typ := old.ticket_typ;
    new.bewertung_reminder_gesendet := old.bewertung_reminder_gesendet;
    -- Sprint AM Phase 2: interne Direktvergabe-Vergabefelder darf der
    -- Mieter nicht manipulieren.
    new.direktvergabe_kandidaten := old.direktvergabe_kandidaten;
    new.direktvergabe_index := old.direktvergabe_index;
    new.direktvergabe_angefragt_am := old.direktvergabe_angefragt_am;
    new.direktvergabe_timeout_min := old.direktvergabe_timeout_min;
    return new;
  end if;

  if auth.uid() = old.zugewiesener_hw then
    v_befund_text     := new.befund_text;
    v_befund_fotos    := new.befund_fotos;
    v_befund_aufwand  := new.befund_aufwand_stunden;
    v_projekt_angebot := new.projekt_angebot;
    v_leistungsumfang := new.leistungsumfang;
    v_status          := new.status;
    v_korridor_min    := new.preiskorridor_min;
    v_korridor_max    := new.preiskorridor_max;
    v_hw_kommentar    := new.hw_abschluss_kommentar;
    v_hw_abschluss_am := new.hw_abschluss_am;

    new := old;

    new.befund_text             := v_befund_text;
    new.befund_fotos            := v_befund_fotos;
    new.befund_aufwand_stunden  := v_befund_aufwand;
    new.projekt_angebot         := v_projekt_angebot;
    new.leistungsumfang         := v_leistungsumfang;
    new.preiskorridor_min       := v_korridor_min;
    new.preiskorridor_max       := v_korridor_max;

    if v_status = 'in_bearbeitung' and old.status in ('auktion', 'in_bearbeitung') then
      new.status := v_status;
    elsif v_status = 'erledigt' and old.status = 'in_bearbeitung' then
      new.status := v_status;
    elsif v_status = 'fertiggestellt_hw' and old.status = 'in_bearbeitung' then
      new.status := v_status;
      new.hw_abschluss_kommentar := v_hw_kommentar;
      new.hw_abschluss_am := v_hw_abschluss_am;
    end if;

    return new;
  end if;

  raise exception 'Not allowed to update ticket %', old.id;
end;
$function$;
