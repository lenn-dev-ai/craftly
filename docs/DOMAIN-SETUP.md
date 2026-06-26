# Domain-Setup Runbook — reparo-app.de

Stand: vorbereitet 2026-06-26. Ziel: eigene Domain + funktionierende E-Mail
(Resend) für den Feldtest. Der Code ist bereits **domain-switch-ready** —
der Wechsel ist im Kern reine Env-Sache (`NEXT_PUBLIC_SITE_URL`); Netlify-
Crons folgen automatisch über `process.env.URL`.

Empfohlene Domain: **reparo-app.de** (frei geprüft, konsistent mit dem
bisherigen Netlify-Subdomain-Namen). Alternativen frei: `getreparo.de`,
`meinreparo.de`, `reparo.immo`.

---

## Schritt 1 — Domain kaufen (DU)

Registrar-Empfehlung für `.de`: **INWX** (inwx.de) — saubere DNS-Verwaltung,
faire Preise (~10–12 €/J). Alternativen: Netcup, united-domains.
(Bezahlung macht der Nutzer — Claude fasst Zahlungen nicht an.)

Konto anlegen → `reparo-app.de` suchen → kaufen. Danach hast du im INWX-Panel
die DNS-Verwaltung.

---

## Schritt 2 — Domain mit Netlify verbinden

Netlify: Project `reparo-app` → **Domain management** → **Add a domain** →
**Add a domain you already own** → `reparo-app.de` → Verify.

Dann DNS bei INWX setzen (externe DNS-Variante — Registrar + DNS bleiben bei INWX):

| Typ | Name/Host | Wert |
|---|---|---|
| A | `@` (Apex) | `75.2.60.5` |
| CNAME | `www` | `reparo-app.netlify.app` |

> Alternative „Netlify DNS": In Netlify „Netlify DNS" wählen → Netlify gibt 4
> Nameserver (`dns1.p0X.nsone.net` …) → diese bei INWX als Nameserver
> eintragen. Vorteil: alle Records (inkl. Resend) zentral in Netlify.

**SSL:** Netlify stellt Let's-Encrypt-Zertifikat automatisch aus, sobald DNS
auflöst (kann bis ~1 h dauern). Nichts weiter zu tun.

Apex als Primary setzen (Netlify → Domain management → `reparo-app.de` →
„Set as primary domain"), damit `process.env.URL` (Crons) automatisch auf die
neue Domain zeigt.

---

## Schritt 3 — Environment-Variablen in Netlify setzen

Netlify → Project configuration → **Environment variables**:

| Variable | Wert |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://reparo-app.de` |
| `RESEND_API_KEY` | (aus Resend, Schritt 4) |
| `RESEND_FROM_EMAIL` | `Reparo <no-reply@reparo-app.de>` |
| `RESEND_PAUSED` | entfernen oder auf `0` setzen (erst NACH Resend-Verify!) |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | (Vapi-Dashboard → API Keys → Public Key) |
| `VAPI_API_KEY` | (Vapi-Dashboard → API Keys → Private Key) |

Danach **Redeploy** (Deploys → Trigger deploy → „Deploy site"), damit die
`NEXT_PUBLIC_*`-Werte ins Frontend-Bundle gebacken werden.

---

## Schritt 4 — Resend (E-Mail) freischalten — der #1 Feldtest-Blocker

1. resend.com → Domains → **Add Domain** → `reparo-app.de`.
2. Resend zeigt DNS-Records (DKIM `resend._domainkey…`, SPF/Return-Path-MX,
   optional DMARC). Diese bei INWX (bzw. Netlify DNS) eintragen.
3. In Resend „Verify" — bis grün (DNS-Propagation abwarten).
4. API-Key erzeugen → als `RESEND_API_KEY` in Netlify (Schritt 3).
5. `RESEND_PAUSED` entfernen → Redeploy.

> Die exakten Resend-Records werden pro Domain generiert — Claude trägt sie
> ein/transkribiert sie, sobald die Domain in Resend angelegt ist.

---

## Schritt 5 — Verifizieren (Claude macht das mit dir)

- [ ] `https://reparo-app.de` lädt mit gültigem SSL
- [ ] `/api/admin/health` → `ki.ok` grün (sobald `VAPI_API_KEY` gesetzt)
- [ ] Test-E-Mail kommt an (echter Resend-Versand)
- [ ] Web-Voice-Button erscheint im HW-Dashboard (Public Key gesetzt)
- [ ] Voice-Tool-URLs/E-Mail-Footer zeigen `reparo-app.de`

---

## Bereits im Code vorbereitet (erledigt)

- `sitemap.ts`, `robots.ts`, E-Mail-Footer-Anzeigetext folgen `NEXT_PUBLIC_SITE_URL`.
- `voice-call/ingest` auf `NEXT_PUBLIC_SITE_URL` angeglichen.
- Alle API-Routen/Crons nutzen `NEXT_PUBLIC_SITE_URL` bzw. Netlifys `URL`.

## Noch hartcodiert (bewusst, erst bei Public-Launch relevant)

- `app/agb/page.tsx` — Domain im AGB-Text (Rechtstext; bei Public-Beta aktualisieren).
- `components/admin/FeedbackVerdictCard.tsx` — Display-Replace nur Admin-intern.
