# CC-Commit-Prompt — Loop-26 Fix (27.05.2026)

## Was gefixt wird

Loop-26-Feedback `d3495b20`: Admin sieht auf der Angebot-Seite "—" als
System-Preis und kann Auftrag nicht annehmen.

**Root cause**: `POST /api/auction/start` (zeitnah/planbar) schickte bisher
nur Einladungs-E-Mails, legte aber **keine `einladungen`-Zeilen** an.
Die Angebot-Seite liest `einladungen.empfohlener_preis` — ohne Zeile → null → Block.

**Fix**: Im fire-and-forget Loop werden jetzt ZUERST `einladungen`-Zeilen
upsertet (mit berechnetem Preis), dann erst die E-Mails verschickt.

Preis-Formel: `(basis_stundensatz ?? basis_preis ?? 50) × h × surge_faktor`
- zeitnah → 2 h, planbar → 3 h, Minimum 80 €

## Geänderte Files

```
app/api/auction/start/route.ts     modifiziert (Loop-26-Fix)
LOOP-ITERATION-26-2026-05-27.md   NEU (Feedback-Triage)
CC-COMMIT-LOOP-26.md              NEU (dieser Prompt)
```

## Commit-Message

```
fix(auction/start): einladungen-Zeilen vor E-Mail anlegen (Loop-26)

Loop-26-Feedback d3495b20: Angebot-Seite zeigte immer "— €" weil
einladungen.empfohlener_preis nie gesetzt wurde.

- auction/start (zeitnah+planbar): HW-Query erweitert um
  basis_stundensatz, basis_preis
- Im fire-and-forget Block: einladungen UPSERT (onConflict ticket+hw)
  VOR E-Mail-Versand, Preis = stundensatz x h x surge (min 80 EUR)
  - zeitnah: 2 h, planbar: 3 h
- E-Mail-Loop iteriert jetzt ueber vorgefiltertes eingeladene[]-Array
  statt doppelter Radius-Berechnung

Loop-26-Feedback d3495b20 adressiert.
```

## Push-Befehle

```bash
cd ~/Desktop/Reparo && \
git add app/api/auction/start/route.ts \
        LOOP-ITERATION-26-2026-05-27.md \
        CC-COMMIT-LOOP-26.md && \
git commit -m "fix(auction/start): einladungen-Zeilen vor E-Mail anlegen (Loop-26)

Loop-26-Feedback d3495b20: Angebot-Seite zeigte immer '— EUR' weil
einladungen.empfohlener_preis nie gesetzt wurde.

- auction/start (zeitnah+planbar): HW-Query + basis_stundensatz/basis_preis
- fire-and-forget: einladungen UPSERT vor E-Mail, Preis = stundensatz x h x surge (min 80)
  zeitnah=2h, planbar=3h
- E-Mail-Loop iteriert ueber vorgefiltertes eingeladene[]-Array

Loop-26 d3495b20 adressiert." && \
git push origin main
```

## Smoke-Test nach Deploy

1. Als Verwalter: Ticket öffnen → Auction starten (Planbar oder Zeitnah)
2. Als Handwerker (selbe Gewerk, im Radius): `/dashboard-handwerker/angebot/[ticket-id]`
3. Erwartung: System-Preis zeigt echten €-Betrag (nicht "—")
4. Erwartung: Submit-Button "Auftrag über X € annehmen" ist aktiv

Falls der Test-HW kein `basis_stundensatz` im Profil hat → 50 × h × surge.
Empfehlung: Demo-HW-Profil auf 65 €/h setzen für realistische Beträge.

## UNIQUE-Constraint check

`einladungen` braucht `UNIQUE(ticket_id, handwerker_id)` für den upsert.
Falls noch nicht vorhanden:

```sql
ALTER TABLE public.einladungen
  ADD CONSTRAINT einladungen_ticket_hw_unique UNIQUE (ticket_id, handwerker_id);
```

Falls der Constraint schon existiert (aus H7-Sprint): alles gut.
