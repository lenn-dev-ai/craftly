#!/usr/bin/env node
// Nutzungs-Simulation für Reparo — 300 User + ~3000 Records realistisch
// gegen LOKALES Supabase. Service-Role-Key umgeht RLS.
//
// Verwendung:
//   source tests/e2e/load-env.sh
//   node scripts/seed-simulation.mjs

import { createClient } from "@supabase/supabase-js"

const URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321"
const KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
if (!KEY) {
  console.error("❌ E2E_SUPABASE_SERVICE_ROLE_KEY nicht gesetzt.")
  console.error("   Erst: source tests/e2e/load-env.sh")
  process.exit(1)
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } })

// ============================================================
// Daten-Pools — deutsche Realität, statisch (keine externen APIs)
// ============================================================

const STAEDTE = [
  { name: "Berlin", lat: 52.520, lng: 13.405, plz: "10115" },
  { name: "Hamburg", lat: 53.551, lng: 9.994, plz: "20095" },
  { name: "München", lat: 48.137, lng: 11.575, plz: "80331" },
  { name: "Köln", lat: 50.937, lng: 6.960, plz: "50667" },
  { name: "Frankfurt am Main", lat: 50.111, lng: 8.682, plz: "60311" },
  { name: "Stuttgart", lat: 48.776, lng: 9.181, plz: "70173" },
  { name: "Düsseldorf", lat: 51.227, lng: 6.773, plz: "40213" },
  { name: "Leipzig", lat: 51.339, lng: 12.373, plz: "04109" },
  { name: "Dortmund", lat: 51.514, lng: 7.466, plz: "44135" },
  { name: "Essen", lat: 51.456, lng: 7.012, plz: "45127" },
  { name: "Bremen", lat: 53.079, lng: 8.802, plz: "28195" },
  { name: "Dresden", lat: 51.050, lng: 13.738, plz: "01067" },
  { name: "Hannover", lat: 52.375, lng: 9.732, plz: "30159" },
  { name: "Nürnberg", lat: 49.452, lng: 11.077, plz: "90402" },
  { name: "Duisburg", lat: 51.435, lng: 6.762, plz: "47051" },
  { name: "Bochum", lat: 51.482, lng: 7.219, plz: "44787" },
  { name: "Wuppertal", lat: 51.265, lng: 7.179, plz: "42103" },
  { name: "Bielefeld", lat: 52.030, lng: 8.532, plz: "33602" },
  { name: "Bonn", lat: 50.737, lng: 7.098, plz: "53111" },
  { name: "Münster", lat: 51.961, lng: 7.626, plz: "48143" },
  { name: "Karlsruhe", lat: 49.007, lng: 8.404, plz: "76131" },
  { name: "Mannheim", lat: 49.488, lng: 8.466, plz: "68159" },
  { name: "Augsburg", lat: 48.371, lng: 10.898, plz: "86150" },
  { name: "Wiesbaden", lat: 50.082, lng: 8.241, plz: "65183" },
  { name: "Mönchengladbach", lat: 51.180, lng: 6.443, plz: "41061" },
  { name: "Gelsenkirchen", lat: 51.518, lng: 7.086, plz: "45879" },
  { name: "Aachen", lat: 50.776, lng: 6.084, plz: "52062" },
  { name: "Braunschweig", lat: 52.265, lng: 10.524, plz: "38100" },
  { name: "Chemnitz", lat: 50.828, lng: 12.921, plz: "09111" },
  { name: "Kiel", lat: 54.323, lng: 10.123, plz: "24103" },
]

