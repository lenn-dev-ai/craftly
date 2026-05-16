# Reparo Mobile App — Implementierungs-Prompt für Claude Code

> **Ziel:** Die Expo-App von einem Read-only-Skeleton zu einer zeigbaren, funktionalen App ausbauen. Alle drei Rollen (Mieter, Handwerker, Verwalter) sollen ihre Kernaktionen durchführen können. **Nur im `mobile/`-Ordner arbeiten.** Web-App nicht anfassen.

---

## Kontext & bestehende Patterns

**Stack:** Expo 54 + Expo Router 6 + NativeWind 4 (Tailwind) + Supabase JS + TypeScript

**Design-Tokens (tailwind.config.js):**
- `bg: "#FAF8F5"`, `accent: "#3D8B7A"`, `warm: "#C4956A"`, `danger: "#C4574B"`
- `mieter: "#5B6ABF"`, `admin: "#7C6CAB"`, `text: "#2D2A26"`, `muted: "#8C857B"`
- `border: "#EDE8E1"`, `card: "#FFFFFF"`

**Bestehende Patterns (beibehalten!):**
- `useAuth()` Hook liefert `{ user, profile, session, signOut, refreshProfile }`
- `supabase` Import aus `../../lib/supabase`
- `<Header title="..." subtitle="..." />` als Page-Header
- NativeWind className auf allen RN-Komponenten
- Pull-to-Refresh via `<RefreshControl>`
- Cards: `bg-card border border-border rounded-xl p-4`
- Section-Labels: `text-xs font-bold uppercase tracking-wider text-muted mb-3`
- Status-Badges: `text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded`

**Routing:** `app/(app)/[rolle]/...` — Expo Router File-based Routing. Aktuell nur `index.tsx` pro Rolle.

**Supabase-Tabellen (die wichtigsten):**
- `tickets` — id, titel, beschreibung, status, prioritaet, gewerk, dringlichkeit, ticket_typ, erstellt_von, verwalter_id, zugewiesener_hw, foto_url, befund_text, projekt_angebot, kosten_final, auktion_start, auktion_ende, einsatzort_adresse, einsatzort_lat, einsatzort_lng, created_at
- `angebote` — id, ticket_id, handwerker_id, preis, kommentar, status, smart_score, created_at
- `nachtraege` — id, ticket_id, nachtrag_betrag, begruendung, kategorie, status, created_at
- `nachrichten` — id, ticket_id, absender_id, text, created_at
- `profiles` — id, email, name, rolle, firma, gewerk, bewertung_avg, telefon
- `bewertungen` — id, ticket_id, mieter_id, handwerker_id, sterne, kommentar

---

## SPRINT 1 — Mieter-Flow (Schaden melden + Ticket-Detail)

### 1.1 Schaden-Melden Screen (`app/(app)/mieter/melden.tsx`)

**Navigation:** FAB (+) Button in `mieter/index.tsx` → `router.push("/(app)/mieter/melden")`

**Formular-Felder:**
1. **Titel** — TextInput, Pflicht, max 100 Zeichen
2. **Beschreibung** — TextInput multiline, optional, max 500 Zeichen
3. **Kategorie/Gewerk** — Pressable-Auswahl (Chips): `sanitaer`, `heizung`, `elektro`, `schliessanlage`, `allgemein`
4. **Dringlichkeit** — Pressable-Auswahl (3 Chips): `dringend` (🔴 Notfall), `hoch` (🟡 Zeitnah), `normal` (🟢 Planbar)
5. **Foto** (optional) — Pressable → `expo-image-picker` (Kamera oder Galerie). Vorschau als Thumbnail.

**Submit-Logik:**
```typescript
// 1. Foto hochladen (wenn vorhanden)
const fotoPath = foto ? `${user.id}/${Date.now()}_${foto.fileName}` : null
if (foto && fotoPath) {
  await supabase.storage.from("schadens-fotos").upload(fotoPath, fotoBlob, { contentType: foto.mimeType })
}

// 2. Ticket erstellen
const { error } = await supabase.from("tickets").insert({
  titel,
  beschreibung: beschreibung || null,
  gewerk: selectedGewerk,
  dringlichkeit: selectedDringlichkeit,
  prioritaet: selectedDringlichkeit, // gleicher Wert
  status: "offen",
  erstellt_von: user.id,
  foto_url: fotoPath,
})
if (error) { Alert.alert("Fehler", error.message); return }
router.back() // zurück zur Liste
```

