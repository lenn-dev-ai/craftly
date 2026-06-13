# CC-Master-Prompt — Health-Fix Sprint 2026-06-09

Du bist Claude Code im Reparo-Projekt (Next.js 14, Supabase, Netlify).
Führe alle Aufgaben eigenständig durch, committe am Ende gesammelt.

---

## KONTEXT

Health-Check vom 09.06.2026 hat folgende Probleme identifiziert:
1. Landing Page zeigt alte Bid-Sprache (Vollkalkulations-Modell längst live)
2. Anti-Pause fehlt — Supabase Free Tier pausiert nach 7 Tagen ohne DB-Connection
3. Loop-27: 5 neue Feedbacks vom 27.05. ohne Verdicts (Supabase war pausiert)
4. Demo-HW-Profile unvollständig (kein Gewerk / kein Stundensatz / keine Koordinaten)
5. HW-Dashboard: VERFÜGBAR IM RADIUS Kachel ist nicht klickbar
6. Resend: roter Dot in Mission-Control — Health-Check-Logging verbessern

---

## AUFGABE 1 — LANDING PAGE FIX

**Datei finden**: Suche nach der Landing Page (wahrscheinlich `app/page.tsx`).

**Ersetze folgende Texte:**

| Alt (falsch) | Neu (korrekt) |
|---|---|
| "Die erste Stundenauktion für Immobilien" | "Die intelligente Schadensmeldung für Immobilien" |
| "Verwalter bieten auf deine Stunden" | "Verwalter buchen dich direkt — zum Festpreis" |
| Jeder Text mit "Auktion" / "bieten" im HW-Kontext | Formulierungen mit "Festpreis" / "Einladung" / "direkt buchen" |

Hintergrund: Das Modell ist Vollkalkulation (F11). System berechnet Festpreis.
HW erhält Einladung und nimmt an/ab. Kein Bieten. Kein Auktions-Wettbewerb.

---

## AUFGABE 2 — SUPABASE ANTI-PAUSE CRON

**Problem**: Supabase Free Tier pausiert nach 7 Tagen ohne aktive DB-Verbindungen.
Das zerstört die App komplett (503 auf Auth-Endpoint).

**Lösung A — Netlify Scheduled Function** (bevorzugt):

Erstelle `app/api/cron/keep-alive/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: Request) {
  // Sicherheits-Check: nur von Netlify-Cron erlauben
  const authHeader = request.headers.get('x-netlify-event')
  
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
    
    if (error) throw error
    
    console.log('[keep-alive] Supabase ping OK', new Date().toISOString())
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[keep-alive] Supabase ping FAILED', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
```

Füge in `netlify.toml` hinzu (erstelle die Datei falls nicht vorhanden):

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# Täglich um 06:00 UTC Supabase wachhalten
[[crons]]
  schedule = "0 6 * * *"
  function = "cron-keep-alive"
```

Falls `netlify.toml` bereits existiert: nur den `[[crons]]`-Block hinzufügen,
bestehende Konfiguration NICHT überschreiben.

**Alternative**: Wenn die `netlify.toml`-Cron-Syntax für Next.js-Projekte
zu komplex ist, reicht auch ein Kommentar-Block mit der Empfehlung,
einen externen Ping-Service (cron-job.org) auf die URL
`https://reparo-app.netlify.app/api/cron/keep-alive` zu setzen.

---

## AUFGABE 3 — DEMO-HW-PROFILE FIXEN (SQL via Supabase)

**Problem**: Alle 3 Demo-Handwerker haben null lat/lng → werden nie im Radius gefunden.
Demo-HW-1 und -3 haben auch kein Gewerk gesetzt.

**Führe folgendes SQL in der Supabase aus** (via `supabase.from()` oder Migration):

Erstelle Migration `supabase/migrations/[timestamp]_fix_demo_hw_profiles.sql`:

