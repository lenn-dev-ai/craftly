# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint N — Empty-States + Fehlermeldungen

> Aus Audit-Empfehlung 2: „Deutlichere Fehler- und Leermeldungen: Beispielsweise in der Tickets- oder Marktplatz-Ansicht sollten Hinweise geben, warum keine Daten vorhanden sind."
>
> Aufwand: ~2-3h Claude Code. Eigenständig.

## Ziel

Jede Liste/Tabelle hat einen sinnvollen Empty-State mit:
1. **Icon** (Lucide, Reparo-Grün)
2. **Headline** („Noch keine Tickets")
3. **Erklärung** („Sobald ein Mieter einen Schaden meldet, erscheint er hier")
4. **Primary Action** (Button mit Link zur nächsten sinnvollen Aktion)

Jeder Fehler-Toast / API-Error zeigt:
- Was schiefging (verständlich, nicht „500 Internal Server Error")
- Was der User jetzt tun kann (Retry, später nochmal, Support kontaktieren)

## Empty-State-Inventar (CC soll abarbeiten)

### Verwalter
- `dashboard-verwalter` → keine Tickets: „Noch keine Schadensmeldungen — laden Sie Wohnungen hoch, damit Mieter melden können" + [Wohnungen hochladen]
- `dashboard-verwalter/tickets` → leere Liste pro Filter: „Keine Tickets in Status [X]" + Filter zurücksetzen
- `dashboard-verwalter/wohnungen` → keine Wohnungen: „Noch keine Wohnungen — Excel hochladen oder einzeln anlegen" + [Bulk-Import]

### Handwerker
- `dashboard-handwerker` → bereits gut (Sprint L „Setze zuerst deine Gewerke")
- `dashboard-handwerker/zeitslots` → keine Slots: „Du hast noch keine Verfügbarkeiten — leg den ersten Slot an damit Verwalter dich finden"
- `dashboard-handwerker/einnahmen` → keine Aufträge: „Bisher keine abgerechneten Aufträge"

### Mieter
- `dashboard-mieter` → keine Tickets: „Alles in Ordnung — keine offenen Schäden 🎉"
- `dashboard-mieter/melden` → KI-Analyse leer: bereits gut

### Admin
- `dashboard-admin/feedback` → keine neuen: „Keine ungesichteten Feedbacks — alles unter Kontrolle"
- `dashboard-admin/users` → unwahrscheinlich leer
- `dashboard-admin/diagnose-prices` → keine Preise: „Keine Preise gesetzt — leg Standard-Preise pro Gewerk an"

## Fehlermeldungen-Inventar

### API-Errors einheitlich behandeln

`lib/api-error.ts`:
```typescript
export function getUserMessage(error: unknown): { title: string; description: string; action?: { label: string; href?: string } } {
  if (error instanceof TypeError) return { title: 'Verbindungsproblem', description: 'Bitte Internet prüfen und erneut versuchen.' };
  if (isAuthError(error)) return { title: 'Anmeldung abgelaufen', description: 'Bitte neu einloggen.', action: { label: 'Zum Login', href: '/login' } };
  if (isPermissionError(error)) return { title: 'Keine Berechtigung', description: 'Du darfst diese Aktion nicht ausführen.' };
  if (isRateLimitError(error)) return { title: 'Zu schnell', description: 'Bitte 30 Sekunden warten.' };
  return { title: 'Etwas ist schiefgelaufen', description: 'Bitte erneut versuchen oder Feedback geben.', action: { label: 'Feedback senden' } };
}
```

### Bekannte Fehler-Hot-Spots

- Vergabe fehlgeschlagen (Feedback `f4d86912`): Toast „Vergabe nicht möglich — [Grund]" + Retry-Button
- Schema-Cache-Error (Feedback `125ddf52`, war H10): bei DB-Errors generisch „Daten konnten nicht geladen werden" + Retry
- Falsche Anmeldedaten: „E-Mail oder Passwort falsch" statt 401
- Upload-Fehler: „Datei zu groß (max 10 MB)" / „Format nicht unterstützt"

## Implementations-Plan

### Phase N1 — Shared EmptyState-Component (~30 min)

```tsx
// components/ui/EmptyState.tsx
export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="bg-bg-muted border border-line rounded-card p-12 text-center">
      <Icon className="w-12 h-12 text-primary mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2 text-ink">{title}</h3>
      <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto">{description}</p>
      {action && (
        <Button onClick={action.onClick} href={action.href}>{action.label}</Button>
      )}
    </div>
  );
}
```

### Phase N2 — Empty-States ausrollen (~1h)

Alle 9 oben gelisteten Stellen in den jeweiligen Pages ersetzen.

### Phase N3 — Shared Error-Handler (~45 min)

`lib/api-error.ts` + Toast-Integration.

### Phase N4 — Hot-Spot-Fehler-Texte anpassen (~30 min)

Die 4 oben genannten + auto-discover via Grep nach „Internal Server Error" / „500" / „Failed to fetch".

### Phase N5 — Success-Toasts überall ergänzen (~30 min)

Audit-2-Finding: „Rückmeldungen nach Aktionen werden kaum angezeigt; der Nutzer
bleibt oft im Unklaren, ob die Aktion ausgeführt wurde."

Cowork-Spec:
- Nach jedem `INSERT`/`UPDATE`/`DELETE`: Toast „[Aktion] erfolgreich"
- Toast-Component bereits da (Sprint A H11 hat sie eingeführt) — nur noch nicht überall verwendet
- Auto-discover via Grep nach `mutation`/`onSubmit`/`handleSave` ohne anschließendes `toast.success`
- Typische Hot-Spots:
  - Profil speichern → „Profil aktualisiert"
  - Wohnung anlegen → „Wohnung [Adresse] angelegt"
  - Slot erstellen → „Slot für [Datum] angelegt"
  - Angebot abgeben → „Angebot eingereicht, du bekommst Bescheid"
  - Ticket vergeben → bereits ok (Sprint A)
  - Diagnose-Preis ändern → „Preis aktualisiert"

### Phase N6 — Form-Tooltips (~45 min)

Audit-2-Finding: „Einige UI-Elemente sind nicht selbsterklärend; beispielsweise
fehlen Hilfetexte oder Tooltips in Formularen (z. B. Diagnose-Preise oder
Zeitslot-Erstellung)."

Shared Tooltip-Component:
```tsx
// components/ui/Tooltip.tsx — kleines Info-Icon mit Hover/Click-Erklärung
<label>Stundensatz <Tooltip text="Dein Brutto-Stundensatz. Reparo zieht 5% Provision ab." /></label>
```

Konkrete Form-Tooltips ergänzen:
- HW-Profil: Stundensatz, Mindeststundensatz, Fahrtkosten/km, Radius, Smart-Score
- HW-Zeitslot: Aufschläge bei Notfall, Mindest-Dauer
- Admin-Diagnose-Preise: was ist "Marktpreis"?
- Verwalter-Bulk-Import: erwartete Excel-Spalten + Sample-Download

### Phase N7 — Smoke-Test + Commit

`feat(ux): Empty-States + Success-Toasts + Form-Tooltips (Sprint N)`

## Constraints

- Pricing-Engine nicht anfassen
- KEINE neuen Routes, nur Texte/Komponenten
- Action-Buttons müssen auf real existierende Routes zeigen

## Erfolg

- User sieht nie wieder „Failed to load" ohne Kontext
- Jede leere Liste hat eine sinnvolle nächste Aktion

## Erster Schritt

Phase N1: `EmptyState`-Component bauen.
