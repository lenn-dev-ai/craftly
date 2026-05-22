// C3: Diagnose-API ist in /api/auftraege/* gemergt (Diagnose ist nur eine
// Phase eines Auftrags, keine eigene Entität). Diese Route bleibt als
// Wrapper für Übergangs-Kompatibilität — alte Clients/Bookmarks landen
// transparent auf der neuen Implementierung. Kann nach 2 Wochen Beta
// entfernt werden, wenn keine alten Aufrufer mehr da sind.
export { POST } from "@/app/api/auftraege/diagnose-termin-annehmen/route"
