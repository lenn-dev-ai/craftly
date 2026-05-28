# Account-Setup Anleitung — Vapi + Twilio + Mapbox + Google-Cal

> Cowork hat 4 Tabs in Chrome geöffnet. Du machst die Anmeldung (Cowork darf
> aus Sicherheitsgründen keine neuen Accounts mit Passwort erstellen).
> Nach Anlage extrahiere ich API-Keys + setze sie in Netlify-ENVs.

## Wofür das alles ist

| Account | Wozu | Aufwand | Kosten |
|---|---|---|---|
| **Vapi** | Voice-AI V2 (Outbound zu Mieter) | 5 Min | Free-Tier reicht für Beta |
| **Twilio** | Telefon-Provider für Vapi (DE-Nummer + Outbound) | 10 Min | ~5 €/Mon + 0.05 €/Min |
| **Mapbox** | Karten-Lib upgrade (statt OSM) | 5 Min | Free 50K Loads/Mon = reicht für Beta |
| **Google-Cloud** | OAuth-App für HW-Kalender-Sync | 10 Min | Free für unsere Quotas |

**Total Setup-Zeit: ~30 Minuten.**

---

## 1. Vapi.ai — Voice-AI V2

**Tab:** geöffnet bei `https://vapi.ai`

**Schritte:**
1. Oben rechts „**Login**" oder „**Get Started**" klicken
2. Mit Google (`lenn-dev@proton.me` oder ähnlich) ODER E-Mail signup
3. Account anlegen → bei „Use Case" wähle „Inbound + Outbound Calls"
4. Stripe-Card hinzufügen (Free-Tier verbraucht kein Geld, aber Vapi verlangt Card-on-File)
5. Dashboard → **API Keys** → neuen Key erstellen, Name: `reparo-prod`
6. ⚠️ **Permission:** „Full access" (Cowork braucht Read+Write für Outbound-Calls)
7. Key kopieren, **mir in den Chat schicken** als `VAPI_API_KEY=xxx`

**Cowork-Aktion danach:** ich setze `VAPI_API_KEY` als Secret in Netlify-ENVs.

---

## 2. Twilio — DE-Nummer + Outbound

**Tab:** geöffnet bei `https://login.twilio.com/u/signup`

**Schritte:**
1. Sign-up-Form ausfüllen (First Name, Last Name, E-Mail, Passwort)
2. E-Mail bestätigen
3. Phone-Nummer-Verifikation (eigene Handy-Nummer)
4. Bei „Use Case" wähle „Build voice or video apps"
5. Console → **Phone Numbers** → **Buy a Number** → Country: Germany → Local
6. ⚠️ **Wichtig:** Capabilities → ✅ Voice + ✅ SMS aktivieren (für später)
7. Nummer kaufen (~5 €/Mon + ~1 € Setup, geht von Twilio-Trial-Credit ab)
8. Notiere mir in den Chat:
   - `TWILIO_ACCOUNT_SID=AC...` (oben rechts, Account-Info)
   - `TWILIO_AUTH_TOKEN=...` (im Account → API Keys → Master Token)
   - `TWILIO_PHONE_NUMBER=+49...` (deine neue DE-Nummer)

**Cowork-Aktion danach:** ich setze alle 3 in Netlify-ENVs + verbinde Twilio mit Vapi (Vapi-Dashboard → Phone Numbers → Import from Twilio).

---

## 3. Mapbox — moderne Karten

**Tab:** geöffnet bei `https://account.mapbox.com/auth/signup/`

