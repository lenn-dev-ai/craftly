/*
 * ARCHIVED / OBSOLETE
 *
 * Diese Datei ist historisch und nicht mehr operative Source of Truth.
 *
 * Aktuelle Quellen:
 *   - ai/REPARO_OPERATING_SYSTEM.md
 *   - ai/SESSION_HANDOFF.md
 *
 * Nicht für neue Architektur- oder Produktentscheidungen verwenden.
 */

#!/usr/bin/env node
/**
 * Reparo Voice-AI Mock-Webhook Tester
 *
 * Schickt einen simulierten Vapi-Webhook-Call an /api/voice-call/ingest
 * für lokale Tests bevor Vapi live ist.
 *
 * Usage:
 *   node test-webhook.js                              # local dev (localhost:3000)
 *   node test-webhook.js --url https://reparo-app.netlify.app  # production
 *   node test-webhook.js --secret YOUR_HMAC_SECRET    # mit HMAC-Signatur
 *   node test-webhook.js --scenario notfall           # andere Test-Szenarien
 *
 * Voraussetzungen:
 *   - Node >= 18 (für native fetch + crypto.subtle)
 *   - /api/voice-call/ingest existiert (CC baut Skeleton aus api-route-skeleton.ts)
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// === CLI ARGS ===
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : fallback;
}

const TARGET_URL = getArg('url', 'http://localhost:3000/api/voice-call/ingest');
const HMAC_SECRET = getArg('secret', process.env.VAPI_WEBHOOK_SECRET || '');
const SCENARIO = getArg('scenario', 'normal'); // normal | notfall | unvollstaendig | abbruch

// === SZENARIEN ===
const SCENARIOS = {
  normal: {
    structuredData: {
      adresse_strasse: 'Musterstraße',
      adresse_hausnummer: '12',
      adresse_plz: null,
      adresse_ort: 'Berlin',
      wohnungs_bezeichnung: '3B',
      gewerk: 'wasser',
      beschreibung_kurz: 'Spülkasten WC läuft seit gestern Abend, tropft.',
      dringlichkeit: 'zeitnah',
      mieter_telefon: '+493012345678',
      mieter_fotos_versprochen: false,
      dsgvo_aufzeichnung_consent: true,
      vollstaendigkeits_score: 95,
    },
    durationSeconds: 217,
  },
  notfall: {
    structuredData: {
      adresse_strasse: 'Bahnhofstraße',
      adresse_hausnummer: '5',
      adresse_plz: '10115',
      adresse_ort: 'Berlin',
      wohnungs_bezeichnung: 'Whg 12',
      gewerk: 'wasser',
      beschreibung_kurz: 'NOTFALL: Heizungsrohr geplatzt, Wasser steht in der Küche.',
      dringlichkeit: 'notfall',
      mieter_telefon: '+491701234567',
      mieter_fotos_versprochen: true,
      dsgvo_aufzeichnung_consent: true,
      vollstaendigkeits_score: 88,
    },
    durationSeconds: 94,
  },
  unvollstaendig: {
    structuredData: {
      adresse_strasse: 'Goethestraße',
      adresse_hausnummer: '7',
      adresse_plz: null,
      adresse_ort: 'Berlin',
      wohnungs_bezeichnung: null,
      gewerk: 'heizung',
      beschreibung_kurz: 'Mieter sagt Heizung kalt, weiß nicht welche Etage.',
      dringlichkeit: 'zeitnah',
      mieter_telefon: null,
      mieter_fotos_versprochen: false,
      dsgvo_aufzeichnung_consent: true,
      vollstaendigkeits_score: 42,
    },
    durationSeconds: 156,
  },
  abbruch: {
    structuredData: null, // kein Ticket erstellen
    durationSeconds: 18,
    endedReason: 'customer-ended-call',
  },
};

const scenario = SCENARIOS[SCENARIO];
if (!scenario) {
  console.error(`❌ Unbekanntes Szenario: ${SCENARIO}`);
  console.error(`   Verfügbar: ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}

// === PAYLOAD BAUEN ===
const callId = `call_test_${Date.now()}`;
const now = new Date();
const startedAt = new Date(now.getTime() - scenario.durationSeconds * 1000);

const payload = {
  message: {
    type: 'end-of-call-report',
    call: {
      id: callId,
      orgId: 'org_reparo_test',
      type: 'inboundPhoneCall',
      createdAt: startedAt.toISOString(),
      endedAt: now.toISOString(),
      phoneNumberId: 'phone_de_test_1',
      customer: { number: '+4915112345678' },
    },
    durationSeconds: scenario.durationSeconds,
    endedReason: scenario.endedReason || 'assistant-ended-call',
    transcript: `[Mock-Transcript für Szenario "${SCENARIO}"]`,
    recordingUrl: `https://vapi.ai/recordings/${callId}.mp3`,
    summary: scenario.structuredData?.beschreibung_kurz || 'Anruf abgebrochen',
    structuredData: scenario.structuredData,
    analysis: {
      successEvaluation: scenario.structuredData ? 'true' : 'false',
    },
  },
};

const payloadStr = JSON.stringify(payload);

// === HMAC-SIGNATUR (optional) ===
let signature = null;
if (HMAC_SECRET) {
  signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payloadStr)
    .digest('hex');
}

// === REQUEST ===
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎙  Reparo Voice-AI Mock-Webhook');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📞 Szenario:     ${SCENARIO}`);
  console.log(`🎯 Target:       ${TARGET_URL}`);
  console.log(`🔐 HMAC:         ${signature ? 'ja (' + signature.slice(0, 16) + '...)' : 'nein'}`);
  console.log(`📦 Call-ID:      ${callId}`);
  console.log(`⏱  Dauer:        ${scenario.durationSeconds}s`);
  console.log(`📊 Payload-Size: ${payloadStr.length} Bytes`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Vapi-Mock-Webhook/1.0',
  };
  if (signature) headers['x-vapi-signature'] = signature;

  try {
    const t0 = Date.now();
    const res = await fetch(TARGET_URL, {
      method: 'POST',
      headers,
      body: payloadStr,
    });
    const elapsed = Date.now() - t0;

    const body = await res.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = body; }

    console.log(`✓ Response: HTTP ${res.status} in ${elapsed}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (res.ok) {
      console.log('✅ Test erfolgreich.');
      if (parsed?.ticket_id) {
        console.log(`   Ticket angelegt: ${parsed.ticket_id}`);
      }
    } else {
      console.log('⚠  Endpoint hat nicht-OK Status zurückgegeben.');
      process.exit(2);
    }
  } catch (err) {
    console.error('❌ Request fehlgeschlagen:');
    console.error(`   ${err.message}`);
    console.error('');
    console.error('Häufige Ursachen:');
    console.error('  - Dev-Server läuft nicht: starte mit "npm run dev"');
    console.error('  - Route /api/voice-call/ingest existiert nicht: CC muss bauen');
    console.error('  - HMAC-Secret fehlt: --secret YOUR_SECRET übergeben');
    process.exit(1);
  }
}

main();
