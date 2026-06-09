# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint AE — Google-Calendar-Sync für Handwerker

> Bestätigt 25.05.2026 — Konzept aus `KONZEPT-google-calendar-sync-hw.md`
> wird zu konkretem Sprint-Auftrag für CC.
>
> Aufwand: ~2-3 Tage CC. Mittel-prio (Marktplatz-Adoption).
> Voraussetzung: Lennart richtet **Google-Cloud-Console-OAuth-Client** ein
> (siehe Sprint #124 Step-by-Step) und liefert Client-ID + Client-Secret.

## Ziel

HW pflegt seine Verfügbarkeit **nicht mehr in Reparo**, sondern in seinem
Google-Calendar. Reparo liest free/busy-Slots und schreibt vergebene
Aufträge als Cal-Events zurück.

→ "Handwerker-Adoptions-Killer" gelöst.

## Voraussetzungen aus Lennarts Side (#124)

1. Google-Cloud-Console-Projekt „Reparo Production" anlegen
2. OAuth-Consent-Screen konfigurieren (External, Test-Mode für Beta)
3. OAuth-Client (Web-Application) erstellen mit:
   - Authorized redirect URI: `https://reparo-app.netlify.app/api/auth/google/callback`
   - Scopes: `https://www.googleapis.com/auth/calendar.readonly` + `https://www.googleapis.com/auth/calendar.events`
4. Client-ID + Client-Secret in Netlify ENV:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET` (secret)

Cowork bereitet eine Step-by-Step-Anleitung als separater Sprint vor (#124).

## Architektur

### Phase 1 — OAuth-Flow (0.5 Tag)

```
HW klickt "Mit Google verbinden" im Profil
  → GET /api/auth/google/connect (initiiert OAuth-Redirect)
  → Google Consent Screen
  → Callback an /api/auth/google/callback
  → Tokens (access + refresh) in DB speichern (verschlüsselt!)
  → Redirect zurück ins Profil mit Success-State
```

**Tabelle** (neue Migration):

```sql
CREATE TABLE public.hw_google_oauth (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz
);

ALTER TABLE public.hw_google_oauth ENABLE ROW LEVEL SECURITY;
CREATE POLICY hw_own_google ON public.hw_google_oauth
  FOR ALL USING (auth.uid() = user_id);
```

Tokens werden mit **pgcrypto** verschlüsselt (Schlüssel aus ENV
`GOOGLE_TOKEN_ENCRYPTION_KEY`, 32 byte hex).

### Phase 2 — Free/Busy-Sync (1 Tag)

**Lese-Pfad** (im Marktplatz-Matching aktiv):

```typescript
async function getHWAvailability(userId: string, from: Date, to: Date) {
  // Wenn Google verbunden: free/busy aus Google holen
  const oauth = await getDecryptedTokens(userId);
  if (oauth) {
    const busy = await callGoogleFreeBusy(oauth, from, to);
    return invertBusyToFree(busy, hwWorkingHours);
  }
  // Fallback: Reparo-Zeitslots (Sprint B)
  return getReparoSlots(userId, from, to);
}
```

**Token-Refresh** wenn `expires_at` < jetzt: `refresh_token` an
Google senden, neue Tokens speichern, weitermachen.

**API-Quota:** Google Free-Tier = 1M Calls/Tag. Bei 200 HW × 100 Reads/Tag
= 20K, weit unter Limit. Trotzdem **Cache 5 Min** für free/busy-Antworten.

### Phase 3 — Write-Back (1 Tag)

Bei Auftragsvergabe (`/api/auction/close`):

```typescript
if (winnerHWHasGoogleCal) {
  await createGoogleEvent({
    summary: `📍 Reparo: ${ticket.titel}`,
    description: `Adresse: ${ticket.adresse}\nMieter: ${ticket.mieter_name}\n\nIm Reparo öffnen: https://reparo-app.netlify.app/dashboard-handwerker/auftrag/${ticket.id}`,
    start: terminVorschlag.start,
    end: terminVorschlag.end,
    location: ticket.adresse,
    extendedProperties: {
      private: { reparo_ticket_id: ticket.id, reparo_event: 'true' }
    }
  });
}
```

`extendedProperties.private.reparo_ticket_id` ist Anker für später
(Update bei Storno, Disconnect-Handling).

### Phase 4 — UI im HW-Profil (0.5 Tag)

`app/dashboard-handwerker/profil/page.tsx`:

```
Verfügbarkeit
─────────────────────────────────────
🟢 Mit Google-Calendar verbunden
   Verbunden seit: 25.05.2026
   Letzte Synchronisation: vor 3 Min
   [Trennen] [Test-Sync starten]

oder (wenn nicht verbunden):

⚪ Verfügbarkeit manuell pflegen (aktuell)
   [➕ Mit Google verbinden] (Empfohlen)

   Tipp: Statt manuelle Slots in Reparo zu pflegen,
   verbinde deinen Google-Cal — wir lesen freie Zeiten
   automatisch.
```

## Edge-Cases — verpflichtend handhaben

| Case | Verhalten |
|---|---|
| HW löscht Reparo-Event im Google-Cal | Wird in nächstem Sync erkannt → Mieter wird per Email informiert „HW hat Termin verschoben — bitte neu vereinbaren" → Status zurück auf `terminvorschlag_offen` |
| HW ändert Zeit im Google-Cal | Sync erkennt Time-Drift → Bei Drift >30min: Email an Mieter + Reparo-Status updaten |
| HW disconnects Google | Bestands-Events bleiben im Cal, Reparo nutzt Fallback (Sprint B Zeitslots) |
| Zeitzone (DST) | Alle Timestamps in UTC speichern, nur in UI mit `Europe/Berlin` rendern |
| Refresh-Token revoked | DB-Eintrag löschen, HW-Profil zeigt „Verbindung verloren — bitte neu verbinden" |
| Google-API 429 (Quota) | Exponential Backoff, max 3 Retries, dann Fallback |

## Sicherheits-Anforderungen

- Refresh-Token verschlüsselt mit pgcrypto (NIE plain in DB)
- Access-Token nie in Logs / Sentry
- OAuth-Callback nur für eingeloggte HW (Session-Check vor Token-Speicherung)
- Scopes minimal: `calendar.readonly` + `calendar.events` (NICHT `calendar` full)

## Testing

- Unit-Tests: free/busy-Invert-Funktion (Edge: leerer Tag, ganztägig busy, Multi-Cal)
- E2E-Test mit Test-Google-Account (Reparo-Demo-HW-1) → OAuth-Flow, Sync, Event-Create
- Smoke: 1 echter HW (Beta-Tester) verbindet seinen Cal → Test-Auftrag wird im Cal sichtbar

## Sanity-Check nach Deploy

1. `curl https://reparo-app.netlify.app/api/auth/google/connect` → Redirect zu Google
2. SQL: `SELECT count(*) FROM hw_google_oauth;` → ≥1 nach erstem Connect
3. Manuell: Test-Auftrag vergeben → Google-Cal-Event sichtbar binnen 5 Sek

## Constraints

- Sprint B Verfügbarkeits-Modell bleibt als Fallback bestehen
- Mieter-Sicht ändert sich NICHT (sieht nur „verfügbare Termine")
- iCal/Outlook-Sync ist out-of-scope → Sprint AE.2 später

## Commit-Struktur

1. `feat(google-cal): OAuth-Flow + DB-Tabelle (Sprint AE Phase 1)`
2. `feat(google-cal): free/busy-Sync + Refresh-Token-Handling (Phase 2)`
3. `feat(google-cal): Write-Back bei Auftragsvergabe (Phase 3)`
4. `feat(google-cal): HW-Profil-UI für Connect/Disconnect (Phase 4)`

## Erfolg

- HW Demo-Handwerker-1 verbindet Cal in <30 Sek
- Verfügbare Slots im Mieter-Marktplatz spiegeln Google-Cal
- Vergabe schreibt Event ins Cal
- HW-Adoption-Friction ist GEKLÄRT
