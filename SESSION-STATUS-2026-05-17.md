# Session-Status zum Ende der Sitzung am 17. Mai 2026

> Update nach PC-Transfer (Abend, in Cowork erledigt). Dieser Stand ist
> die neue Wahrheit für die nächste Claude-Code-Session.

---

## Lokales Setup auf dem neuen Mac — DURCH

- SSH-Key (`~/.ssh/github_betongold`, neu generiert) ist bei GitHub als „MacBook Mai 2026" hinterlegt
- `~/.ssh/config` ist gesetzt (IdentityFile + IdentitiesOnly)
- `ssh -T git@github.com` → erfolgreich als `lenn-dev-ai`
- Repo liegt unter `~/Desktop/Reparo` (geklont aus `lenn-dev-ai/craftly`)
- `.env.local` mit Supabase-URL + Anon-Key + SITE_URL ist drin
- `.claude/settings.local.json` ist drin (wie im PC-TRANSFER-GUIDE)
- `git config user.email/name` gesetzt
- `npm install` durch (645 Packages, 10 Vulnerabilities — eine ist Next.js 14.2.3 CVE, siehe Backlog)
- `npm run dev` läuft, `/login` rendert sauber (Form sichtbar)

---

## Code-Stand auf `main`

Aktueller Commit: `e2f8616` — `fix(onboarding): upsert statt insert + echter error.message`
(unverändert seit dem Vormittag, kein neuer Code in der PC-Transfer-Session)

