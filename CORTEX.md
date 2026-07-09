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
| Ereignisstrom | `cortex_ereignisse` + Trigger auf tickets/angebote/bewertungen/nachtraege/feedback | Nervenimpulse: alles Relevante landet automatisch hier. Trigger schlucken Fehler — das Gehirn blockiert nie das Geschäft. |
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

## Ausbaupfad

1. ✅ Fundament: Ereignisstrom, Gedächtnis, Journal, Schlaf-Zyklus, Memo
2. Reflexe: definierte Auto-Reparaturen (z. B. hängende Vergabe anstoßen) mit Playbook + Journal
3. Gesichter: „Frag Reparo" pro Rolle (Verwalter-Analyst zuerst), gleiche Erinnerung über alle Kanäle (Web, Voice/Vapi, Mail)
4. Selbst-Erweiterung: Cortex öffnet PRs/Playbook-Änderungen, Betreiber genehmigt
5. Geschlossener Lern-Loop: Hypothesen → Feature-Flags → Messung
