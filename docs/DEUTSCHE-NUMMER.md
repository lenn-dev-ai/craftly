# Deutsche Telefonnummer für die Voice-AI — Runbook

Stand: 2026-07-02. Ziel: **+49-Nummer** statt der US-Nummer +1 (541) 800-4518,
damit Anrufer (Mieter/Handwerker) **kostenlos** anrufen (Festnetz-Flat) und
keine Auslandsgebühren zahlen.

## Ehrliche Kosten-Wahrheit zuerst

| Kostenpunkt | US-Nummer (heute) | Deutsche Nummer (SIP) | Web-Voice-Button |
|---|---|---|---|
| Anrufer zahlt | Auslandstarif ⚠️ | **0 €** (Flat) | 0 € |
| Nummern-Miete | im Vapi-Preis | ~2–3 €/Monat | — |
| Telefonie/Transport | Vapi-Telephony | ~1 ct/min (SIP) | — |
| **Vapi-KI-Minuten** | ~0,10–0,15 $/min | ~0,10–0,15 $/min | ~0,08–0,13 $/min |

**Wichtig:** Die KI-Minuten (Modell + Transcriber + Stimme + Vapi-Plattform)
fallen bei *jedem* Gespräch an — die lassen sich nicht wegoptimieren, nur der
Telefonie-Anteil. Der **Web-Voice-Button ist und bleibt die günstigste
Variante** (kein Telefonie-Transport). Die deutsche Nummer ist für alle, die
klassisch anrufen wollen (Mieter ohne App, HW unterwegs).

## Empfohlener Weg: Zadarma + Vapi BYO-SIP

Vapi bietet **keine deutschen Nummern direkt** an (Gratis-Nummern = nur US).
Der offizielle Weg ist ein eigener SIP-Trunk ("BYO"). Vapis eigene Doku nutzt
**Zadarma** als Beispiel-Provider — dokumentierter, verifizierter Pfad:

1. **DU: Nummer kaufen** — zadarma.com → Registrieren → virtuelle Nummer
   Deutschland (~2 €/Monat, geografisch z. B. +49 30 Berlin).
   ⚠️ BNetzA-Regulierung: Identitäts- + Adressnachweis nötig (Privatperson
   reicht; für geografische Nummern Adresse im Ortsnetz, sonst nationale
   Nummer wählen). Zahlung + Ausweis-Upload machst du selbst.
2. **DU: SIP-Zugangsdaten notieren** — Zadarma → SIP-Einstellungen:
   Server, SIP-Nummer (Username), Passwort.
3. **ICH (Claude): Vapi-Credential anlegen** — per Vapi-API
   (`POST /credential`, type `byo-sip-trunk`, Username/Passwort-Auth —
   von Vapi empfohlen, keine IP-Whitelist).
4. **ICH: Nummer registrieren** — `POST /phone-number` mit
   `provider: "byo-phone-number"` + `credentialId` + Assistant-Verknüpfung
   (assistant-request-Webhook wie bei der US-Nummer).
5. **DU/ICH: Weiterleitung beim Provider** — eingehende Anrufe auf die
   SIP-URI forwarden: `{nummer}@<credentialId>.sip.vapi.ai`
   (EU-Endpunkt: `sip.eu.vapi.ai`, nur falls Vapi-Org in EU-Region läuft).
6. **Test:** Nummer anrufen → Assistent meldet sich auf Deutsch;
   Vapi-Logs zeigen den Inbound-Call.

**Alternative Provider** (falls Zadarma nicht gefällt): sipgate trunking
(deutscher Anbieter, Nummernportierung gratis) oder easybell. Prinzip
identisch; Schritt 5 heißt dort "SIP-URI-Weiterleitung".

## Sobald du Schritt 1–2 erledigt hast

Sag einfach "Zadarma ist da" — dann übernehme ich Schritt 3–4 per API und
begleite Schritt 5–6. Die US-Nummer können wir danach in Vapi kündigen.

## Quellen

- Vapi SIP-Trunk-Doku: https://docs.vapi.ai/advanced/sip/sip-trunk
- Vapi SIP-Übersicht: https://docs.vapi.ai/advanced/sip
- sipgate trunking: https://www.sipgatetrunking.de/
