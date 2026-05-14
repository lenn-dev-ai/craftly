#!/usr/bin/env bash
# Lädt E2E-Supabase-ENV-Vars für die lokale Instanz.
#
# Generiert die JWT-Keys (anon + service_role) DETERMINISTISCH aus dem
# JWT-Secret das `supabase status` ausgibt. Das ist notwendig, weil
# neuere Supabase-CLI-Versionen das neue sb_secret_*/sb_publishable_*-
# Format als Default ausgeben — diese sind keine JWTs und werden von
# GoTrue (Auth-Service) bei admin.*-Calls nicht als Bearer Token
# akzeptiert.
#
# Verwendung:
#   source tests/e2e/load-env.sh

set -e

NPX_BIN="${NPX_BIN:-npx}"
SUPABASE_CMD="$NPX_BIN --yes supabase"

STATUS=$($SUPABASE_CMD status 2>&1)
if echo "$STATUS" | grep -qE "not running|Cannot connect|Error"; then
  echo "❌ Lokale Supabase läuft nicht. Erst: npm run db:start" >&2
  echo "$STATUS" >&2
  return 1 2>/dev/null || exit 1
fi

# API URL extrahieren
URL=$(echo "$STATUS" | grep -E '^[[:space:]]*API URL:' | sed -E 's/.*API URL:[[:space:]]+//' | tr -d '[:space:]')

# JWT-Secret extrahieren — die einzige Konstante zwischen alten und neuen
# CLI-Versionen. Wird zum Signieren der Tokens benötigt die GoTrue
# akzeptiert.
JWT_SECRET=$(echo "$STATUS" | grep -E '^[[:space:]]*JWT secret:' | sed -E 's/.*JWT secret:[[:space:]]+//' | tr -d '[:space:]')

if [ -z "$URL" ]; then
  echo "❌ API URL nicht in 'supabase status' Output gefunden." >&2
  echo "$STATUS" >&2
  return 1 2>/dev/null || exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  # Default-Secret das Supabase CLI bei `supabase start` ohne expliziten
  # Secret verwendet (well-known für lokale Entwicklung).
  JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
  echo "⚠ JWT secret nicht im Status-Output — nutze Default-Secret." >&2
fi

# JWT-Keys mit Node generieren (HS256, role-Claim, 10 Jahre Laufzeit)
JWT_KEYS=$(node -e '
const crypto = require("crypto");
const secret = process.argv[1];
const now = Math.floor(Date.now() / 1000);
const tenYears = 60 * 60 * 24 * 365 * 10;

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
function sign(role) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { role, iss: "supabase-local", iat: now, exp: now + tenYears };
  const data = b64url(header) + "." + b64url(payload);
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return data + "." + sig;
}

console.log(sign("anon"));
console.log(sign("service_role"));
' "$JWT_SECRET")

ANON_KEY=$(echo "$JWT_KEYS" | sed -n '1p')
SERVICE_KEY=$(echo "$JWT_KEYS" | sed -n '2p')

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "❌ JWT-Key-Generierung fehlgeschlagen." >&2
  return 1 2>/dev/null || exit 1
fi

export E2E_SUPABASE_URL="$URL"
export E2E_SUPABASE_ANON_KEY="$ANON_KEY"
export E2E_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"

echo "✓ E2E-Env geladen (JWT-Keys aus JWT-Secret erzeugt):"
echo "  URL:     $E2E_SUPABASE_URL"
echo "  ANON:    ${E2E_SUPABASE_ANON_KEY:0:32}..."
echo "  SERVICE: ${E2E_SUPABASE_SERVICE_ROLE_KEY:0:32}..."
