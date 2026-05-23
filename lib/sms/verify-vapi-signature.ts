import crypto from "node:crypto"

// Vapi sendet bei Webhook einen HMAC-SHA256-Header (z.B. `x-vapi-signature`)
// über den raw-Body, signiert mit dem Webhook-Secret. Wir verifizieren
// constant-time, damit Timing-Angriffe nicht möglich sind.
//
// Spec-Form (vapi.ai/docs/server/webhooks): "sha256=<hex>"
// Manche Provider liefern ohne Prefix — wir akzeptieren beides.

export function verifyVapiSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader
  if (provided.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(expected, "hex"),
    )
  } catch {
    // Provided ist kein gültiger Hex-String → invalid signature
    return false
  }
}
