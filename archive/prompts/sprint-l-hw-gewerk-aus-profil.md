# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint L — HW-Gewerk aus Profil-Stamm statt pro-Ticket frei wählbar

> Bug-Fix. Lennart-Feedback `7de666f7` (18.05.): "Man sollte unten bei den aktuellen
> Ausschreibungen nicht einfach das Gewerk ändern können — kann ja keiner heute
> Sanitär und morgen Elektriker sein. Vllt. kann man 2 oder 3 Gewerke in den
> eigenen Einstellungen angeben."
>
> Aufwand: ~2-3h Claude Code. Eigenständig.

## Ziel

Handwerker können in ihrem Profil 1–3 Stamm-Gewerke hinterlegen. Im Marktplatz / bei Angebots-Abgabe ist das Gewerk dann nicht mehr frei wählbar, sondern auf die Stamm-Gewerke beschränkt. Wenn ein Ticket ein anderes Gewerk hat → wird HW garnicht erst angezeigt (Marktplatz-Filter).

## Code-Lokationen

- `app/dashboard-handwerker/profil/page.tsx` — neue Sektion „Meine Gewerke"
- `app/dashboard-handwerker/page.tsx` (Marktplatz) — Filter auf Stamm-Gewerke
- `app/api/angebote/create/route.ts` (oder wo das Angebot erstellt wird) — Validation
- DB: neue Tabelle oder JSONB-Spalte `profiles.handwerker_gewerke`

## Spec

### Phase L1 — Schema (XS, ~15 min)

```sql
-- Variante A: JSONB-Array auf profiles (einfacher)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handwerker_gewerke text[] DEFAULT NULL;

-- CHECK: 1-3 Einträge, jeder aus erlaubter Liste
ALTER TABLE public.profiles
  ADD CONSTRAINT IF NOT EXISTS handwerker_gewerke_valid
  CHECK (
    handwerker_gewerke IS NULL
    OR (
      array_length(handwerker_gewerke, 1) BETWEEN 1 AND 3
      AND handwerker_gewerke <@ ARRAY['wasser','heizung','strom','schloss','dach','fenster','boden','wand','sonstiges']
    )
  );

-- Index für Marktplatz-Filter
CREATE INDEX IF NOT EXISTS idx_profiles_handwerker_gewerke
  ON public.profiles USING gin(handwerker_gewerke)
  WHERE rolle = 'handwerker';
```

### Phase L2 — Profil-UI (~1h)

In `app/dashboard-handwerker/profil/page.tsx`:

- Neue Sektion „Meine Gewerke" (vor anderen Profil-Sektionen)
- Multi-Select mit max 3 Auswahl, mit Tooltip „Max 3 Gewerke — wir wollen Spezialisten, keine Allrounder"
- Checkbox-Liste mit allen 9 Gewerken
- Speichern via Supabase-Update auf `handwerker_gewerke`
- Validierung: mind. 1 Gewerk Pflicht, max 3
- Wenn nicht gesetzt: dezenter Hinweis „Setze deine Gewerke um Tickets zu sehen"

### Phase L3 — Marktplatz-Filter (~45 min)

In `app/dashboard-handwerker/page.tsx`:

- Bisher: alle offenen Tickets werden angezeigt
- Neu: filter `WHERE tickets.gewerk = ANY(profile.handwerker_gewerke)`
- Wenn HW noch keine Gewerke gesetzt hat: leere Marktplatz-Liste + CTA „Setze zuerst deine Gewerke im Profil"
- Frontend-Filter: keine Gewerk-Spalte mehr in der Angebots-Maske editierbar (Gewerk wird aus Ticket übernommen, nicht überschrieben)

### Phase L4 — Angebot-Endpoint Validation (~30 min)

In `app/api/angebote/create/route.ts` (oder wo Angebote erstellt werden):

```typescript
// Hole HW-Stamm-Gewerke
const { data: profile } = await supabase
  .from('profiles')
  .select('handwerker_gewerke')
  .eq('id', user.id)
  .single();

// Hole Ticket-Gewerk
const { data: ticket } = await supabase
  .from('tickets')
  .select('gewerk')
  .eq('id', ticketId)
  .single();

// Validate
if (!profile.handwerker_gewerke?.includes(ticket.gewerk)) {
  return NextResponse.json(
    { error: `Dieses Ticket ist Gewerk "${ticket.gewerk}". Du bietest nur ${profile.handwerker_gewerke.join(', ')} an.` },
    { status: 403 }
  );
}
```

### Phase L5 — Migration für bestehende HW (~15 min)

Bestehende HW haben kein `handwerker_gewerke` gesetzt — würden also nichts sehen.

```sql
-- Setze alle bestehenden HW auf alle Gewerke (Übergangslösung)
UPDATE public.profiles
SET handwerker_gewerke = ARRAY['wasser','heizung','strom','schloss','sonstiges']
WHERE rolle = 'handwerker' AND handwerker_gewerke IS NULL;
```

Plus: One-shot Banner für HW bei nächstem Login: „Bitte schränke deine Gewerke auf max 3 ein — sonst siehst du irrelevante Aufträge."

### Phase L6 — Smoke-Test + Commit (~20 min)

- Test mit test.handwerker: Profil öffnen → 2 Gewerke setzen → Marktplatz prüfen → nur passende Tickets sichtbar
- Versuch Angebot auf falsches Gewerk → 403
- Commit: `fix(handwerker): Stamm-Gewerke aus Profil statt frei wählbar (Sprint L, Feedback 7de666f7)`

## Constraints

- Pricing-Engine nicht anfassen
- Bestehende Angebote NICHT validieren (Migration setzt alle HW initial breit, danach grenzen sie selbst ein)
- Keine Breaking-Changes für laufende Auktionen

## Erfolg

- HW sieht nur Tickets in seinen Gewerken
- Verwalter bekommt nur qualifizierte Angebote (statt "Sanitär bietet auf Elektrik")
- Profil-UI zeigt Gewerke prominent

## Erster Schritt

Phase L1 (Schema-Erweiterung via Supabase-MCP — Cowork hat write-access).
