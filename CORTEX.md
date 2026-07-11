# Reparo Cortex — das System-Gehirn

Der Cortex ist das Gehirn hinter Reparo: er beobachtet alles, was im
System passiert, erinnert sich, denkt nach und meldet sich beim
Betreiber. Er ist als Organismus gebaut, nicht als Feature — jede
Ausbaustufe dockt an dasselbe Fundament an.

## Verfassung

Die Charta ([lib/cortex/charta.ts](lib/cortex/charta.ts)) ist die
Governance: Betrieb schützen, Mensch genehmigt, ehrlich lernen, konkret
sein, Kosten kennen. Änderungen an der Charta sind bewusste
Governance-Entscheidungen.

## Organe (Stand: Fundament, Sprint CI)

| Organ | Ort | Zweck |
|---|---|---|
| Ereignisstrom | `cortex_ereignisse` + 5 DB-Trigger (tickets/angebote/bewertungen/nachtraege/feedback) ✅ aktiv + App-Emission (`lib/cortex/ereignis.ts`) | Nervenimpulse: alles Relevante landet automatisch hier — auch client-seitige Ereignisse. Trigger schlucken Fehler — das Gehirn blockiert nie das Geschäft. |
| Gedächtnis | `cortex_gedaechtnis` (pgvector 384 + deutsche Volltextsuche), [lib/cortex/gedaechtnis.ts](lib/cortex/gedaechtnis.ts) | episodisch / semantisch / prozedural. Embeddings via Edge-Function `cortex-embed` (gte-small, kostenlos); Fallback Volltext. |
| Entscheidungsjournal | `cortex_entscheidungen` | Jede Überlegung mit Begründung, Modell und Token-Kosten — vollständige Rechenschaft. |
| Playbooks | `cortex_playbooks` | Prozedurale Abläufe, die der Cortex selbst pflegen wird. |
| Schlaf-Zyklus | [lib/cortex/denken.ts](lib/cortex/denken.ts) + `/api/cron/cortex-schlaf` (03:30 UTC) | Nächtliche Konsolidierung: Signale sichten → denken (Claude) → Erkenntnisse merken → Memo-Mail an den Betreiber. |

## Ventile

- `CORTEX_OFF=1` — Kill-Switch, Schlaf-Zyklus wird übersprungen
- `CORTEX_MODEL` — Modell-Override (Default `claude-haiku-4-5`; Deliberationstiefe ist aktuell durch das 10s-Limit der Netlify-Functions begrenzt — Upgrade-Pfad: Background Function / eigener Worker)
- `CORTEX_MEMO_EMPFAENGER` — Komma-Liste (Default `lenn-dev@proton.me`)

Manuell auslösen (als Admin eingeloggt): `POST /api/cron/cortex-schlaf`.

## Was der Cortex heute NICHT tut

Er führt nichts aus. Keine Vergaben, kein Code, kein Geld — er
beobachtet, merkt und meldet (Charta §2). Handeln kommt stufenweise
dazu, jeweils hinter eigenen Leitplanken.

## Gesichter ("Frag Reparo")

Ein Gehirn, drei Perspektiven — dieselbe API (`/api/cortex/frage`,
`components/cortex/FragReparo.tsx` mit Prop `sicht`), rollen-gescopter
Kontext, ein gemeinsames Journal. Echte Rollen sind serverseitig
fixiert; nur Admins wählen die Sicht (für Sicht-Wechsel-Tests).

| Sicht | Kontext | Ton |
|---|---|---|
| Verwalter | Portfolio, Ticket-Status, Kosten, Hänger, offene Nachträge + Cortex-Gedächtnis | knapp, mit Ticket-Kürzeln |
| Mieter | eigene Meldungen, Status verständlich, HW-Name, Termine | freundlich, ohne Fachjargon |
| Handwerker | Termine (mit Adresse), laufende Aufträge, offene Anfragen, Monatsverdienst | kollegial, du-Form |

Kostenschutz: KI-Tagesquota (10 Fragen/Tag/Nutzer). Gedächtnis-
Erinnerungen fließen nur in die Verwalter-Sicht (Betriebs-Insights).

## Ausbaupfad

1. ✅ Fundament: Ereignisstrom, Gedächtnis, Journal, Schlaf-Zyklus, Memo
2. ✅ Cockpit: `/dashboard-admin/cortex` — Memos, Gedächtnis, „Jetzt denken"
3. ✅ Gesichter: „Frag Reparo" für Verwalter, Mieter, Handwerker
4. ✅ Reflexe ([lib/cortex/reflexe.ts](lib/cortex/reflexe.ts)): `direktvergabe-nachholen` (verpasste Eskalationen, redundant zum 5-Min-Cron), `vergabe-anstossen`, `angebote-nudge`, `wachhund` (hängende Vergaben >24h + ausbleibende `cron_heartbeats` → Alarm-Mail, max 1×/24h)
5. Selbst-Erweiterung: Cortex öffnet PRs/Playbook-Änderungen, Betreiber genehmigt
6. Geschlossener Lern-Loop: Hypothesen → Feature-Flags → Messung
