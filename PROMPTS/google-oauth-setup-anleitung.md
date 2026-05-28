# Google-OAuth-Client einrichten — Step-by-Step für Lennart

> Voraussetzung für **Sprint AE** (Google-Calendar-Sync HW).
> Aufwand: ~15 Min im Google-Cloud-Console.
>
> Was Cowork tun kann: Click-Pfade zeigen, Werte vorgeben, ENVs setzen.
> Was Lennart tun muss: Google-Account-Login (Cowork darf das nicht), Consent-Screen-Felder mit Firmen-Daten ausfüllen.

## Vorbereitung

- Google-Account: persönlich (lennart…@gmail.com) oder Workspace
- Browser mit Claude-Extension läuft (Cowork kann navigieren)
- 15 Min Zeit, keine Unterbrechungen

## Schritt 1 — Google-Cloud-Console öffnen + Projekt anlegen

1. Browser auf https://console.cloud.google.com öffnen
2. Mit Google-Account einloggen (Lennart manuell)
3. Oben links: Project-Picker („Select a project") → „New Project"
4. **Projekt-Name:** `Reparo Production`
   **Organization:** (leer lassen wenn persönlicher Account)
   **Location:** (leer)
5. „Create" klicken
6. Warten 30 Sek bis Projekt erstellt — dann oben auf das Projekt umschalten

## Schritt 2 — APIs aktivieren

1. Linke Sidebar → „APIs & Services" → „Library"
2. Suchen: „Google Calendar API"
3. „Google Calendar API" anklicken → „Enable"
4. (Optional aber empfohlen: nach Aktivierung 1 Min warten)

## Schritt 3 — OAuth-Consent-Screen konfigurieren

1. „APIs & Services" → „OAuth consent screen"
2. **User Type:** „External" auswählen → „Create"
3. **App information:**
   - App name: `Reparo`
   - User support email: deine Kontakt-Email
   - App logo: Reparo-Logo (optional, Datei in `/public/logo.png` — kannst du später hochladen)
4. **App domain:**
   - Application home page: `https://reparo-app.netlify.app`
   - Application privacy policy: `https://reparo-app.netlify.app/datenschutz`
   - Application terms of service: `https://reparo-app.netlify.app/agb`
5. **Authorized domains:**
   - `netlify.app`
   - (später wenn eigene Domain: `reparo.de`)
6. **Developer contact information:** deine Kontakt-Email
7. „Save and continue"
8. **Scopes:** „Add or remove scopes"
   - `https://www.googleapis.com/auth/calendar.readonly` (auswählen)
   - `https://www.googleapis.com/auth/calendar.events` (auswählen)
   - „Update"
9. „Save and continue"
10. **Test users:** Lennarts Google-Account + 2-3 Beta-HW-Test-Accounts hinzufügen
    (so lange App in „Test-Mode" — nur diese können sich einloggen, max 100 User)
11. „Save and continue"
12. „Back to dashboard"

## Schritt 4 — OAuth-Client-ID erstellen

1. „APIs & Services" → „Credentials"
2. „+ Create Credentials" → „OAuth client ID"
3. **Application type:** „Web application"
4. **Name:** `Reparo Web Client`
5. **Authorized JavaScript origins:**
   - `https://reparo-app.netlify.app`
   - `http://localhost:3000` (für lokale Entwicklung)
6. **Authorized redirect URIs:**
   - `https://reparo-app.netlify.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
7. „Create" klicken
8. Modal zeigt **Client-ID** + **Client-Secret** — beides direkt in Cowork-Chat einfügen:
   - Client-ID sieht aus wie `123456789-abc...apps.googleusercontent.com`
   - Client-Secret sieht aus wie `GOCSPX-...`
9. „OK" klicken (Werte sind später auch im Credential-Detail sichtbar)

## Schritt 5 — Werte in Netlify-ENV setzen

Cowork übernimmt das via Netlify-MCP. Lennart liefert Client-ID + Secret im
Chat — Cowork setzt:

- `GOOGLE_OAUTH_CLIENT_ID` (plain) = Wert aus Schritt 4
- `GOOGLE_OAUTH_CLIENT_SECRET` (secret) = Wert aus Schritt 4
- `GOOGLE_TOKEN_ENCRYPTION_KEY` (secret) = generiert Cowork: 32-byte hex
- `NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI` = `https://reparo-app.netlify.app/api/auth/google/callback`

Danach Redeploy nicht nötig (Runtime-ENVs, werden bei nächstem Request gezogen).

## Schritt 6 — Verification später (für Production-Release)

Solange App in „Test-Mode" ist:
- Max 100 Test-User
- Beim Login warnt Google „Diese App ist nicht verifiziert"
- HW kann mit „Advanced → Trotzdem öffnen" weitermachen

Für Production (>100 HW): Google-Verification beantragen.
- Dauert 2-6 Wochen
- Erfordert: Datenschutz-URL erreichbar, AGB-URL erreichbar, Demo-Video, Privacy-Notice für Calendar-Scopes
- Cowork erstellt eine Verification-Checkliste wenn so weit (Sprint AE.2)

## Was im Beta NICHT nötig ist

- Workspace-Domain-wide Delegation (nur falls Verwaltungen ein Workspace-Konto teilen)
- Service-Account (Reparo nutzt User-OAuth, keine Service-Identity)
- Google-Cloud-Billing-Account (Calendar-API hat free quota 1M Calls/Tag)

## Was Cowork machen kann während Lennart aktiv ist

1. https://console.cloud.google.com im Browser öffnen via Chrome-MCP
2. Bei jeder Page-Navigation Lennart anweisen wo zu klicken
3. Default-Werte ins Clipboard schreiben damit Lennart paste statt tippt
4. Am Ende ENVs in Netlify setzen (mit Lennart-Werten aus Chat)

## Sanity-Check

Nach Setup sollte:
- Lennart auf https://console.cloud.google.com/apis/credentials einen OAuth-Client sehen
- ENVs in Netlify Dashboard sichtbar (`GOOGLE_OAUTH_CLIENT_ID` ohne lock-icon, Secret mit lock-icon)
- Erster `curl https://reparo-app.netlify.app/api/auth/google/connect` zeigt 302-Redirect zu `accounts.google.com` (sobald Sprint AE Code-Side live ist)

## Reihenfolge mit Sprint AE

1. Diese Anleitung (Lennart, 15 Min)
2. Sprint AE Code-Implementation (CC, 2-3 Tage)
3. Beta-HW lädt OAuth ein → Smoke-Test
