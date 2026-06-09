# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint AI — Wizard-Refactor (Nachzug Sprint R Phase 3)

> Aus Sprint R Phase R3, aber als eigenständiger Sprint herausgezogen weil
> R3 in Originalspec untergeht — hier explizit als Sprint mit klarer
> Acceptance.
>
> Aufwand: ~2-3h CC. Mittel-prio (Code-Hygiene, kein User-Feature).

## Problem

Zwei Wizards mit nahezu identischer Logik:

| Lokation | LOC (aktuell) |
|---|---|
| `app/dashboard-mieter/melden/page.tsx` | ~915 |
| `app/dashboard-verwalter/neues-ticket/page.tsx` | ~361 |

Beide:
- 5-Step Flow (Foto → KI-Analyse → Details → Ort → Zusammenfassung)
- Foto-Upload mit Compression
- KI-Klassifikator-Aufruf
- Submit nach Supabase

Drift-Risiko: Sprint R Phase 1 (Pills als optional labeln) wurde nur im
Mieter-Wizard umgesetzt; Verwalter könnte das gleiche Problem haben aber
ist nicht synchronisiert.

## Ziel

Eine **shared Component** `components/wizard/TicketWizard.tsx`. Beide Pages
rendern nur noch ~80-200 LOC mit `<TicketWizard variant="..." />`.

## Architektur

### Neue Datei: `components/wizard/TicketWizard.tsx`

```tsx
'use client';
import { useState, useRef } from 'react';
import { Foto Step } from './steps/FotoStep';
import { AnalyseStep } from './steps/AnalyseStep';
import { DetailsStep } from './steps/DetailsStep';
import { OrtStep } from './steps/OrtStep';
import { ZusammenfassungStep } from './steps/ZusammenfassungStep';

type Variant = 'mieter' | 'verwalter';

interface TicketWizardProps {
  variant: Variant;
  /** Verwalter: zusätzlich Anrufer-Daten erfassen */
  showAnruferFelder?: boolean;
  /** Default-Wohnung-ID (z.B. wenn Mieter nur 1 hat) */
  defaultWohnungId?: string;
  /** Welche Wohnungen sind verfügbar (Verwalter: alle eigenen; Mieter: nur seine) */
  wohnungen: Array<{ id: string; adresse: string; nr: string }>;
  /** Callback nach erfolgreichem Submit */
  onSuccess?: (ticketId: string) => void;
}

export function TicketWizard({ variant, showAnruferFelder, defaultWohnungId, wohnungen, onSuccess }: TicketWizardProps) {
  const [step, setStep] = useState<'foto' | 'analyse' | 'details' | 'ort' | 'zusammenfassung'>('foto');
  // ... shared State

  return (
    <div className="min-h-screen bg-surface text-ink">
      <WizardHeader step={step} totalSteps={variant === 'verwalter' && showAnruferFelder ? 6 : 5} />
      <WizardProgressBar step={step} />
      <div className="max-w-xl mx-auto px-6 py-8">
        {step === 'foto' && <FotoStep onNext={...} variant={variant} />}
        {step === 'analyse' && <AnalyseStep onResult={...} />}
        {step === 'details' && <DetailsStep variant={variant} showAnruferFelder={showAnruferFelder} />}
        {step === 'ort' && <OrtStep wohnungen={wohnungen} defaultWohnungId={defaultWohnungId} />}
        {step === 'zusammenfassung' && <ZusammenfassungStep onSubmit={...} />}
      </div>
    </div>
  );
}
```

### Steps als sub-Module

```
components/wizard/
├── TicketWizard.tsx          (orchestrator, 80-100 LOC)
├── steps/
│   ├── FotoStep.tsx          (Foto-Grid, Beschreibung, Pills — 200 LOC)
│   ├── AnalyseStep.tsx       (Loading-Animation — 50 LOC)
│   ├── DetailsStep.tsx       (Titel, Gewerk, Anrufer-Felder optional — 150 LOC)
│   ├── OrtStep.tsx           (Wohnung-Picker, Einsatzort-Adresse — 100 LOC)
│   └── ZusammenfassungStep.tsx (Review + Submit — 100 LOC)
└── helpers/
    ├── fotoUpload.ts         (Compression, Validation — bestehender Code extrahieren)
    └── kiAnalyse.ts          (API-Call wrappen)
```

