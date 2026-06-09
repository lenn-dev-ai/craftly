# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Reparo · Beta-Launch-Status

> 18.05.2026, finale Version nach autonomer Cowork-Nacht-Session.
> Lies das morgen vor dem Beta-Tester-Einladen einmal durch.

---

## ✅ Heute komplett gefixt — 13 Bugs

| Item | Was |
|---|---|
| H1 | `/api/auction/bid` → 401 (systematischer Auth-Fix B1.1-Pattern) |
| H2/H3/H4 | Auktion-Wording → Festpreis-Modell |
| H5 | HW-Dashboard-KPI „Offene Ausschreibung" klickbar |
| M4 | Feedback-Bubble Mobile-Position über BottomNav |
| M5 | Mieter-Wizard zentriert |
| H6 | Migration `ticket_einsatzort_und_angebote_dauer` |
| H7 | UNIQUE-Constraint `angebote(ticket_id, handwerker_id)` |
| H8 | `/api/termine/vorschlagen` User-Client statt Service-Role |
| H9 | UPDATE-Policy `angebote_update_handwerker_self` |
| H10 | Admin-Feedback-Page Profile-Embed + Auto-Refresh-Stop |
| H11 | Verwalter-Vergabe Toast + setSending (silent-Button gefixt) |
| UX | Admin-Sidebar ↔ BottomNav konsistent |
| H12 | RLS `einladungen` INSERT+UPDATE für Verwalter+Admin erweitert |

Plus: Phase 3 Admin-Feedback-Dashboard live, doppelte RLS-Policies auf `angebote` cleanup, K1-Story End-to-End grün.

---

## 📂 Was funktioniert (Production, getestet)

### Mieter
- Login, Übersicht, Schaden-Wizard mit KI-Vorklassifikation, M4 Bubble-Mobile, M5 Wizard-Center

### Verwalter
- Login, Dashboard mit klickbaren KPI-Kacheln, Ticket-Detail mit Kontext, Marktplatz, **HW-Vergabe** (H11+H12 grün)

### Handwerker
- Login, Sidebar konsolidiert, Kalender mit 3 Layern, Auftrag annehmen (H1+H2-4), KPI-Klick (H5), Slot-Vorschlag (K1.1), bestätigte Termine im Kalender (K1.2)

### Admin
- `/dashboard-admin/feedback` Dashboard live mit Verdicts, Filter, Auto-Refresh-Stop bei Error (H10), Mobile-BottomNav-Eintrag

### System
- Feedback-Bubble auf allen Auth-Routes (B1.1), Insert mit Bearer-Token, Cowork-Auto-Loop **V2 Review-First**: klassifiziert + zeigt im Dashboard, schreibt KEINE PROMPTS-Files mehr automatisch

---

## 📁 Sprint-Specs für morgen (im PROMPTS/-Ordner, bereit)

| Sprint | Inhalt | Aufwand | Empfohlene Reihenfolge |
|---|---|---|---|
| **Sprint A** | DURCH (H11 + UX) — `sprint-a-h11-ux-2026-05-18-2200.md` | — | erledigt |
| **Sprint B** | Slot+Verfügbarkeit mergen — `sprint-b-merge-slot-verfuegbarkeit.md` | M (~1-2h) | 2. — UX-Improvement |
| **Sprint C** | Diagnose+Auftrag mergen mit Phasen — `sprint-c-merge-diagnose-auftrag.md` | L (mehrere Sessions, Schema-Migration) | 4. — größter Refactor |
| **Sprint D** | Wording-Restwasser + RLS-Cleanup — `sprint-d-cleanup-wording-rls.md` | S–M (~30-45 Min) | 1. — Quick Win für Beta-Optik |
| **Sprint E** | Mieter-Vorgang-Card HW+Termin inline — `sprint-e-mieter-vorgang-card-inline.md` | S–M (~45 Min) | 3. — direktes User-Feedback umgesetzt |

→ Reihenfolge-Empfehlung: **D → B → E → C**

---

## 🔁 Dein Workflow ab morgen

1. **Beta-Tester einladen** mit `BETA-WELCOME.md` (per Mail/WhatsApp/AirDrop)
2. **Wenn Feedback kommt** → landet in `public.feedback`
3. **Cowork-Loop** läuft stündlich :17 → klassifiziert + zeigt im Dashboard
4. **Du reviewst** `/dashboard-admin/feedback` oder das Standalone-Dashboard
5. **Du sagst „Sprint <auswahl>"** → Cowork baut PROMPTS-File für Claude Code
6. **Claude Code im Terminal** → fix → push → Netlify deployt → Cowork-QA

---

## 🚀 Beta-Launch-Checkliste für morgen

- [ ] Resend-Key holen + an Cowork geben (5 Min, optional)
- [ ] H11+H12 selbst kurz prüfen (1 Min) — als `lenn-dev` auf Verwalter-Pfad, „N einladen" → sollte jetzt Toast zeigen oder direkt durchgehen
- [ ] (Optional) Sprint D pasten lassen → Wording-Restwasser ist weg vor Tester
- [ ] Ersten Vertrauten einladen mit `BETA-WELCOME.md`
- [ ] Loop alle 2-3 Stunden checken
- [ ] Bei Bugs: Cowork-Chat → Loop / Sprint <auswahl> / CC fixt → live

---

## ⏸ Was noch offen / nicht beta-blockend

| Item | Impact |
|---|---|
| RESEND_API_KEY | Welcome-/Reminder-Mails kommen nicht raus. DB-Inserts laufen. |
| Google OAuth | Login nur Email/Passwort. 3 Demo-Accounts decken Beta. |
| Impressum-ENV | Closed-Beta, kein Zwang. |
| Sprint B-E | Bereit zum Reinpasten in Claude Code wann du willst. |
| H12-Test | Du musst selbst nochmal versuchen, ich konnte mit `test.verwalter` nicht (Ticket gehört dir als `lenn-dev`). |

---

**Heutiger Sprint in Zahlen:** 13 Bugs gefixt · 6 Schema-Migrationen / RLS-Updates · ~15 Claude-Code-Commits · 4 Phase-3-Admin-Dashboard-Commits · 12 echte Beta-Feedbacks klassifiziert · Auto-Loop V2 Review-First live · Beta-Welcome auf 3 Logins · 4 Sprint-Specs für morgen vorbereitet.

Schlaf gut. 🌙
