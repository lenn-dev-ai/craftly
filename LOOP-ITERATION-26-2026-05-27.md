# Loop-Iteration-26 — 27.05.2026

## Feedbacks

| ID | created_at | Rolle | URL | Message |
|----|-----------|-------|-----|---------|
| d3495b20 | 2026-05-27 18:13 | admin | /dashboard-handwerker/angebot/f90c3a69 | "Was muss passieren, damit wir ein System Preis bekommen?" |

## Triage

### d3495b20 — BUG: `empfohlener_preis` bleibt immer null bei zeitnah/planbar-Auktionen

**Kontext**: Die Angebot-Seite (`/dashboard-handwerker/angebot/[id]`) liest
`einladungen WHERE handwerker_id = user.id` um den System-Festpreis anzuzeigen
(Vollkalkulations-Modell, Sprint F11). Wenn kein `einladungen`-Eintrag existiert,
zeigt die Seite "—" und blockiert den Submit-Button mit
"Kein System-Preis verfügbar".

**Root Cause**: `POST /api/auction/start` für zeitnah/planbar:
1. ✅ Setzt ticket.status = 'auktion'
2. ✅ Schickt Einladungs-E-Mails an HW im Radius (fire-and-forget)
3. ❌ Legt KEINE `einladungen`-Zeilen an

→ HW öffnet Link aus E-Mail → Query findet keine einladung → systemPreis = null

**Fix (dieser Commit)**: Im fire-and-forget Loop für zeitnah/planbar werden
zusätzlich zur E-Mail `einladungen`-Zeilen upsertet:

```
empfohlener_preis = (basis_stundensatz ?? basis_preis ?? 50) × estimated_stunden × surge_faktor
```

Estimated-Stunden-Tabelle:
- zeitnah → 2 h
- planbar → 3 h

Minimum: 80 € (vermeidet 0-€-Preise bei fehlenden Profil-Daten).

**Geänderte Datei**: `app/api/auction/start/route.ts`
- HW-Query erweitert: `basis_stundensatz, basis_preis` ergänzt
- Nach Radius-Filter: `einladungen` batch-upsert vor E-Mail-Versand

**Status**: GEFIXT in diesem Loop
