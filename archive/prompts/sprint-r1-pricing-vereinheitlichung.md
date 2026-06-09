# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint R1 — Pricing-Vereinheitlichung auf Option B (per Wohnung)

> Lennart-Entscheidung 25.05.2026: **Pricing-Modell B (per Wohnung)** wird die
> einheitliche Wahrheit. Sales-Material ist schon damit konsistent — nur
> Landing-Page + Startseite-FAQ müssen nachziehen.
>
> Aufwand: ~30 Min CC. Eigenständig.

## Pricing-Wahrheit (alle 3 Quellen müssen das matchen)

| Tier | Preis | Größe |
|---|---|---|
| **Starter** | **1,29 €/Wohnung/Monat** | bis 50 Wohnungen |
| **Pro** | **0,89 €/Wohnung/Monat** | 51–500 Wohnungen |
| **Enterprise** | **Custom** (Volumen-Rabatte) | 500+ Wohnungen |

Zusatz: erste 30 Tage gratis, monatlich kündbar, kein Setup-Fee.

## Code-Lokationen die geändert werden müssen

### 1. `app/hausverwaltungen/page.tsx` (CC's Sprint K Landing)

Aktuell hardcoded: Starter 49€/Mon, Pro 149€/Mon, Enterprise Auf Anfrage.

**Ändern auf:** Per-Wohnung-Modell wie oben.

Plus: Link zum interaktiven Pricing-Calculator ergänzen falls noch nicht (Calculator-HTML ist unter `public/Reparo-Pricing-Calculator.html` deployed oder muss noch nach `public/` kopiert werden).

### 2. `app/page.tsx` (Startseite)

Falls dort eine FAQ-Sektion existiert die „Provision pro Auftrag" sagt → ersetzen mit:

> „Reparo kostet pro Wohnung pro Monat — ab 1,29 €. Keine versteckten Provisionen, keine Setup-Fees. Erste 30 Tage gratis."

Wenn keine FAQ existiert: ok, kein Change nötig.

### 3. Constants (falls vorhanden)

`lib/pricing.ts` oder ähnlich — falls Pricing-Konstanten zentralisiert sind, dort aktualisieren.

## Sanity-Check nach dem Update

1. `curl https://reparo-app.netlify.app/hausverwaltungen` → Pricing zeigt 1,29/0,89/Custom
2. `curl https://reparo-app.netlify.app/` → FAQ (falls vorhanden) konsistent
3. Sales-Material (PPTX/PDF/HTML/MD) ist NICHT zu ändern — schon konsistent

## Commit

`feat(pricing): vereinheitlichen auf Option B per-Wohnung (Sprint R1)`

## Constraints

- Sales-Material auf Desktop/Reparo bleibt unangetastet (ist schon konsistent)
- Pricing-Calculator-HTML bleibt unangetastet (schon konsistent)
- Pricing-Engine im Code (`lib/pricing/*`) NICHT anfassen

## Erfolg

- Alle 3 öffentlichen Quellen (Landing, Startseite-FAQ, Sales-Material) sagen das gleiche
- Cold-Outreach kann ohne Konflikt starten
