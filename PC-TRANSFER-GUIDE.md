# Reparo — PC-Transfer-Guide

Anleitung, um die Entwicklungsumgebung auf einem neuen Computer einzurichten.
Stand: 17. Mai 2026

---

## 1. SSH-Key für GitHub einrichten

Du brauchst einen SSH-Key, damit `git clone` und `git push` funktionieren.

**Option A — Bestehenden Key vom alten PC kopieren:**

Kopiere die Dateien `~/.ssh/github_betongold` und `~/.ssh/github_betongold.pub` per USB-Stick oder sicherem Transfer auf den neuen PC in den gleichen Ordner (`~/.ssh/`). Dann:

```bash
chmod 600 ~/.ssh/github_betongold
chmod 644 ~/.ssh/github_betongold.pub
```

Falls die Datei `~/.ssh/config` noch nicht existiert, erstelle sie mit folgendem Inhalt:

```
Host github.com
  IdentityFile ~/.ssh/github_betongold
  IdentitiesOnly yes
```

**Option B — Neuen Key generieren:**

```bash
ssh-keygen -t ed25519 -C "lenn-dev@proton.me" -f ~/.ssh/github_betongold
```

Dann den Public Key bei GitHub hinterlegen:

1. Inhalt von `~/.ssh/github_betongold.pub` kopieren
2. GitHub -> Settings -> SSH and GPG Keys -> New SSH Key
3. Titel z.B. "Neuer PC" — Key einfuegen — speichern

`~/.ssh/config` wie oben anlegen.

**Verbindung testen:**

```bash
ssh -T git@github.com
```

Erwartete Ausgabe: `Hi lenn-dev-ai! You've successfully authenticated...`

---

## 2. Repo klonen

```bash
cd ~/Desktop
git clone git@github.com:lenn-dev-ai/craftly.git
cd craftly
```

Das Repo wird als `craftly` geklont — der Ordnername auf dem Desktop bleibt gleich wie vorher.

---

## 3. Dependencies installieren

```bash
npm install
```

---

## 4. Umgebungsvariablen einrichten

Erstelle die Datei `.env.local` im Projekt-Root:

```bash
cp .env.example .env.local
```

Dann `.env.local` oeffnen und folgende Werte eintragen:

```env
NEXT_PUBLIC_SUPABASE_URL=https://gkojaogdzzyuboajwyom.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrb2phb2dkenp5dWJvYWp3eW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTU2ODcsImV4cCI6MjA5MDEzMTY4N30.PUU3WKaKtp2YNW5-F2sL4eDvPxybYV8_r07nTBzwXME
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Die restlichen Variablen (Resend, Stripe, Anthropic, Plausible, Impressum) sind optional und werden nur fuer spezifische Features gebraucht. Siehe `.env.example` fuer Dokumentation.

---

## 5. Git-Identitaet konfigurieren

```bash
git config user.email "lenn-dev@proton.me"
git config user.name "Lenn Test"
```

---

## 6. Claude Code einrichten

Claude Code ist bereits installiert. Damit die Berechtigungen stimmen, erstelle die Datei `.claude/settings.local.json` im Projekt-Root (falls nach dem Klonen nicht vorhanden):

```bash
mkdir -p .claude
```

Inhalt von `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(rm .git/index.lock)",
      "Bash(git add *)",
      "Bash(uuidgen)",
      "Bash(npm install *)",
      "Bash(npm run *)",
      "Bash(git push *)",
      "Bash(git commit *)",
      "Bash(npx depcheck *)",
      "Bash(ssh -T git@github.com)",
      "Bash(ssh-add -l)",
      "Bash(ssh-add ~/.ssh/github_betongold)",
      "Bash(npx tsc *)",
      "Bash(docker exec *)"
    ]
  }
}
```

Diese Datei ist in `.gitignore` und wird nicht mit-committed — daher muss sie manuell angelegt werden.

---

## 7. App starten und pruefen

```bash
npm run dev
```

Dann im Browser oeffnen: http://localhost:3000

Die App sollte die Landing Page ("Mehr verdienen. Weniger suchen.") anzeigen. Teste auch eine Anmeldung, um die Supabase-Verbindung zu pruefen.

**Build testen:**

```bash
npm run build
```

Wenn der Build fehlerfrei durchlaeuft, ist alles korrekt eingerichtet.

---

## 8. Wichtige Links und Zugaenge

| Service | URL | Account |
|---------|-----|---------|
| GitHub Repo | https://github.com/lenn-dev-ai/craftly | lenn-dev-ai |
| Netlify Dashboard | https://app.netlify.com/projects/reparo-app | lenn-dev / lenn-dev@proton.me |
| Netlify Env-Vars | https://app.netlify.com/projects/reparo-app/configuration/env | (siehe oben) |
| Supabase Dashboard | https://supabase.com/dashboard/project/gkojaogdzzyuboajwyom | (Login mit GitHub) |
| Produktion | https://reparo-app.netlify.app | -- |

---

## 9. Optionale Einrichtung

**Lokale Supabase (Docker):**
Falls du lokal mit einer eigenen Supabase-Instanz arbeiten willst, erstelle zusaetzlich `.env.test.local`:

```env
export E2E_SUPABASE_URL=http://127.0.0.1:54321
export E2E_SUPABASE_SERVICE_ROLE_KEY=<wird von supabase start ausgegeben>
```

Starten mit: `npx supabase start` (Docker muss laufen).

**Resend (E-Mails):**
Ohne `RESEND_API_KEY` in `.env.local` funktioniert die App normal — nur E-Mail-Benachrichtigungen werden uebersprungen.

**Anthropic (KI-Schadenserkennung):**
Ohne `ANTHROPIC_API_KEY` faellt die Schadenserkennung automatisch auf die Regex-Heuristik zurueck.

---

## 10. Checkliste

- [ ] SSH-Key eingerichtet und `ssh -T git@github.com` erfolgreich
- [ ] Repo geklont nach `~/Desktop/craftly`
- [ ] `npm install` durchgelaufen
- [ ] `.env.local` mit Supabase-Credentials angelegt
- [ ] `git config` fuer Name/Email gesetzt
- [ ] `.claude/settings.local.json` angelegt
- [ ] `npm run dev` startet ohne Fehler
- [ ] `npm run build` laeuft fehlerfrei durch
- [ ] Anmeldung in der App funktioniert (Supabase-Verbindung OK)