### Anrufer-Felder (Verwalter only)

`DetailsStep` mit `showAnruferFelder=true` zeigt zusätzlich:
- Anrufer-Name (Verwalter dokumentiert: wer hat angerufen)
- Anrufer-Telefon (für Rückfrage)
- `ticket.eingetragen_von_verwalter = true` (DB-Spalte aus Sprint G)

### Page-Refactor

`app/dashboard-mieter/melden/page.tsx` → ~80 LOC:

```tsx
'use client';
import { TicketWizard } from '@/components/wizard/TicketWizard';
import { useUser } from '@/lib/auth';
import { useWohnungen } from '@/lib/hooks';

export default function MeldenPage() {
  const user = useUser();
  const wohnungen = useWohnungen({ mieter_id: user.id });
  return (
    <TicketWizard
      variant="mieter"
      wohnungen={wohnungen}
      defaultWohnungId={wohnungen.length === 1 ? wohnungen[0].id : undefined}
      onSuccess={(id) => router.push(`/dashboard-mieter/vorgang/${id}`)}
    />
  );
}
```

`app/dashboard-verwalter/neues-ticket/page.tsx` → ~80 LOC:

```tsx
'use client';
import { TicketWizard } from '@/components/wizard/TicketWizard';

export default function NeuesTicketPage() {
  const user = useUser();
  const wohnungen = useWohnungen({ verwalter_id: user.id });
  return (
    <TicketWizard
      variant="verwalter"
      showAnruferFelder
      wohnungen={wohnungen}
      onSuccess={(id) => router.push(`/dashboard-verwalter/ticket/${id}`)}
    />
  );
}
```

## Migration-Schritte

1. **Backup**: aktuelle 2 Pages in `.archive/` kopieren als Referenz
2. **Skeleton**: `TicketWizard.tsx` + Steps anlegen, Props definieren
3. **Foto-Step migrieren** — primär aus Mieter-Wizard (915 LOC hat mehr Logic)
4. **Analyse-Step migrieren** — fast 1:1
5. **Details-Step migrieren** + Variant-Switch für Anrufer-Felder
6. **Ort-Step migrieren** + Wohnungs-Default-Logic
7. **Zusammenfassung-Step** migrieren
8. **Pages umstellen** auf neue Component
9. **Tests grün** (Sprint J Playwright muss durch)

## Acceptance

- Mieter-Wizard-Page: <100 LOC
- Verwalter-Wizard-Page: <100 LOC
- Shared `TicketWizard` Component: ≤200 LOC, alle Steps <250 LOC
- Bestehende E2E-Tests (Sprint J) bestehen
- Visuell identisch zu vorher (Diff in Lighthouse-Snapshots)

## Risiken & Mitigation

| Risiko | Mitigation |
|---|---|
| Breaking-Change in Mieter-Flow | Backup in `.archive/`; Beta-Tester Smoke vor Deploy |
| Variant-Conditional explodiert (zu viele if-Branches) | Strict: max 2 if-Statements pro Step; sonst weiter splitten |
| KI-Endpoint-Variant-Drift | KI-Call ist gleich für beide Varianten, nur Submit-Schritt unterscheidet sich |

## Constraints

- KI-Analysiere-Endpoint NICHT anfassen
- DB-Schema NICHT anfassen
- Wording (Auktion → Marktplatz aus Sprint R Phase R5) NICHT in diesem Sprint mitnehmen — separate Phase

## Commit-Struktur

1. `refactor(wizard): TicketWizard component + steps skeleton (Sprint AI 1/3)`
2. `refactor(wizard): migrate steps from mieter-wizard (Sprint AI 2/3)`
3. `refactor(wizard): pages use TicketWizard, archive originals (Sprint AI 3/3)`

## Erfolg

- 2 Wizard-Pages = je <100 LOC
- Drift-Risiko zwischen Mieter/Verwalter weg
- Sprint R Phase R3 nachgeholt
