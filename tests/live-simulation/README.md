# Live Simulation Harness

Dieses Harness ist für einen realitätsnahen 100-User-Test mit Playwright gedacht.
Es simuliert nicht einfach nur einzelne E2E-Flows, sondern mischt Rollen,
Verhalten und Seitenaufrufe so, dass Last, Route-Protection, Redirects,
Konsole/HTTP-Fehler und grobe UX-Bruchstellen sichtbar werden.
Pro Persona werden die Sessions vor dem eigentlichen Lastlauf seriell
vorgewärmt. Der 100-User-Lauf selbst nutzt dann die gespeicherten Sessions
und vermeidet so parallele Auth-Login-Stürme.

## Unterschied zu klassischem E2E

- Klassische E2E-Tests prüfen einen festen Flow mit klaren Assertions.
- Dieses Harness spielt viele Personas mit gewichtetem Verhalten durch.
- Der Fokus liegt auf Breite, nicht auf einer einzigen harten Assertion.
- Read-only läuft standardmäßig, Schreib-Szenarien sind absichtlich gesperrt.

## Sicherheitsregeln

- Standardziel ist lokal oder Staging.
- Prod ist gesperrt, außer `ALLOW_PROD_SIMULATION=true`.
- Schreibende Szenarien laufen nur mit `ALLOW_WRITES=true`.
- Mails dürfen nur in Test-/Sandbox-Umgebungen landen.
- Keine echten Nutzerkonten löschen.
- Keine Secrets committen.

## Benötigte Env Vars

- `SIM_BASE_URL` default: `http://localhost:3000`
- `SIM_USERS` default: `10`
- `SIM_HEADLESS` default: `true`
- `SIM_CONCURRENCY` default: `5`
- `ALLOW_WRITES` default: `false`
- `ALLOW_PROD_SIMULATION` default: `false`
- `SIM_SEED_ACCOUNTS` default: `false`

Empfohlen für lokale Runs:

```bash
source tests/e2e/load-env.sh
```

Das lädt die Supabase-Test-Umgebung, ohne Prod anzufassen.

Wenn du frische Simulation-Accounts anlegen willst, setze zusätzlich:

```bash
SIM_SEED_ACCOUNTS=true ALLOW_WRITES=true
```

Ohne Seed-Accounts müssen die Persona-Logins bereits in der Test-/Staging-
Umgebung existieren. Schreibende Flows laufen nur mit `SIM_SEED_ACCOUNTS=true`
und `ALLOW_WRITES=true`, weil der Runner die Fixtures deterministisch anlegt.
Die Auth-Sessions werden vorab einmalig aufgebaut und dann im eigentlichen
Run wiederverwendet.

## Beispiele

10 User lokal:

```bash
SIM_BASE_URL=http://localhost:3000 SIM_USERS=10 npm run simulate:live
```

50 User auf Preview/Staging:

```bash
SIM_BASE_URL=https://reparo-preview.netlify.app SIM_USERS=50 npm run simulate:live
```

Prod ist gesperrt und muss explizit freigegeben werden:

```bash
ALLOW_PROD_SIMULATION=true SIM_BASE_URL=https://reparo-app.netlify.app SIM_USERS=100 npm run simulate:live
```

## 10 / 50 / 100 User

- `SIM_USERS=10` für einen schnellen Smoke-Durchlauf
- `SIM_USERS=50` für eine mittlere Lastprobe
- `SIM_USERS=100` für den vollen Persona-Lauf
- `SIM_CONCURRENCY=5` als konservativer Default, bei Bedarf anheben

Die Personas sind deterministisch und werden aus 5 Verwaltern,
25 Handwerkern und 70 Mietern gebildet.

## Schreibeinschränkungen

- `ALLOW_WRITES=false` ist der sichere Default.
- Dann laufen nur smokeartige Lese- und Navigationspfade.
- `ALLOW_WRITES=true` schaltet die implementierten Write-Flows frei.
- Noch nicht implementierte Write-Flows brechen dann explizit ab.
- `SIM_SEED_ACCOUNTS=true` legt deterministische Testkonten an.
- Sobald Write-Szenarien aktiv werden, müssen sie zuerst separat abgesichert werden.

## Ausgabe

Reports landen unter:

- `test-results/live-simulation/live-simulation-report.json`
- `test-results/live-simulation/live-simulation-report.md`

Screenshots bei Fehlern liegen im gleichen Verzeichnis unter `screenshots/`.