```sql
-- Demo Handwerker 1 (Sanitär & Heizung, Berlin-Mitte)
UPDATE public.profiles SET
  gewerk            = 'heizung_sanitaer',
  basis_stundensatz = 65,
  lat               = 52.5200,
  lng               = 13.4050,
  radius_km         = 40,
  name              = 'Demo Handwerker 1'
WHERE email = 'demo-handwerker-1@reparo-demo.de';

-- Demo Handwerker 2 (Elektro, Berlin-Kreuzberg)  
UPDATE public.profiles SET
  gewerk            = 'elektro',
  basis_stundensatz = 60,
  lat               = 52.4966,
  lng               = 13.3253,
  radius_km         = 40
WHERE email = 'demo-handwerker-2@reparo-demo.de';

-- Demo Handwerker 3 (Maler, Berlin-Prenzlauer Berg)
UPDATE public.profiles SET
  gewerk            = 'maler',
  basis_stundensatz = 55,
  lat               = 52.5408,
  lng               = 13.4147,
  radius_km         = 40
WHERE email = 'demo-handwerker-3@reparo-demo.de';
```

Wende diese Migration sofort auf Production an (via `supabase db push` oder
direkt via Supabase-Dashboard SQL-Editor).

---

## AUFGABE 4 — HW-KACHEL "VERFÜGBAR IM RADIUS" KLICKBAR MACHEN

**Datei**: `app/dashboard-handwerker/page.tsx`

**Problem**: Die Kachel "VERFÜGBAR IM RADIUS / X offene Ausschreibungen"
ist nicht klickbar. Andere Kacheln (MEINE AUFTRÄGE) linken intern.

**Fix**: Wrap die Kachel in einen `<Link>` oder füge `onClick` + `useRouter` hinzu.
Ziel: `#ausschreibungen` (Anker auf der gleichen Seite zur Ausschreibungs-Liste)
oder `/dashboard-handwerker/auftraege`.

Pattern (wie andere Kacheln):
```tsx
// Vorher:
<div className="kachel ...">
  <span>VERFÜGBAR IM RADIUS</span>
  ...
</div>

// Nachher:
<Link href="#ausschreibungen" className="kachel cursor-pointer hover:shadow-md transition ...">
  <span>VERFÜGBAR IM RADIUS</span>
  ...
</Link>
```

---

## AUFGABE 5 — RESEND HEALTH CHECK VERBESSERN

**Datei**: Suche nach dem Health-Check-Endpoint (wahrscheinlich
`app/api/admin/health/route.ts` oder `app/dashboard-admin/page.tsx`).

**Problem**: Resend zeigt rot in Mission Control. Wir wissen nicht warum.

**Fix**: Verbessere den Resend-Health-Check um den echten Fehler zu loggen:

```typescript
// In der Health-Check-Funktion für Resend:
try {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    resendStatus = { ok: false, reason: 'RESEND_API_KEY nicht gesetzt' }
  } else {
    // Kurzer Domains-Check via Resend API
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${resendApiKey}` },
      signal: AbortSignal.timeout(5000)
    })
    if (res.ok) {
      resendStatus = { ok: true }
    } else {
      const body = await res.text()
      resendStatus = { ok: false, reason: `HTTP ${res.status}: ${body.slice(0, 100)}` }
    }
  }
} catch (err) {
  resendStatus = { ok: false, reason: String(err) }
}
```

Stelle sicher dass der `reason` auch im Frontend angezeigt wird (Tooltip oder
kleiner Text unter dem roten Dot).

---

## AUFGABE 6 — LOOP-ITERATION-27 DOKUMENT

Erstelle `LOOP-ITERATION-27-2026-06-09.md`:

```markdown
# Loop-Iteration-27 — 09.06.2026

## Feedbacks (5 neue seit 27.05., alle WARTET COWORK)

| ID | Datum | Rolle | URL | Message |
|----|-------|-------|-----|---------|
| d3495b20 | 27.05.26 | Admin | /dashboard-handwerker/angebot/f90c3... | Was muss passieren, damit wir ein System Preis bekommen? |
| — | 27.05.26 | Admin | /dashboard-handwerker#ausschreibungen | verfügbar im radius 1 aber ich kann nicht draufklicken... |
| — | 27.05.26 | Admin | /dashboard-verwalter/marktplatz | Warum muss ich handwerker erst als stammhandwerker anlegen... |
| — | 27.05.26 | Admin | /dashboard-mieter/melden | Hier fehlt mieter nummer |
| — | 27.05.26 | HW | /dashboard-handwerker | Warum steht hier Hallo Mieter wenns handwerker ist? |

## Triage

### d3495b20 — ERLEDIGT (Loop-26)
System-Preis auf Angebot-Seite. Behoben in Loop-26 (commit aff1032 + 7186097).

### HW-Kachel nicht klickbar — BUG (S)
Root Cause: `<div>` ohne Link/onClick. Fix: Link zu #ausschreibungen.
Status: GEFIXT in diesem Loop (Aufgabe 4).

