# 🚨 CRITICAL — Pricing-Inkonsistenz vor Beta-Start klären

> Gefunden bei Live-Quality-Pass 24.05.2026. **Sales-Blocker** wenn nicht aufgelöst.
> Lennart-Entscheidung nötig.
> **UPDATE 24.05. nach ChatGPT-Audit:** es gibt nicht 2, sondern **3 Pricing-Aussagen live**.

## Das Problem — 3 verschiedene Pricing-Modelle gleichzeitig live

Bei einem Cold-Outreach würde ein Verwalter DREI widersprüchliche Pricing-Aussagen sehen:

| Quelle | Modell | Starter | Pro | Enterprise |
|---|---|---|---|---|
| **Landing-Page** `/hausverwaltungen` (CC Sprint K) | Pauschal | **49 €/Mon** (≤50) | **149 €/Mon** (50–300) | Auf Anfrage |
| **Sales-Material** (Deck + One-Pager + Calculator) (Cowork) | Per-Wohnung | **1,29 €/Whg/Mon** (≤50) | **0,89 €/Whg/Mon** (51–500) | Custom |
| **Startseite `/` FAQ** (entdeckt von ChatGPT-Audit) | Provision-only | **0 €/Mon Grundgebühr** + Provision pro Auftrag | dito | dito |

Konkretes Beispiel — 200 Wohnungen-Verwaltung, fragt nach Monatskosten:
- Landing sagt: **149 €/Mon** (pauschal Pro)
- Sales-Material sagt: **178 €/Mon** (200 × 0,89 €)
- Startseite-FAQ sagt: **0 €/Mon Grundgebühr**, nur Provision pro vergebenem Auftrag

→ Verwalter würde fragen: „was gilt jetzt?" und das Vertrauen ist weg, bevor das Gespräch beginnt.

## Wie es dazu kam

- Sales-Material habe ich (Cowork) gebaut mit pro-Wohnung-Modell, analog zu Casavi/Wohnmonitor
- Sprint K (B2B-Landing) hat CC bekommen ohne explizite Pricing-Vorgaben → CC hat ein eigenes Pauschal-Modell erfunden
- Startseite-FAQ wurde irgendwann historisch mit Provision-Modell beschrieben (vermutlich ältester Code, vor irgendeiner früheren Pivot-Diskussion)
- Drei Modelle sind in sich konsistent, aber zueinander inkompatibel

## Die drei Optionen mit Trade-offs (4. ist neu: Provision-only)

### Option A — Pauschal-Modell (CC's Landing)

**Pro:**
- Einfacher zu kommunizieren: „149 € fix, fertig"
- Vorhersehbare Kosten für Verwalter, kein Rechnen
- Geringere Hemmschwelle bei großen Verwaltern (200 → 300 Wohnungen kostet trotzdem 149€)

**Contra:**
- Regressives Modell: 300 Wohnungen für 149 € = **0,50 €/Wohnung** → günstiger pro Einheit als 50 Wohnungen für 49 € = 0,98 €/Wohnung → das ist ökonomisch komisch
- Marge bei großen Beständen schwach (Voice-AI-Anruf kostet schon ~0,80 €, da bleibt wenig)
- Kein Up-Sell-Hebel: 200 oder 300 Wohnungen kosten gleich

### Option B — Per-Wohnung-Modell (Cowork's Sales-Material)

**Pro:**
- Skaliert mit Wert: mehr Wohnungen = mehr Tickets = mehr SaaS-Wert
- Marktüblich im Property-SaaS (Casavi 2,50€, Wohnmonitor 1,90€ — du wärst unter beiden)
- Natürlicher Up-Sell wenn Verwaltung wächst
- Pricing-Calculator schon gebaut, funktioniert perfekt mit diesem Modell

