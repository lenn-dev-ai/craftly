# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Admin-Feedback-Dashboard als Next.js-Route einbauen

> Erzeugt von Cowork, 18.05.2026 14:25.
> Direkt in Claude Code (Reparo-Ordner) reinpasten.
> Aufwand: M (~30-45 Min). Kann nach H1+H5+M5-Sprint laufen, oder davor wenn Lennart Admin-Dashboard-Zugang prioritaer braucht.

---

## Kontext

Cowork hat das Feedback-Dashboard als Standalone-HTML unter `/Users/lennart/Desktop/Reparo/feedback-dashboard.html` gebaut (login-geschuetzt via Supabase-Client). Lennart will es auch vom Handy aus erreichen und sauber in den Admin-Bereich integriert haben.

Ziel: gleiche Funktionalitaet als React-Komponente in `app/dashboard-admin/feedback/page.tsx`, geschuetzt durch die bestehende Admin-Middleware.

## Pflicht-Reads

1. `/Users/lennart/Desktop/Reparo/feedback-dashboard.html` — die Standalone-Variante, hat alle Logik (VERDICTS-Objekt, Filter, Klassifikation, Mark-viewed-Toggle, askClaude-Stub)
2. `app/dashboard-admin/layout.tsx` und `app/dashboard-admin/page.tsx` — bestehendes Admin-Layout-Pattern (Sidebar-Eintraege, Cards, KPIs)
3. `components/Sidebar.tsx` oder aehnlich — wo der „Feedback"-Eintrag in die Admin-Sidebar muss
4. `lib/supabase.ts` — der bestehende Supabase-Client (kein extra Setup noetig)

## Was zu bauen ist

### 1. Route + Page-Komponente

Datei: `app/dashboard-admin/feedback/page.tsx`

- Server-Component oder Client-Component? **Client**, weil interaktive Filter + Live-Refresh
- "use client" oben
- Imports: `useState`, `useEffect`, `useMemo`, `createClient` aus `lib/supabase`
- Holt Feedbacks via `supabase.from('feedback').select(...)` mit den gleichen Spalten wie das Standalone (id, user_id, rolle, kontext_url, message, viewed, created_at)
- RLS regelt eh dass nur Admins alle sehen
- Komponente rendert:
  - Stats-Bar oben (Total / Unviewed / Blocker / Bugs / UX / Features / Positives / Erledigt)
  - Filter-Chips (Status / Owner / Rolle)
  - Feedback-Liste mit Verdict-Karten

### 2. VERDICTS-Lookup

- Das VERDICTS-Objekt aus dem Standalone-HTML uebernehmen
- Speichern als `lib/feedback-verdicts.ts` (TypeScript-Konstanten)
- Type definieren: `type Verdict = { cat, sev, area, summary, recommendation, status, owner, ref? }`
- Lookup-Funktion `getVerdict(id, message)` mit Fallback auf Heuristik wenn kein manuelles Verdict da

### 3. Verdict-Card-Komponente

Datei: `components/admin/FeedbackVerdictCard.tsx`

- Pro Feedback eine Karte mit gleichen Inhalten wie im Standalone (Badges, Verdict-Block mit Status/Owner/Bereich/Empfehlung/Referenz, Mark-viewed-Button)
- Tailwind-Klassen statt Inline-CSS
- Reparo-Brand-Farben nutzen (text-rolle-* / bg-rolle-* sind schon definiert)

### 4. Sidebar-Eintrag

In der Admin-Sidebar (vermutlich `components/Sidebar.tsx` oder `app/dashboard-admin/layout.tsx`):

```tsx
{ href: "/dashboard-admin/feedback", label: "Feedback", Icon: MessageSquare }
```

Idealerweise als 3. oder 4. Eintrag (nach „Start" / „Nutzer", vor „Aktivitaet" / „System").

### 5. Mobile-BottomNav

Wenn Admin eine BottomNav hat (siehe `components/layout/BottomNav.tsx`): „Feedback"-Eintrag ergaenzen oder einen der 4 Top-Items ersetzen. Empfehlung: Reihenfolge Start / Feedback / Nutzer / System fuer Admin-Mobile.

### 6. Verwaiste Datei

Nach erfolgreichem Deploy: das Standalone `/Users/lennart/Desktop/Reparo/feedback-dashboard.html` kann bestehen bleiben als Backup, oder via README-Notiz als deprecated markiert werden.

## Erwartetes Verhalten

- Admin loggt sich ein → Sidebar zeigt „Feedback"
- Klick → `/dashboard-admin/feedback` → alle Feedbacks mit Verdicts
- Mobile: BottomNav zeigt „Feedback"-Icon → erreichbar auch auf Handy
- Live: SELECT laeuft bei jedem Page-Load + manueller Refresh-Button + (optional) Auto-Refresh-Toggle
- Mark-viewed: UPDATE direkt via Supabase, Liste reloadet

## Constraints

- Pricing/Stripe nicht anfassen
- Pro Phase max. 1 Klaerungsfrage
- Bestehende VERDICTS-Daten 1:1 aus Standalone uebernehmen (Eintraege fuer 11 Feedbacks)
- Mobile-First wie der Rest des Admin-Bereichs

## Erster Schritt

Liste mir die Dateien `app/dashboard-admin/layout.tsx`, `app/dashboard-admin/page.tsx`, und falls existent `components/Sidebar.tsx` — damit ich den Stil + die Sidebar-Konvention sehe. Dann fang ich mit `lib/feedback-verdicts.ts` an, weil das die Basis ist.
