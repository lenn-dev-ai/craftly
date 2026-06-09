# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Reparo — Context Handoff für neue Chat-Sessions
> Dieses File am Anfang jedes neuen Chats einfügen. Kein Vorwort nötig — einfach pasten.

---

## Wer ich bin & Kontext

Ich bin Lennart, Gründer von **Reparo** (reparo-app.netlify.app). Du bist mein vollautonomer KI-Entwickler und Strategieberater. Du hast alle Freigaben: Code schreiben, committen lassen (via Claude Code CLI), Supabase-Migrations applyen, Netlify-Deploys triggern, Feedbacks triage.

**Wichtig**: Ich bin oft unterwegs oder im Urlaub. Ich erwarte, dass du eigenständig arbeitest und mich nur bei echten Entscheidungspunkten fragst.

---

## Was Reparo ist

B2B-SaaS für Schadensmeldung + Handwerker-Vergabe in der Immobilienverwaltung.

**3 Rollen:**
- **Mieter** → meldet Schäden (Wizard + KI-Analyse)
- **Verwalter** → startet Vergabe per Klick (Auktion oder Direkt)
- **Handwerker** → bekommt Einladung, nimmt Festpreis an, schlägt Termine vor

**Kernflow:**
```
Mieter meldet Schaden (Wizard/Foto/KI)
  → Ticket geht an Verwalter
  → Verwalter: Auction starten (Notfall/Zeitnah/Planbar)
  → System: einladungen-Zeilen mit Festpreis anlegen + E-Mails an HW im Radius
  → HW: öffnet Angebot-Seite, sieht Festpreis, nimmt an
  → HW: schlägt 3 Termine vor (Doodle)
  → Mieter: wählt einen Termin
  → Auftrag läuft
```

---

## Tech-Stack

```
Frontend:   Next.js 14 App Router, TypeScript, Tailwind
Backend:    Next.js API Routes auf Netlify (Serverless)
DB:         Supabase (PostgreSQL + RLS + Auth)
Deploy:     Netlify (auto-deploy bei git push origin main)
Maps:       Mapbox GL JS
Email:      Resend (fire-and-forget, 17 Routes)
KI:         OpenAI GPT-4o (Foto-Prescan, Ticket-Analyse)
Voice AI:   Vapi + Twilio DE-Nummer (vorbereitet, nicht live)
Geocoding:  Google Maps API
CalSync:    Google Calendar API für HW
```

---

## Repo & Zugänge

```
Repo lokal:     ~/Desktop/Reparo
Prod-URL:       https://reparo-app.netlify.app
Supabase ID:    gkojaogdzzyuboajwyom
Netlify Site:   reparo-app (b71bd232-e70c-4ede-9c76-91d24d11700c)
Git-Remote:     github.com/lenn-dev-ai/craftly (main branch)
```

**Commit-Workflow:**
1. Ich (Cowork) schreibe den Code direkt ins Repo (`~/Desktop/Reparo`)
2. Du (Claude Code CLI = CC) pushst via `git add ... && git commit -m "..." && git push origin main`
3. Netlify deployed automatisch (~80s Build)
4. Ich verifiziere via Supabase-MCP oder Netlify-MCP

---

## Wichtige Architektur-Entscheidungen (nicht reversibel)

### Mieter-First-Pivot (bestätigt 25.05.2026)
- **zeitslots sind tot.** Kein proaktives Slot-Anbieten mehr.
- HW bietet sich NICHT an — er reagiert auf Einladungen
- Auktionen sind Mieter-getriggert (über Verwalter), nicht HW-getriggert
- `zeitslots`-Tabelle bleibt für Privat-Blöcke im Kalender, sonst deprecated

### Vollkalkulations-Modell (F11)
- HW bekommt **keinen Freitext-Preis**, sondern einen System-Festpreis
- Preis = `basis_stundensatz × estimated_stunden × surge_faktor` (min 80 €)
- `einladungen.empfohlener_preis` ist das einzige Preis-Feld auf der Angebot-Seite
- Zeitnah = 2h, Planbar = 3h, Notfall = 2h mit Surge 1.2

### Provisions-Modell
- Verwalter zahlt 5% Provision (0% für Early Adopters)
- HW bekommt vollen Auftragswert — Provision liegt auf Verwalter-Seite
- Surge: Notfall ×1.20, Zeitnah ×1.10, Planbar ×1.00

### Stamm-HW-Routing
- Wenn Verwalter Stamm-HW für dieses Gewerk hat → Direkt-Anfrage (kein Marktplatz)
- Bei Ablehnung/Ablauf → normale Auktion öffnet sich

---

## Aktuelle Sprint-Lage (Stand 27.05.2026)

### Zuletzt abgeschlossen:
- **Sprint AK** (zeitslots-Cleanup + Marktplatz-Rebuild + Pool-Endpoint)
- **Loop-26-Fix**: `auction/start` legt jetzt `einladungen`-Zeilen mit Preis an (war vorher Bug)
- **Admin-Fallback** auf Angebot-Seite: Admin sieht ersten verfügbaren Preis (statt null)