const VORNAMEN = [
  "Anna","Maximilian","Sophie","Paul","Marie","Leon","Emilia","Felix","Hannah","Ben",
  "Lena","Lukas","Mia","Jonas","Lara","Tim","Laura","Niklas","Sarah","Tobias",
  "Lisa","Daniel","Julia","Sebastian","Katharina","Andreas","Stefanie","Michael","Christina","Thomas",
  "Sandra","Markus","Petra","Frank","Susanne","Klaus","Birgit","Wolfgang","Monika","Jürgen",
]
const NACHNAMEN = [
  "Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann",
  "Schäfer","Koch","Bauer","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Zimmermann",
  "Braun","Krüger","Hofmann","Hartmann","Lange","Schmitt","Werner","Schmitz","Krause","Meier",
  "Lehmann","Schmid","Schulze","Maier","Köhler","Herrmann","König","Walter","Mayer","Huber",
]
const STRASSEN = [
  "Hauptstraße","Bahnhofstraße","Schulstraße","Gartenstraße","Dorfstraße","Bergstraße",
  "Lindenstraße","Kirchstraße","Goethestraße","Schillerstraße","Mozartstraße","Beethovenstraße",
  "Mühlenweg","Wiesenstraße","Marktplatz","Ahornweg","Birkenstraße","Eichendorffstraße",
  "Friedrichstraße","Wilhelmstraße","Kaiserstraße","Königsweg","Parkstraße","Rosenweg",
]
const VERWALTER_BEZEICHNUNGEN = [
  "Hausverwaltung","Immobilien-Service","Wohnungsverwaltung","Haus & Hof Verwaltung",
  "Verwaltungsgesellschaft","Immobilien Management","Property Services","Hausbetreuung",
]
const HW_PRAEFIX = [
  { gewerk: "sanitaer", prefixe: ["Sanitär","Klempnerei","Bad & Heizung","Rohrleitung"] },
  { gewerk: "heizung", prefixe: ["Heizungsbau","Wärmetechnik","Heizung & Sanitär","HKLS"] },
  { gewerk: "elektro", prefixe: ["Elektro","Elektrotechnik","Elektroinstallation","Strom & Licht"] },
  { gewerk: "schreiner", prefixe: ["Schreinerei","Tischlerei","Holzwerkstatt","Möbelbau"] },
  { gewerk: "dachdecker", prefixe: ["Dachdeckerei","Bedachung","Dachbau","Dach & Wand"] },
  { gewerk: "maler", prefixe: ["Malermeister","Maler & Lackierer","Anstrich","Fassadentechnik"] },
  { gewerk: "schlosser", prefixe: ["Schlosserei","Metallbau","Schließtechnik","Sicherheit"] },
]
const HW_SUFFIX = [" GmbH"," & Co. KG"," KG"," GmbH & Co. KG","-Service"," Meisterbetrieb"," Inh.","-Werkstatt"]

const SCHADENS_KATALOG = [
  // sanitaer
  { gewerk: "sanitaer", titel: "Wasserhahn tropft", beschr: "Der Wasserhahn im Bad tropft seit Tagen — auch zugedreht läuft Wasser." },
  { gewerk: "sanitaer", titel: "WC verstopft", beschr: "Das WC lässt sich nicht mehr spülen, das Wasser steht hoch." },
  { gewerk: "sanitaer", titel: "Dusche läuft langsam ab", beschr: "Beim Duschen sammelt sich Wasser im Boden, läuft viel zu langsam ab." },
  { gewerk: "sanitaer", titel: "Wasserrohr leckt", beschr: "Hinter dem Waschbecken bildet sich nasser Fleck." },
  { gewerk: "sanitaer", titel: "Spülkasten leise tropft", beschr: "Toilettenspülung läuft auch nach Drücken weiter." },
  // heizung
  { gewerk: "heizung", titel: "Heizung wird nicht warm", beschr: "Die Heizung im Wohnzimmer bleibt kalt trotz aufgedrehtem Regler." },
  { gewerk: "heizung", titel: "Heizung gluckert laut", beschr: "Nachts hören wir laute Gluckergeräusche aus dem Heizkörper." },
  { gewerk: "heizung", titel: "Therme zeigt Fehler F22", beschr: "Die Gas-Therme hat Fehlercode F22, Warmwasser geht trotzdem." },
  { gewerk: "heizung", titel: "Heizung erst nach langer Zeit warm", beschr: "Es dauert über eine Stunde bis der Raum warm wird." },
  // elektro
  { gewerk: "elektro", titel: "Sicherung fliegt regelmäßig", beschr: "Beim Anschalten der Mikrowelle springt die Sicherung in der Küche raus." },
  { gewerk: "elektro", titel: "Steckdose funktioniert nicht", beschr: "Die Steckdose neben dem Sofa hat keinen Strom mehr." },
  { gewerk: "elektro", titel: "Licht im Bad flackert", beschr: "Die Deckenlampe im Bad flackert beim Einschalten." },
  { gewerk: "elektro", titel: "Klingel kaputt", beschr: "Die Türklingel macht keinen Ton mehr, der Postbote klopft." },
  // schreiner
  { gewerk: "schreiner", titel: "Fenster schließt nicht richtig", beschr: "Das Schlafzimmerfenster geht nicht mehr ganz zu, es zieht." },
  { gewerk: "schreiner", titel: "Schrankscharnier gebrochen", beschr: "Die Küchenschranktür hängt schief, das Scharnier ist gebrochen." },
  { gewerk: "schreiner", titel: "Türgriff lose", beschr: "Der Wohnungstür-Griff wackelt stark, droht abzubrechen." },
  // dachdecker
  { gewerk: "dachdecker", titel: "Dachziegel verrutscht", beschr: "Nach dem Sturm liegt ein Ziegel auf dem Hof, am Dach fehlt ein Stück." },
  { gewerk: "dachdecker", titel: "Wasser im Speicher", beschr: "Auf dem Dachboden ist eine feuchte Stelle an der Decke." },
  // maler
  { gewerk: "maler", titel: "Schimmel an der Wand", beschr: "Im Schlafzimmer wächst Schimmel hinter dem Bett." },
  { gewerk: "maler", titel: "Putz blättert ab", beschr: "Im Flur fällt der Putz von der Wand, hinterlässt Krümel." },
  // schlosser
  { gewerk: "schlosser", titel: "Schlüssel dreht nicht mehr", beschr: "Der Wohnungstürschlüssel lässt sich nur noch mit Gewalt drehen." },
  { gewerk: "schlosser", titel: "Briefkasten-Schloss kaputt", beschr: "Der Briefkasten lässt sich nicht mehr abschließen." },
]
const STERNE_KOMMENTARE = {
  5: ["Top Service, schnell und sauber.","Sehr freundlicher Handwerker, alles geklappt.","Pünktlich, professionell, faires Angebot.","Kann ich uneingeschränkt empfehlen."],
  4: ["Insgesamt gute Arbeit, kleine Wartezeit am Anfang.","Solide Leistung, Kommunikation könnte besser sein.","Hat gut gepasst, Preis fair."],
  3: ["Arbeit erledigt, aber etwas chaotisch.","Geht so — Termin wurde einmal verschoben.","Akzeptabel, würde aber nicht nochmal buchen."],
  2: ["War unpünktlich und nicht freundlich.","Nachbesserung war nötig.","Preis-Leistung passte nicht."],
  1: ["Sehr unzufrieden, Auftrag schlecht ausgeführt.","Nicht empfehlenswert, viel Pfusch.","Hat den Termin nicht eingehalten."],
}

