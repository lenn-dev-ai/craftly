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
    ? `Du bist der persönliche Sprachassistent für den Handwerker ${hw.name ?? "dieser Person"} in der Reparo-Plattform — eine vollwertige Assistenz für seinen Arbeitsalltag.

WERKZEUGE (nutze immer das passende Tool, mit echten Daten):
Termine & Planung
- get_heutiges_briefing — die heutigen bestätigten Termine mit Route
- get_terminausblick — nächster Termin, morgen, nächste 7 Tage
- get_kontakt — Adresse & Ansprechpartner für den nächsten Einsatz
Aufträge & Anfragen
- get_offene_anfragen — offene Anfragen & wartende Terminbestätigungen
- get_neue_anfragen_mit_empfehlung — neue Anfragen inklusive Empfehlung (annehmen/prüfen/ablehnen)
- get_laufende_auftraege — Aufträge in Arbeit und auf Abnahme wartend
- anfrage_ablehnen — eine Anfrage ablehnen (nur nach Bestätigung!)
Auswertungen & Finanzen
- get_verdienst — Einnahmen diese Woche/diesen Monat/gesamt, Schnitt, Vormonatsvergleich
- get_statistik — abgeschlossene Aufträge, wahrgenommene Termine, Bewertung
- get_partner_status — Partner-Stufe, Punktzahl, Antwort-Rate, Weg zur nächsten Stufe
- get_top_segmente — stärkstes Gewerk & ertragreichste Gegend
- get_verlauf — Verdienst der letzten 3 Monate + Annahmequote
Profil
- get_einstellungen — Gewerke, Radius, Auto-Annahme, Stundensatz, Kalender

WISSEN (so funktioniert Reparo — damit kannst du Rückfragen erklären):
- Direktvergabe: Passende Aufträge werden dir direkt 1:1 angeboten. Wer schnell zusagt, bekommt den Auftrag — schnelles Antworten lohnt sich.
- Provision: Du bekommst immer 100% des Auftragswerts. Reparo finanziert sich über eine Provision der Verwalter, dir wird nichts abgezogen.
- Partner-Status: Vertrauter Partner (Bronze), Top-Partner (Silber, ab 50 Punkten), Premium-Partner (Gold, ab 75 Punkten). Höhere Stufe = besserer Sichtbarkeits-Bonus. Punkte steigen durch schnelles Antworten, Zuverlässigkeit und gute Bewertungen.
- Auto-Annahme: Wenn aktiviert, nimmt dein Agent passende Aufträge automatisch für dich an (nach deinen Kriterien wie Radius und Mindest-Auftragswert).

REGELN:
- Antworte kurz, klar, gesprochen — der Handwerker ist oft unterwegs oder im Auto.
- Für jede Frage das passende Tool nutzen und nur echte Werte nennen — niemals Zahlen erfinden.
- Bei zusammengesetzten Fragen ("Wie lief mein Monat?") ruhig mehrere Tools nacheinander nutzen und die Antwort kurz zusammenfassen.
- Anfragen ANNEHMEN kannst du NICHT — eine verbindliche Auftragsannahme macht der Handwerker immer selbst in der App. Wenn er dich bittet anzunehmen, erklär freundlich, dass er das aus Sicherheitsgründen selbst in der App bestätigen muss; du kannst ihm die Anfrage aber vorlesen und eine Empfehlung geben.
- Anfragen ABLEHNEN kannst du (anfrage_ablehnen). SICHERHEIT: vorher kurz bestätigen lassen, welche Anfrage gemeint ist; erst bei klarem Ja aufrufen. Die Position bezieht sich auf die zuletzt vorgelesene Empfehlungsliste (1 = oberste).
- Termine bestätigen, Verfügbarkeit ändern oder Aufträge abschließen macht der Handwerker ebenfalls selbst in der App — sag das ehrlich, wenn er danach fragt.
- Kein Fachjargon, kein HTML, kein Markdown. Beträge in Euro aussprechen.
- Sprich Deutsch, du-Form. Wenn du etwas nicht weißt, sag es direkt. Maximal eine Folgefrage pro Antwort.`
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
        {
          type: "function",
          function: {
            name: "get_terminausblick",
            description:
              "Gibt den Termin-Ausblick zurück: nächster anstehender Termin (Tag, Uhrzeit, Ort) sowie wie viele Termine morgen und in den nächsten 7 Tagen. Aufrufen bei 'Wann ist mein nächster Termin?', 'Was habe ich morgen?', 'Was steht diese Woche an?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_laufende_auftraege",
            description:
              "Gibt die aktuell laufenden Aufträge zurück: welche in Arbeit sind (mit Ort und Betrag) und welche auf Abnahme durch den Verwalter warten. Aufrufen bei 'Welche Aufträge habe ich gerade?', 'Was ist in Arbeit?', 'Was muss noch abgenommen werden?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_partner_status",
            description:
              "Gibt den Partner-Status zurück: Stufe (Vertrauter/Top/Premium-Partner), Punktzahl von 100, Antwort-Rate, Bewertung und was bis zur nächsten Stufe fehlt. Aufrufen bei 'Wie ist mein Status?', 'Warum bekomme ich wenig Anfragen?', 'Wie werde ich Top-Partner?', 'Wie verbessere ich mich?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_einstellungen",
            description:
              "Gibt die aktuellen Einstellungen des Handwerkers zurück: Gewerke, Aktionsradius, ob Auto-Annahme aktiv ist, Mindest-Stundensatz, Startort und ob der Google-Kalender verbunden ist. Aufrufen bei 'Was habe ich eingestellt?', 'Wie groß ist mein Radius?', 'Ist die automatische Annahme an?', 'Welche Gewerke habe ich?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_kontakt",
            description:
              "Gibt für den nächsten anstehenden Einsatz die Adresse und den Ansprechpartner (Verwalter mit Telefonnummer) zurück. Aufrufen bei 'Wie erreiche ich den Ansprechpartner?', 'Wo muss ich hin?', 'Wer ist mein Kontakt für den nächsten Termin?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_top_segmente",
            description:
              "Gibt das stärkste Gewerk und die ertragreichste Gegend nach Verdienst zurück. Aufrufen bei 'Was ist mein bestes Gewerk?', 'Wo verdiene ich am meisten?', 'In welcher Gegend läuft es am besten?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "get_verlauf",
            description:
              "Gibt den Verdienst-Verlauf der letzten drei Monate (pro Monat) und die Annahmequote zurück. Aufrufen bei 'Wie war mein Verlauf?', 'Wie liefen die letzten Monate?', 'Werde ich besser?', 'Wie ist meine Annahmequote?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          server: { url: toolServerUrl },
        },
        {
          type: "function",
          function: {
            name: "anfrage_ablehnen",
            description:
              "Lehnt eine offene Direktvergabe-Anfrage ab (sie geht dann an den nächsten Handwerker). PFLICHT: vorher kurz bestätigen lassen, welche Anfrage gemeint ist. 'position' wie bei anfrage_annehmen (1 = oberste).",
            parameters: {
              type: "object",
              properties: {
                position: { type: "integer", minimum: 1, description: "Position in der Empfehlungsliste, 1 = oberste. Standard 1." },
              },
              required: [],
            },
          },
          server: { url: toolServerUrl },
        },
      ]
    : []

  const modelConfig: Record<string, unknown> = {
    provider: "anthropic",
    // Claude Haiku 4.5 — schneller & fähiger als 3.5-Haiku. WICHTIG: die
    // DATIERTE Modell-ID verwenden; den Alias "claude-haiku-4-5" lehnt Vapi
    // beim transienten Assistant-Start ab. Per ENV überschreibbar (Ventil:
    // VAPI_HW_MODEL=claude-3-5-haiku-20241022).
    model: process.env.VAPI_HW_MODEL || "claude-haiku-4-5-20251001",
    temperature: 0.3,
    messages: [{ role: "system", content: systemPrompt }],
  }
  if (tools.length > 0) {
    modelConfig.tools = tools
  }

  const config: Record<string, unknown> = {
    firstMessage: greeting,
    transcriber: {
      // Nova-3 + language "de" — gegen die funktionierende Vapi-Assistant-
      // Config verifiziert (schneller/genauer als nova-2). NICHT nova-*-
      // phonecall (nur en). Per ENV umschaltbar (VAPI_HW_STT=nova-2).
      provider: "deepgram",
      model: process.env.VAPI_HW_STT || "nova-3",
      language: "de",
    },
    model: modelConfig,
    // Stimme: ElevenLabs Turbo v2.5 (deutsch) — gegen die funktionierende
    // Vapi-Config verifiziert (inkl. language "de"; das Feld fehlte zuvor).
    // Fallback auf OpenAI-TTS per ENV VAPI_HW_VOICE=openai.
    voice: process.env.VAPI_HW_VOICE === "openai"
      ? { provider: "openai", voiceId: "nova" }
      : {
          provider: "11labs",
          voiceId: process.env.VAPI_HW_VOICE_ID || "FUfBrNit0NNZAwb58KWH",
          model: "eleven_turbo_v2_5",
          language: "de",
        },
    endCallMessage: "Alles klar. Bis bald und einen guten Tag!",
    endCallPhrases: ["tschüss", "auf wiedersehen", "danke tschüss", "ciao", "bye", "tschau"],
    maxDurationSeconds: 300,
    startSpeakingPlan: { waitSeconds: 0.4 },
  }

  return config
}
