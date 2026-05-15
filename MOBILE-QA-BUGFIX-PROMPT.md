# Mobile QA + Bug-Fix Prompt für Claude Code

> **Kontext:** Manuelle Mobile-QA bei 390×844 Viewport (iPhone 14 Pro) über alle 4 Dashboard-Rollen. Bugs wurden visuell verifiziert. Dieses Dokument beschreibt exakt welche Bugs existieren, welche Dateien betroffen sind, welche Fixes nötig sind, und enthält eine obligatorische QA-Checkliste die du nach den Fixes abarbeiten MUSST.

---

## BUG-1: Admin-Dashboard Titel wird vom Hamburger-Menü überdeckt

**Symptom:** Auf Mobile (<768px) zeigt der Admin-Dashboard-Titel "Dashboard" nur als "shboard" an. Der Hamburger-Button (fixed, top-4 left-4, 40×40px) überdeckt die ersten ~2 Buchstaben.

**Root Cause:** Alle Admin-Seiten verwenden `p-6` oder `p-8` als Container-Padding OHNE `pt-16 md:pt-8`. Die Verwaltung-, Handwerker- und Mieter-Dashboards haben `pt-16 md:pt-8` korrekt — nur die Admin-Seiten fehlt es.

**Betroffene Dateien + exakte Fixes:**

### 1. `app/dashboard-admin/page.tsx` (Zeile ~207)
```
VORHER:  <div className="p-6 max-w-6xl mx-auto space-y-6">
NACHHER: <div className="p-6 max-w-6xl mx-auto space-y-6 pt-16 md:pt-8">
```

### 2. `app/dashboard-admin/nutzer/page.tsx` (Zeile ~130, und Loading-State ~122)
```
VORHER:  <div className="p-8 max-w-6xl mx-auto">
NACHHER: <div className="p-8 max-w-6xl mx-auto pt-16 md:pt-8">
```
(Auch den Loading-State Container anpassen, falls dort auch `p-8` ohne `pt-16` steht.)

### 3. `app/dashboard-admin/aktivitaet/page.tsx` (Zeile ~74, ~100)
```
VORHER:  <div className="p-8 max-w-6xl mx-auto">
NACHHER: <div className="p-8 max-w-6xl mx-auto pt-16 md:pt-8">
```
(Sowohl Loading-State als auch Main-Return.)

### 4. `app/dashboard-admin/diagnose-preise/page.tsx` (Zeile ~148, ~156)
```
VORHER:  <div className="p-6 max-w-3xl mx-auto">
NACHHER: <div className="p-6 max-w-3xl mx-auto pt-16 md:pt-8">
```
(Sowohl Loading-State als auch Main-Return.)

### 5. `app/dashboard-admin/system/page.tsx` (Zeile ~90)
```
VORHER:  <div className="p-8 max-w-6xl mx-auto">
NACHHER: <div className="p-8 max-w-6xl mx-auto pt-16 md:pt-8">
```
(Sowohl Loading-State als auch Main-Return.)

**Warum pt-16:** Der Hamburger-Button ist `fixed top-4` (16px) + `h-10` (40px) = endet bei 56px. `pt-16` = 64px → 8px Abstand unter dem Button. Auf Desktop (md:) wird `pt-8` verwendet, da die Sidebar dort statisch links sitzt und kein Hamburger existiert.

---

## BUG-2: Handwerker-Subtitle zeigt "Heizung0Noch" statt Separator

**Symptom:** Im Handwerker-Dashboard Hero steht "Sanitär, Heizung0Noch keine Bewertungen" — die Ziffer "0" klebt zwischen Gewerk und "Noch keine Bewertungen".

**Root Cause:** Klassischer React-Gotcha. In `app/dashboard-handwerker/page.tsx` Zeile ~132:
```tsx
{profile?.gewerk && profile?.bewertung_avg && " · "}
```
Wenn `bewertung_avg` den Wert `0` (Number) hat, ist `0` in JavaScript falsy. Aber React rendert `0` als Text! Der Ausdruck `true && 0` ergibt `0`, und React zeigt "0" an statt nichts.

