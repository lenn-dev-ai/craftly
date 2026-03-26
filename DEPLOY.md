# Craftly â Deploy-Anleitung

## Was du brauchst
- Einen kostenlosen Supabase-Account (supabase.com)
- Einen kostenlosen Vercel-Account (vercel.com)
- Ein GitHub-Account (github.com)

Gesamtzeit: ca. 30 Minuten. Keine Programmierkenntnisse nÃ¶tig.

---

## Schritt 1: Supabase einrichten (10 Min)

1. Gehe zu **supabase.com** â "Start your project" â kostenlosen Account erstellen
2. "New project" klicken â Name: **craftly** â Passwort merken â Region: **Frankfurt** â "Create new project"
3. Warte ca. 2 Minuten bis das Projekt bereit ist
4. Linke Spalte: **SQL Editor** klicken â "New query"
5. Den gesamten Inhalt der Datei `supabase-schema.sql` kopieren und einfÃ¼gen â "Run" klicken
6. Du siehst "Success" â die Datenbank ist fertig
7. Linke Spalte: **Settings** â **API** â kopiere:
   - `Project URL` â das ist dein `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` Key â das ist dein `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Schritt 2: Code auf GitHub hochladen (5 Min)

1. Gehe zu **github.com** â "New repository" â Name: **craftly** â "Create repository"
2. Lade den Craftly-Ordner hoch: "uploading an existing file" â alle Dateien hineinziehen â "Commit changes"

---

## Schritt 3: Auf Vercel deployen (10 Min)

1. Gehe zu **vercel.com** â "Sign up" â mit GitHub einloggen
2. "Add New Project" â dein GitHub-Repo "craftly" auswÃ¤hlen â "Import"
3. **Environment Variables** hinzufÃ¼gen (sehr wichtig!):
   - Name: `NEXT_PUBLIC_SUPABASE_URL` â Value: deine Supabase URL
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY` â Value: dein Supabase Anon Key
4. "Deploy" klicken â warte ca. 2 Minuten
5. Vercel gibt dir eine URL wie `craftly.vercel.app` â das ist deine App!

---

## Schritt 4: Eigene Domain (optional, 5 Min)

1. Domain kaufen auf **namecheap.com** (z.B. craftly.de, ca. 12â¬/Jahr)
2. In Vercel: Settings â Domains â deine Domain eingeben
3. Die DNS-EintrÃ¤ge bei Namecheap wie von Vercel angezeigt eintragen
4. Nach 10â30 Minuten ist die Domain aktiv

---

## Erster Login

1. Gehe zu deiner App-URL
2. Klicke "Registrieren"
3. WÃ¤hle deine Rolle (Verwalter, Handwerker oder Mieter)
4. Erstelle dein erstes Konto

---

## Bei Problemen

Einfach Claude fragen â beschreibe die Fehlermeldung und ich helfe dir sofort.

---

## Technischer Stack (fÃ¼r spÃ¤tere Ãbergabe an Entwickler)

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Datenbank:** Supabase (PostgreSQL) mit Row Level Security
- **Auth:** Supabase Auth (E-Mail + Passwort)
- **Hosting:** Vercel
- **Kosten bis 500 Nutzer:** ~0 â¬ / Monat
