# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint AF — KI-Schnellauswahl smarter (Pills + KI-Round-Trip)

> Lennart-Feedback `f28deb26` + `7326f74f` (24./25.05.): Schnellauswahl-Pills
> im Mieter-Wizard wirken willkürlich, KI-Analyse danach manchmal
> langweilig (gleiche 5 Templates).
>
> Aufwand: ~0.5–1 Tag CC. Niedrig-prio (Nice-to-have).
> Lokation: `app/dashboard-mieter/melden/page.tsx` Step 1 ("foto")

## Status-Quo

`app/dashboard-mieter/melden/page.tsx` Zeilen 521-535: 5 hardcoded Pills
- "Heizung aus", "Wasserschaden", "Strom/Elektrik", "Tür/Fenster", "Schimmel"

Klick setzt einen festen Beispieltext in die Textarea. Nach `Sprint R`-Phase 1
wurde der Pill-Tap so umgelabelt, dass er nur als „Hilfe für den Anfang" wirkt.

**Trotzdem:** Lennart-Feedback sagt:
1. Pills decken nicht alle realen Fälle ab (z.B. Dach, Fassade, Boden fehlen)
2. Pre-Filled-Text ist generisch und hilft Mieter nicht wirklich
3. Bei vielen Fotos müsste die KI smarter sein, was sie als „wichtigsten" Pill ranked

## Ziel

Pills sind nicht statisch, sondern **dynamisch aus Top-Schadensarten** in
Reparo. Mieter sieht die 5 wahrscheinlichsten Pills basierend auf:
- Jahreszeit (Heizung-Defekte im Winter, Dach-Schaden bei Sturm)
- Eigenes Wohnungs-Profil (Altbau → Schimmel/Fassade häufiger; Neubau → Elektrik)
- Top-Categories des Verwalters in den letzten 30 Tagen

Plus: nach Foto-Upload wird **Foto-only-KI** kurz angerufen, um auf den
Pills das wahrscheinlichste vorzuselektieren.

## Architektur

### Phase 1 — Dynamische Pills aus DB (~3h)

**Neue API:** `GET /api/melden/pills?wohnung_id=...`

```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wohnungId = searchParams.get('wohnung_id');
  const userId = (await getUser()).id;

  // 1. Wenn wohnung_id mitgegeben: hole verwalter_id + objekt-typ
  // 2. Top-5 Schadensarten der letzten 30 Tage in diesem Verwalter-Pool
  // 3. Fallback: globale Top-5 (Heizung, Wasser, Elektrik, Tür, Schimmel)
  // 4. Saisonale Boosts:
  //    - Nov-Feb: Heizung +20%, Wasser-Frost +10%
  //    - Mrz-Mai: Schimmel +15% (nach Winter)
  //    - Jun-Aug: Klima +20%, Dach (Sturm) +10%
  //    - Sep-Okt: Heizung-Inbetrieb +15%

  return Response.json({ pills: top5 });
}
```

**Pills-Datenmodell:**
```typescript
type Pill = {
  key: string;           // 'heizung', 'wasser', ...
  label: string;         // 'Heizung aus'
  icon: string;          // emoji or single char
  startText: string;     // pre-fill for textarea
  gewerkHint: string;    // hilft KI später
};
```

### Phase 2 — Foto-only Pre-Analyse (~3h)

Wenn Mieter ein Foto hochlädt **bevor** er „Analyse starten" klickt:

```typescript
// Hintergrund-Call, NICHT blockierend
async function preAnalyzePhoto(file: File): Promise<{ likelyPill: string }> {
  const compressed = await compressPhoto(file, { maxBytes: 200_000 });
  const res = await fetch('/api/ki/foto-prescan', { method: 'POST', body: compressed });
  return res.json();
}
```

**API-Route:** `app/api/ki/foto-prescan/route.ts`

```typescript
// Claude/Anthropic-Vision-Call mit Mini-Prompt:
// "Welche dieser 5 Schadensarten erkennst du auf dem Bild?
//  - heizung
//  - wasser
//  - elektro
//  - tuer
//  - schimmel
//  - dach
//  - fassade
//  - boden
//  - sonstiges
//
//  Antworte nur mit dem Key, nichts anderes."
```

