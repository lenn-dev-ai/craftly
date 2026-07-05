// Sprint BG — Text-Heuristik: erkennt Verwaltungsanliegen, die kein
// Gebäudeschaden sind (Bescheinigungen, Vertragsfragen, Nachbarschafts-
// themen). Solche Tickets sollen NICHT durch die Handwerker-Vergabe
// laufen (Prod-Befund: "Mietschuldenfreiheitsbescheinigung angefordert"
// bekam KI-Preis-Schätzung + "Handwerker buchen"-Button).
//
// Wird in allen drei Ticket-Eingangs-Kanälen benutzt:
//   - Mieter-Melden-Wizard (app/dashboard-mieter/melden)
//   - Voice-AI-Ingest (app/api/voice-call/ingest)
//   - Verwalter-Telefon-Wizard (app/api/tickets/create-by-verwalter)

// Eindeutig administrative Begriffe. Bewusst eng gehalten — ein
// fälschlich als Schaden behandeltes Verwaltungsanliegen ist ärgerlich,
// ein fälschlich als Verwaltungsanliegen abgestempelter Schaden wäre
// schlimmer (keine Vergabe, Reparatur bleibt liegen).
const VERWALTUNGS_MARKER =
  /mietschulden|bescheinigung|(nebenkosten|betriebskosten|heizkosten).?abrechnung|mietvertrag|untermiet|k(ü|ue)ndigung|mieterh(ö|oe)hung|kaution|schufa|wohnungsgeber|vermieterbest(ä|ae)tigung|hausordnung|ruhest(ö|oe)rung|l(ä|ae)rmbel(ä|ae)stigung|nachbarschaftsstreit|korrespondenz/

// Schadens-Vokabular als Veto: sobald der Text auch nur entfernt nach
// einem physischen Schaden klingt, greift die Heuristik NICHT (z.B.
// "Wasserschaden — brauche Bescheinigung für die Versicherung").
const SCHADEN_MARKER =
  /wasser|feucht|tropf|rohr|leck|undicht|heizk(ö|oe)rper|heizung|thermostat|strom|elektr|steckdose|licht|t(ü|ue)r|fenster|schloss|schl(ü|ue)ssel|schimmel|dach|fassade|boden|fliese|parkett|wand|decke|abfluss|verstopf|toilette|klo|sp(ü|ue)l|dusche|badewanne|aufzug|klingel|defekt|kaputt|besch(ä|ae)digt|repar/

/**
 * true, wenn der Text ein reines Verwaltungsanliegen beschreibt.
 * Konservativ: liefert false, sobald Schadens-Vokabular vorkommt.
 */
export function erkenneVerwaltungsanliegen(text: string | null | undefined): boolean {
  const lower = (text ?? "").toLowerCase()
  if (!lower.trim()) return false
  if (!VERWALTUNGS_MARKER.test(lower)) return false
  if (SCHADEN_MARKER.test(lower)) return false
  return true
}