**UI-Design:**
- ScrollView mit KeyboardAvoidingView
- Chip-Auswahl: `border border-border rounded-full px-4 py-2` — selected: `bg-accent border-accent` mit `text-white`
- Submit-Button: `bg-accent rounded-xl py-4 items-center` mit weißem Text
- Loading-State auf Submit-Button

**Dependency:** `expo-image-picker` muss installiert werden:
```bash
cd mobile && npx expo install expo-image-picker
```

### 1.2 Ticket-Detail Screen (`app/(app)/mieter/ticket/[id].tsx`)

**Navigation:** TicketCard in `mieter/index.tsx` → `router.push(\`/(app)/mieter/ticket/${t.id}\`)`
→ TicketCard muss Pressable werden!

**Inhalte:**
- Header mit Titel + Status-Badge
- Beschreibung (wenn vorhanden)
- Foto-Vorschau (wenn foto_url vorhanden → Signed URL laden)
- Diagnose-Info (wenn ticket_typ === "diagnose"): Befund-Text, Projekt-Angebot
- **Chat-Bereich:** Nachrichten laden aus `nachrichten`-Tabelle + eigene schicken
- Status-Timeline: offen → auktion → in_bearbeitung → erledigt (visuell als vertikale Schritte)
- **Bewertung** (wenn status === "erledigt" und noch keine Bewertung): 1-5 Sterne + Kommentar

**Supabase Queries:**
```typescript
// Ticket mit Handwerker-Profil laden
const { data: ticket } = await supabase
  .from("tickets")
  .select("*, zugewiesener_hw_profil:profiles!zugewiesener_hw(name, firma, bewertung_avg)")
  .eq("id", id)
  .single()

// Nachrichten laden
const { data: msgs } = await supabase
  .from("nachrichten")
  .select("*, absender:profiles!absender_id(name, rolle)")
  .eq("ticket_id", id)
  .order("created_at")

// Nachricht senden
await supabase.from("nachrichten").insert({
  ticket_id: id,
  absender_id: user.id,
  text: chatText.trim(),
})
```

**Chat-UI:**
- FlatList mit Nachrichten (eigene rechts/grün, andere links/grau)
- Input-Bar unten: TextInput + Send-Button
- Auto-Scroll nach unten bei neuer Nachricht

---

## SPRINT 2 — Handwerker-Flow (Angebot abgeben + Auftrags-Detail)

### 2.1 Auftrags-Detail Screen (`app/(app)/handwerker/auftrag/[id].tsx`)

**Navigation:** AuftragCard in `handwerker/index.tsx` → `router.push(\`/(app)/handwerker/auftrag/${a.id}\`)`
→ AuftragCard muss Pressable werden!

**Inhalte:**
- Ticket-Details: Titel, Beschreibung, Gewerk, Dringlichkeit, Adresse
- Foto-Vorschau (wenn vorhanden)
- Auktions-Info: Verbleibende Zeit (Countdown), Anzahl bisheriger Angebote
- **Angebot-Formular** (wenn noch kein eigenes Angebot):
  - Preis (€) — nummerischer TextInput
  - Kommentar — TextInput multiline
  - Submit: `POST` an Supabase `angebote`-Tabelle

**Angebot-Submit:**
```typescript
const { error } = await supabase.from("angebote").insert({
  ticket_id: id,
  handwerker_id: user.id,
  preis: Number(preis),
  kommentar: kommentar || null,
  status: "ausstehend",
})
if (error) { Alert.alert("Fehler", error.message); return }

// Smart-Score Re-Scoring via API
await fetch(`${SITE_URL}/api/auction/bid`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ticketId: id }),
})
```

**Eigenes Angebot anzeigen (wenn schon abgegeben):**
- Preis + Kommentar + Status (ausstehend/angenommen/abgelehnt)
- Kein erneutes Abgeben möglich

### 2.2 Meine Aufträge Tab (`app/(app)/handwerker/meine.tsx`)

**Optional aber empfohlen:** Zweiter Tab/Screen der die zugewiesenen Aufträge zeigt (status = in_bearbeitung, zugewiesener_hw = user.id). Ähnlich wie Mieter-Liste aber aus HW-Perspektive.

---

## SPRINT 3 — Verwalter-Flow (Ticket-Pipeline + Aktionen)

### 3.1 Ticket-Liste Screen (`app/(app)/verwalter/tickets.tsx`)

