# Reparo · Closed Beta

**Willkommen** — du gehörst zu den ersten Menschen, die Reparo vor allen anderen in die Hand bekommen. Diese Broschüre erklärt dir in 5 Minuten, wofür Reparo gut ist, was du testen sollst und wie du dein Feedback loswirst.

---

## Was ist Reparo?

Wenn in einer Wohnung der Wasserhahn tropft oder die Heizung ausfällt, dauert es heute oft Tage bis Wochen, bis ein Handwerker da ist. Mieter rufen den Verwalter an, der ruft drei Handwerker an, einer meldet sich zurück, der Termin passt nicht. Reibung an jeder Stelle.

**Reparo macht das in drei Klicks.** Der Mieter meldet den Schaden mit Foto, eine KI klassifiziert ihn automatisch (Wasserschaden, Heizung, Strom, …) und schätzt Dringlichkeit und Dauer. Der Verwalter sieht das Ticket sofort, kann es in einem Marktplatz an passende Handwerker streuen oder direkt vergeben. Der Handwerker bekommt einen System-kalkulierten Festpreis, nimmt an, terminiert über den eigenen Kalender, rechnet automatisch ab.

**Drei Rollen — ein Workflow:**

| Rolle | Tut hauptsächlich |
|---|---|
| **Mieter** | Schaden melden, Termin abstimmen, Status verfolgen |
| **Verwalter** | Tickets sichten, Handwerker zuweisen, KPIs im Blick behalten |
| **Handwerker** | Aufträge annehmen, Termine setzen, abrechnen |

Im Hintergrund läuft noch ein Admin-Panel für die Reparo-internen Tools — das siehst du in der Beta nicht, du arbeitest direkt mit den drei produktiven Rollen.

---

## Warum bist du in der Beta?

Weil du jemand bist, dessen Urteil mir hilft. Reparo ist gerade an dem Punkt, wo der Code grundsätzlich tut was er soll — aber wo erst echte Menschen rausfinden, ob das **intuitiv** und **nützlich** ist. Genau das soll diese Beta klären, bevor wir das Tor für externe Verwalter aufmachen.

**Was ich von dir hoffe:** dass du dich traust, **hart zu sein**. Drei konkrete Punkte „das war verwirrend, weil …" sind wertvoller als zehn nette „läuft gut". Es geht hier nicht um Höflichkeit, sondern darum, vor dem echten Launch noch mal scharf hinzuschauen.

---

## Deine Demo-Zugänge

> **🌐 App** — https://reparo-app.netlify.app
> ⚠️ Wichtig: Falls du noch eine alte „Craftly"-PWA auf dem Homescreen hast oder einen Bookmark auf einer „craftly"-URL — die ist veraltet. Reparo läuft ausschließlich unter `reparo-app.netlify.app`.