const PASSWORD = "SeedPassword123!"

// ============================================================
// Helpers
// ============================================================
const rand = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rand(arr.length)]
const pickN = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)
const intBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const floatBetween = (min, max) => Math.random() * (max - min) + min
const round2 = (n) => Math.round(n * 100) / 100
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Jitter um Stadt-Koordinaten herum (~5km Streuung)
function jitterKoord(lat, lng) {
  return {
    lat: lat + (Math.random() - 0.5) * 0.08,
    lng: lng + (Math.random() - 0.5) * 0.12,
  }
}

function deutscheAdresse(stadt) {
  return `${pick(STRASSEN)} ${intBetween(1, 99)}, ${stadt.plz} ${stadt.name}`
}

function deutscherName() {
  return `${pick(VORNAMEN)} ${pick(NACHNAMEN)}`
}

// Idempotenter User-Create: existing user wird via updateUserById gepatcht
// statt failing zu sein. Robuste gegen Re-Runs nach abgebrochenem Cleanup.
let _userCache = null
async function loadAllSeedUsers() {
  if (_userCache) return _userCache
  _userCache = new Map()
  for (let page = 1; page <= 20; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (!data?.users.length) break
    for (const u of data.users) {
      if (u.email?.endsWith("@reparo-test.local")) _userCache.set(u.email, u)
    }
  }
  return _userCache
}
async function idempotentCreateUser({ email, name }) {
  const all = await loadAllSeedUsers()
  const existing = all.get(email)
  if (existing) {
    const { error } = await sb.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    })
    if (error) throw new Error(`${email} update: ${error.message}`)
    return { id: existing.id }
  }
  const { data, error } = await sb.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { name },
  })
  if (error) throw new Error(`${email} create: ${error.message}`)
  all.set(email, data.user)
  return { id: data.user.id }
}

// Batch-Insert mit Error-Bail. Für profiles: upsert weil profile-id
// = auth.user.id und User können idempotent existing sein.
async function batchInsert(table, rows, size = 50) {
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size)
    const q = table === "profiles"
      ? sb.from(table).upsert(batch, { onConflict: "id" })
      : sb.from(table).insert(batch)
    const { error } = await q
    if (error) {
      console.error(`❌ ${table} batch ${i}-${i + batch.length}: ${error.message}`)
      console.error("Erste Row:", JSON.stringify(batch[0]).slice(0, 300))
      process.exit(1)
    }
  }
}

