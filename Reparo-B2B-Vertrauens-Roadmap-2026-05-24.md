# Reparo — B2B-Vertrauens-Roadmap (Post-Urlaub-Konzept)

> Strategisches Memo, NICHT für sofortige CC-Action.
> Basiert primär auf ChatGPT-Audit-Findings die Cowork + CC nicht sahen:
> SLA, Audit-Trail, Freigabegrenzen, Eigentümer-Reporting, Stamm-HW-Hybrid.
> Diskussions-Grundlage für nach Lennarts Urlaub.

## Warum dieses Memo wichtig ist

Code-Stand nach 18 Sprints ist solide (CC: „Beta-launchable: ja"). Aber für
**echten B2B-Sales-Erfolg** (>10K MRR mit Hausverwaltungen) fehlen 5-7
Vertrauens-Bausteine die Casavi/Wohnmonitor/vermietet.de haben. ChatGPT bringt
das auf den Punkt:

> „DSGVO, TLS, RLS sind gut, aber es fehlen kaufentscheidende B2B-Signale:
> Pilotkunden, SLA-Logik, Rollenrechte, Freigabegrenzen, Audit-Trail,
> Abrechnungsklarheit, Supportprozess."

Ohne diese Features ist Reparo „nice toy", nicht „enterprise-ready".

## Die 5 strategischen Bausteine — als Sprint-Konzepte

### Sprint-T — B2B-Trust-Package

**Inhalt:**
- **SLA-Definitionen** (Vergabe-Zeit Garantie, Uptime, Support-Antwortzeit)
- **Audit-Trail:** jede Vergabe / Status-Änderung / Datenexport unveränderlich geloggt
- **Freigabegrenzen:** Verwalter mit Limit (z.B. <500 € allein, >500 € Vier-Augen)
- **Rollen-Rechte:** RBAC innerhalb Verwaltung — Sachbearbeiter vs. Geschäftsführer
- **Vier-Augen-Prinzip:** bei großen Aufträgen 2 Signaturen nötig
- **Support-SLA:** definierter Antwort-Zeitkanal (Mail vs. Chat vs. Telefon)

**Aufwand:** groß (2-3 Wochen) — DB-Schema, UI, Reporting
**Wann:** Post-Beta, sobald 3-5 Verwalter-Kunden konkretes Feedback geben
**Mini-Variante (MVP, 3-5 Tage):** nur Audit-Trail + 1 Freigabegrenze (z.B. >1000 € braucht 2. Signatur)

### Sprint-U — Verwalter-Statuslogik vertiefen

ChatGPT-Vorschlag: 10 Zustände statt aktuell 4.

Aktuelle Zustände: `offen`, `auktion`, `in_bearbeitung`, `erledigt`

**Neue Zustände:**
1. `gemeldet` (Mieter hat eingereicht, Verwalter noch nicht gesehen)
2. `geprüft` (Verwalter hat draufgeschaut, OK)
3. `rückfrage_offen` (Verwalter hat Mieter nach Info gefragt, wartet auf Antwort)
4. `ausgeschrieben` (Auktion läuft)
5. `angebote_da` (Auktion vorbei, Verwalter muss wählen)
6. `vergeben` (HW beauftragt, Termin noch nicht fix)
7. `termin_bestätigt` (Mieter + HW haben Termin abgestimmt)
8. `in_arbeit` (HW hat begonnen)
9. `abgenommen` (Mieter hat Reparatur akzeptiert)
10. `abgerechnet` (Rechnung gestellt, Geld läuft)
11. `reklamiert` (Mieter beschwert sich nach Abnahme — Eskalation)

**Aufwand:** mittel (1 Woche) — Schema-Migration, UI-Filter, Workflow-Logik
**Wann:** vor Sprint-T (Status ist Basis für SLA)
**Mini-Variante:** 6 Zustände statt 4 + Reklamations-Flow

### Sprint-V — Stamm-HW vs. Marktplatz-Hybrid

ChatGPT-Insight: Viele Verwaltungen wollen Stamm-HW als Default (Verlässlichkeit),
Marktplatz nur als Backup bei Notfällen oder wenn Stamm-HW nicht verfügbar.

**Inhalt:**
- Verwalter kann pro Wohnung / Gewerk einen Stamm-HW hinterlegen
- Bei neuer Ticketmeldung: System fragt erst Stamm-HW → erst wenn der absagt oder nicht antwortet (24h), öffnet sich Marktplatz-Auktion
- Stamm-HW-Beziehung wird über Reparo abgewickelt (gleiche Plattform, gleiche Rechnung) — kein Lock-in

**Aufwand:** mittel (1-2 Wochen)
**Wann:** vor Cold-Outreach an größere Verwaltungen (>100 Wohnungen) wo Stamm-HW
existiert
**Strategischer Wert:** **hoch** — adressiert größten B2B-Einwand („wir wollen
nicht jeden Auftrag neu vergeben")

### Sprint-W — Eigentümer-Reporting

ChatGPT-Insight: Casavi/Wohnmonitor-Standard sind Quartals-/Jahres-Reports an
Wohnungseigentümer (WEG-Verwaltung) mit:
- Übersicht alle Schäden pro Objekt
- Kosten pro Eigentümer
- SLA-Erfüllung (wie schnell vergeben? wie schnell repariert?)
- Audit-Trail-Auszug für Wirtschaftsplan
- Export als PDF mit Verwalter-Briefkopf

**Aufwand:** mittel (1 Woche) — Reporting-Engine + PDF-Generator
**Wann:** Post-Beta, abhängig von WEG-Tester-Feedback
**Strategischer Wert:** **kritisch** für WEG-Verwaltung (anders als reine Miet-Verwaltung)

### Sprint-X — Notfall-Flow separieren

Aus Konvergenz CC + ChatGPT.

**Inhalt:**
- Notfall-Button im Mieter-Wizard (vor allem anderen): „🚨 Akuter Notfall — Wasser läuft jetzt"
- Notfall-Flow: nur 2 Steps statt 6 (Adresse + Foto) — Rest macht KI / Verwalter
- Sofortige Eskalation: SMS an Verwalter + verfügbare Notfall-HW innerhalb 15 Min
- Notfall-Marktplatz mit kürzerer Auktion (15 Min statt 12h)
- Notfall-Zuschlag transparent (z.B. +50% — Mieter weiß warum)

**Aufwand:** klein (3-5 Tage) — wäre relativ schnell baubar
**Wann:** vor Beta-Start gut, weil bei Beta-Tests irgendwann ein „echter" Notfall reinkommt
**Strategischer Wert:** **hoch** — Notfall-Coverage ist Sales-Argument („wir lösen
das Albtraum-Szenario für Sie")

## Reihenfolge-Empfehlung

```
Nach Urlaub:
├── Pricing-Entscheidung (Lennart, 30 Min)
├── Sprint R: Aufräumen (CC, 6-8h) ← muss zuerst
├── Beta-Start (3-5 Vertraute, 14 Tage)
└── Parallel zur Beta:
    ├── Sprint X: Notfall-Flow (5 Tage) ← kleinster Sprint mit höchstem Mehrwert
    ├── Konzept-Workshops mit Lennart für Sprint T/U/V/W

Nach Beta:
└── Sprint U: Statuslogik (Basis für T)
    └── Sprint T: B2B-Trust-Package (Audit-Trail + Freigabe + SLA)
        └── Sprint V: Stamm-HW-Hybrid (sobald 2-3 Verwalter-Kunden)
            └── Sprint W: Eigentümer-Reporting (sobald 1+ WEG-Kunde)
```

## Was NICHT zu tun ist

ChatGPT-Warnung: „Ich würde Reparo jetzt nicht weiter mit Features aufblasen."

→ Sprint T/U/V/W NICHT bauen bis du echte Beta-Feedback-Daten hast die das
priorisieren. Sonst baust du falsche Features.

→ Sprint R + Sprint X sind die einzigen die Cowork sofort empfiehlt — sie
beheben Bekanntes / sind klein.

## Alternativ-Strategie — wenn Beta gut läuft

Wenn 3-5 Beta-Tester begeistert sind und konkretes Kauf-Interesse zeigen:
- Pivot auf B2B-Fokus (siehe `KONZEPT-pivot-mieter-raus-b2b-fokus.md`) sofort
  vollziehen
- Sprint T (B2B-Trust-Package) als erstes Post-Beta-Projekt
- Sales-Outreach beginnen mit Pilot-Setup aus ChatGPT (100 Wohnungen / 20 Schäden /
  5 HW / 30 Tage)
- Erste echte Kunden im Q3 2026

Wenn Beta schlecht läuft:
- Pivot-Konzept anders interpretieren (vielleicht doch Mieter-fokussierten Pfad
  als B2C-SaaS?)
- Sprint T/U/V/W on hold

## Konkrete Diskussions-Punkte für Lennart-Rückkehr

1. **Sprint T vs. Sprint U: was zuerst?** Cowork tendiert zu Sprint U (Statuslogik
   ist Basis für T), aber ChatGPT priorisiert Trust-Package.
2. **Sprint X (Notfall) sofort oder erst nach Beta-Daten?** Cowork tendiert zu
   sofort (wenig Aufwand, viel Sales-Wert), ChatGPT würde abwarten.
3. **Stamm-HW-Hybrid (Sprint V): essentiell oder optional?** Ohne das wirst du
   bei Verwaltungen mit Stamm-HW abgelehnt — aber das musst du in Beta-Gesprächen
   verifizieren.
4. **Eigentümer-Reporting (Sprint W): MVP oder vollwertig?** WEG-Verwalter
   brauchen das, Miet-Verwalter weniger. Pivot-Frage.
5. **Bronze/Silber/Gold: behalten oder dezenter?** ChatGPT findet's unseriös, CC
   findet's gut. Lennart-Entscheidung.

## Cowork-Bottom-Line

Reparo hat ein **starkes Produkt-Fundament** (alle drei Auditoren stimmen zu).
Was fehlt für Enterprise-Reife sind 5-7 B2B-Features die *konzeptionell aufwändig*
aber technisch lösbar sind. Die nächsten 2 Wochen sollten Pricing + Aufräumen +
Beta-Daten sein — nicht weiter neue Features.

Wenn Beta-Daten zeigen dass die B2B-Hypothese trägt: Sprint T+U+V+W+X als
strategisches Q3/Q4-Programm.
