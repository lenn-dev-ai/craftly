#!/usr/bin/env bash
# Diagnostiziert warum die E2E-Admin-API 401/Bearer-token zurückgibt.
# Verwendung: bash tests/e2e/diagnose-env.sh
# (oder nach `source tests/e2e/load-env.sh`)

set +e

echo "=== 1) ENV-Vars ==="
echo "E2E_SUPABASE_URL = $E2E_SUPABASE_URL"
echo "ANON length = ${#E2E_SUPABASE_ANON_KEY}"
echo "SERVICE length = ${#E2E_SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$E2E_SUPABASE_URL" ]; then
  echo
  echo "❌ E2E_SUPABASE_URL leer. Erst: source tests/e2e/load-env.sh"
  exit 1
fi

echo
echo "=== 2) Docker-Container ==="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | grep -E "supabase|NAME" || echo "(docker ps läuft nicht oder keine Supabase-Container)"

echo
echo "=== 3) Auth-Service erreichbar? ==="
curl -s -o /tmp/health.json -w "HTTP %{http_code}\n" "$E2E_SUPABASE_URL/auth/v1/health"
cat /tmp/health.json 2>/dev/null
echo

echo
echo "=== 4) JWT-Secret aus supabase status (erste/letzte 20 Zeichen) ==="
supabase status 2>/dev/null | grep -E "JWT secret" | sed 's/JWT secret:[[:space:]]*//' | awk '{print "First 20: " substr($0,1,20); print "Last 20:  " substr($0, length($0)-19, 20)}'

echo
echo "=== 5) Direkter Admin-Call ==="
echo "→ /auth/v1/admin/users?per_page=1 mit beiden Headern"
curl -s -o /tmp/admin.json -w "HTTP %{http_code}\n" \
  "$E2E_SUPABASE_URL/auth/v1/admin/users?per_page=1" \
  -H "Authorization: Bearer $E2E_SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $E2E_SUPABASE_SERVICE_ROLE_KEY"
cat /tmp/admin.json 2>/dev/null
echo

echo
echo "=== 6) JWT-Payload des Service-Role-Keys (Base64-decoded) ==="
echo "$E2E_SUPABASE_SERVICE_ROLE_KEY" | cut -d. -f2 | base64 -d 2>/dev/null

echo
echo "=== 7) Interpretation ==="
echo "• Wenn 3) HTTP 200 ist und 5) HTTP 200 ist: alles OK — Test-Failure liegt am Test-Code"
echo "• Wenn 3) OK aber 5) 401: JWT-Secret-Mismatch (Key passt nicht zur Instanz)"
echo "• Wenn 3) auch 401/timeout: Auth-Service nicht hochgefahren"
echo "• Wenn 6) role != 'service_role': falscher Key"