// ============================================================
// Cleanup — vorherige Seed-Daten entfernen
// ============================================================
async function cleanup() {
  console.log("→ Cleanup alter Seed-Daten ...")
  // Pageweise iterieren — listUsers hat per_page-Cap (200 in CLI/lokal)
  const seedUsers = []
  for (let page = 1; page <= 20; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (!data?.users.length) break
    for (const u of data.users) {
      if (u.email?.startsWith("seed.") && u.email?.endsWith("@reparo-test.local")) {
        seedUsers.push(u)
      }
    }
  }
  if (seedUsers.length === 0) {
    console.log("  keine Seed-User vorhanden — skip")
    return
  }
  const ids = seedUsers.map(u => u.id)
  // Cascade: alles was an Test-Usern hängt
  await sb.from("nachtraege").delete().in("handwerker_id", ids)
  await sb.from("zeitslot_gebote").delete().in("verwalter_id", ids)
  await sb.from("zeitslots").delete().in("handwerker_id", ids)
  await sb.from("provisionen").delete().in("verwalter_id", ids)
  await sb.from("provisionen").delete().in("handwerker_id", ids)
  await sb.from("angebote").delete().in("handwerker_id", ids)
  await sb.from("bewertungen").delete().in("handwerker_id", ids)
  await sb.from("nachrichten").delete().in("absender_id", ids)
  await sb.from("einladungen").delete().in("handwerker_id", ids)
  await sb.from("termine").delete().in("handwerker_id", ids)
  await sb.from("verfuegbarkeiten").delete().in("handwerker_id", ids)
  await sb.from("tickets").delete().in("erstellt_von", ids)
  await sb.from("tickets").delete().in("zugewiesener_hw", ids)
  await sb.from("objekte").delete().in("verwalter_id", ids)
  for (const u of seedUsers) {
    await sb.auth.admin.deleteUser(u.id)
  }
  console.log(`  ${seedUsers.length} Seed-User + abhängige Daten entfernt`)
}

// ============================================================
// Phase: Verwalter (100)
// ============================================================
async function seedVerwalter() {
  console.log("→ 100 Verwalter ...")
  const ids = []
  for (let i = 1; i <= 100; i++) {
    const name = deutscherName()
    const firma = `${pick(VERWALTER_BEZEICHNUNGEN)} ${pick(NACHNAMEN)}`
    const email = `seed.verwalter.${i}@reparo-test.local`
    const data = await idempotentCreateUser({ email, name })
    ids.push({ id: data.id, name, firma })
  }
  // Profile in Batches
  const profileRows = ids.map(u => ({
    id: u.id,
    email: `seed.verwalter.${ids.indexOf(u) + 1}@reparo-test.local`,
    name: u.name,
    firma: u.firma,
    rolle: "verwalter",
  }))
  await batchInsert("profiles", profileRows)
  console.log(`  ${ids.length} Verwalter angelegt`)
  return ids
}

// ============================================================
// Phase: Handwerker (100)
// ============================================================
async function seedHandwerker() {
  console.log("→ 100 Handwerker ...")
  const ids = []
  for (let i = 1; i <= 100; i++) {
    const name = deutscherName()
    const gewerkInfo = pick(HW_PRAEFIX)
    const firma = `${pick(gewerkInfo.prefixe)}${pick(HW_SUFFIX)} ${pick(NACHNAMEN)}`
    const email = `seed.handwerker.${i}@reparo-test.local`
    const data = await idempotentCreateUser({ email, name })
    ids.push({ id: data.id, name, firma, gewerk: gewerkInfo.gewerk })
  }
  const profileRows = ids.map((u, idx) => {
    const stadt = pick(STAEDTE)
    const koord = jitterKoord(stadt.lat, stadt.lng)
    const sichtbarkeit = pick(["bronze", "bronze", "silber", "silber", "gold"])
    return {
      id: u.id,
      email: `seed.handwerker.${idx + 1}@reparo-test.local`,
      name: u.name,
      firma: u.firma,
      rolle: "handwerker",
      gewerk: u.gewerk,
      plz_bereich: stadt.plz.slice(0, 2),
      basis_stundensatz: intBetween(45, 95),
      mindest_stundensatz: intBetween(35, 50),
      basis_preis: intBetween(50, 80),
      bewertung_avg: round2(floatBetween(2.5, 5.0)),
      auftraege_anzahl: intBetween(0, 250),
      angebotstreue: round2(floatBetween(50, 100)),
      verfuegbarkeit_score: round2(floatBetween(0, 100)),
      sichtbarkeit_stufe: sichtbarkeit,
      startort_adresse: deutscheAdresse(stadt),
      startort_lat: koord.lat,
      startort_lng: koord.lng,
      radius_km: intBetween(15, 50),
      kalender_streak: intBetween(0, 30),
    }
  })
  await batchInsert("profiles", profileRows)
  console.log(`  ${ids.length} Handwerker angelegt`)
  return ids.map((u, idx) => ({ ...u, ...profileRows[idx] }))
}

