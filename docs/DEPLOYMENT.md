# Deployment & ENV-Checkliste — Reparo

Deploy läuft automatisch von `main` auf Netlify. Diese Datei listet alle
Umgebungsvariablen mit Status für die Produktion (reparo-app.de).

## Legende
✅ gesetzt & aktiv · ⚠️ optional/feature-gated · ❌ noch zu setzen

---

## Kern (Pflicht — App startet nicht ohne)
| Variable | Status | Wert / Quelle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase-Projekt |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → API (geheim!) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://reparo-app.de` |
| `CRON_SECRET` | ✅ | Zufalls-Token (Cron-Auth + Zero-Login-/Voice-HMAC) |
| `BETA_PASSWORD` / `BETA_USER` | ✅ | Basic-Auth-Gate (Closed Beta) |

## E-Mail (Resend) — live
| Variable | Status | Wert |
|---|---|---|
| `RESEND_API_KEY` | ✅ | Resend |
| `RESEND_FROM_EMAIL` | ✅ | `Reparo <no-reply@reparo-app.de>` |
| `RESEND_PAUSED` | ✅ | entfernt / 0 |
| `REPARO_FEEDBACK_EMAIL` | ✅ | Empfänger für In-App-Feedback |

## KI / Karte
| Variable | Status | Wert |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Schadenserkennung + Briefings |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ | Karte + Directions |

## Auth-Zusatz (Google) — für Kalender-Sync + Google-Login
| Variable | Status | Wert |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | ✅ | Google Cloud Console |
| `NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI` | ✅ | `https://reparo-app.de/api/auth/google/callback` |

## Voice (Vapi)
| Variable | Status | Hinweis |
|---|---|---|
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | ✅ | Web-Voice-Button (client) |
| `VAPI_API_KEY` | ✅ | Voice-Health + Rückruf |
| `VAPI_WEBHOOK_SECRET` | ❌ | **Empfohlen**: aktiviert die Signaturpflicht für den Telefon-Pfad. Web-Button läuft über CRON_SECRET auch ohne. In Netlify UND als Server-Secret in Vapi setzen (gleicher Wert). Generieren: `openssl rand -hex 32` |
| `VAPI_HW_MODEL` / `_STT` / `_VOICE` / `_VOICE_ID` | ⚠️ | Nur als Override-Ventile; Defaults im Code (Haiku 4.5 / nova-3 / 11labs) |
| `VAPI_PHONE_NUMBER_ID` | ⚠️ | Erst bei deutscher Telefonnummer (s. docs/DEUTSCHE-NUMMER.md) |

## Optional / feature-gated
| Variable | Status | Hinweis |
|---|---|---|
| `STRIPE_SECRET_KEY` / `_WEBHOOK_SECRET` / `_PLATFORM_ACCOUNT_ID` | ⚠️ | Provisions-Abrechnung — erst bei Zahlungs-Go-Live |
| `TWILIO_*` | ⚠️ | SMS-Benachrichtigung (aktuell E-Mail-first) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` / `_SRC` | ⚠️ | Analytics |
| `NEXT_PUBLIC_REPARO_BETREIBER_*`, `_KONTAKT_*` | ⚠️ | Impressum-Daten (env-getrieben) — vor Public-Beta füllen |

---

## Deploy-Runbook
1. `main` push → Netlify baut automatisch (`next build`).
2. Bei geänderten `NEXT_PUBLIC_*` **immer Redeploy** (Werte werden ins
   Client-Bundle gebacken).
3. DB-Migrationen separat anwenden (`supabase db push` / Dashboard) —
   **vor** dem Deploy, der die neuen Spalten nutzt.
4. Smoke-Test: `/api/admin/health` (db/resend/vapi/mapbox), ein Login,
   eine Schadensmeldung mit Foto.

## Offene Beta-Blocker
Keine. Alle Pflicht-ENVs gesetzt, Auth auf reparo-app.de umgestellt.
`VAPI_WEBHOOK_SECRET` ist die einzige empfohlene Härtung (nur für den
Telefon-Pfad relevant).
</content>
