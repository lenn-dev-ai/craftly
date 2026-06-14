# Demo-Accounts nach Reset (25.05.2026)

> Alle bisherigen Test/Demo-Accounts wurden gelöscht, alle Tickets/Angebote/
> Zeitslots/Einladungen/Wohnungen geleert. **Bei 0 gestartet.**
> Feedback-Tabelle (51 Einträge) wurde bewusst behalten (Loop-Historie).
> Lennart's 4 eigene Accounts unangetastet.

## Die 9 neuen Demo-Accounts

**Standard-Passwort für alle: `BetaReparo2026!`**

### Mieter (3 Stück)

| E-Mail | Passwort | Name |
|---|---|---|
| `demo-mieter-1@reparo-demo.de` | `BetaReparo2026!` | Demo Mieter 1 |
| `demo-mieter-2@reparo-demo.de` | `BetaReparo2026!` | Demo Mieter 2 |
| `demo-mieter-3@reparo-demo.de` | `BetaReparo2026!` | Demo Mieter 3 |

### Verwalter (3 Stück)

| E-Mail | Passwort | Name |
|---|---|---|
| `demo-verwalter-1@reparo-demo.de` | `BetaReparo2026!` | Demo Verwalter 1 |
| `demo-verwalter-2@reparo-demo.de` | `BetaReparo2026!` | Demo Verwalter 2 |
| `demo-verwalter-3@reparo-demo.de` | `BetaReparo2026!` | Demo Verwalter 3 |

### Handwerker (3 Stück)

| E-Mail | Passwort | Name |
|---|---|---|
| `demo-handwerker-1@reparo-demo.de` | `BetaReparo2026!` | Demo Handwerker 1 |
| `demo-handwerker-2@reparo-demo.de` | `BetaReparo2026!` | Demo Handwerker 2 |
| `demo-handwerker-3@reparo-demo.de` | `BetaReparo2026!` | Demo Handwerker 3 |

## Lennart-Accounts (unberührt)

| E-Mail | Rolle |
|---|---|
| `lenn-dev@proton.me` | admin |
| `lenn.test.2@gmail.com` | admin |
| `admin@craftly-test.de` | admin |
| `lennjahn@gmail.com` | verwalter |

## Reset-Bilanz

| Tabelle | Vorher | Nachher |
|---|---|---|
| profiles | 10 | 13 (4 Lennart + 9 Demo) |
| auth.users | 10 | 13 |
| tickets | 24 | 0 ✅ |
| angebote | 16 | 0 ✅ |
| zeitslots | 62 | 0 ✅ |
| einladungen | 5 | 0 ✅ |
| wohnungen | 0 | 0 |
| feedback | 48 | 51 (behalten, +3 neue heute) |

Plus geleert (waren schon 0 oder werden bei Bedarf wieder gefüllt):
nachrichten, nachtraege, termine, private_termine, bewertungen, handwerker_stats, ki_analysen_cache, ki_quota, provisionen, objekte, verfuegbarkeiten, routen_planung, zeitslot_gebote.

## Wie die Demo-Accounts in Beta zu nutzen sind

### Zuordnung Beta-Tester zu Account

Wenn du einen Beta-Tester einlädst, sag ihm:
„Du bist **Demo Mieter 2** (oder Verwalter 1, oder HW 3)."

Vorteil:
- **Eindeutige Identifikation** im Feedback-Dashboard
- Falls Tester 2 was meldet, weißt du: das war der `demo-mieter-2`-Account
- Mehrere Tester können parallel mit unterschiedlichen Accounts testen

### Empfohlene Test-Konstellationen

**Mini-Beta (3 Tester):**
- 1× Demo Mieter 1
- 1× Demo Verwalter 1
- 1× Demo Handwerker 1
→ minimaler End-to-End-Test

**Pilot (ChatGPT-Empfehlung):**
- 100 Wohnungen, 20 Schäden, 5 HW, 30 Tage
- 3 Mieter + 1 Verwalter + 3 HW + 2 weitere HW (von dir später eingeladen)
- → alle 9 Demo-Accounts in Verwendung

**Empfehlung für Cold-Outreach (nach Pricing-Entscheidung):**
- Pro Hausverwaltung 1 Demo-Verwalter-Account
- 2-3 Demo-Mieter zum Vorführen
- 2-3 Demo-HW zum Vorführen
- → max 3 parallele Sales-Demos möglich (sonst Konflikt)

## Nächste Schritte für Lennart

- [ ] `BETA-WELCOME.pdf` updaten von 3 auf 9 Logins (sobald Cowork das nachzieht)
- [ ] Cold-Outreach erst nach Pricing-Entscheidung (siehe `CRITICAL-Pricing-Konflikt-2026-05-24.md`)
- [ ] Beta-Tester-Liste schreiben (3-5 Vertraute)

## Wichtig

- Alle 9 Demo-Accounts sind **echte Login-fähige Accounts** (auth.users + profiles).
- Passwort `BetaReparo2026!` ist überall gleich — für Beta OK, sollte aber für Production-Tester individuell sein.
- Bei Bedarf können einzelne Demo-Accounts in Supabase-Studio individualisiert werden (Passwort-Reset, Name, etc.).

## Rollback (falls Reset doch falsch war)

⚠️ Daten sind komplett weg, kein Backup gemacht. Falls Lennart Daten zurück will:
- Tickets/Angebote/Zeitslots: müssen neu erstellt werden
- Test-Accounts: müssen neu angelegt werden
- Feedback ist erhalten

Für künftige Resets: vorher `pg_dump` machen — Cowork schreibt das als Tooling
wenn gewünscht.
