# Reparo — Supabase E-Mail-Templates (DE)

Drei deutschsprachige E-Mail-Templates im Reparo-Design für die Supabase-Auth-Mails.
Alle Inline-Styles, getestet gegen die gängigen E-Mail-Clients (Gmail, Outlook, Apple Mail).

## Dateien

| Datei | Supabase-Template | Subject (empfohlen) |
|---|---|---|
| `confirm-signup.html` | Confirm signup | Bestätigen Sie Ihre Reparo-Anmeldung |
| `magic-link.html` | Magic Link | Ihr Anmeldelink für Reparo |
| `reset-password.html` | Reset Password | Passwort zurücksetzen für Reparo |

Die Templates nutzen den Supabase-Token `{{ .ConfirmationURL }}` — kein anderes Feld wird gebraucht.

## Einrichtung in Supabase Studio

1. Studio öffnen: https://supabase.com/dashboard/project/gkojaogdzzyuboajwyom/auth/templates
2. Pro Template:
   - Tab des entsprechenden Templates auswählen
   - **Subject** wie oben eintragen
   - **Body** komplett ersetzen — Inhalt der jeweiligen `.html`-Datei einfügen
   - **Save**
3. Optional: **Authentication → URL Configuration** prüfen, dass `Site URL` auf `https://reparo-app.netlify.app` zeigt und die Redirect-URLs korrekt sind (`/email-bestaetigt`, `/passwort-zuruecksetzen`).

## Test

Nach dem Save: in der App registrieren, Magic-Link anfordern oder Passwort-Reset auslösen.
Die Mail sollte im Reparo-Design (Off-White-Hintergrund, dunkelgrünes Logo, grüner CTA) ankommen.

## Anpassen

- Logo-Buchstabe ist aktuell „R" — falls Reparo eine SVG-Logo bekommt, kann der `<td>`-Block oben durch ein gehostetes PNG/SVG ersetzt werden (Inline-SVGs werden von einigen E-Mail-Clients gestrippt — daher PNG hosten).
- Footer-Links zeigen auf `https://reparo-app.netlify.app/{impressum,datenschutz,agb}`. Bei Domain-Wechsel hier global suchen+ersetzen.
- Subject-Zeilen sind bewusst informativ, nicht clickbait — passt zum DSGVO-konformen Charakter der Plattform.
