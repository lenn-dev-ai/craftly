#!/usr/bin/env bash
# Lädt die E2E-Supabase-ENV-Vars direkt aus `supabase status`.
# Eliminiert Copy-Paste-Fehler beim Service-Role-Key.
#
# Verwendung:
#   source tests/e2e/load-env.sh
#
# Nach dem Sourcing sind exportiert:
#   E2E_SUPABASE_URL
#   E2E_SUPABASE_ANON_KEY
#   E2E_SUPABASE_SERVICE_ROLE_KEY

set -e

if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ supabase CLI nicht installiert. brew install supabase/tap/supabase" >&2
  return 1 2>/dev/null || exit 1
fi

STATUS=$(supabase status 2>&1)
if echo "$STATUS" | grep -q "not running\|Cannot connect"; then
  echo "❌ Lokale Supabase läuft nicht. Erst: npm run db:start" >&2
  return 1 2>/dev/null || exit 1
fi

# API URL extrahieren (z. B. "API URL: http://127.0.0.1:54321")
URL=$(echo "$STATUS" | grep -E '^[[:space:]]*API URL:' | sed -E 's/.*API URL:[[:space:]]+//' | tr -d '[:space:]')
ANON=$(echo "$STATUS" | grep -E '^[[:space:]]*anon key:' | sed -E 's/.*anon key:[[:space:]]+//' | tr -d '[:space:]')
SERVICE=$(echo "$STATUS" | grep -E '^[[:space:]]*service_role key:' | sed -E 's/.*service_role key:[[:space:]]+//' | tr -d '[:space:]')

if [ -z "$URL" ] || [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  echo "❌ Konnte URL/Keys nicht aus 'supabase status' lesen. Output:" >&2
  echo "$STATUS" >&2
  return 1 2>/dev/null || exit 1
fi

export E2E_SUPABASE_URL="$URL"
export E2E_SUPABASE_ANON_KEY="$ANON"
export E2E_SUPABASE_SERVICE_ROLE_KEY="$SERVICE"

echo "✓ E2E-Env geladen aus 'supabase status':"
echo "  URL:     $E2E_SUPABASE_URL"
echo "  ANON:    ${E2E_SUPABASE_ANON_KEY:0:32}..."
echo "  SERVICE: ${E2E_SUPABASE_SERVICE_ROLE_KEY:0:32}..."