// ============================================================
// Phase: Mieter (100)
// ============================================================
async function seedMieter() {
  console.log("→ 100 Mieter ...")
  const ids = []
  for (let i = 1; i <= 100; i++) {
    const name = deutscherName()
    const email = `seed.mieter.${i}@reparo-test.local`
    const data = await idempotentCreateUser({ email, name })
    ids.push({ id: data.id, name })
  }
  const profileRows = ids.map((u, idx) => ({
    id: u.id,
    email: `seed.mieter.${idx + 1}@reparo-test.local`,
    name: u.name,
    rolle: "mieter",
  }))
  await batchInsert("profiles", profileRows)
  console.log(`  ${ids.length} Mieter angelegt`)
  return ids
}

// ============================================================
// Phase: Objekte (200)
// ============================================================
async function seedObjekte(verwalter) {
  console.log("→ 200 Objekte ...")
  const rows = []
  for (const v of verwalter) {
    const anzahl = intBetween(1, 5)
    for (let i = 0; i < anzahl; i++) {
      const stadt = pick(STAEDTE)
      rows.push({
        name: `${pick(STRASSEN)} ${intBetween(1, 99)}`,
        adresse: deutscheAdresse(stadt),
        plz: stadt.plz,
        verwalter_id: v.id,
        einheiten_anzahl: intBetween(4, 30),
      })
      if (rows.length >= 200) break
    }
    if (rows.length >= 200) break
  }
  // Ergänzen falls < 200
  while (rows.length < 200) {
    const v = pick(verwalter)
    const stadt = pick(STAEDTE)
    rows.push({
      name: `${pick(STRASSEN)} ${intBetween(1, 99)}`,
      adresse: deutscheAdresse(stadt),
      plz: stadt.plz,
      verwalter_id: v.id,
      einheiten_anzahl: intBetween(4, 30),
    })
  }
  const { data, error } = await sb.from("objekte").insert(rows).select("id, verwalter_id, adresse, plz")
  if (error) { console.error(`Objekte: ${error.message}`); process.exit(1) }
  console.log(`  ${data.length} Objekte angelegt`)
  return data
}

// ============================================================
// Verfügbarkeiten pro Handwerker (Mo–Fr, 8–17 Uhr default)
// ============================================================
async function seedVerfuegbarkeiten(handwerker) {
  console.log("→ Verfügbarkeiten ...")
  // Erst löschen — verfuegbarkeiten hat unique(handwerker_id, wochentag)
  await sb.from("verfuegbarkeiten").delete().in("handwerker_id", handwerker.map(h => h.id))
  const rows = []
  for (const hw of handwerker) {
    for (let wt = 1; wt <= 5; wt++) {
      rows.push({
        handwerker_id: hw.id,
        wochentag: wt,
        von: "08:00:00",
        bis: "17:00:00",
        aktiv: Math.random() > 0.05,
      })
    }
  }
  await batchInsert("verfuegbarkeiten", rows, 100)
  console.log(`  ${rows.length} Verfügbarkeits-Zeilen`)
}