**Contra:**
- Komplexer zu erklären („müssen wir das ausrechnen?")
- Kann hoch wirken: 500 Wohnungen × 0,89 = 445 €/Mon
- Verwalter mit großen Beständen wollen oft Custom-Deals statt linearer Formel

### Option D — Provision-only (Startseite-FAQ)

Kein Abo, nur Provision pro vergebenem Auftrag (z.B. 5%).

**Pro:**
- Niedrigste Hürde („kostet nix bis erste Vergabe")
- Risiko-frei für Verwalter („ich zahle nur wenn ich nutze")
- Schöner Cold-Outreach-Pitch („zahlen Sie nichts wenn Sie nichts vergeben")

**Contra:**
- Schlechtester Cashflow für Reparo (kein MRR)
- Verwalter könnten Reparo nur für Notfälle nutzen, Routine selbst machen
- Unvorhersehbar — eine Verwaltung mit 500 Wohnungen aber wenig Schäden zahlt kaum was
- Investoren mögen Provisions-Modelle nicht (kein klares Pricing-Power-Signal)
- Voice-AI-Kosten (~0,80 €/Anruf) werden zur Belastung wenn Provision nicht fließt
- Wettbewerber (Casavi, Wohnmonitor) machen Abo — Reparo wirkt sub-professionell

### Option C — Hybrid (Cowork-Empfehlung)

Pauschale Grundgebühr + variable Komponente pro Wohnung:

| Tier | Wohnungen | Pauschale | + pro Wohnung | Beispiel 200 Whg |
|---|---|---|---|---|
| Starter | bis 50 | 29 €/Mon | + 0,79 € | 29 + 39,50 = **68,50 €** (oder Pauschale wenn weniger) |
| Pro | 51–500 | 79 €/Mon | + 0,49 € | 79 + 98 = **177 €** |
| Enterprise | 500+ | Custom | — | nach Verhandlung |

**Pro Hybrid:**
- Niedrige Einstiegs-Hürde (29 €)
- Skaliert mit Wert
- Marge bleibt gesund

**Contra Hybrid:**
- Noch komplexer als Option B
- Erklärungsbedarf in Sales-Demos

## Was sofort zu tun ist (alle Optionen brauchen jetzt 3-Quellen-Sync)

**Wenn du Option A wählst (Pauschal, CC's Modell):**
- Cowork muss Sales-Deck Slide 8, One-Pager Pricing-Strip, Pricing-Calculator HTML und Sales-Playbook nachziehen
- Startseite-FAQ muss umgeschrieben werden (Pauschal-Statement)
- Aufwand: ~45 Min Cowork + 15 Min CC

**Wenn du Option B wählst (per Wohnung, Cowork's Modell):**
- CC muss Landing-Page `/hausverwaltungen` Pricing-Sektion umbauen
- Startseite-FAQ muss umgeschrieben werden (Per-Wohnung-Statement)
- Aufwand: ~45 Min CC

**Wenn du Option C wählst (Hybrid):**
- Beide UI-Quellen nachziehen
- Plus Startseite-FAQ
- Aufwand: ~1.5h gemeinsam — beste Margin-Position aber höchster Setup-Aufwand

**Wenn du Option D wählst (Provision-only — was die Startseite-FAQ heute sagt):**
- CC muss Landing-Page Pricing-Tiers komplett rausnehmen, ersetzen durch „0 € Grundgebühr + Provision"
- Cowork muss Sales-Deck Slide 8, One-Pager Pricing-Strip, Calculator komplett umbauen
- Aufwand: ~1h gemeinsam
- **Cowork-Warnung:** schwächstes Geschäftsmodell, würde ich nur empfehlen wenn du primär „risk-free Pitch" verkaufen willst und Cashflow nicht prio ist

## Cowork-Empfehlung

**Option B** (per Wohnung, Cowork-Modell) als Default — der Markt erwartet das, du bist unter den Wettbewerbern, Pricing-Calculator unterstützt es perfekt, sauberer Up-Sell-Pfad.

**ABER** — wenn du auf Simplicity wert legst und in Sales-Demos schnell durch das Pricing-Thema willst, ist **Option A** auch defensibel. Insbesondere mit den unverhandelbaren Voice-AI-Kosten (~0,80 €/Anruf) musst du dann aber sicherstellen dass die Pauschale die operativen Kosten deckt.

**Option C ist die optimale ökonomische Lösung, aber unnötig komplex für Beta. Erst nach Pricing-Power-Daten (50+ Demos) sinnvoll.**

## Entscheidungs-Trigger für Lennart

Sag eines von vier:
- **„Option A (Pauschal)"** — Cowork zieht Sales-Material + Startseite-FAQ nach
- **„Option B (per Wohnung)"** — Cowork schreibt Sprint-R-Spec für CC, der Landing + FAQ umbaut **(Cowork-Empfehlung)**
- **„Option C (Hybrid)"** — Cowork plant beide Updates plus FAQ
- **„Option D (Provision-only)"** — Cowork warnt explizit dagegen, baut aber wenn du willst

Bis das geklärt ist: **kein Cold-Outreach mit Sales-Deck**, sonst kommen verwirrte Verwalter.

---

**Status:** Pricing-Kalkulator + Sales-Material sagen B. Landing sagt A. Beide live. Du bist im Urlaub.
**Empfehlung von Cowork:** „kein Outreach bis aufgelöst — kein Schaden, weil Urlaub eh kein Outreach geplant".
