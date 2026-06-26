// Gemeinsame Vapi-Assistant-Config für Telefon UND Web-Call.
//
// Wird genutzt von:
//   - app/api/vapi/hw-assistant (assistant-request beim Telefon-Anruf)
//   - app/api/vapi/web-call-config (Web-Voice-Button in der HW-App)
//
// Web-Calls haben KEINE Telefonnummer → der HW kann beim tool-call nicht
// per Caller-Nummer identifiziert werden. Lösung: die Tool-Server-URL trägt
// den hwId als Query-Param (`?hwId=...`), den der hw-assistant-Handler beim
// tool-call ausliest (Fallback bleibt die Caller-Nummer fürs Telefon).

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reparo-app.netlify.app"

export interface VapiHwLite {
  id: string
  name: string | null
}

/**
 * Baut die personalisierte Vapi-Assistant-Config für einen Handwerker
 * (oder eine neutrale Config, wenn der HW unbekannt ist).
 *
 * WICHTIG (gegen Vapi-Schema verifiziert):
 *   - transcriber nova-2 (nova-2-phonecall kann KEIN Deutsch → stille Ablehnung)
 *   - tools MÜSSEN in model.tools stehen (kein top-level 'tools'-Feld)
 *   - keine deprecated Felder (silenceTimeoutSeconds/responseDelaySeconds)
 */
export function buildAssistantConfig(hw: VapiHwLite | null) {
  const vorname = hw?.name?.split(" ")[0] ?? null

  const greeting = vorname
    ? `Hallo ${vorname}! Ich bin dein Reparo-Assistent. Was kann ich für dich tun?`
    : "Hallo! Ich bin der Reparo-Assistent. Deine Nummer ist leider nicht in Reparo hinterlegt. Bitte trag sie in deinem Profil nach."

  const systemPrompt = hw
    ? `Du bist der persönliche Sprachassistent für den Handwerker ${hw.name ?? "dieser Person"} in der Reparo-Plattform.

Du kannst Folgendes beantworten:
- Heutige Termine und Route (Tool: get_heutiges_briefing)
- Offene Anfragen und wartende Terminbestätigungen (Tool: get_offene_anfragen)
- Neue Anfragen mit Agent-Empfehlung (Tool: get_neue_anfragen_mit_empfehlung)
- Verdienst & Einnahmen — diese Woche, diesen Monat, gesamt (Tool: get_verdienst)
- Leistungs-Auswertung — abgeschlossene Aufträge, wahrgenommene Termine, Durchschnittsbewertung (Tool: get_statistik)

Regeln:
- Antworte immer kurz und klar — der Handwerker ist oft unterwegs oder im Auto.
- Nutze für jede Frage das passende Tool und antworte mit den echten Zahlen — erfinde nie Werte.
- Bei zusammengesetzten Fragen ("Wie lief mein Monat?") darfst du mehrere Tools nacheinander nutzen.
- Kein Fachjargon, kein HTML, keine Markdown-Formatierung. Beträge in Euro aussprechen.
- Sprich Deutsch, du-Form.
- Wenn du etwas nicht weißt, sag es direkt.
- Frag maximal eine Folgefrage pro Antwort.`
    : "Du bist der Reparo-Assistent. Die Person ist nicht in Reparo hinterlegt. Bitte erklär das freundlich und beende das Gespräch."

  // Tool-Server-URL trägt den hwId, damit Web-Calls (ohne Caller-Nummer)
  // den Handwerker beim tool-call identifizieren können.
  const toolServerUrl = hw
    ? `${SITE_URL}/api/vapi/hw-assistant?hwId=${hw.id}`
    : `${SITE_URL}/api/vapi/hw-assistant`

  const tools = hw
    ? [
        {
          type: "function",
          function: {
            name: "get_heutiges_briefing",
            description:
              "Gibt die heutigen bestätigten Termine mit Uhrzeit und Ort zurück. Aufrufen wenn der HW nach seinen Terminen oder seinem Tagesplan fragt.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_offene_anfragen",
            description:
              "Gibt die Anzahl offener Auftragsanfragen und ausstehender Terminbestätigungen zurück.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_neue_anfragen_mit_empfehlung",
            description:
              "Sprint AX: Listet neue Direktvergabe-Anfragen mit Agent-Empfehlung (annehmen/ablehnen/prüfen) auf. Aufrufen wenn der HW fragt 'Was empfiehlst du mir?', 'Was sind neue Anfragen?' oder 'Welche Aufträge lohnen sich?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_verdienst",
            description:
              "Gibt Verdienst/Einnahmen des Handwerkers zurück: diese Woche, diesen Monat, gesamt, Schnitt pro Auftrag und laufende Aufträge. Aufrufen bei 'Was habe ich verdient?', 'Wie viel diesen Monat?', 'Meine Einnahmen?', 'Wie viel Umsatz?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_statistik",
            description:
              "Gibt eine Leistungs-Auswertung zurück: wie viele Aufträge abgeschlossen (gesamt & diesen Monat), wie viele Termine wahrgenommen (gesamt & diesen Monat) und die Durchschnittsbewertung in Sternen. Aufrufen bei 'Wie viele Termine hatte ich?', 'Wie viele Aufträge habe ich gemacht?', 'Wie ist meine Bewertung?', 'Wie läuft es bei mir?', 'Gib mir eine Auswertung'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
      ]
    : []

  const modelConfig: Record<string, unknown> = {
    provider: "anthropic",
    // Aktuelles schnelles Claude (Haiku 4.5) — schneller & fähiger als 3.5-Haiku.
    // Per ENV überschreibbar als Sicherheitsventil, falls Vapi das Modell mal
    // nicht akzeptiert (dann z.B. VAPI_HW_MODEL=claude-3-5-haiku-20241022).
    model: process.env.VAPI_HW_MODEL || "claude-haiku-4-5",
    temperature: 0.3,
    messages: [{ role: "system", content: systemPrompt }],
  }
  if (tools.length > 0) {
    modelConfig.tools = tools
  }

  const config: Record<string, unknown> = {
    firstMessage: greeting,
    transcriber: {
      // Nova-3 (general) kann Deutsch und ist schneller/genauer als nova-2.
      // NICHT nova-*-phonecall verwenden — die können nur en/en-US.
      provider: "deepgram",
      model: "nova-3",
      language: "de",
    },
    model: modelConfig,
    voice: {
      provider: "openai",
      voiceId: "nova", // OpenAI TTS — kein eigener Key nötig, spricht Deutsch
    },
    endCallMessage: "Alles klar. Bis bald und einen guten Tag!",
    endCallPhrases: ["tschüss", "auf wiedersehen", "danke tschüss", "ciao", "bye", "tschau"],
    maxDurationSeconds: 300,
    startSpeakingPlan: { waitSeconds: 0.4 },
  }

  return config
}