Response wird auf Pill als **selected**-State angezeigt:

```tsx
{pills.map(pill => {
  const isAutoSelected = pill.key === photoPreScanResult?.likelyPill;
  return (
    <button
      key={pill.key}
      onClick={() => setBeschreibung(pill.startText)}
      className={isAutoSelected
        ? "bg-accent/20 border-accent ring-2 ring-accent/30 ..."
        : "bg-surface-muted ..."
      }
    >
      {isAutoSelected && '✓ '}
      {pill.icon} {pill.label}
    </button>
  );
})}
```

### Phase 3 — KI-Round-Trip improvements (~2h)

Aktueller KI-Endpoint `app/api/ki/analysiere-schaden`:
- Nimmt Beschreibung + (1) Foto
- Liefert `{ gewerk, dringlichkeit, ... }` aus statischer Map `KI_ANALYSEN`

**Verbesserung:** Statt nur statische Map, KI dynamisch antworten lassen:

```typescript
// In app/api/ki/analysiere-schaden/route.ts:
const claudeResp = await callClaude({
  system: 'Du analysierst Wohnungsschäden für deutsche Hausverwaltungen.',
  prompt: `
    Beschreibung: ${beschreibung}
    Foto (wenn vorhanden): [Bild]

    Antworte JSON:
    {
      "titel": "kurzer Titel max 60 Zeichen",
      "gewerk": "heizung_sanitaer | elektro | schreiner | maler | dachdecker | bodenleger | allgemein",
      "dringlichkeit": "notfall | zeitnah | planbar",
      "tipp_fuer_mieter": "1-Satz Sofortmaßnahme",
      "geschaetzte_zeit_bis_reparatur": "z.B. '24-48 Stunden'"
    }
  `
});
```

Vorteil: Echte Variation pro Fall, nicht 9 fixe Templates.

**Fallback:** wenn Claude-Call fehlschlägt oder >3s dauert → bestehende
statische `KI_ANALYSEN`-Map.

## Implementation-Schritte

1. **Phase 1** (dynamische Pills) — kann unabhängig deployed werden
   - API-Route schreiben
   - `MeldenPage` useEffect bei wohnung-Wahl → Pills holen
   - Saison-Logic in Helper-Funktion auslagern
2. **Phase 2** (Foto-prescan) — separat deploybar
   - Photo-Compression-Helper (sharp oder browser-side)
   - API-Route `foto-prescan` neu
   - UI-State `photoPreScanResult` + visuelle Hervorhebung
3. **Phase 3** (KI-Round-Trip) — separat deploybar, optional
   - `analysiere-schaden` Route refactor
   - JSON-Schema-Validation für Response
   - Fallback-Pfad testen

## Tests

- E2E: Mieter ohne Wohnung-Profil → globale Pills sichtbar
- E2E: Mieter mit Altbau-Profil im November → Pills enthalten Heizung als #1
- Foto-prescan: Heizungs-Foto hochladen → Pill „Heizung aus" wird auto-selected
- Foto-prescan-Fallback: KI-Call mockt 500 → keine Pre-Selection, kein Crash

## Sanity-Check nach Deploy

1. `curl https://reparo-app.netlify.app/api/melden/pills` → 5 Pills im JSON
2. Mieter-Wizard öffnen → Pills sind nicht mehr hardcoded
3. Foto hochladen → nach ~1-2s ein Pill markiert (oder grau wenn kein Match)

## Constraints

- KEIN Breaking-Change: bestehende Pills bleiben als Fallback im Code
- `KI_ANALYSEN`-Map bleibt für Statik (Tipp, Zeit-Range)
- Keine extra ENVs nötig (Anthropic-Key ist schon da für Voice-AI)

## Commit-Struktur

1. `feat(melden): dynamische Pills aus DB + saisonale Logic (Sprint AF Phase 1)`
2. `feat(ki): foto-prescan Endpoint für Pre-Selection (Phase 2)`
3. `feat(ki): KI-Round-Trip dynamisch statt statisch (Phase 3)`

## Erfolg

- Pills wirken nicht mehr willkürlich, sondern relevant
- Foto-Upload führt zu spürbarer „Magie" (Pill leuchtet auf)
- KI-Output ist variabler statt repetitiv
