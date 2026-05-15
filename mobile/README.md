# Reparo Mobile (Expo + Expo Router)

Native iOS/Android-App für Reparo. Teilt Supabase-DB mit der Web-App
(siehe `../`).

## Tech

- Expo SDK 54, React 19, React Native 0.81
- Expo Router (file-based)
- TypeScript
- NativeWind v4 (Tailwind für RN)
- Supabase via @supabase/supabase-js + AsyncStorage

## Setup

```bash
cd mobile
npm install                 # Dependencies
cp .env.example .env        # Env-Template kopieren
# .env editieren: EXPO_PUBLIC_SUPABASE_ANON_KEY eintragen
```

## Starten

```bash
npx expo start              # Metro + QR-Code für Expo Go
# i ↵ → iOS Simulator
# a ↵ → Android Emulator
# w ↵ → Browser (für UI-Iteration)
```

Auf dem Handy: **Expo Go** App (App Store / Play Store) → QR-Code scannen.

## Struktur

```
app/
  _layout.tsx              Root mit AuthProvider
  index.tsx                Routing nach Rolle
  (auth)/
    login.tsx
    register.tsx
  (app)/
    _layout.tsx            Auth-Guard
    mieter/index.tsx       Mieter-Dashboard
    handwerker/index.tsx   HW-Dashboard
    verwalter/index.tsx    Verwalter-Dashboard

lib/
  supabase.ts              Client mit AsyncStorage
  auth-context.tsx         Session + Profile

components/
  Header.tsx               Wiederverwendbarer Page-Header
```

## Test-User

Aus dem Web-Repo-Seed (siehe `../scripts/seed-simulation.mjs`):

| Email | Passwort | Rolle |
|---|---|---|
| `seed.verwalter.1@reparo-test.local` | `SeedPassword123!` | Verwalter |
| `seed.handwerker.1@reparo-test.local` | `SeedPassword123!` | Handwerker |
| `seed.mieter.1@reparo-test.local` | `SeedPassword123!` | Mieter |

Voraussetzung: Seed wurde gegen die DB ausgeführt die in der `.env` als
`EXPO_PUBLIC_SUPABASE_URL` zeigt (lokales oder Cloud-Supabase).

## Status (Phase 1)

Geliefert in dieser Session:
- Foundation (Expo + Router + NativeWind + Theme)
- Auth-Flow (Login + Register + Logout)
- Rollen-Routing nach Login
- 3 Dashboard-Screens (Mieter / Handwerker / Verwalter) — read-only

Offen für Phase 2:
- Mieter: Ticket erstellen mit Foto-Upload (Camera-API)
- Mieter: Ticket-Detail mit Status-Timeline, Bewertung
- Handwerker: Angebot abgeben, Befund-Form, Zeitslots, Kalender
- Verwalter: Ticket-Detail, Angebots-Vergleich, Nachträge
- Push-Notifications (Expo EAS Setup)

Pro Screen ca. 30-60 Min, am sinnvollsten in Etappen pro Rolle.
