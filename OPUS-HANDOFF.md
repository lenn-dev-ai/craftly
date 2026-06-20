# Opus Handoff — Reparo Session 2026-06-20

## Kontext
Reparo ist eine KI-getriebene Hausverwaltungs-Plattform (Next.js 14 / Supabase / Netlify).
Repo: ~/Desktop/Reparo | Prod: https://reparo-app.netlify.app

---

## TEIL 1: Offener Bug — Vapi Voice AI

### Symptom
Anruf auf +1 (541) 800-4518 → englische Fehlermeldung „set the assistant id to your phonenumber or debug your request". KI antwortet nie auf Deutsch.

### Root Cause (vollständig aufgeklärt)
Vapi empfängt den Webhook-Response (HTTP 200, gültiges JSON) setzt aber `assistant = null`. Das passiert bei **unbekannten Feldern auf dem Assistant-Objekt**, die in Vapis `CreateAssistantDto` nicht existieren.

**Drei Ursachen, alle gefixt in lokalen Commits:**

| Commit | Fix |
|--------|-----|
| `b170c4b` | Deepgram `nova-3` → `nova-2-phonecall` (nova-3 war in altem Deployed-Stand) |
| `6415d8e` | `tools` von `assistant.tools` → `model.tools` (CreateAssistantDto hat kein top-level tools-Feld) |
| `98ba99c` | `silenceTimeoutSeconds` + `responseDelaySeconds` entfernt — beide NICHT in CreateAssistantDto, führten zu stiller Ablehnung. Ersatz: `startSpeakingPlan: { waitSeconds: 0.4 }` |

### Status
**3 Commits lokal, NICHT gepusht.** Lennart muss pushen:
```bash
cd ~/Desktop/Reparo && git push origin main
```

### Nach dem Push: testen
1. Testanruf auf +1 (541) 800-4518
2. Falls immer noch leer: Vapi Dashboard → Settings → Integrations → **Anthropic API Key prüfen** (noch nicht verifiziert — fehlendes Key würde Anthropic-Model silent scheitern lassen)
3. Falls Anthropic-Key fehlt: entweder Key eintragen oder Model auf `openai/gpt-4o-mini` wechseln als Isolation-Test

### Datei
`app/api/vapi/hw-assistant/route.ts` — aktueller Stand (98ba99c):
- Model: `anthropic/claude-3-5-haiku-20241022`, Transcriber: `deepgram/nova-2-phonecall/de`
- Voice: `openai/nova`, Tools in `model.tools` (3 Funktionen)
- `maxDurationSeconds: 300`, `startSpeakingPlan: { waitSeconds: 0.4 }`

### Vapi Credits
Nur noch ~10 Credits — ggf. Top-Up nötig vor weiteren Tests.

---

## TEIL 2: KI-Strategie Review

### Das Kernprinzip (was Reparo sein soll)
> **KI entscheidet, Menschen genehmigen — nicht umgekehrt.**

Alle drei Rollen sollen passiv sein: Mieter meldet, Verwalter bestätigt, Handwerker nimmt an. Die KI treibt den Prozess.

### Aktueller Stand pro Rolle

#### 👤 Mieter
**Vision:** Meldet Problem in 30 Sek., KI erkennt Kategorie + Dringlichkeit automatisch, bekommt Push/SMS-Updates ohne Login.

| Feature | Status |
|---------|--------|
| Melden-Wizard (Sprint BA) | ✅ gebaut |
| Wohneinheit-Picker | ✅ gebaut |
| Status sichtbar | ⚠️ manuell (kein Push) |
| KI-Kategorisierung beim Melden | ❌ fehlt |
| Foto-KI-Analyse (prescan) | ⚠️ Endpoint da, nicht integriert |
| Push/SMS-Notifications | ❌ fehlt |

**Gap:** Mieter ist noch aktiver Nutzer, kein passiver Melder. Priorität: MITTEL (Wizard ist für Beta OK).

#### 🏢 Verwalter
**Vision:** Öffnet App, sieht Ergebnisse. KI hat bereits vergeben + Termin gesetzt. Verwalter nur genehmigt oder eskaliert. Präferenzen 1× einstellen, dann passiv.

| Feature | Status |
|---------|--------|
| Direktvergabe-Flow (Sprint AM) | ✅ gebaut |
| Automatische Eskalation (Timeout-Cron) | ✅ gebaut |
| KI-HW-Empfehlung (Sprint BB) | ⚠️ Vorschlag da, kein Auto-Trigger |
| Verwalter-View: Monitoring statt Steuerung | ❌ fehlt — noch Buttons/Aktionen |
| Marktplatz = Statusanzeige statt manuelle Auswahl | ❌ fehlt |
| Präferenz-Config für KI-Verhalten | ❌ fehlt |