Du bekommst **drei getrennte Logins** — einen pro Rolle. Alle nutzen dasselbe Passwort, damit du es dir nur einmal merken musst. Logg dich für jede Rolle separat ein (oben rechts „Abmelden", dann mit dem nächsten Login wieder rein).

| Rolle | Login | Passwort |
|---|---|---|
| 🏠 **Mieter** | `demo-mieter-1@reparo-demo.de` | `BetaReparo2026!` |
| 🏢 **Verwalter** | `demo-verwalter-1@reparo-demo.de` | `BetaReparo2026!` |
| 🔧 **Handwerker** | `demo-handwerker-1@reparo-demo.de` | `BetaReparo2026!` |

> Es gibt jeweils 3 Accounts (`-1` / `-2` / `-3`) falls du gleichzeitig mit jemandem testen willst und nicht aus derselben Session arbeiten kannst.

So siehst du jede Perspektive sauber getrennt, ohne dass sich z.B. Verwalter-Funktionen in die Mieter-Sicht mischen.

Alle Daten sind Testdaten — **du kannst nichts kaputt machen**, lege so viele Schäden, Aufträge und Termine an wie du willst.

---

## Was du testen sollst (15–25 Min)

### 1. Mieter-Sicht ↓

Logg dich als `demo-mieter-1@reparo-demo.de` ein. Du bist jetzt jemand, dessen Wasserhahn tropft.

1. **Profil** — geh zuerst kurz auf „Mein Profil" (unten rechts oder Sidebar) und hinterleg eine Wohnung-Adresse. Damit der Wizard sie beim Melden auto-befüllt.
2. **Schaden melden** — klick „Schaden melden". Geh durch alle Wizard-Steps (Foto/Beschreibung mit KI-Analyse → Ort → Dringlichkeit → Zusammenfassung). Probier auch die Schnellauswahl-Buttons. Im Ort-Step solltest du jetzt deine Wohnung als Pill sehen — mit „Andere Adresse eingeben" für Sonderfälle.
3. **Übersicht** — gehe zur Startseite. Sobald ein Termin steht, siehst du HW + Datum/Uhrzeit direkt auf der Vorgang-Card (kein extra Klick nötig).
4. **Status checken** — „Meine Tickets". Findest du dein gerade gemeldetes Ticket? Verstehst du den Phasen-Indikator?

### 2. Verwalter-Sicht ↓

Abmelden, neu anmelden als `demo-verwalter-1@reparo-demo.de`. Du bist jetzt der Verwalter — die Demo-Umgebung ist frisch zurückgesetzt, du startest mit leerer Pipeline.

1. **Dashboard verstehen** — KPI-Kacheln oben, dann „Laufende Auktionen". Klick eine Kachel an — wird passend gefiltert?
2. **Ticket öffnen** — klick auf das gerade gemeldete Ticket. Hast du alle Infos die du brauchst (Mieter, Adresse, Beschreibung, KI-Vorschlag)?
3. **Handwerker zuweisen** — wechsle zum „Handwerker"-Verzeichnis oder „Marktplatz". Klick „Verfügbare Slots" bei einem Handwerker. Versuch das Ticket zu vergeben.

### 3. Handwerker-Sicht ↓

Abmelden, neu anmelden als `demo-handwerker-1@reparo-demo.de`. Du bist jetzt der Handwerker, der angeschrieben wurde.

1. **Sidebar erkunden** — was findest du intuitiv, was nicht? Macht die Gruppierung Sinn?
2. **Auftrag annehmen** — klick auf „Aktuelle Ausschreibungen" → Wasserschaden → „Auftrag annehmen". Der Preis ist System-kalkuliert (du kannst nicht selber bieten — bewusste Designentscheidung).
3. **Termin-Vorschlag** — nach der Annahme schlägst du dem Mieter 2–3 Termine vor (Doodle-Stil). Der Mieter wählt einen, die anderen verfallen. Schau dir die Slot-Maske an — fühlt sich das natürlich an?
4. **Kalender prüfen** — wechsle zu „Kalender". Bestätigte Termine erscheinen als solide Auftrag-Karten. Klick auf eine leere Stunde → „Verfügbarkeit anbieten" mit Toggle „Einmalig | Jede Woche". Wiederkehrende Slots werden als Hintergrund-Streifen sichtbar und bilden deine Wochenstruktur.

### 4. Mobile testen 📱

Wenn du Zeit hast: öffne die App **auf deinem Handy** unter derselben URL. Funktioniert der Wizard? Sind die Buttons groß genug? Ist die Sidebar erreichbar?

---

## Feedback geben

> ↘️ **Unten rechts gibt es eine grüne Sprechblase.** Klick sie an und schreib was du denkst.

Das Feedback geht direkt an mich. Ich sehe dabei:
- den aktuellen Pfad in der App (also wo du gerade warst)
- deine Rolle zur Zeit
- den Zeitstempel

Du kannst beliebig viele Nachrichten schicken — eine pro Beobachtung ist sogar besser als eine lange. Alternative: WhatsApp oder Mail an mich, je nachdem was dir liegt.

**Besonders wertvoll:**
- „Ich wusste nicht, wo ich X klicken soll"
- „Was bedeutet eigentlich Y?"
- „Das hier hat mich überrascht — ich hatte Z erwartet"
- „Auf meinem Handy ist N abgeschnitten"

---

## Was noch nicht funktioniert

Damit du nicht in eine Sackgasse läufst und denkst „das ist kaputt":

- **Stripe-Zahlungen** sind im Demo-Modus — es wird nichts wirklich abgerechnet
- **E-Mails** (Welcome, Auftragsbestätigung) kommen meist nicht raus — die Reparo-Domain ist noch nicht offiziell verifiziert
- **Penalty-Markierungen** bleiben auf `manual_pending` — das ist die Vor-Beta-Voreinstellung
- **Google-Login** kommt im nächsten Build — aktuell nur Email/Passwort
- **Wochenstruktur als bewerbbarer Slot** im Marktplatz: aktuell sind diese Slots nur Vorschau („Auf Anfrage"-Badge) — direkt buchen lassen wir erst, wenn der HW sie konkret freigibt. Das ist Absicht und wird im nächsten Sprint vereinfacht.

Falls etwas crasht, hängt oder unverständlich ist: Screenshot mit `Cmd+Shift+5` machen, in die Feedback-Bubble reinpacken, kurz schreiben wo du warst.

---

## Was passiert nach der Beta?

Ich sammle euer Feedback in der ersten Woche, priorisiere die Fixes, baue die wichtigsten Sachen nach. Dann öffne ich für eine erweiterte Beta mit echten Verwaltern und ihrem realen Tagesgeschäft. Wenn das gut läuft, geht Reparo Mitte Sommer 2026 öffentlich live.

Dein früher Input macht den Unterschied zwischen einem Tool das funktioniert und einem das auch gerne benutzt wird.

---

**Danke dir.**  
Lennart · [`lenn-dev@proton.me`](mailto:lenn-dev@proton.me) · Mai 2026