**Navigation:** KPI-Cards in `verwalter/index.tsx` → `router.push("/(app)/verwalter/tickets?status=offen")`
→ KPI-Cards müssen Pressable werden!

**Filter-Tabs oben:** Offen | Auktion | In Arbeit | Erledigt
**Ticket-Karten** mit: Titel, Status-Badge, Datum, Gewerk, zugewiesener HW (wenn vorhanden)

### 3.2 Ticket-Detail Screen (`app/(app)/verwalter/ticket/[id].tsx`)

**Inhalte:**
- Alle Ticket-Details (wie Mieter, aber mit mehr Info)
- **Angebote-Liste** (wenn status === "auktion"):
  - Jedes Angebot: HW-Name, Firma, Preis, Smart-Score, Bewertung
  - "Annehmen"-Button pro Angebot
- **Diagnose-Pipeline** (wenn ticket_typ === "diagnose"):
  - Befund-Text + Projekt-Angebot anzeigen
  - "Angebot annehmen" / "In Auktion geben" Buttons
- **Nachträge** (wenn vorhanden):
  - Offene Nachträge mit Betrag + Begründung
  - "Genehmigen" / "Ablehnen" Buttons
- **Chat** (wie Mieter)

**Angebot annehmen:**
```typescript
// API-Call statt direktem DB-Write (Audit FIX-2!)
const res = await fetch(`${SITE_URL}/api/auction/close`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
  body: JSON.stringify({ ticketId: id, angebotId }),
})
if (!res.ok) { Alert.alert("Fehler", "Vergabe fehlgeschlagen"); return }
```

---

## SPRINT 4 — Tab-Navigation + Polish

### 4.1 Bottom-Tab-Navigation

Ersetze die aktuelle Single-Screen-per-Rolle durch eine Bottom-Tab-Navigation:

**Mieter Tabs:**
1. 🏠 Vorgänge (`mieter/index.tsx`)
2. ➕ Melden (`mieter/melden.tsx`)
3. 👤 Profil (neuer Screen — Name, Email, Logout)

**Handwerker Tabs:**
1. 🔍 Marktplatz (`handwerker/index.tsx` — verfügbare Aufträge)
2. 📋 Meine Aufträge (`handwerker/meine.tsx`)
3. 👤 Profil

**Verwalter Tabs:**
1. 📊 Übersicht (`verwalter/index.tsx` — KPIs)
2. 📋 Tickets (`verwalter/tickets.tsx`)
3. 👤 Profil

**Implementierung:** Expo Router Tab-Layout in `app/(app)/mieter/_layout.tsx` etc. mit `@react-navigation/bottom-tabs` (bereits installiert).

### 4.2 Profil-Screen (alle Rollen, shared)

**Inhalt:** Name, Email, Rolle-Badge, Logout-Button. Bei Handwerker zusätzlich: Firma, Gewerk, Bewertung.

---

## TECHNISCHE REGELN

1. **Nur `mobile/` Ordner** — keine Änderungen an Web-App oder Supabase-Migrationen
2. **NativeWind className** auf allen Komponenten — kein `StyleSheet.create()`
3. **Supabase-Client** aus `../../lib/supabase` importieren — keine eigenen Clients
4. **Error-Handling** auf JEDER Supabase-Query: `const { data, error } = ...` prüfen
5. **Pull-to-Refresh** auf allen Listenscreens
6. **Loading-States** mit `<ActivityIndicator color="#3D8B7A" />`
7. **Typing:** Interfaces für alle Daten-Shapes definieren
8. **Keine neuen npm Dependencies** außer `expo-image-picker` (Sprint 1)
9. **Deutsche UI-Texte** — konsistent mit Web-App
10. **API-URL:** `process.env.EXPO_PUBLIC_SITE_URL ?? "https://reparo-app.netlify.app"` für API-Calls

## QA-CHECKLISTE

Nach jedem Sprint:
```bash
cd mobile && npx expo export --platform ios 2>&1 | head -5
# Muss ohne Fehler durchlaufen (Type-Check + Bundle)
```

Visuell testen in Expo Go:
- [ ] Mieter: Schaden melden → erscheint in Liste
- [ ] Mieter: Ticket antippen → Detail mit Chat
- [ ] Handwerker: Auftrag antippen → Detail + Angebot abgeben
- [ ] Verwalter: KPI antippen → Ticket-Liste → Detail → Angebot annehmen
- [ ] Pull-to-Refresh auf allen Listen
- [ ] Keyboard verschwindet nach Submit
- [ ] Zurück-Navigation funktioniert überall