Was diese Session am Vormittag geliefert hat (Kontext für später):
- OAuth-Login (Google) inkl. Onboarding-Page für Erst-Logins
- Stripe Connect Phase 1 (Schema, Onboarding-Flow für HW, Penalty-Markierung im Cron, Admin-Penalty-Übersicht, Webhook-Stub)
- Beta-Loop (Feedback-Widget, Admin-Feedback-Inbox, Welcome-Mail-Template)
- UI-UX-Sprint (Drawer, Chat Auto-Scroll, Kalender, Spacing, Toast)
- Agent-Review-Sprint (Ticket-Detail-Crash gefixt, Verwalter-RLS-Migrationen, Sanitär-Encoding-Fix, Mieter-Wizard Zurück, Filterchips, Tooltips, Error-Boundary mit Details)
- Onboarding-Upsert-Fix („Profil konnte nicht erstellt werden")

Tests-Status zum Sessionsende: 15/15 E2E grün, 16/16 Pen-Tests blocked, tsc/lint/build clean.

---

## Cloud-Tasks — Stand

### ✅ Admin-Profil-SQL — durch

Im Supabase SQL Editor (Projekt `craftly` / `gkojaogdzzyuboajwyom`, Branch `main PRODUCTION`) ausgeführt:

```sql
INSERT INTO public.profiles (id, email, name, rolle)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)), 'admin'
FROM auth.users u
WHERE u.email = 'lenn-dev@proton.me'
ON CONFLICT (id) DO UPDATE SET rolle = 'admin';
```

Verifikation:
```
email              | rolle | id                                   | auth_user_existiert
lenn-dev@proton.me | admin | 39fbf0ff-c9f3-461c-830f-10779544464e | true
```

### ✅ Smoke-Check Migrationen — durchgeführt, **MIT FINDING**

| Query | Erwartet | Tatsächlich | Status |
|---|---|---|---|
| Stripe-/Penalty-Spalten auf profiles/tickets | 9 (4× stripe_*, 4× penalty_*, 1× frist_warnung_gesendet) | **nur 1** (frist_warnung_gesendet) | ❌ Migrationen fehlen |
| RLS-Policies auf einladungen/nachtraege | 2 (einladungen_select_alle_beteiligten + nachtraege_select_beteiligte) | 6 (beide erwarteten + 4 insert/update) | ✅ |
| Diagnose-Preise gewerk-Werte | nur ASCII, kein "Sanitär" | 8 ASCII-Werte (allgemein, dachdecker, elektro, heizung, maler, sanitaer, …) | ✅ Encoding-Fix drin |

**Konsequenz:** Stripe-Connect- und Penalty-Migrationen aus `CLOUD-DEPLOY-NOW.md` (vermutlich Blöcke 5/6/7) sind **nicht** in der DB. Müssen nachgezogen werden, bevor Stripe Phase 1 Features funktionieren (HW-Onboarding-Flow, Penalty-Markierung im Cron, Admin-Penalty-Übersicht).

### ✅ Nachtrag Abend (17. Mai 2026) — Block 3 + 4 eingespielt + verifiziert

Im Studio SQL-Editor (Projekt `gkojaogdzzyuboajwyom`) als ein zusammengefasster Block ausgeführt, idempotent (`IF NOT EXISTS` / `DROP IF EXISTS`), in `BEGIN; … COMMIT;`-Transaktion gekapselt:

- **Block 3 — Stripe-Connect + Penalty-Schema** → 4 `stripe_*` Spalten auf `profiles`, 4 `penalty_*` Spalten + CHECK-Constraint + Partial-Index auf `tickets`, `protect_profile_fields()` um die 4 Stripe-Spalten erweitert
- **Block 4 — Feedback-Tabelle** → `public.feedback` mit RLS und 4 Policies (`feedback_insert_self`, `feedback_select_own_or_admin`, `feedback_update_admin`, `feedback_delete_admin`)

Verifikation via Supabase MCP — **alle 6 Checks grün**:

| Check | Soll | Ist |
|---|---|---|
| `profiles.stripe_*` Spalten | 4 | 4 ✅ |
| `tickets.penalty_*` Spalten | 4 | 4 ✅ |
| CHECK `tickets_penalty_status_check` | exists | ✅ |
| Index `tickets_penalty_status_idx` | exists | ✅ |
| `feedback.rowsecurity` | true | true ✅ |
| `feedback` Policies | 4 | 4 ✅ |

**DB-Stand nach Block 3+4:** CLOUD-DEPLOY-NOW.md Schritt 1 (Blöcke 1-4) komplett durch. Block 5-7 (Nachtrag-Migrationen aus Agent-Review) waren laut Smoke-Check vom Mittag bereits vorher in der DB.

### ✅ Advisors (security + performance) gefahren via MCP

Snapshot direkt nach Block 3+4. Block 3+4 hat **keine neuen Findings** verursacht — die unten genannten Themen waren alle vorher schon im Repo, jetzt aber sortiert priorisiert.

**Security: 1 ERROR · 91 WARN · 2 INFO**

| Prio | Finding | Fix-Aufwand |
|---|---|---|
| 🔴 vor Beta | `handwerker_bewertungen`-View ist `SECURITY DEFINER` → umgeht RLS | 15 Min |
| 🟡 vor Beta | `auth_leaked_password_protection` (HIBP-Check) im Auth-Dashboard aus | 1 Klick |
| 🟡 vor Beta | `ki_analysen_cache`: RLS an, keine Policy → de-facto unerreichbar | 10 Min |
| 🟢 Post-Beta | 18× `function_search_path_mutable` (inkl. `is_admin`, `is_handwerker`, `protect_profile_fields`) | 45 Min Sweep |
| 🟢 Post-Beta | 28× `*_security_definer_function_executable` (anon/auth dürfen RPC callen) — Spot-Check pro Funktion | 1-2 h |
| ⚪️ Default | 44× `pg_graphql_*_table_exposed` (anon/authenticated GraphQL-sichtbar) — Standard-Supabase-Muster, RLS schützt | ignorieren |

**Performance: 104 WARN · 32 INFO**

| Prio | Finding | Fix-Aufwand |
|---|---|---|
| 🟢 Post-Beta | 58× `auth_rls_initplan` — `auth.uid()` direkt statt `(SELECT auth.uid())` → Re-Eval pro Zeile | 2 h Sweep |
| 🟢 Post-Beta | 46× `multiple_permissive_policies` — Konsolidierung | 2-3 h |
| 🟢 Post-Beta | 18× `unused_index`, 14× `unindexed_foreign_keys` | 1 h Cleanup |

Volle JSON-Reports liegen unter `~/.claude/projects/-Users-lennart-Desktop-Reparo/.../tool-results/mcp-supabase-get_advisors-*.txt` (zwei Files, Security + Performance).

### ⏸ Netlify-ENV-Vars (Impressum) — WARTET auf Adresse

Folgende 6 Vars müssen unter https://app.netlify.com/projects/reparo-app/configuration/env gesetzt + Deploy getriggert werden. Vor Beta rechtlich Pflicht (Hard-Blocker):

```
NEXT_PUBLIC_REPARO_BETREIBER_NAME    = <Vor- und Nachname>          ← brauche ich noch
NEXT_PUBLIC_REPARO_BETREIBER_STRASSE = <Straße + Hausnummer>        ← brauche ich noch
NEXT_PUBLIC_REPARO_BETREIBER_PLZORT  = <PLZ Ort>                    ← brauche ich noch
NEXT_PUBLIC_REPARO_KONTAKT_EMAIL     = lenn-dev@proton.me
NEXT_PUBLIC_REPARO_LIVE_DATA         = true
REPARO_FEEDBACK_EMAIL                = lenn-dev@proton.me
```

---

## Nächste Schritte (Reihenfolge sinnvoll für Claude Code)

1. ✅ ~~Fehlende Migrationen Block 3+4 nachziehen~~ — **durch** (siehe Nachtrag Abend)

2. **Netlify-ENV-Vars setzen** (sobald Adresse vom User da ist) und Deploy triggern. **Hard-Blocker vor Beta** (Impressum-Banner). Vars siehe oben.

3. **Vor Beta-Usern (jetzt aktiv adressieren):**
   - 🔴 `handwerker_bewertungen`-View ohne `SECURITY DEFINER` neu bauen
   - 🟡 HIBP-Toggle im Supabase Auth-Dashboard aktivieren (1 Klick)
   - 🟡 `ki_analysen_cache` Policies ergänzen ODER RLS aus (10 Min)
   - Resend-Domain `reparo-app.de` verifizieren (DNS), sonst keine Mails
   - Google-OAuth-Client anlegen (siehe `ONBOARDING.md` § 3)
   - Stripe-Account + Connect aktivieren (Penalty läuft sonst als `manual_pending`)
   - Manual-QA bei 390 px: Mieter-Wizard, HW-Termin-Annahme, Verwalter-Vergabe
   - 2-3 echte Beta-User anwerben

4. **Backlog (Hygiene, nach Beta):**
   - 🟢 `function_search_path_mutable` Sweep (18 Funktionen, 45 Min)
   - 🟢 `auth_rls_initplan` Sweep — `auth.uid()` → `(SELECT auth.uid())` (~2 h)
   - 🟢 `multiple_permissive_policies` Konsolidierung (~2-3 h)
   - 🟢 `unused_index` / `unindexed_foreign_keys` Cleanup (~1 h)
   - `npm audit` review – Next.js 14.2.3 hat CVE (`https://nextjs.org/blog/security-update-2025-12-11`), Update auf gepatchte Version planen
   - „Bereits über 500 verwaltete Einheiten" auf der Login-Page ist Fake-Stat → entfernen (siehe Memory-Regel „keine Fake-Stats/Testimonials")

---

## Memory-Regeln aus dieser Session (für künftige Sessions relevant)

- **Action-Bias bei „weiter" / „los"**: vollständig liefern statt um Erlaubnis fragen
- **Glaubwürdigkeit**: keine Fake-Stats/Testimonials in Reparo-Marketing
- **Security-Trigger-Invariante**: column-level Whitelist via BEFORE-UPDATE-Trigger; `tests/security/pen-tests.ts` vor jedem RLS-Change laufen lassen
- **KI-Quota**: `try_consume_ki_quota` begrenzt `/api/ki/schadenserkennung` auf 10/Tag/User

---

## Größere Brocken nach Beta (unverändert)

- Stripe Phase 2 — echte Penalty-Charging-Logik (PaymentMethod off_session vs. Connect-Reversal)
- Eigentümer-Rolle als 4. Persona (2-3 Tage)
- Chat-Read-Indicators zwischen Rollen
- Voller Wochen-Editor für Kalender
- Mehrsprachigkeit (de/en) sobald Markt das verlangt