// ============================================================
// Tickets (~500) — Status-Mix wie spezifiziert
// ============================================================
async function seedTickets(mieter, verwalter, handwerker, objekte) {
  console.log("→ ~500 Tickets ...")
  // Status-Verteilung (an die DB-States gemappt)
  // - 15 % offen → standard, status=offen
  // - 10 % "in_diagnose" → ticket_typ=diagnose, status=auktion, no hw
  // - 15 % "in_auktion" → standard, status=auktion, no hw
  // - 20 % "vergeben" → in_bearbeitung, hw zugewiesen, frisch
  // - 15 % "in_arbeit" → in_bearbeitung, älter
  // - 25 % "erledigt" → erledigt, kosten_final gesetzt
  const TICKET_COUNT = 500
  const phasen = [
    { kuerzel: "offen", anteil: 0.15 },
    { kuerzel: "diagnose", anteil: 0.10 },
    { kuerzel: "auktion", anteil: 0.15 },
    { kuerzel: "vergeben", anteil: 0.20 },
    { kuerzel: "in_arbeit", anteil: 0.15 },
    { kuerzel: "erledigt", anteil: 0.25 },
  ]

  // Erstellt_von = entweder Mieter ODER Verwalter (in Reparo erstellen beide)
  const ticketRows = []
  let phaseIdx = 0
  let phaseCount = 0
  let phaseTarget = Math.round(phasen[0].anteil * TICKET_COUNT)

  for (let i = 0; i < TICKET_COUNT; i++) {
    if (phaseCount >= phaseTarget && phaseIdx < phasen.length - 1) {
      phaseIdx++
      phaseCount = 0
      phaseTarget = Math.round(phasen[phaseIdx].anteil * TICKET_COUNT)
    }
    phaseCount++
    const phase = phasen[phaseIdx]

    const schaden = pick(SCHADENS_KATALOG)
    const objekt = pick(objekte)
    const verw = verwalter.find(v => v.id === objekt.verwalter_id)
    const ersteller = Math.random() < 0.4 ? pick(mieter) : verw
    const stadt = STAEDTE.find(s => objekt.plz === s.plz) ?? pick(STAEDTE)
    const koord = jitterKoord(stadt.lat, stadt.lng)
    const daysAgo = phase.kuerzel === "erledigt" ? intBetween(7, 90)
                  : phase.kuerzel === "in_arbeit" ? intBetween(3, 14)
                  : phase.kuerzel === "vergeben" ? intBetween(0, 3)
                  : intBetween(0, 7)
    const createdAt = new Date(Date.now() - daysAgo * 86400_000).toISOString()
    const dringlichkeit = pick(["notfall","zeitnah","zeitnah","planbar","planbar","planbar"])
    const prioritaet = dringlichkeit === "notfall" ? "dringend" : dringlichkeit === "zeitnah" ? "hoch" : "normal"
    const surge = dringlichkeit === "notfall" ? 1.2 : dringlichkeit === "zeitnah" ? 1.1 : 1.0

    // gemeinsame Felder
    const base = {
      titel: schaden.titel,
      beschreibung: schaden.beschr,
      gewerk: schaden.gewerk,
      objekt_id: objekt.id,
      erstellt_von: ersteller.id,
      einsatzort_adresse: objekt.adresse,
      einsatzort_lat: koord.lat,
      einsatzort_lng: koord.lng,
      prioritaet,
      dringlichkeit,
      surge_faktor: surge,
      vergabemodus: "auktion",
      created_at: createdAt,
    }

    let row
    switch (phase.kuerzel) {
      case "offen":
        row = { ...base, status: "offen", ticket_typ: "standard" }
        break
      case "diagnose":
        row = { ...base, status: "auktion", ticket_typ: "diagnose" }
        break
      case "auktion":
        row = {
          ...base, status: "auktion", ticket_typ: "standard",
          auktion_start: createdAt,
          auktion_ende: new Date(new Date(createdAt).getTime() + 24 * 3600_000).toISOString(),
        }
        break
      case "vergeben":
      case "in_arbeit": {
        const hw = pick(handwerker.filter(h => h.gewerk === schaden.gewerk)) ?? pick(handwerker)
        const finalKosten = intBetween(150, 1200)
        row = {
          ...base, status: "in_bearbeitung", ticket_typ: "standard",
          zugewiesener_hw: hw.id,
          kosten_final: finalKosten,
        }
        break
      }
      case "erledigt": {
        const hw = pick(handwerker.filter(h => h.gewerk === schaden.gewerk)) ?? pick(handwerker)
        row = {
          ...base, status: "erledigt", ticket_typ: "standard",
          zugewiesener_hw: hw.id,
          kosten_final: intBetween(150, 1500),
        }
        break
      }
    }
    ticketRows.push(row)
  }

  // Insert in Batches; gib IDs zurück
  const inserted = []
  for (let i = 0; i < ticketRows.length; i += 50) {
    const batch = ticketRows.slice(i, i + 50)
    const { data, error } = await sb.from("tickets").insert(batch).select("id, status, ticket_typ, gewerk, zugewiesener_hw, kosten_final, erstellt_von, einsatzort_lat, einsatzort_lng, created_at")
    if (error) { console.error(`Tickets batch ${i}: ${error.message}`); process.exit(1) }
    inserted.push(...data)
  }
  console.log(`  ${inserted.length} Tickets angelegt`)
  return inserted
}

