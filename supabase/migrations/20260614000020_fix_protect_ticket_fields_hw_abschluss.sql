-- Sprint AL — Fix: protect_ticket_fields() kannte den neuen Status
-- "fertiggestellt_hw" (Feature #216, Handwerker-Self-Service-Abschluss)
-- noch nicht.
--
-- Symptom: Wenn der Handwerker auf "Arbeit abgeschlossen melden" klickt,
-- führt das Frontend ein UPDATE auf tickets aus (status -> fertiggestellt_hw,
-- hw_abschluss_kommentar, hw_abschluss_am). Das UPDATE läuft ohne Fehler durch
-- (PostgREST liefert bei return=minimal kein Fehlerobjekt), aber der
-- BEFORE-UPDATE-Trigger trg_protect_ticket_fields setzt für den Handwerker-Pfad
-- "NEW := OLD" und übernimmt NEW.status nur bei den fest verdrahteten
-- Übergängen (auktion/in_bearbeitung -> in_bearbeitung, in_bearbeitung ->
-- erledigt). Der neue Übergang in_bearbeitung -> fertiggestellt_hw fehlte in
-- dieser Whitelist, also wurde status/hw_abschluss_kommentar/hw_abschluss_am
-- klammheimlich auf die alten Werte zurückgesetzt — der Verwalter sah nie ein
-- Bestätigungs-Banner und der Mieter nie "Wird geprüft".
--
-- Fix: zusätzlichen erlaubten Übergang
--   v_status = 'fertiggestellt_hw' AND OLD.status = 'in_bearbeitung'
-- ergänzen und dabei hw_abschluss_kommentar/hw_abschluss_am aus NEW
-- übernehmen (sonst würden auch diese beiden neuen Spalten durch
-- "NEW := OLD" verworfen).

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
