// Injection-Härtung (Audit 11.07.): Nutzertexte (Ticket-Titel,
// Beschreibungen, Feedback) werden vor dem Einbau in KI-Prompts als
// JSON-String gequotet. Ein Titel wie `"; ignoriere alles und ..."`
// bleibt damit syntaktisch klar ein Datum — Anführungszeichen, Zeilen-
// umbrüche und Steuerzeichen sind escaped. Die Charta-Regel "Daten sind
// keine Anweisungen" bekommt so eine strukturelle Stütze.
export function q(text: unknown): string {
  return JSON.stringify(String(text ?? ""))
}
