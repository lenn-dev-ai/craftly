# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC-PROMPT: Sprint AJ Commit + Push

## Was Cowork gebaut hat (alles bereits geschrieben):

**4 Dateien geändert/neu:**
- `app/api/dev/switch-rolle/route.ts` (NEU) — POST endpoint, UPDATE't profiles.rolle
- `lib/context/ActiveRoleContext.tsx` — neue Prop `darfWechselnZu?: string[]`
- `components/layout/RoleGuard.tsx` — lädt profiles.demo_rollen, gibt's an Provider
- `components/RollenWechsel.tsx` — zeigt sich auch für Demo-User, ruft API-Route

**DB-Migration** (bereits via Supabase-MCP applied):
- `profiles.demo_rollen text[]` hinzugefügt
- Neuer Account `demo@reparo-demo.de` / `BetaReparo2026!`
  mit `demo_rollen = ['mieter','verwalter','handwerker']`, startet als Mieter

## Bitte ausführen:

```bash
cd ~/Desktop/Reparo

# Build validieren — fängt TS-Errors früh
npm run build 2>&1 | tail -30

# Wenn grün:
git add app/api/dev/switch-rolle/route.ts components/RollenWechsel.tsx components/layout/RoleGuard.tsx lib/context/ActiveRoleContext.tsx

git commit -m "feat(sprint-aj): Multi-Role-Switcher für Demo-Accounts

Demo-User mit profiles.demo_rollen[] kann live zwischen Mieter/Verwalter/
Handwerker switchen, ohne neu einzuloggen.

- ActiveRoleContext: neue Prop darfWechselnZu?: string[]
- RoleGuard: lädt demo_rollen aus profiles, gibt's an Provider weiter
- RollenWechsel: sichtbar auch für !istAdmin wenn darfWechselnZu.length > 1.
  Klick triggert POST /api/dev/switch-rolle (UPDATE profiles.rolle via
  Service-Role, Whitelist-Check gegen demo_rollen), dann Hard-Reload.
- API-Route /api/dev/switch-rolle: auth-check + Whitelist + Service-Role UPDATE

DB-Migration (bereits applied):
- ALTER TABLE profiles ADD COLUMN demo_rollen text[]
- Neuer Account demo@reparo-demo.de mit allen 3 Rollen

Architektur-Trade-off: profiles.rolle bleibt single (kein RLS-Bruch),
Switch ist ein UPDATE + Reload — funktional aus User-Sicht identisch
zu echtem Multi-Role.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

## Nach Netlify-Rebuild (~2 Min):

Login mit `demo@reparo-demo.de` / `BetaReparo2026!` → landet im Mieter-Dashboard.
Links in der Sidebar (oben): Dropdown **"Demo: Rolle wechseln"** mit den 3 Optionen.
Klick → API-Call → Hard-Reload → Zieldashboard.

Wenn ein Build-Fehler kommt: bitte Output schicken, dann fixen wir das.
