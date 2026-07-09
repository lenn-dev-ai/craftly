#!/usr/bin/env node
// Generiert idempotentes, KOMPAKTES SQL (Multi-Row-INSERTs) für eine
// realistische Prod-Testdatenbasis, verankert am Live-Test-Account
// (Admin "Test" per Sicht-Wechsel = verwalter_id 39fbf0ff). Referenziert
// AUSSCHLIESSLICH bereits existierende Auth-User (Verwalter, Demo-Mieter,
// 69 Test-HW) — legt also keine neuen Auth-User an.
//
// Alle erzeugten Zeilen tragen ein 5eed-UUID-Präfix → Cleanup = ein
// DELETE ... WHERE id::text LIKE '5eed%' pro Tabelle.
//
//   node scripts/gen-seed-prod.mjs > supabase/seed-prod-testdaten.sql

// ---- deterministischer PRNG (mulberry32) ----
let _s = 0x5eed1234
const rnd = () => { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = a => a[Math.floor(rnd() * a.length)]
const pickN = (a, n) => [...a].sort(() => rnd() - 0.5).slice(0, n)
const iBetween = (lo, hi) => Math.floor(rnd() * (hi - lo + 1)) + lo
const fBetween = (lo, hi) => rnd() * (hi - lo) + lo
const r2 = n => Math.round(n * 100) / 100
const jitter = (v, d) => Math.round((v + (rnd() - 0.5) * d) * 1e6) / 1e6
const q = s => `'${String(s).replace(/'/g, "''")}'`
const uid = (type, n) => `5eed${type}-0000-4000-a000-${String(n).padStart(12, '0')}`
const daysAgoISO = d => new Date(Date.UTC(2026, 6, 5, 10, 0, 0) - d * 86400000).toISOString()
const daysAheadDate = d => new Date(Date.UTC(2026, 6, 5) + d * 86400000).toISOString().slice(0, 10)

// ---- verankerte, bereits existierende IDs ----
const VERWALTER = '39fbf0ff-c9f3-461c-830f-10779544464e'
const MIETER = [
  '10000000-0000-4000-a000-000000000001',
  '10000000-0000-4000-a000-000000000002',
  '10000000-0000-4000-a000-000000000003',
  '99999999-9999-4999-a999-999999999999',
]
const HW = {
  heizung_sanitaer: ['0ab21cf0-1e25-4deb-a938-b32188e5fbda','1ca615d0-6247-4b56-a417-d42be6bc0982','1ccf3f99-13e1-45dd-a029-7b63bb3b6d79','1e7d7d13-742f-487a-891f-502947b42c68'],
  elektro: ['0ad80c39-2777-49b2-93b3-22b067b9743c','16184e8a-2d24-453d-8b16-c58f857c677c','2b90fffb-f693-44e2-a268-0c07b3d0a46b','30000000-0000-4000-a000-000000000002'],
  maler: ['0f774ffd-21c9-4e31-8c0e-b099a65c0c73','13dd4f12-c6e1-4f28-8736-34d078f78f45','2a215ede-f945-412c-b2ef-ab9158414185','30000000-0000-4000-a000-000000000003'],
  schreiner: ['16096c58-d1d0-45c5-aad6-1128fcea96b2','1a609c19-1b6e-467d-bbfa-d38ab1bed3b2','57d80dc7-485b-44d7-9af5-2ad8a3f79388','58b02273-da5a-4e9b-8e6b-d32f1ebea46e'],
  dachdecker: ['0b707de6-1783-4c51-9847-58f9467905c2','759bfcb5-233d-48af-ab75-c0aeeb582d37','a7b6a2b4-b2a6-44af-9e55-a1cf19a9c441','c0d4ee5a-efda-49fc-9348-d2ec0c919f8c'],
  bodenleger: ['07ff47f5-05ee-4c8e-acdc-d40b7eafcd8f','4752035b-51a5-47f5-baab-612c2809ab10','5e8b72cb-eb1e-4c8b-8fdb-87ec7b810c79','97f6f39d-82b6-4afe-88ea-e1723c664e0c'],
  schluessel: ['01291303-cbad-4f7a-a30e-376d93d27410','21a4caa4-6bab-490e-b127-ada1ddff16c4','28e43f8b-9b6f-467c-a1e7-383510ce09db','6e34706a-8a98-4624-afe7-70cabacf92bd'],
}
const GEWERKE = Object.keys(HW)

const KIEZE = [
  { ort: 'Berlin', plz: '10115', str: 'Invalidenstraße', lat: 52.5308, lng: 13.3846 },
  { ort: 'Berlin', plz: '10245', str: 'Boxhagener Straße', lat: 52.5119, lng: 13.4593 },
  { ort: 'Berlin', plz: '10405', str: 'Prenzlauer Allee', lat: 52.5382, lng: 13.4241 },
  { ort: 'Berlin', plz: '10707', str: 'Konstanzer Straße', lat: 52.4959, lng: 13.3037 },
  { ort: 'Berlin', plz: '10967', str: 'Gneisenaustraße', lat: 52.4894, lng: 13.4014 },
  { ort: 'Berlin', plz: '12047', str: 'Weserstraße', lat: 52.4884, lng: 13.4294 },
  { ort: 'Berlin', plz: '12207', str: 'Lichterfelder Ring', lat: 52.4180, lng: 13.3120 },
  { ort: 'Berlin', plz: '13353', str: 'Müllerstraße', lat: 52.5443, lng: 13.3480 },
  { ort: 'Berlin', plz: '13187', str: 'Wollankstraße', lat: 52.5720, lng: 13.3860 },
  { ort: 'Berlin', plz: '14059', str: 'Kaiserdamm', lat: 52.5083, lng: 13.2846 },
  { ort: 'Potsdam', plz: '14467', str: 'Friedrich-Ebert-Straße', lat: 52.4009, lng: 13.0591 },
]
const EIG_FIRMA = ['Immobilien', 'Grundbesitz', 'Vermögensverwaltung', 'Wohnbau', 'Hausbesitz GbR', 'Beteiligungs KG']
const VORNAMEN = ['Anna','Paul','Marie','Felix','Hannah','Ben','Lena','Jonas','Laura','Tobias','Sandra','Markus','Petra','Frank','Klaus','Birgit','Monika','Jürgen','Sophie','Leon']
const NACHNAMEN = ['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Hoffmann','Schäfer','Koch','Bauer','Richter','Klein','Wolf','Neumann','Zimmermann','Krüger','Hartmann','Lange']
const dName = () => `${pick(VORNAMEN)} ${pick(NACHNAMEN)}`

const KATALOG = {
  heizung_sanitaer: [['Wasserhahn tropft','Der Wasserhahn im Bad tropft dauerhaft, auch fest zugedreht läuft Wasser.'],['WC verstopft','Das WC lässt sich nicht mehr spülen, das Wasser steht hoch.'],['Heizung wird nicht warm','Der Heizkörper im Wohnzimmer bleibt kalt trotz voll aufgedrehtem Regler.'],['Therme Fehler F22','Die Gas-Therme zeigt Fehlercode F22, Warmwasser läuft aber noch.'],['Abfluss Küche verstopft','Das Wasser in der Spüle läuft nur noch sehr langsam ab.']],
  elektro: [['Sicherung fliegt raus','Beim Einschalten der Mikrowelle springt die Küchensicherung.'],['Steckdose ohne Strom','Die Steckdose neben dem Sofa hat keinen Strom mehr.'],['Deckenlampe flackert','Die Lampe im Flur flackert stark beim Einschalten.'],['Türklingel defekt','Die Klingel macht keinen Ton mehr, Paketboten klopfen.']],
  maler: [['Schimmel an der Wand','Im Schlafzimmer bildet sich Schimmel hinter dem Bett.'],['Putz blättert ab','Im Treppenhaus fällt der Putz von der Wand.'],['Wände nach Auszug streichen','Nach dem Mieterwechsel muss die Wohnung neu gestrichen werden.']],
  schreiner: [['Fenster schließt nicht','Das Schlafzimmerfenster geht nicht mehr ganz zu, es zieht.'],['Schrankscharnier gebrochen','Die Küchenschranktür hängt schief, Scharnier gebrochen.'],['Wohnungstür klemmt','Die Eingangstür lässt sich nur mit Kraft schließen.']],
  dachdecker: [['Dachziegel verrutscht','Nach dem Sturm fehlt am Dach ein Stück, ein Ziegel liegt im Hof.'],['Feuchte Stelle Dachboden','Auf dem Dachboden zeigt sich eine feuchte Stelle an der Decke.']],
  bodenleger: [['Parkett wirft Blasen','Im Wohnzimmer hebt sich das Parkett an mehreren Stellen.'],['Fliese gebrochen','Im Bad ist eine Bodenfliese gesprungen, scharfe Kante.']],
  schluessel: [['Schlüssel dreht nicht','Der Wohnungstürschlüssel lässt sich nur mit Gewalt drehen.'],['Ausgesperrt','Mieter hat sich ausgesperrt, Tür ins Schloss gefallen.'],['Briefkastenschloss kaputt','Der Briefkasten lässt sich nicht mehr abschließen.']],
}
const KOMMENTARE = { 5:['Top Service, schnell und sauber.','Sehr freundlich, alles top geklappt.','Pünktlich, professionell, faires Angebot.'], 4:['Gute Arbeit, kleine Wartezeit am Anfang.','Solide Leistung, Preis fair.'], 3:['Arbeit erledigt, Termin einmal verschoben.','Akzeptabel, aber etwas chaotisch.'], 2:['War unpünktlich, Nachbesserung nötig.'], 1:['Sehr unzufrieden, Termin nicht eingehalten.'] }
const NG = ['Material teurer als angenommen.','Weitere defekte Stelle gefunden.','Zusatzaufwand durch erschwerten Zugang.','Anschlussteile mussten zusätzlich erneuert werden.']

// ============================================================
const buckets = {}
const extras = []
const row = (table, cols, tuple) => { if (!buckets[table]) buckets[table] = { cols, rows: [] }; buckets[table].rows.push(tuple) }

// ---- Eigentümer (12) ----
const eig = []
for (let i = 1; i <= 12; i++) {
  const id = uid('e160', i)
  const name = rnd() < 0.5 ? `${pick(NACHNAMEN)} ${pick(EIG_FIRMA)}` : dName()
  const k = pick(KIEZE)
  eig.push({ id, name })
  row('eigentuemer', '(id, verwalter_id, name, anschrift, email, telefon, notizen)',
    `(${q(id)},${q(VERWALTER)},${q(name)},${q(`${k.str} ${iBetween(1,80)}, ${k.plz} ${k.ort}`)},${q(`eig${i}@example-seed.de`)},${q(`+49 30 ${iBetween(1000000,9999999)}`)},'[SEED] Testdaten')`)
}

// ---- Objekte (20) ----
const obj = []
for (let i = 1; i <= 20; i++) {
  const id = uid('0b10', i)
  const k = pick(KIEZE)
  const hn = iBetween(1, 99)
  const name = `${k.str} ${hn}`
  const adr = `${k.str} ${hn}, ${k.plz} ${k.ort}`
  const einheiten = iBetween(4, 24)
  obj.push({ id, name, adr, plz: k.plz, ort: k.ort, str: k.str, lat: jitter(k.lat, 0.02), lng: jitter(k.lng, 0.03), einheiten })
  const o = obj[obj.length - 1]
  row('objekte', '(id, name, adresse, plz, verwalter_id, einheiten_anzahl, lat, lng, created_at)',
    `(${q(id)},${q(name)},${q(adr)},${q(k.plz)},${q(VERWALTER)},${einheiten},${o.lat},${o.lng},${q(daysAgoISO(iBetween(30,400)))})`)
}

// ---- Wohnungen (bis 55) ----
let whgN = 0
for (const o of obj) {
  const anzahl = Math.min(o.einheiten, iBetween(2, 4))
  for (let u = 1; u <= anzahl && whgN < 55; u++) {
    whgN++
    const id = uid('7714', whgN)
    const e = pick(eig)
    const hn = o.name.split(' ').pop()
    const mieterId = rnd() < 0.35 ? pick(MIETER) : null
    const mName = dName()
    const mEmail = `mieter.${whgN}@example-seed.de`
    // whg_bezeichnung muss je (verwalter,strasse,hausnummer) eindeutig sein
    // (Unique-Constraint) → global laufende WE-Nummer voranstellen.
    const etage = iBetween(1, 4)
    const lage = pick(['links', 'rechts', 'Mitte'])
    const bez = `WE ${whgN} · ${etage}. OG ${lage}`
    row('wohnungen', '(id, verwalter_id, strasse, hausnummer, plz, ort, whg_bezeichnung, mieter_id, mieter_name, mieter_email, baujahr, qm, eigentuemer_id, mea_promille, created_at)',
      `(${q(id)},${q(VERWALTER)},${q(o.str)},${q(hn)},${q(o.plz)},${q(o.ort)},${q(bez)},${mieterId ? q(mieterId) : 'NULL'},${q(mName)},${q(mEmail)},${iBetween(1900,2020)},${iBetween(38,140)},${q(e.id)},${iBetween(20,180)},${q(daysAgoISO(iBetween(30,400)))})`)
  }
}

// ---- Stamm-HW (14) ----
let stammN = 0
for (const g of GEWERKE) {
  for (const hw of pickN(HW[g], 2)) {
    if (stammN >= 14) break
    stammN++
    row('stamm_handwerker', '(id, verwalter_id, handwerker_id, objekt_id, gewerk, prio, frist_stunden, notizen)',
      `(${q(uid('57a3', stammN))},${q(VERWALTER)},${q(hw)},${q(pick(obj).id)},${q(g)},${iBetween(1,3)},${pick([24,48,72])},'[SEED] Stamm-HW')`)
  }
}

// ---- Tickets (~58) ----
const PLAN = [...Array(6).fill('offen'), ...Array(6).fill('vergabe'), ...Array(9).fill('angebote_da'), ...Array(13).fill('in_bearbeitung'), ...Array(21).fill('erledigt'), ...Array(3).fill('reklamiert')]
const tickets = []
let tN = 0
for (const phase of PLAN) {
  tN++
  const id = uid('71c7', tN)
  const gewerk = pick(GEWERKE)
  const [titel, beschr] = pick(KATALOG[gewerk])
  const o = pick(obj)
  const dring = pick(['notfall','zeitnah','zeitnah','planbar','planbar','planbar'])
  const surge = dring === 'notfall' ? 1.2 : dring === 'zeitnah' ? 1.1 : 1.0
  const erstellt = rnd() < 0.25 ? VERWALTER : pick(MIETER)
  const lat = jitter(o.lat, 0.005), lng = jitter(o.lng, 0.008)
  const dAlt = phase === 'erledigt' ? iBetween(5,120) : phase === 'reklamiert' ? iBetween(4,40) : phase === 'in_bearbeitung' ? iBetween(1,12) : phase === 'angebote_da' ? iBetween(1,5) : iBetween(0,6)
  const created = daysAgoISO(dAlt)
  let status = phase, hw = null, kosten = null
  if (phase === 'vergabe') {
    status = 'offen'
    // Shape muss DirektvergabeKandidat entsprechen ({hw_id, score, preis}) —
    // die Marktplatz-UI rendert kandidat.preis.
    const kand = pickN(HW[gewerk], 3).map((h, idx) => ({
      hw_id: h,
      score: r2(85 - idx * 8 - fBetween(0, 5)),
      preis: iBetween(150, 600),
    }))
    extras.push(`UPDATE public.tickets SET direktvergabe_kandidaten='${JSON.stringify(kand)}'::jsonb, direktvergabe_index=${iBetween(0,2)}, direktvergabe_angefragt_am=${q(daysAgoISO(0))}, direktvergabe_timeout_min=${pick([15,120,1440])} WHERE id=${q(id)};`)
  } else if (phase === 'in_bearbeitung' || phase === 'reklamiert') {
    hw = pick(HW[gewerk]); kosten = iBetween(120, 1200)
  } else if (phase === 'erledigt') {
    hw = pick(HW[gewerk]); kosten = iBetween(120, 1500)
    extras.push(`UPDATE public.tickets SET hw_abschluss_am=${q(daysAgoISO(Math.max(0,dAlt-2)))}, hw_abschluss_kommentar='Arbeit abgeschlossen, Funktion geprüft.' WHERE id=${q(id)};`)
  }
  tickets.push({ id, gewerk, status, phase, hw, kosten, erstellt, created })
  row('tickets', '(id, titel, beschreibung, gewerk, status, prioritaet, dringlichkeit, surge_faktor, vergabemodus, ticket_typ, objekt_id, verwalter_id, erstellt_von, zugewiesener_hw, kosten_final, einsatzort_adresse, einsatzort_lat, einsatzort_lng, wohnung, created_at)',
    `(${q(id)},${q(titel)},${q(beschr)},${q(gewerk)},${q(status)},${q(dring)},${q(dring)},${surge},'auktion','standard',${q(o.id)},${q(VERWALTER)},${q(erstellt)},${hw ? q(hw) : 'NULL'},${kosten ?? 'NULL'},${q(o.adr)},${lat},${lng},${q(`${iBetween(1,4)}. OG ${pick(['links','rechts'])}`)},${q(created)})`)
}

// ---- HW-Sicht des Accounts: 3 Tickets an ihn ----
for (const t of tickets.filter(t => t.phase === 'in_bearbeitung' || t.phase === 'erledigt').slice(0, 3)) {
  extras.push(`UPDATE public.tickets SET zugewiesener_hw=${q(VERWALTER)} WHERE id=${q(t.id)};`)
  t.hw = VERWALTER
}

// ---- Angebote ----
let aN = 0
tickets.filter(t => t.phase === 'angebote_da').forEach((t, ti) => {
  const bieter = pickN(HW[t.gewerk], iBetween(2, 4)); if (ti === 0) bieter.push(VERWALTER)
  const basis = iBetween(150, 800)
  for (const hw of bieter) {
    aN++
    row('angebote', '(id, ticket_id, handwerker_id, preis, fruehester_termin, nachricht, status, smart_score, created_at)',
      `(${q(uid('a6b0', aN))},${q(t.id)},${q(hw)},${r2(basis*fBetween(0.85,1.2))},${q(daysAheadDate(iBetween(1,14)))},${q(pick(['Kann morgen vorbeikommen.','Material auf Lager, schnell umsetzbar.','Termin flexibel — kurz abstimmen.','Erfahren im Gewerk.']))},'eingereicht',${r2(fBetween(45,95))},${q(t.created)})`)
  }
})

// ---- Einladungen (HW-Sicht offene Anfragen) ----
let eN = 0
for (const t of tickets.filter(t => t.phase === 'vergabe').slice(0, 2)) {
  eN++
  row('einladungen', '(id, ticket_id, handwerker_id, status, empfohlener_preis, created_at)',
    `(${q(uid('e14d', eN))},${q(t.id)},${q(VERWALTER)},'offen',${iBetween(150,600)},${q(daysAgoISO(0))})`)
}

// ---- Termine ----
let mN = 0
for (const t of tickets.filter(t => t.phase === 'in_bearbeitung' && t.hw)) {
  mN++; const von = iBetween(8, 14)
  row('termine', '(id, handwerker_id, ticket_id, titel, datum, von, bis, status, created_at)',
    `(${q(uid('7e12', mN))},${q(t.hw)},${q(t.id)},'Auftrag: Termin',${q(daysAheadDate(iBetween(0,10)))},'${String(von).padStart(2,'0')}:00','${String(von+iBetween(2,4)).padStart(2,'0')}:00','bestaetigt',${q(t.created)})`)
}

// ---- Bewertungen ----
let bN = 0
for (const t of tickets.filter(t => t.phase === 'erledigt' && t.hw && t.hw !== VERWALTER)) {
  if (rnd() > 0.82) continue
  bN++; const sterne = pick([5,5,5,5,4,4,4,3,3,2,1])
  row('bewertungen', '(id, ticket_id, handwerker_id, bewerter_id, sterne, kommentar, created_at)',
    `(${q(uid('be40', bN))},${q(t.id)},${q(t.hw)},${q(t.erstellt)},${sterne},${q(pick(KOMMENTARE[sterne]))},${q(daysAgoISO(iBetween(0,30)))})`)
}

// ---- Provisionen ----
let pN = 0
for (const t of tickets.filter(t => (t.phase === 'erledigt' || t.phase === 'in_bearbeitung' || t.phase === 'reklamiert') && t.hw && t.kosten)) {
  pN++; const betrag = r2(t.kosten * 0.05)
  row('provisionen', '(id, ticket_id, verwalter_id, handwerker_id, auftragswert, provision_rate, provision_betrag, gesamt, is_early_adopter, created_at)',
    `(${q(uid('9207', pN))},${q(t.id)},${q(VERWALTER)},${q(t.hw)},${t.kosten},0.05,${betrag},${r2(t.kosten+betrag)},false,${q(t.created)})`)
}

// ---- Nachträge (8) ----
let nN = 0
for (const t of pickN(tickets.filter(t => (t.phase === 'in_bearbeitung' || t.phase === 'erledigt') && t.hw && t.kosten), 8)) {
  nN++; const rr = rnd()
  const prozent = rr < 0.6 ? fBetween(3,9) : rr < 0.9 ? fBetween(12,24) : fBetween(28,45)
  const betrag = r2(t.kosten * prozent / 100)
  const stufe = prozent < 10 ? 'bagatell' : prozent < 25 ? 'wesentlich' : 'erheblich'
  const status = rr < 0.85 ? 'genehmigt' : rr < 0.95 ? 'abgelehnt' : 'offen'
  const hwId = t.hw === VERWALTER ? pick(HW[t.gewerk]) : t.hw
  // aufpreis_prozent UND stufe sind GENERATED columns → NICHT einfügen.
  void stufe
  row('nachtraege', '(id, ticket_id, handwerker_id, ursprungspreis, nachtrag_betrag, begruendung, fotos, status, genehmigt_von, genehmigt_am, created_at)',
    `(${q(uid('4a67', nN))},${q(t.id)},${q(hwId)},${t.kosten},${betrag},${q(pick(NG))},'{}',${q(status)},${status!=='offen'?q(VERWALTER):'NULL'},${status!=='offen'?q(daysAgoISO(iBetween(0,20))):'NULL'},${q(t.created)})`)
}

// ============================================================
// Emission
const out = []
const P = s => out.push(s)
P(`-- =====================================================================`)
P(`-- Reparo Prod-Testdatenbasis (Sprint BH) — 2026-07-05`)
P(`-- Verankert an verwalter_id ${VERWALTER} ("Test" / Sicht-Wechsel).`)
P(`-- Alle Zeilen 5eed-Präfix. Cleanup: scripts/cleanup-seed-prod.sql`)
P(`-- Idempotent (ON CONFLICT DO NOTHING). Legt KEINE Auth-User an.`)
P(`-- =====================================================================`)
P(`BEGIN;`)
// Reihenfolge = FK-Abhängigkeiten
for (const table of ['eigentuemer','objekte','wohnungen','stamm_handwerker','tickets','angebote','einladungen','termine','bewertungen','provisionen','nachtraege']) {
  const b = buckets[table]; if (!b) continue
  P(`INSERT INTO public.${table} ${b.cols} VALUES`)
  P(b.rows.join(',\n') + `\nON CONFLICT (id) DO NOTHING;`)
}
if (extras.length) { P(`-- Folge-UPDATEs (direktvergabe / hw_abschluss / HW-Sicht)`); extras.forEach(e => P(e)) }
P(`COMMIT;`)
P(``)
P(`-- Summary: ${eig.length} Eigentümer, ${obj.length} Objekte, ${whgN} Wohnungen, ${stammN} Stamm-HW,`)
P(`--   ${tickets.length} Tickets, ${aN} Angebote, ${eN} Einladungen, ${mN} Termine, ${bN} Bewertungen, ${pN} Provisionen, ${nN} Nachträge.`)
console.log(out.join('\n'))