### "Warum erst Stamm-HW anlegen?" — KONZEPT-KLARSTELLUNG (UX)
Der Marktplatz zeigt Stamm-HW UND Pool-HW. Stamm-HW ist optional/bevorzugt.
Die Auktionslogik läuft auch ohne Stamm-HW (Radius-Matching im Pool).
Problem: UI-Text im Marktplatz macht das nicht klar.
Empfehlung: Tooltip/Erklär-Text auf Marktplatz-Seite "Stamm-HW = bevorzugt,
Pool = alle verfügbaren HW im Radius". Sprint AL oder Loop-28.

### "Hier fehlt mieter nummer" — FEATURE (M)
Wohneinheits-Referenz im Mieter-Melden-Wizard.
Migration loop23_tickets_wohneinheit_referenz ist live (Spalte existiert),
aber UI-Feld fehlt noch im Wizard.
Empfehlung: Im Ticket-Wizard nach "Adresse" ein optionales Feld
"Wohneinheit / Mieternummer" einfügen. Sprint AL.

### "Hallo Mieter wenns Handwerker" — BEREITS GEFIXT
Sprint AJ hat den Rollen-Switcher + Begrüßung korrigiert.
Heute live: "Hallo, [Name]" ohne Rollen-Präfix. Kein Handlungsbedarf.

## Status: Loop-27 DURCH
Fixes deployed: HW-Kachel klickbar.
Pending: Marktplatz-Erklär-Text (Loop-28), Wohneinheit-Wizard-Feld (Sprint AL).
```

---

## AUFGABE 7 — CONTEXT-HANDOFF UPDATEN

Update `CONTEXT-HANDOFF.md`:

Füge folgendes unter "Infrastruktur / Wichtige Eigenheiten" hinzu:

```markdown
## Supabase Free Tier — Auto-Pause

**WICHTIG**: Das Projekt pausiert nach 7 Tagen ohne DB-Verbindungen.
Symptom: Login-Spinner dreht endlos, Console zeigt `TypeError: Failed to fetch` 
auf `auth/v1/token?grant_type=refresh_token` mit HTTP 503.

Lösung:
1. Supabase MCP: `restore_project` mit project_id `gkojaogdzzyuboajwyom`
2. Warte 30-60 Sekunden
3. Browser: localStorage/sessionStorage/Cookies clearen, dann neu laden

Anti-Pause-Mechanismus: `/api/cron/keep-alive` läuft täglich via Netlify Cron.
```

Aktualisiere auch den Sprint-Stand:
- Loop-27: ✅ 5 Feedbacks triagiert
- Demo-HW-Profile: ✅ Koordinaten + Stundensatz gesetzt
- Landing Page: ✅ Vollkalkulations-Sprache

---

## COMMIT

```
feat(health-fix-27): Landing + Anti-Pause + Demo-HW + Kachel + Loop-27

- Landing Page: Bid-Sprache durch Vollkalkulations-Sprache ersetzt
  (Stundenauktion → Festpreis, Verwalter bieten → direkt buchen)
- Cron: /api/cron/keep-alive verhindert Supabase-Auto-Pause (tägl. 06:00)
- SQL: Demo-HW-1/-2/-3 bekommen Gewerk, Stundensatz, Berlin-Koordinaten
- HW-Dashboard: VERFÜGBAR-IM-RADIUS-Kachel → klickbar (Link #ausschreibungen)
- Resend Health-Check: Fehlermeldung im UI sichtbar (reason-Feld)
- LOOP-ITERATION-27-2026-06-09.md erstellt (5 Feedbacks triagiert)
- CONTEXT-HANDOFF.md: Anti-Pause-Doku + Sprint-Stand aktualisiert
```

---

## WICHTIGE HINWEISE

- Die Demo-HW-SQL muss auf PRODUCTION laufen — entweder via Migration-File
  oder direkt im Supabase SQL-Editor
- Bei `netlify.toml`: bestehende Konfiguration NICHT überschreiben
- Die Landing Page hat wahrscheinlich mehrere Stellen mit alter Sprache —
  suche nach "Auktion", "bieten", "Stundenauktion" im ganzen File
- Nach Push: Netlify deployed automatisch (~2-3 Min), dann Demo-HW im Admin
  prüfen (Nutzer-Seite sollte 0 HW-Warnungen zeigen)