**Gap: HOCH.** Das ist Lennarts Hauptkritik: Backend-Logik ist weiter als die UI. Die KI macht schon automatisch Direktvergabe, aber der Verwalter sieht trotzdem „Handwerker einladen"-Buttons statt Statusmeldungen. Das UI widerspricht der Strategie.

**Was konkret geändert werden muss:**
- Marktplatz-View umbauen: Weg von „Aktionen ausführen" hin zu „Status beobachten + bestätigen"
- Kein „Handwerker einladen"-Button als primäre Aktion — stattdessen: „KI hat [HW] kontaktiert — wartet auf Antwort"
- Manuelle Eingriffe nur als expliziter Fallback (Eskalations-Button, versteckt)
- Neues Konzept: **Verwalter-Präferenzen** (Welche HW vertraue ich? Maximales Budget? Auto-Confirm nach X Stunden?) → KI arbeitet innerhalb dieser Leitplanken

#### 🔧 Handwerker
**Vision:** Morgens Anruf vom KI-Agent (Briefing + Auftragsempfehlungen). Agent nimmt passende Jobs automatisch an. Kalender wird automatisch geblockt. Einnahmen wachsen passiv.

| Feature | Status |
|---------|--------|
| Agent-Scoring (Sprint AX) | ✅ gebaut |
| KI-Assistent Chat (Sprint AV) | ✅ gebaut |
| Google-Cal Sync | ✅ gebaut |
| Voice-Briefing Webhook (Sprint AW) | ⚠️ Code fertig, Anruf kommt aber nicht an (Bug s.o.) |
| Auto-Accept Loop | ⚠️ Config-Felder da, kein Trigger der sie auslöst |
| Outbound-Call-Trigger (morgens anrufen) | ❌ fehlt |

**Gap: MITTEL** — erst sinnvoll anzugehen wenn Voice-Bug gefixt ist.

---

## TEIL 3: Was als nächstes zu tun ist

### Sofort (Vapi-Fix deployen)
```bash
cd ~/Desktop/Reparo && git push origin main
```
Dann testen + Anthropic-Key in Vapi prüfen.

### Sprint BD — Verwalter-View auf „Passiv/Monitoring" umbauen (HÖCHSTE PRIORITÄT)
Das ist die strategisch wichtigste Arbeit. Konkret:

1. **Marktplatz-View**: Von Aktionscentral zu Statusboard
   - Statt „Handwerker einladen": Timeline „KI hat Müller Elektro angefragt (vor 5 Min)"
   - Statt Auswahl-Buttons: Ergebnis-Banner „Vergeben an [HW] — Termin [Datum]"
   - Manueller Eingriff nur wenn KI scheitert (Fallback, visuell zurückgesetzt)

2. **Präferenz-Config für Verwalter** (Settings-Seite oder Profil-Tab):
   - Vertrauens-HW-Liste (diese immer zuerst)
   - Budget-Limit pro Gewerk
   - Auto-Confirm nach X Stunden (ja/nein)

3. **Notification-Layer**: Verwalter bekommt Push/E-Mail wenn KI eine Entscheidung getroffen hat — nicht wenn er selbst handeln soll

### Sprint BE — Outbound-Call-Trigger für HW
Wenn Voice-Bug gefixt:
- Scheduled Task (z.B. täglich 7:00) → Vapi Outbound-Call-API für jeden HW mit Reparo-Konto
- Fallback: HW ruft selbst an (bleibt erhalten)

### Sprint BF — Auto-Accept-Loop schließen
- Wenn neuer Job reinkommt (einladungen INSERT) → Agent-Scoring läuft → wenn score ≥ threshold UND agent_auto_accept = true → automatisch annehmen (einladungen.status = 'angenommen')
- HW bekommt Bestätigungs-SMS/Push

### Mittelfristig: Mieter
- KI-Kategorisierung beim Melden (Foto-Analyse → Gewerk + Dringlichkeit vorschlagen)
- Status-Notifications per E-Mail (ohne Login)

---

## Offene Nebenthemen (können warten)
- **#225**: Smoke-Test Google-Login Phase 1+2 (Lennart inkognito mit lennjahn@gmail.com)
- **#228**: Infra-Themen: Netlify Impressum-URL (#4), Resend-Domain (#8), HIBP Pro Plan (#12)

---

## Tech-Stack Reminder
- Next.js 14 App Router, TypeScript, Tailwind
- Supabase (Postgres + Auth + RLS)
- Netlify (Deploy + Scheduled Functions)
- Vapi (Voice AI) — Phone: +1 (541) 800-4518
- Resend (E-Mail), Mapbox (Karte), Google Calendar API