**Schritte:**
1. Form ausfüllen:
   - „I am using Mapbox for:" → **Business**
   - Full Name, Organization Name (z.B. „Reparo")
   - Industry → **Real Estate** oder **Other Software**
   - E-Mail, Username, Passwort
2. ✅ Terms akzeptieren → Continue
3. E-Mail bestätigen
4. Dashboard → **Access tokens** → Default Public Token kopieren
5. Mir schicken als `NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...`

**Wichtig:** Mapbox-Token ist „public" (im Browser sichtbar), aber das ist OK — Mapbox hat URL-Restriction-Schutz. Im Token-Settings auch URL-Restrictions ergänzen: `https://reparo-app.netlify.app/*` und `http://localhost:3000/*`.

**Cowork-Aktion danach:** ich setze `NEXT_PUBLIC_MAPBOX_TOKEN` in Netlify-ENVs.

---

## 4. Google Cloud — OAuth für HW-Kalender-Sync

**Tab:** geöffnet bei `https://console.cloud.google.com/projectcreate`

**Schritte (komplexer, ~10 Min):**

1. **Google-Account-Login** (lenn-dev@proton.me geht nicht, brauchst Google-Account — z.B. lenn.test.2@gmail.com)
2. **Neues Projekt anlegen:**
   - Name: `reparo-prod`
   - Organization: (leer wenn keine GSuite)
   - Create
3. **Calendar-API aktivieren:**
   - APIs & Services → Library → „Google Calendar API" → Enable
4. **OAuth Consent Screen:**
   - APIs & Services → OAuth consent screen
   - User Type: **External**
   - App-Name: „Reparo"
   - Support-Email + Developer-Email: deine Mail
   - Scopes hinzufügen: `https://www.googleapis.com/auth/calendar.readonly` und `.events`
   - Testing-Mode → bei Test-Users deine Mail eintragen (HW können später hinzu)
5. **OAuth 2.0 Client erstellen:**
   - APIs & Services → Credentials → + Create Credentials → OAuth client ID
   - Type: **Web application**
   - Name: „Reparo Web"
   - Authorized redirect URIs: `https://reparo-app.netlify.app/api/auth/google/callback` UND `http://localhost:3000/api/auth/google/callback`
   - Create → Notiere mir:
     - `GOOGLE_CLIENT_ID=...apps.googleusercontent.com`
     - `GOOGLE_CLIENT_SECRET=GOCSPX-...`

**Cowork-Aktion danach:** ich setze beide in Netlify-ENVs.

---

## Reihenfolge-Empfehlung

Wenn du wenig Zeit hast, in dieser Reihenfolge:

1. **Mapbox** (5 Min — quickest, sofort nutzbar)
2. **Vapi** (5 Min — wichtig für Voice-AI-PoC)
3. **Twilio** (10 Min — braucht Vapi um Wert zu haben)
4. **Google Cloud** (10 Min — komplex, kann auch später)

Falls du nur 5 Min hast: nur Mapbox. Dann Sprint AG (Mapbox-Migration) kann
sofort von CC gemacht werden.

---

## Was Cowork dann automatisch macht

Sobald du mir die Tokens schickst:

1. **ENVs in Netlify setzen** (Secret, alle Contexts) via Netlify-MCP
2. **Sprint-Specs aktualisieren** mit „bereit für Implementation"-Marker
3. **CC informieren** dass Voice-AI V2 / Mapbox / Google-Cal jetzt baubar sind
4. **Bei Vapi:** Assistant-Konfiguration via API ergänzen (Prompt aus SPEC-voice-ai-v2.md)
5. **Bei Twilio:** Nummer in Vapi importieren (via UI oder API)

---

## Format für Antwort an Cowork

Wenn du fertig bist, schicke mir das hier kompakt:

```
VAPI_API_KEY=...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+49...
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Ich verarbeite das in unter 5 Minuten.

---

## Was du NICHT machen sollst

- ❌ Pricing-Pläne kaufen (Free-Tier reicht für Beta) — nur dort wo Card-on-File-Pflicht ist (Vapi, Twilio)
- ❌ 2FA an die Hauptkonten (kompliziert für Cowork-Zugriff später)
- ❌ Mehrere Accounts pro Service (Verwirrung)

## Bei Problemen

Wenn ein Sign-up hängt oder du Fragen hast: einfach in den Chat schreiben. Ich
sehe die Screenshots, kann unterstützen.