// ============================================================
// Befunde für Diagnose-Tickets
// ============================================================
async function seedBefunde(tickets, handwerker) {
  const diagTickets = tickets.filter(t => t.ticket_typ === "diagnose")
  console.log(`→ Befunde für ${Math.round(diagTickets.length * 0.7)} von ${diagTickets.length} Diagnose-Tickets ...`)
  let count = 0
  for (const t of diagTickets) {
    if (Math.random() > 0.7) continue // 30 % bleiben unbearbeitet
    const hw = pick(handwerker.filter(h => h.gewerk === t.gewerk)) ?? pick(handwerker)
    const angebot = intBetween(150, 600)
    const stunden = round2(floatBetween(1, 5))
    await sb.from("tickets").update({
      zugewiesener_hw: hw.id,
      befund_text: "Sichtbarer Defekt am betroffenen Teil. Austausch notwendig, Material muss bestellt werden.",
      befund_aufwand_stunden: stunden,
      projekt_angebot: angebot,
      leistungsumfang: ["Defektes Teil ausbauen", "Material besorgen", "Neuteil montieren", "Funktionsprüfung"],
      preiskorridor_min: round2(angebot * 0.85),
      preiskorridor_max: round2(angebot * 1.15),
    }).eq("id", t.id)
    count++
  }
  console.log(`  ${count} Befunde angelegt`)
}

// ============================================================
// Angebote (~700) auf Auktion-Tickets
// ============================================================
async function seedAngebote(tickets, handwerker) {
  console.log("→ Angebote auf Auktions-Tickets ...")
  const aukTickets = tickets.filter(t => t.status === "auktion" && t.ticket_typ === "standard")
  const rows = []
  for (const t of aukTickets) {
    const passendeHws = handwerker.filter(h => h.gewerk === t.gewerk)
    if (passendeHws.length === 0) continue
    const count = intBetween(2, Math.min(5, passendeHws.length))
    const bieter = pickN(passendeHws, count)
    const basisPreis = intBetween(150, 800)
    for (const hw of bieter) {
      rows.push({
        ticket_id: t.id,
        handwerker_id: hw.id,
        preis: round2(basisPreis * floatBetween(0.85, 1.20)),
        fruehester_termin: new Date(Date.now() + intBetween(1, 14) * 86400_000).toISOString().slice(0, 10),
        nachricht: pick([
          "Kann morgen vorbeikommen.",
          "Material auf Lager, schnell umsetzbar.",
          "Termin flexibel — bitte kurz abstimmen.",
          "Erfahren im genannten Gewerk.",
        ]),
        status: "eingereicht",
        smart_score: round2(floatBetween(40, 95)),
      })
    }
  }
  await batchInsert("angebote", rows)
  console.log(`  ${rows.length} Angebote angelegt`)
  return rows.length
}

// ============================================================
// Bewertungen (~400) auf erledigte Tickets
// ============================================================
async function seedBewertungen(tickets) {
  console.log("→ Bewertungen auf erledigte Tickets ...")
  const erl = tickets.filter(t => t.status === "erledigt" && t.zugewiesener_hw)
  const rows = []
  for (const t of erl) {
    if (Math.random() > 0.85) continue // 15 % unbewertet
    const sterne = pick([5,5,5,5,4,4,4,3,3,2,1])
    rows.push({
      ticket_id: t.id,
      handwerker_id: t.zugewiesener_hw,
      bewerter_id: t.erstellt_von,
      sterne,
      kommentar: pick(STERNE_KOMMENTARE[sterne]),
    })
  }
  await batchInsert("bewertungen", rows)
  console.log(`  ${rows.length} Bewertungen angelegt`)
}

// ============================================================
// Zeitslots (~1200) — 5-15 pro Handwerker
// ============================================================
async function seedZeitslots(handwerker) {
  console.log("→ Zeitslots für Handwerker ...")
  const rows = []
  for (const hw of handwerker) {
    const anzahl = intBetween(5, 15)
    for (let i = 0; i < anzahl; i++) {
      const tagOffset = intBetween(0, 30)
      const datum = new Date(Date.now() + tagOffset * 86400_000).toISOString().slice(0, 10)
      const startStunde = intBetween(8, 14)
      const dauer = intBetween(2, 5)
      const stundensatz = hw.basis_stundensatz ?? 60
      const status = pick(["verfuegbar","verfuegbar","verfuegbar","reserviert","vergeben"])
      rows.push({
        handwerker_id: hw.id,
        titel: `Frei-Termin ${pick(["Vormittag","Nachmittag","Ganztags"])}`,
        gewerk: hw.gewerk,
        datum,
        von: `${String(startStunde).padStart(2,"0")}:00:00`,
        bis: `${String(startStunde + dauer).padStart(2,"0")}:00:00`,
        basis_preis_stunde: stundensatz,
        preisfaktor: round2(floatBetween(0.95, 1.20)),
        dynamischer_preis: round2(stundensatz * dauer * floatBetween(0.95, 1.20)),
        status,
        ist_luecke: Math.random() < 0.2,
      })
    }
  }
  await batchInsert("zeitslots", rows)
  console.log(`  ${rows.length} Zeitslots angelegt`)
}

