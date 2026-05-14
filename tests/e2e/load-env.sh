#!/usr/bin/env bash
# Lädt E2E-Supabase-ENV-Vars für die lokale Instanz.
#
# Quelle: `supabase status -o env` — exposed sowohl die neuen
# sb_publishable_*/sb_secret_*-Keys als auch die klassischen
# JWT-Format-ANON_KEY und SERVICE_ROLE_KEY parallel. Wir nutzen die
# JWT-Variante, weil GoTrue (Auth-Service) bei admin.*-Calls
# nur signierte JWTs als Bearer Token akzeptiert.
#
# Verwendung:
#   source tests/e2e/load-env.sh

set -e

ENV_OUTPUT=$(npx --yes supabase status -o env 2>&1)
if echo "$ENV_OUTPUT" | grep -qiE "not running|cannot connect|error"; then
  echo "❌ Lokale Supabase läuft nicht. Erst: npm run db:start" >&2
  echo "$ENV_OUTPUT" >&2
  return 1 2>/dev/null || exit 1
fi

# Parsen — Format ist KEY="value" pro Zeile
extract() {
  echo "$ENV_OUTPUT" | grep -E "^$1=" | sed -E 's/^[^=]+="?([^"]*)"?$/\1/'
}

URL=$(extract "API_URL")
ANON=$(extract "ANON_KEY")
SERVICE=$(extract "SERVICE_ROLE_KEY")

if [ -z "$URL" ] || [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  echo "❌ Konnte API_URL/ANON_KEY/SERVICE_ROLE_KEY nicht aus Output extrahieren." >&2
  echo "Output:" >&2
  echo "$ENV_OUTPUT" >&2
  return 1 2>/dev/null || exit 1
fi

export E2E_SUPABASE_URL="$URL"
export E2E_SUPABASE_ANON_KEY="$ANON"
export E2E_SUPABASE_SERVICE_ROLE_KEY="$SERVICE"

echo "✓ E2E-Env geladen aus 'supabase status -o env':"
echo "  URL:     $E2E_SUPABASE_URL"
echo "  ANON:    ${E2E_SUPABASE_ANON_KEY:0:32}..."
echo "  SERVICE: ${E2E_SUPABASE_SERVICE_ROLE_KEY:0:32}..."