**Betroffene Datei:** `app/dashboard-handwerker/page.tsx` Zeilen 130-137

**Fix:**
```tsx
// VORHER (Zeilen 130-137):
<p className="text-sm text-[#8C857B] mt-1.5">
  {profile?.gewerk && <span>{profile.gewerk}</span>}
  {profile?.gewerk && profile?.bewertung_avg && " · "}
  {profile?.bewertung_avg ? (
    <span className="text-[#C4956A] font-medium">★ {profile.bewertung_avg}</span>
  ) : (
    <span>Noch keine Bewertungen</span>
  )}

// NACHHER:
<p className="text-sm text-[#8C857B] mt-1.5">
  {profile?.gewerk && <span>{profile.gewerk}</span>}
  {profile?.gewerk && profile?.bewertung_avg != null && Number(profile.bewertung_avg) > 0 ? " · " : null}
  {profile?.bewertung_avg != null && Number(profile.bewertung_avg) > 0 ? (
    <span className="text-[#C4956A] font-medium">★ {profile.bewertung_avg}</span>
  ) : (
    <>
      {profile?.gewerk ? " · " : null}
      <span>Noch keine Bewertungen</span>
    </>
  )}
```

**Erklärung:** 
- Prüft explizit `!= null && > 0` statt nur truthy-check
- Bei bewertung_avg = 0 oder null: zeigt "Gewerk · Noch keine Bewertungen" (mit Separator vor "Noch")
- Bei bewertung_avg > 0: zeigt "Gewerk · ★ 4.5"

---

## BUG-3: Sidebar ✕-Button auf Mobile kaum sichtbar

**Symptom:** Wenn die Sidebar geöffnet ist, existiert zwar ein ✕-Button (der Hamburger toggelt zu ✕), aber er ist weiß-auf-weiß (`bg-white` auf weißem Sidebar-Hintergrund) und damit fast unsichtbar. User denken es gibt keinen Close-Button.

**Betroffene Datei:** `components/layout/Sidebar.tsx` Zeile ~179-194

**Fix:** Wenn die Sidebar offen ist, den Button-Hintergrund anpassen:
```tsx
// VORHER (Zeile 181):
className="md:hidden fixed top-4 left-4 z-[60] w-10 h-10 bg-white border border-[#EDE8E1] rounded-xl flex items-center justify-center text-[#2D2A26] hover:bg-[#F5F0EB] transition-all shadow-sm"

// NACHHER:
className={`md:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
  mobileOpen
    ? "bg-[#F5F0EB] border border-[#D5CFC7] text-[#2D2A26]"
    : "bg-white border border-[#EDE8E1] text-[#2D2A26] hover:bg-[#F5F0EB]"
}`}
```

**Zusätzlich:** Das ✕-Zeichen selbst größer und fetter machen (Zeile ~186):
```tsx
// VORHER:
<span className="text-lg">✕</span>

// NACHHER:
<span className="text-xl font-bold">✕</span>
```

---

## OBLIGATORISCHE QA-CHECKLISTE (MUSS nach Fixes durchlaufen werden!)

> ⚠️ Du darfst NICHT "done" sagen bevor JEDER dieser Checks bestanden ist.

### Schritt 1: Entwicklungsserver starten
```bash
cd ~/Desktop/Craftly && npm run dev
```

### Schritt 2: Mobile-Viewport simulieren
Öffne Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M) → Wähle "iPhone 14 Pro" (390×844).

### Schritt 3: Checklist pro Dashboard-Rolle

Navigiere zu JEDER URL und prüfe JEDEN Punkt:

