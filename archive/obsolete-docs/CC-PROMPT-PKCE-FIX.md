# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC-PROMPT: PKCE-Bug Hotfix (URGENT)

## Was ich gemacht habe:
`package.json` editiert: `@supabase/ssr` bumped `^0.3.0` → `^0.5.2`.

In 0.3.x landet der PKCE `code_verifier` im **localStorage** — der Server kann ihn beim OAuth-Callback nicht lesen → "PKCE code verifier not found in storage".
Ab 0.5.x landet er in **Cookies** → Server kann ihn lesen → exchangeCodeForSession funktioniert.

## Was du machen sollst (Reparo-Repo):

```bash
cd ~/Desktop/Reparo

# 1. package-lock.json updaten
npm install

# 2. Verifizieren der Bump live ist
grep -A1 '"@supabase/ssr"' package.json package-lock.json | head -6

# 3. Build lokal testen (catches Breaking Changes früh)
npm run build

# 4. Wenn Build grün:
git add package.json package-lock.json
git commit -m "fix(auth): bump @supabase/ssr 0.3 -> 0.5.2 (PKCE Cookie-Storage)

Behebt 'PKCE code verifier not found in storage' beim Google-OAuth-Callback.
Ab 0.5.x speichert createBrowserClient den PKCE code_verifier in Cookies
statt localStorage, sodass der Server-Callback ihn lesen kann."

git push origin main
```

## Falls Build fehlschlägt:
@supabase/ssr 0.5.x hat **keine** Breaking Changes für unsere Usage (createBrowserClient + createServerClient API ist identisch). Falls trotzdem etwas bricht, ping mich.

## Nach dem Push:
Netlify rebuildet ~2 Min. Dann inkognito testen:
1. https://reparo-app.netlify.app/login
2. "Mit Google anmelden" → lennjahn@gmail.com
3. Sollte ohne PKCE-Error durchlaufen → /onboarding (oder Dashboard)