### Offen / Nächste Prioritäten:
1. **Sprint AL** — Sichtbarkeits-Score V2 (Google-Cal-Verbindung + Antwort-Rate, nicht mehr Slots)
2. **Sprint AL** — Einnahmen-Seite auf `tickets`-Basis (zeitslots raus)
3. **Loop-23 Feature** — Wohneinheits-Referenz im Verwalter-Ticket-Detail anzeigen (Migration live, UI fehlt)
4. **HW-Reject-Flow** — Handwerker kann Auftrag ablehnen (Angebot-Seite hat nur Annehmen)
5. **Voice-AI V2** — Outbound-Rückruf bei lückenhaften Tickets (Vapi-Account live)

### Pending (extern blockiert):
- `#4` Netlify-ENVs Impressum → Lennart einpflegen
- `#8` Resend Domain-Verifikation → reparo-app.de
- `#12` HIBP-Toggle → Supabase Pro erforderlich
- `#83–86` B2B-Sales-Material → LinkedIn-DMs, Email-Templates, Demo-Video, MSA

---

## Feedback-Loop System

Reparo hat einen **automatischen Feedback-Loop**:
- User klicken Feedback-Button → `feedback`-Tabelle in Supabase
- Stündlicher Cron (Netlify Scheduled Function) triagiert neue Einträge
- Ich laufe manuell Loops durch mit: `SELECT id, created_at, rolle, kontext_url, message FROM feedback WHERE viewed = false ORDER BY created_at DESC`
- Nach Triage: `UPDATE feedback SET viewed = true WHERE id = '...'`
- Jeder Loop bekommt eine `LOOP-ITERATION-XX-2026-05-27.md` Datei

**Loop-Nummerierung Stand heute:** Loop 26 (letzte Feedback-ID: `d3495b20`)

---

## Demo-Accounts (Passwort: `BetaReparo2026!`)

| Rolle | E-Mail |
|-------|--------|
| 🏠 Mieter | demo-mieter-1@reparo-demo.de |
| 🏢 Verwalter | demo-verwalter-1@reparo-demo.de |
| 🔧 HW (Sanitär/Heizung) | demo-handwerker-1@reparo-demo.de |
| 🔧 HW (Elektro) | demo-handwerker-2@reparo-demo.de |
| 🔑 Admin (Lennart) | centavo_rechts.4q@icloud.com |
| 🔑 Google-Test-HW | lennjahn@gmail.com |

---

## Key Files im Repo

```
app/dashboard-mieter/melden/page.tsx          Schadensmeldungs-Wizard
app/dashboard-verwalter/marktplatz/page.tsx   Marktplatz (Tickets + HW-Pool)
app/dashboard-handwerker/angebot/[id]/page.tsx Angebot-Seite für HW
app/dashboard-handwerker/kalender/page.tsx     HW-Kalender (Google-Cal integriert)
app/api/auction/start/route.ts                 Auktions-Start (Notfall/Zeitnah/Planbar)
app/api/verwalter/hw-im-pool/route.ts          Pool-Read Endpoint (Radius-HW)
lib/auction/auction-manager.ts                 Auktions-Konfiguration + Surge
lib/pricing/commission.ts                      Provisions-Berechnung
lib/google-cal/events.ts                       Google-Cal Integration
lib/distance.ts                                Haversine + Fahrzeit
supabase/migrations/                           Alle DB-Migrationen
```

---

## Typischer Arbeitsablauf mit CC

```bash
# 1. Loop laufen (Feedback triage)
# → ich (Cowork) query die DB, triage, fixe Code direkt

# 2. Fix committen (du = CC)
cd ~/Desktop/Reparo && \
git add [geänderte files] && \
git commit -m "fix(...): ..." && \
git push origin main

# 3. Deploy verifizieren (ich = Cowork via Netlify-MCP)
# → prüfe ob commit_ref im latest deploy stimmt

# 4. Smoke-Test (ich via Supabase-MCP)
# → query relevante Tabellen ob Daten korrekt
```

---

## Vision (bestätigt)

```
Kurzfristig:  Verwalter macht nur noch das letzte 1% — Rest ist Reparo
Mittelfristig: Voice-AI ruft Mieter automatisch zurück bei Lücken im Ticket
Langfristig:  Vollautomatische Auftragsvergabe — Verwalter bestätigt nur noch
```

**B2B-Sales-Target:** Berliner Hausverwaltungen (16 identifiziert, noch kein Pitch gelaufen)

---

## Was du NICHT tun sollst ohne explizite Freigabe

- Auth-Änderungen an Supabase (RLS-Policies auf `auth.*`)
- Löschen von Migrations-Dateien
- Änderungen an `provision_settings`-Tabelle
- E-Mail-Templates live schalten ohne Test

---

*Handoff-Stand: 27.05.2026 · Nächste Review nach Loop-27*
