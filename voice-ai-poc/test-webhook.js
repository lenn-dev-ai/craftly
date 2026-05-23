#!/usr/bin/env node
/*
 * Voice-AI PoC — Mock-Webhook für lokales Testing
 *
 * Sendet einen signierten POST-Request an /api/voice-call/ingest
 * mit der mock-Payload aus mock-webhook-payload.json.
 *
 * Usage:
 *   VAPI_WEBHOOK_SECRET=local-test-secret \
 *   node voice-ai-poc/test-webhook.js [URL]
 *
 * Default-URL: http://localhost:3000/api/voice-call/ingest
 *
 * Voraussetzung:
 *   1. npm run dev läuft mit VAPI_WEBHOOK_SECRET=local-test-secret
 *   2. profiles.telefon eines Verwalters matched die caller_phone
 *      in der Payload (Default +491701234567 — anpassen falls anders)
 *   3. Migrations 20260605000050 + 20260605000070 sind angewandt
 */

const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

const SECRET = process.env.VAPI_WEBHOOK_SECRET
if (!SECRET) {
  console.error("× VAPI_WEBHOOK_SECRET nicht gesetzt — siehe header-comment.")
  process.exit(1)
}

const url = process.argv[2] || "http://localhost:3000/api/voice-call/ingest"
const payloadPath = path.join(__dirname, "mock-webhook-payload.json")
const rawBody = fs.readFileSync(payloadPath, "utf-8").trim()

const signature = "sha256=" + crypto
  .createHmac("sha256", SECRET)
  .update(rawBody)
  .digest("hex")

console.log("→ POST", url)
console.log("→ x-vapi-signature:", signature.slice(0, 32) + "…")

;(async () => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
      },
      body: rawBody,
    })
    const text = await res.text()
    console.log("← Status:", res.status)
    console.log("← Body:", text)
    if (res.ok) {
      console.log("\n✓ Erfolg — prüfe im Verwalter-Dashboard, ob das Ticket erscheint.")
    } else {
      console.log("\n× Fehler. Siehe README.md → Troubleshooting.")
      process.exit(1)
    }
  } catch (e) {
    console.error("× Netzwerk-Fehler:", e.message)
    console.error("  Läuft `npm run dev` auf", url, "?")
    process.exit(1)
  }
})()