// ============================================================
// Provisionen für erledigte Tickets
// ============================================================
async function seedProvisionen(tickets) {
  console.log("→ Provisionen für erledigte Tickets ...")
  const erl = tickets.filter(
    t => (t.status === "erledigt" || t.status === "in_bearbeitung")
    && t.zugewiesener_hw && t.kosten_final,
  )
  const rows = []
  // Wir brauchen das verwalter-id pro Ticket — über erstellt_von wenn Verwalter, sonst über objekt.
  // Pragmatisch: erstellt_von verwenden (gilt sowohl für Mieter als auch Verwalter im Mock).
  for (const t of erl) {
    const rate = 0.05
    const betrag = round2(t.kosten_final * rate)
    rows.push({
      ticket_id: t.id,
      verwalter_id: t.erstellt_von, // Pragmatik: bei Mieter-Tickets passt das nicht ganz, aber für Aggregate OK
      handwerker_id: t.zugewiesener_hw,
      auftragswert: t.kosten_final,
      provision_rate: rate,
      provision_betrag: betrag,
      gesamt: round2(t.kosten_final + betrag),
      is_early_adopter: false,
    })
  }
  await batchInsert("provisionen", rows)
  console.log(`  ${rows.length} Provisions-Snapshots angelegt`)
}

// ============================================================
// Nachträge (~120) auf in_bearbeitung / erledigt
// ============================================================
async function seedNachtraege(tickets) {
  console.log("→ ~120 Nachträge ...")
  const kandidaten = tickets.filter(
    t => (t.status === "in_bearbeitung" || t.status === "erledigt")
    && t.zugewiesener_hw && t.kosten_final,
  )
  const auswahl = pickN(kandidaten, Math.min(120, kandidaten.length))
  const rows = []
  for (const t of auswahl) {
    // Stufe-Mix: 60% bagatell, 30% wesentlich, 10% erheblich
    const r = Math.random()
    const prozent = r < 0.6 ? floatBetween(3, 9)       // bagatell
                  : r < 0.9 ? floatBetween(12, 24)     // wesentlich
                  : floatBetween(28, 50)               // erheblich
    const betrag = round2(t.kosten_final * prozent / 100)
    const status = r < 0.6 ? "genehmigt"     // bagatell auto
                 : r < 0.85 ? "genehmigt"    // 25 % der wesentlichen werden auch genehmigt
                 : r < 0.95 ? "abgelehnt"
                 : "offen"
    rows.push({
      ticket_id: t.id,
      handwerker_id: t.zugewiesener_hw,
      ursprungspreis: t.kosten_final,
      nachtrag_betrag: betrag,
      begruendung: pick([
        "Material teurer als ursprünglich angenommen.",
        "Weitere defekte Stelle gefunden.",
        "Zusatzaufwand durch erschwerten Zugang.",
        "Anschluss-Teile mussten zusätzlich erneuert werden.",
      ]),
      fotos: [],
      status,
      genehmigt_von: status !== "offen" ? t.erstellt_von : null,
      genehmigt_am: status !== "offen" ? new Date().toISOString() : null,
    })
  }
  await batchInsert("nachtraege", rows)
  console.log(`  ${rows.length} Nachträge angelegt`)
}

// ============================================================
// Main
// ============================================================
async function main() {
  const t0 = Date.now()
  console.log("\n=== Reparo Nutzungs-Simulation ===")
  console.log(`URL: ${URL}\n`)

  await cleanup()
  const verwalter = await seedVerwalter()
  const handwerker = await seedHandwerker()
  const mieter = await seedMieter()
  const objekte = await seedObjekte(verwalter)
  await seedVerfuegbarkeiten(handwerker)
  const tickets = await seedTickets(mieter, verwalter, handwerker, objekte)
  await seedBefunde(tickets, handwerker)
  await seedAngebote(tickets, handwerker)
  await seedBewertungen(tickets)
  await seedZeitslots(handwerker)
  await seedProvisionen(tickets)
  await seedNachtraege(tickets)

  const dauer = Math.round((Date.now() - t0) / 100) / 10
  console.log(`\n=== Done in ${dauer}s ===`)
  console.log(`Login als beliebiger Seed-User möglich mit Password: ${PASSWORD}`)
  console.log(`Email-Pattern: seed.{rolle}.{1..100}@reparo-test.local`)
}

main().catch(err => { console.error("FATAL:", err); process.exit(1) })