#### A) Admin Dashboard (`/dashboard-admin`)
- [ ] Titel "Dashboard" ist vollständig sichtbar (kein Buchstabe verdeckt)
- [ ] Mindestens 8px Abstand zwischen Hamburger-Button und erstem Content
- [ ] Hamburger öffnet Sidebar
- [ ] ✕-Button in geöffneter Sidebar klar sichtbar (nicht weiß-auf-weiß)
- [ ] Klick auf ✕ schließt Sidebar
- [ ] Klick auf Overlay (dunkel hinterlegt) schließt Sidebar ebenfalls
- [ ] Sidebar zeigt "SICHT WECHSELN" mit 4 Rollen-Buttons

#### B) Admin Sub-Pages
- [ ] `/dashboard-admin/nutzer` — Titel nicht überdeckt
- [ ] `/dashboard-admin/aktivitaet` — Titel nicht überdeckt
- [ ] `/dashboard-admin/diagnose-preise` — Titel nicht überdeckt
- [ ] `/dashboard-admin/system` — Titel nicht überdeckt

#### C) Verwaltung Dashboard (`/dashboard-verwalter`)
- [ ] Titel "Übersicht" vollständig sichtbar
- [ ] "Handwerker-Marktplatz" Button voll sichtbar und klickbar
- [ ] Ticket-Karten responsive (kein Overflow)

#### D) Handwerker Dashboard (`/dashboard-handwerker`)
- [ ] Greeting "Hallo, [Name]" vollständig sichtbar
- [ ] Subtitle zeigt ENTWEDER "Gewerk · ★ X.X" ODER "Gewerk · Noch keine Bewertungen"
- [ ] KEIN "0" zwischen Gewerk und "Noch keine Bewertungen"
- [ ] Sichtbarkeits-Badge responsive
- [ ] "VERFÜGBAR IM RADIUS" Karte nicht abgeschnitten

#### E) Mieter Dashboard (`/dashboard-mieter`)
- [ ] "Hallo, [Name]" sichtbar
- [ ] "Schaden melden" Button klickbar und nicht abgeschnitten
- [ ] Ticket-Karten mit Progress-Bars korrekt dargestellt
- [ ] Kein horizontaler Overflow auf irgendeiner Karte

#### F) Cross-Dashboard Sidebar-Test
- [ ] Öffne Sidebar → wechsle von Admin zu Verwaltung → Sidebar schließt sich
- [ ] Öffne Sidebar → wechsle zu Handwerker → Sidebar schließt sich
- [ ] Öffne Sidebar → wechsle zu Mieter → Sidebar schließt sich
- [ ] Nach jedem Wechsel: Neues Dashboard lädt korrekt

### Schritt 4: Grep-Verification
```bash
# Prüfe dass ALLE Admin-Seiten jetzt pt-16 haben:
grep -rn "pt-16" app/dashboard-admin/ 
# Erwartung: jede page.tsx hat mindestens einen Treffer

# Prüfe dass kein "0 &&" Pattern mehr im Handwerker-Dashboard steht:
grep -n "bewertung_avg &&" app/dashboard-handwerker/page.tsx
# Erwartung: kein Treffer (wurde durch != null && > 0 ersetzt)

# Prüfe Sidebar mobileOpen-Style:
grep -n "mobileOpen" components/layout/Sidebar.tsx
# Erwartung: dynamische className mit mobileOpen-Conditional
```

### Schritt 5: Build-Check
```bash
npm run build
# Muss ohne Fehler durchlaufen
```

---

## GLOBALE MOBILE-DESIGN-REGELN (für alle zukünftigen Änderungen)

1. **Jeder Dashboard-Page-Container MUSS `pt-16 md:pt-8` haben** — der Hamburger-Button ist fixed und überdeckt sonst Content.
2. **Niemals `{number && <JSX>}` verwenden** — immer `{number > 0 && <JSX>}` oder `{number != null && <JSX>}`, weil React `0` als Text rendert.
3. **Sidebar-Toggle-Button muss visuell unterscheidbar sein** — verschiedene Hintergründe für offen/geschlossen Zustand.
4. **Test IMMER bei 390px Breite** — das ist die minimal-unterstützte Viewport-Breite.
5. **Kein horizontaler Scroll** — kein Element darf breiter als der Viewport sein.
