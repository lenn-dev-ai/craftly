// Cowork-Verdicts pro Feedback-Eintrag (Stand 18.05.2026 13:40).
//
// Schlüssel: feedback.id. Die VERDICTS-Map wird beim Render mit
// getVerdict(id, message) gelookt; wenn keine manuelle Einschätzung da
// ist, fällt classifyHeuristisch ein und liefert ein "waiting"-Verdict.
//
// Quelle: das Standalone-Dashboard unter /feedback-dashboard.html
// (Cowork). Bei neuen Feedbacks ergänzt Cowork hier — manuell oder
// per stündlichem Loop, wenn der Auto-Klassifizierer steht.

export type VerdictCat = "bug" | "ux" | "feature" | "question" | "positive" | "test" | "crash"
export type VerdictSev = "blocker" | "high" | "medium" | "low"
export type VerdictStatus = "done" | "inprogress" | "waiting" | "needdecision" | "backlog" | "blocker"
export type VerdictOwner = "cowork" | "claudecode" | "lennart" | "erledigt" | "niemand"

export interface Verdict {
  cat: VerdictCat
  sev: VerdictSev
  area: string
  summary: string
  recommendation: string
  status: VerdictStatus
  owner: VerdictOwner
  ref?: string
}

export const STATUS_LABEL: Record<VerdictStatus, string> = {
  done: "Erledigt",
  inprogress: "In Arbeit",
  waiting: "Wartet",
  needdecision: "Lennart-Entscheidung nötig",
  backlog: "Backlog",
  blocker: "BLOCKER",
}

export const OWNER_LABEL: Record<VerdictOwner, string> = {
  cowork: "Cowork",
  claudecode: "Claude Code",
  lennart: "Lennart",
  erledigt: "—",
  niemand: "noch nicht zugewiesen",
}

// Manuell gepflegte Cowork-Verdicts (1:1 aus feedback-dashboard.html
// übernommen, Stand 18.05.2026 14:25).
export const VERDICTS: Record<string, Verdict> = {
  "1d84ab82-8da9-4e49-8eb5-54d918c4f2b3": {
    cat: "test", sev: "low",
    area: "Bubble (Mobile-Smoke)",
    summary: "Lennarts Mobile-Bubble-Test nach M4-Fix.",
    recommendation: "Nichts zu tun — Test hat bestätigt, dass die Bubble nach M4-Deploy live auf reparo-app.netlify.app erreichbar ist.",
    status: "done",
    owner: "erledigt",
    ref: "Commit 9f2b24a · BETA-FEEDBACK Iteration 6 (M4)",
  },
  "0dc7348c-69ba-4b61-aecf-0c9378476293": {
    cat: "test", sev: "low",
    area: "Bubble (Smoke)",
    summary: "Admin-Smoke-Test von /dashboard-verwalter/handwerker.",
    recommendation: "Nichts zu tun — kein echtes Beta-Feedback. Loop wird beim nächsten Lauf als 'test' klassifizieren und viewed=true setzen.",
    status: "done",
    owner: "erledigt",
  },
  "fb0663dc-e839-4196-8e6d-fb47f3f10549": {
    cat: "positive", sev: "low",
    area: "Verwalter-Dashboard / KPI-Kacheln",
    summary: "Positives Feedback: KPI-Kacheln klickbar + filtern Ticket-Liste sauber.",
    recommendation: "Nichts zu tun — Lob für F9 (Commit 29626eb). Falls Lennart eine Sammlung 'positive Quotes' für Pitch braucht, kann ich das aggregieren.",
    status: "done",
    owner: "erledigt",
    ref: "F9 / Commit 29626eb",
  },
  "ee101390-01e8-4526-9c03-160a33c9637b": {
    cat: "feature", sev: "medium",
    area: "Mieter-Übersicht (Vorgang-Card)",
    summary: "Mieter-Wunsch: zugewiesener HW + Termin direkt inline auf der Übersicht statt erst nach Klick.",
    recommendation: "Klar implementierbar (M-Aufwand). Card-Komponente in app/dashboard-mieter/page.tsx muss zwei Felder zusätzlich rendern (handwerker.name + termin.start). Vor Implementierung: Lennart muss entscheiden ob das immer angezeigt wird (auch während 'Auktion' / 'wartet' Status) oder nur ab Status 'Reparatur'.",
    status: "needdecision",
    owner: "lennart",
    ref: "post-H1-Fix in Folge-Sprint",
  },
  "d99ff0fb-df46-4cf6-9533-af5727e39d35": {
    cat: "test", sev: "low",
    area: "Bubble (Smoke)",
    summary: "Admin-Smoke-Test von /dashboard-admin.",
    recommendation: "Nichts zu tun.",
    status: "done",
    owner: "erledigt",
  },
  "dd42b595-6ae0-4d13-83d2-f97a752fdf23": {
    cat: "bug", sev: "blocker",
    area: "HW-Auftrag-Annahme (/api/auction/bid) + vermutlich alle Server-Routes mit auth.getUser()",
    summary: "POST /api/auction/bid wirft 401 Unauthorized — gleiches Pattern wie B1.1 (Bearer-Token wird nicht gelesen).",
    recommendation: "Erledigt via H1-Sprint (04f9c88 systematischer Auth-Fix für alle Server-Routes) + H2/H3/H4 Auktions-Wording-Cleanup (16a348a). Bearer-Token-Helper `lib/auth/getUserFromRequest.ts` zentralisiert.",
    status: "done",
    owner: "erledigt",
    ref: "H1 · 04f9c88 + 16a348a · Sprint A",
  },
  "89967c7b-07c3-4e63-822a-3d7e0cd8b9e2": {
    cat: "test", sev: "low",
    area: "Bubble (Smoke, lokal)",
    summary: "Lokaler Test von localhost.",
    recommendation: "Nichts zu tun.",
    status: "done",
    owner: "erledigt",
  },
  "6d9e855e-b3cb-4093-9acf-ed250d201d64": {
    cat: "test", sev: "low",
    area: "Bubble (B1.1-Smoke)",
    summary: "Cowork-Smoketest für B1.1 (Bearer-Token-Fix in /api/feedback).",
    recommendation: "Nichts zu tun — hat funktioniert, deshalb war B1.1 grün.",
    status: "done",
    owner: "erledigt",
    ref: "Commit 1fd30db (B1.1)",
  },
  "20a8821e-ab29-477f-8505-8a70d5a728f8": {
    cat: "test", sev: "low",
    area: "Bubble (Smoke, lokal)",
    summary: "Lokaler Test von localhost.",
    recommendation: "Nichts zu tun.",
    status: "done",
    owner: "erledigt",
  },
  "8698ce87-e305-4929-a538-a1d74b940cb7": {
    cat: "test", sev: "low",
    area: "Bubble (Smoke, lokal)",
    summary: "Lokaler Test von localhost.",
    recommendation: "Nichts zu tun.",
    status: "done",
    owner: "erledigt",
  },
  // === Iteration 7 (Cowork-Testrun 14:10) ===
  // f6d050a3 (Wizard-Centering) hat einen späteren Eintrag weiter unten
  // mit status:"done" — der gewinnt (JS-Object-Key-Eindeutigkeit). Hier
  // entfernt damit die Datei nicht zwei widersprüchliche Einträge zeigt.
  "af5e426a-5d9d-44ef-adbb-318790ca7918": {
    cat: "bug", sev: "high",
    area: "HW-Dashboard (/dashboard-handwerker) - KPI-Kachel 'Offene Ausschreibung'",
    summary: "KPI-Kachel reagiert nicht auf Klick — sollte zur Ausschreibungs-Liste führen.",
    recommendation: "Click-Through aktivieren wie bei Verwalter (F9 / Commit 29626eb). Kpi-Komponente in app/dashboard-handwerker/page.tsx braucht href-Prop. S-Aufwand.",
    status: "done",
    owner: "erledigt",
    ref: "H5 · KPI-Kacheln klickbar in F9-Pattern · Sprint H",
  },

  // === Iteration 7-9 (18.-20.05.) — Sprint UX + Sprint B + KI-Schnellauswahl ===
  "f6d050a3-cb16-4fb1-8386-3a72e30cb9f0": {
    cat: "ux", sev: "medium", area: "Mieter-Wizard Container-Centering",
    summary: "Wizard nach rechts verschoben.",
    recommendation: "Erledigt via M5-Sprint (Container `mx-auto` ergänzt).",
    status: "done", owner: "erledigt", ref: "M5 · Sprint UX",
  },
  "5640787d-298a-4e1e-861d-a390b25cc9f9": {
    cat: "feature", sev: "low", area: "Mieter-Wizard Foto-Upload",
    summary: "Video vom tropfenden Wasserhahn statt nur Foto?",
    recommendation: "Backlog: Video-Upload + KI-Vision-Analyse für Video ist substantiell. Foto-Upload reicht für Beta. Spec für Post-Beta.",
    status: "backlog", owner: "lennart",
  },
  "4da463be-fb21-4e23-9580-78630bdfb53c": {
    cat: "ux", sev: "medium", area: "Verwalter-Ticket-Detail Hamburger-Überlagerung",
    summary: "Zurück-Button hinter Hamburger.",
    recommendation: "Erledigt via Sprint UX Phase 1 + R15 (Pattern `pl-14 pr-4` auf allen Headers).",
    status: "done", owner: "erledigt", ref: "Sprint UX P1 + R15 commit f0b6a1e",
  },
  "65f26e2d-a327-44ee-a935-de8c953350ba": {
    cat: "question", sev: "high", area: "Konzept Mieter→HV→Auktion-Workflow",
    summary: "Lennart hinterfragt Workflow-Logik.",
    recommendation: "Beantwortet durch Mieter-First-Konzept-Bestätigung (25.05.) — Sprint AD versteckt Verwalter-Wizard-UI. Mieter ist immer Eingeber.",
    status: "done", owner: "erledigt", ref: "KONZEPT-CONFIRMED-2026-05-25-mieter-first.md",
  },
  "c78feaae-2ca3-4999-8ae9-00910fc4299c": {
    cat: "question", sev: "medium", area: "Marktplatz-Konzept Festpreise vs. Auktion",
    summary: "Sollten Preise nicht festvereinbart sein (Doctolib-Style)?",
    recommendation: "Konzept-Entscheidung: aktuell Auktion-Modell live (Sprint K Landing). Diagnose-Preise als Fix-Pricing wurden mit R22 gedroppt. Konzept-Review post-Beta sinnvoll.",
    status: "needdecision", owner: "lennart",
  },
  "9f0513b9-44a0-400e-ab28-f7406f70b000": {
    cat: "bug", sev: "blocker", area: "HW-Auftrag-Annahme",
    summary: "Annahme/Bestätigung passiert nichts.",
    recommendation: "Erledigt via Sprint AA Hotfix (provisionen_ticket_id_unique Migration) + User-Client-Fix in api/auftraege/annehmen.",
    status: "done", owner: "erledigt", ref: "Sprint AA · Commit 2c097e7 + Migration applied",
  },
  "359d64d3-9d95-4d1d-a1b5-81dc674e6e13": {
    cat: "feature", sev: "low", area: "HW-Einnahmen-Kacheln klickbar",
    summary: "Einnahmen-Kacheln sollten anklickbar in Detail.",
    recommendation: "Backlog: kleine Click-Through-Ergänzung, post-Beta.",
    status: "backlog", owner: "claudecode",
  },
  "3b80448b-d118-4faa-a1e8-4ab4a1ca1890": {
    cat: "ux", sev: "low", area: "HW-Kalender Slot-Klick",
    summary: "Slot-Klick → Lösch-Bestätigung; sollte eher Anzeige sein.",
    recommendation: "Erledigt via Sprint B (Slot+Verfügbarkeit-Merge) — Click → Detail-Modal statt Confirm.",
    status: "done", owner: "erledigt", ref: "Sprint B B2 commit b760a7f",
  },
  "5db8c0e2-7e5f-4889-b297-5d7ea695fd18": {
    cat: "question", sev: "medium", area: "Zeitslot vs. Verfügbarkeit",
    summary: "Unterschied unklar.",
    recommendation: "Erledigt via Sprint B (B1-B4) — gemergt zu einer Tabelle + UI.",
    status: "done", owner: "erledigt", ref: "Sprint B B1-B4",
  },
  "175a5c49-55ed-4a8a-a46a-199d6628d2e3": {
    cat: "ux", sev: "low", area: "HW-Zeitslots h-Suffix verschoben",
    summary: "h von Stunden rutscht runter.",
    recommendation: "Erledigt via Sprint UX Item 4 (h-Suffix vertical aligned).",
    status: "done", owner: "erledigt", ref: "Sprint UX I4 commit f679c1e",
  },
  "47f62752-6909-4e3b-9a47-be352137f93c": {
    cat: "question", sev: "low", area: "HW-Profil Werkstatt vs morgens-los",
    summary: "Warum unterscheiden? Ein Startort sollte reichen.",
    recommendation: "Erledigt via b9b783e: Werkstatt-Adress-Block UI entfernt, Save-Logic spiegelt startort_* automatisch auf adresse/lat/lng (scoring-pipeline-Fallback bleibt funktional).",
    status: "done", owner: "erledigt", ref: "b9b783e",
  },
  "8e20fa02-f43b-4989-a72c-f6e386ea817e": {
    cat: "feature", sev: "medium", area: "HW-Slots Ort-Angabe",
    summary: "Ort für Fahrzeit-Bemessung.",
    recommendation: "Teilweise erledigt: HW-Standort + Radius im Profil (Sprint L kontextiert). Slot-spezifischer Ort ist Backlog.",
    status: "backlog", owner: "claudecode",
  },
  "fee57a75-cd3c-4ac1-83ec-a1b851a398fe": {
    cat: "ux", sev: "low", area: "Admin Stammbaum vs horizontale Auswahl",
    summary: "Inkonsistente Punkte zwischen Sidebar und horizontal.",
    recommendation: "Erledigt via Sprint M (Konsistenz-Pass alle Rollen + Sidebar).",
    status: "done", owner: "erledigt", ref: "Sprint M cde683a",
  },
  "54e2df6d-39c8-4050-acd8-e84f3c36aaa2": {
    cat: "feature", sev: "high", area: "HW-Google-Kalender-Sync",
    summary: "Manuell ist Adoption-Blocker.",
    recommendation: "Konzept-Memo geschrieben (KONZEPT-google-calendar-sync-hw.md). Implementation post-Beta nach Lennart-Bestätigung.",
    status: "needdecision", owner: "lennart", ref: "KONZEPT-google-calendar-sync-hw.md",
  },
  "1c0964f1-f4a5-41ce-869d-63fdb9393327": {
    cat: "question", sev: "medium", area: "Diagnose vs. Auftrag",
    summary: "Macht Aufteilung Sinn oder mergen?",
    recommendation: "Erledigt via Sprint C (Merge) + R22 (Admin-Page droppen).",
    status: "done", owner: "erledigt", ref: "Sprint C + R22 b5c5258",
  },
  "625be650-50f5-47c3-9592-b4a2cc475838": {
    cat: "question", sev: "medium", area: "Slot vs. Verfügbarkeit",
    summary: "Konzept-Frage.",
    recommendation: "Erledigt via Sprint B (Merge).",
    status: "done", owner: "erledigt", ref: "Sprint B",
  },
  "f4d86912-5b9b-4276-b112-ca13b4c578d5": {
    cat: "bug", sev: "blocker", area: "Verwalter-Vergabe schlägt fehl",
    summary: "Vergabe-Button: Fehlermeldung.",
    recommendation: "Erledigt via H11/H12 (Toast+RLS) + Sprint AA (Migration provisionen_ticket_id_unique).",
    status: "done", owner: "erledigt", ref: "Sprint A H11/H12 + Sprint AA Migration applied 25.05.",
  },
  "125ddf52-3374-494d-a9e8-0f438ef04c0c": {
    cat: "bug", sev: "blocker", area: "Admin-Feedback Schema-Cache",
    summary: "Could not find relationship feedback↔profiles.",
    recommendation: "Erledigt via H10 (FK + embed-hint).",
    status: "done", owner: "erledigt", ref: "Sprint A H10 commit 9a07091",
  },
  "f443670f-0683-4bde-b84f-f47d7d6d72b5": {
    cat: "ux", sev: "high", area: "Mobile Container-Overflow",
    summary: "Seiten zoomen ungewollt rechts/links über Bildschirm.",
    recommendation: "Erledigt via R16 (overflow-x-hidden + min-w-0 global).",
    status: "done", owner: "erledigt", ref: "R16 commit a144ad3",
  },
  "7de666f7-6e35-412c-90b4-472c8debaa6b": {
    cat: "bug", sev: "high", area: "HW-Gewerk frei wählbar",
    summary: "HW sollte nicht beliebiges Gewerk pro Ticket wählen können.",
    recommendation: "Erledigt via Sprint L (handwerker_gewerke Stamm-Gewerke aus Profil).",
    status: "done", owner: "erledigt", ref: "Sprint L commit e28d316",
  },
  "f88ec0c7-796a-4414-80ff-79394df2baf0": {
    cat: "question", sev: "medium", area: "Kalender + Zeitslots mergen",
    summary: "Brauchen wir beide?",
    recommendation: "Erledigt via Sprint B.",
    status: "done", owner: "erledigt", ref: "Sprint B",
  },
  "b078859b-cc65-49fb-9d40-caec31fb84fd": {
    cat: "ux", sev: "low", area: "AGB-Page Hamburger fehlt",
    summary: "3 Striche fehlen.",
    recommendation: "AGB ist public (kein Dashboard-Layout, daher kein Hamburger). Stattdessen via 2629a62: expliziter \"← Zurück zur Startseite\"-Link rechts in der Nav.",
    status: "done", owner: "erledigt", ref: "2629a62",
  },
  "90229867-2837-45a9-93c1-0b006acc588c": {
    cat: "ux", sev: "medium", area: "Mieter Vergabe-Uhr passt nicht",
    summary: "Uhr passt nicht zu Ticket-1-2-Tage-Angabe.",
    recommendation: "Erledigt via Sprint UX I6 (Auktions-Dauer-Cap 72h + Konsistenz mit Dringlichkeit).",
    status: "done", owner: "erledigt", ref: "Sprint UX I6 commit c13afdf",
  },
  "a2f592dc-ee4b-4a73-884c-acf69903b520": {
    cat: "question", sev: "high", area: "Termin-Koordination + Mieter sieht Auktion?",
    summary: "Konzept-Frage zu Mieter-Sicht der Auktion.",
    recommendation: "Erledigt via R5 (Mieter sieht 'Handwerker wird gesucht' statt 'Auktion') + Mieter-First-Konzept.",
    status: "done", owner: "erledigt", ref: "R5 commit d121077",
  },
  "fbbf6c70-84e8-4494-a5d5-db893e48ff07": {
    cat: "question", sev: "medium", area: "KI-Schnellauswahl Sinnhaftigkeit",
    summary: "Hilft die Schnellauswahl? KI auf Text+Foto?",
    recommendation: "Bleibt Konzept-Frage. Quick-Select-Pills sind als 'optional' markiert (R4). KI-Vision auf Foto ist sowieso primär. Nach Beta-Daten neu bewerten.",
    status: "needdecision", owner: "lennart",
  },
  "2d757d5d-e4db-4f06-bbe5-090454a0386b": {
    cat: "ux", sev: "low", area: "HW-Zeitslots Von-Bis-Spacing",
    summary: "Zeiten überlappen visuell.",
    recommendation: "Erledigt via Sprint UX I5.",
    status: "done", owner: "erledigt", ref: "Sprint UX I5 commit fb9db64",
  },
  "24cd28cb-9065-423d-a8dc-b668c3b39622": {
    cat: "ux", sev: "low", area: "HW-Zeitslots h-Suffix",
    summary: "h eine Zeile zu tief.",
    recommendation: "Erledigt via Sprint UX I4.",
    status: "done", owner: "erledigt", ref: "Sprint UX I4 commit f679c1e",
  },
  "25592383-4b90-4c7a-b8ed-59561eb491b7": {
    cat: "question", sev: "high", area: "Slot+Kalender mergen",
    summary: "Wollten wir das nicht mergen?",
    recommendation: "Erledigt via Sprint B (B1-B4).",
    status: "done", owner: "erledigt", ref: "Sprint B",
  },
  "0baa2d87-f623-4c03-a739-e32ee8e95897": {
    cat: "ux", sev: "high", area: "Mieter-Ticket Hamburger über Zurück",
    summary: "Scroll-State Hamburger verdeckt.",
    recommendation: "Erledigt via Sprint UX I1 + R15.",
    status: "done", owner: "erledigt", ref: "Sprint UX I1 bd8fac7 + R15 f0b6a1e",
  },
  "7326f74f-2596-4bba-8521-5c34e6cf44ab": {
    cat: "ux", sev: "high", area: "Auktion zu lange (>3 Tage)",
    summary: "Cap auf max 72h.",
    recommendation: "Erledigt via Sprint UX I6.",
    status: "done", owner: "erledigt", ref: "Sprint UX I6 c13afdf",
  },
  "18437be9-6321-41af-a649-6caa43e7232e": {
    cat: "ux", sev: "low", area: "Preisspanne 107-107",
    summary: "Nur Spanne wenn min≠max.",
    recommendation: "Erledigt via Sprint UX I3.",
    status: "done", owner: "erledigt", ref: "Sprint UX I3 936d23b",
  },
  "0c6d8aae-97e3-4ecc-927f-0c8facc5fa18": {
    cat: "ux", sev: "low", area: "Mieter-Auktion KI-Block verschoben",
    summary: "KI links verschoben.",
    recommendation: "Erledigt via Sprint UX I2.",
    status: "done", owner: "erledigt", ref: "Sprint UX I2 07f0260",
  },

  // === Iteration 22 (25.05. — heute morgen) ===
  "a441a93c-591a-45f2-ba11-68099fb19068": {
    cat: "bug", sev: "blocker", area: "Verwalter-Vergabe schlägt fehl (Regression)",
    summary: "Gleicher Bug wie f4d86912 — Vergabe schlägt fehl.",
    recommendation: "Erledigt via Sprint AA Hotfix: provisionen_ticket_id_unique Migration applied (Cowork 25.05.) + defensive Code-Fallback live.",
    status: "done", owner: "erledigt", ref: "Sprint AA + Migration applied 25.05.",
  },
  "c636f2bf-c4c8-4187-ad7b-a87153adac78": {
    cat: "question", sev: "high", area: "Konzept-Update Mieter-First-Workflow",
    summary: "HV setzt nicht Ticket ab, Mieter ist immer Eingeber, KI ruft Mieter zurück.",
    recommendation: "Bestätigt + Sprint AD geschrieben (Verwalter-Wizard UI verstecken). Voice-AI V2 Spec (Outbound zu Mieter) bereit für Post-Twilio-Identity-Setup.",
    status: "done", owner: "erledigt", ref: "KONZEPT-CONFIRMED-2026-05-25-mieter-first.md + Sprint AD",
  },
  "07c7a7af-c97e-462a-9193-2845202f5d75": {
    cat: "question", sev: "low", area: "Diagnose-Preise Admin obsolet",
    summary: "Brauchen wir das noch?",
    recommendation: "Erledigt via R22 — Page gedroppt, aus Sidebar raus, 302 LOC gelöscht.",
    status: "done", owner: "erledigt", ref: "R22 commit b5c5258",
  },
  "09fd6f49-71a1-4b6b-b380-813b96d71a37": {
    cat: "question", sev: "high", area: "Daten-Reset für Beta",
    summary: "Alle Nutzer löschen für Beta-Test.",
    recommendation: "Erledigt: Daten-Reset durchgeführt (24 Tickets, 16 Angebote, 62 Slots, 5 Einladungen, 6 alte Demo/Test-User → 0). 9 neue individuelle Demo-Accounts angelegt. Siehe DEMO-ACCOUNTS-2026-05-25.md.",
    status: "done", owner: "erledigt", ref: "DEMO-ACCOUNTS-2026-05-25.md",
  },
  "ae98f00a-b21f-42a4-a8a4-c0030da81cf3": {
    cat: "ux", sev: "high", area: "Mieter-Ticket Mobile-Verschoben",
    summary: "Mobile nach rechts verschoben.",
    recommendation: "Erledigt via R17 (asymmetrisches Padding gefixt).",
    status: "done", owner: "erledigt", ref: "R17 commit 3923a86",
  },
  "f28deb26-23cb-4aa2-a8d3-eddafa113538": {
    cat: "bug", sev: "high", area: "HW-Kalender Hamburger-Regression",
    summary: "3 Striche verdecken Zurück (Regression aus Sprint UX).",
    recommendation: "Erledigt via R15 (Pattern pl-14 auf Kalender-Header).",
    status: "done", owner: "erledigt", ref: "R15 commit f0b6a1e",
  },
  "b1ad8083-8674-4bb3-abb1-bfb81f5f6bce": {
    cat: "feature", sev: "high", area: "HW-Google-Kalender-Sync",
    summary: "Manuell ist Adoption-Blocker.",
    recommendation: "Konzept-Memo geschrieben (KONZEPT-google-calendar-sync-hw.md). Implementation post-Beta nach Lennart-Bestätigung — ~2-3 Tage CC.",
    status: "needdecision", owner: "lennart", ref: "KONZEPT-google-calendar-sync-hw.md",
  },
  "345cee63-3330-4bdb-b763-6150d9fa77ee": {
    cat: "bug", sev: "high", area: "Karte mobile Bug + OSM veraltet",
    summary: "Mobile Click-Lock + Karten-Look unprofessionell.",
    recommendation: "Mobile-Quick-Fix via R18 (scrollWheelZoom=false). OSM-Replacement → Mapbox-Konzept-Memo geschrieben, Mapbox-Token bereits in Netlify gesetzt. CC kann Mapbox-Migration starten.",
    status: "done", owner: "erledigt", ref: "R18 commit 905dd19 + KONZEPT-map-upgrade-mapbox.md",
  },
  "9337c802-9e7e-4643-a83b-d0606f7c1303": {
    cat: "question", sev: "medium", area: "HW-Sidebar tote Routen (zeitslots/Termine/Diagnosen)",
    summary: "Sollten gemerged sein.",
    recommendation: "Final erledigt via 2629a62: alle 3 Sidebar-Items (zeitslots/Termine/Diagnosen) entfernt, Pages als Redirects zum Kalender bzw. Dashboard. -1758 LOC.",
    status: "done", owner: "erledigt", ref: "2629a62 (zusätzlich zu R2 e28c55f + R22 b5c5258)",
  },
  "f4f19fbe-c3e0-47a4-b4b2-2da0db813678": {
    cat: "bug", sev: "medium", area: "KI Health Score 30 bei leerer DB",
    summary: "Logic-Bug — sollte 'keine Daten' anzeigen.",
    recommendation: "Erledigt via R19 (null-safe, '—' statt magischer Zahl).",
    status: "done", owner: "erledigt", ref: "R19 commit 972b2f6",
  },
  "33ffb279-9c6e-4f5f-a91b-b8de459bae31": {
    cat: "bug", sev: "high", area: "Container-Overflow Admin-Nutzer (Regression)",
    summary: "Ränder über Bildschirm.",
    recommendation: "Erledigt via R16 (overflow-x-hidden global).",
    status: "done", owner: "erledigt", ref: "R16 commit a144ad3",
  },
  "3f7e5be8-5611-4e12-b72f-3a642e819f7e": {
    cat: "question", sev: "high", area: "Neue Demo-Accounts für Beta",
    summary: "Individuelle Accounts erstellen.",
    recommendation: "Erledigt: 9 Demo-Accounts angelegt (Demo-Mieter-1/2/3, Demo-Verwalter-1/2/3, Demo-Handwerker-1/2/3).",
    status: "done", owner: "erledigt", ref: "DEMO-ACCOUNTS-2026-05-25.md",
  },
  "9a528680-0af2-4f82-9c30-95c320f29dd4": {
    cat: "ux", sev: "medium", area: "Admin-Feedback Schriften-Overlap",
    summary: "CSS-Overlap in Karten.",
    recommendation: "Erledigt via R20.",
    status: "done", owner: "erledigt", ref: "R20 commit 1adffc0",
  },
  "9ab7382d-f3b9-46d8-8837-062b2773f029": {
    cat: "feature", sev: "high", area: "Admin-Dashboard Live-Metriken (Mission Control)",
    summary: "Tote Charts statt Live-Nutzung.",
    recommendation: "Erledigt via Sprint AH (Mission Control LIVE): /dashboard-admin zeigt jetzt Live-Status, Action-Items, 24h-Aktivität mit Trend-Pfeilen und System-Health-Dots. Alte Charts/KI-Anomalien-Banner sind weg.",
    status: "done", owner: "erledigt", ref: "Sprint AH commits 85079a2 + f4d6503 + feecf34",
  },
  "0f448aae-7b2e-4814-b5c3-8a3f68247de5": {
    cat: "ux", sev: "low", area: "KPI-Kachel zeigt Striche statt 0",
    summary: "Empty-State-Bug.",
    recommendation: "Erledigt via R21.",
    status: "done", owner: "erledigt", ref: "R21 commit 2644580",
  },
  "37f6be65-dd1d-49e3-acc4-5ebe04cfb28c": {
    cat: "feature", sev: "high", area: "Mieter-Wizard — Wohneinheit-Picker statt Freitext",
    summary: "Mieter soll im Wizard seine Wohneinheit zuordnen können, damit Verwaltung direkt mappen kann (statt Adress-String).",
    recommendation: "Wohnungs-Picker bauen: Mieter wählt aus den Wohnungen seiner Verwaltung (RLS-scoped). Bestehende Spalte tickets.wohnung (text) bleibt als Fallback. Sprint R26 oder zusätzliche Phase im Wizard-Sprint.",
    status: "needdecision", owner: "lennart",
    ref: "wartet auf Wohnungs-Verknüpfungs-Pattern (Sprint G hat verwalter-side, Mieter-side fehlt)",
  },

  // === Iteration 27 (09.06.2026) — 5 Feedbacks vom 27.05. nach
  // Supabase-Reaktivierung (Free-Tier Auto-Pause) triagiert. Siehe
  // LOOP-ITERATION-27-2026-06-09.md für Details. ===
  "d3495b20-9d41-4441-b0cc-df954d767b6c": {
    cat: "question", sev: "medium",
    area: "HW-Angebot-Detail / Festpreis",
    summary: "Was muss passieren, damit wir ein System-Preis bekommen?",
    recommendation: "Erledigt via Loop-26 (Commits aff1032 + 7186097): System-/Festpreis wird auf der Angebot-Seite angezeigt. Live verifiziert am 09.06.2026 — zeigt 121€ Festpreis korrekt.",
    status: "done", owner: "erledigt",
    ref: "Loop-26 · aff1032 + 7186097 · verifiziert Loop-27",
  },
  "55302a76-abb4-4e2a-a90d-683cab5a3a5a": {
    cat: "bug", sev: "medium",
    area: "HW-Dashboard #ausschreibungen Kachel",
    summary: "Verfügbar im Radius 1, aber Klick auf Kachel tut nichts / Ausschreibungs-Liste leer.",
    recommendation: "Bereits gefixt via Loop-25 (H5): Kachel ist jetzt <a href=\"#ausschreibungen\"> mit Hover-Styling und scrollt zur Ausschreibungs-Liste. Am 09.06.2026 im Code verifiziert — kein weiterer Handlungsbedarf. Feedback kam vor dem Fix.",
    status: "done", owner: "erledigt",
    ref: "Loop-25 · H5 · verifiziert Loop-27",
  },
  "444f646e-a08c-4c53-8eae-2866f518e5d0": {
    cat: "ux", sev: "medium",
    area: "Verwalter-Marktplatz Stamm-HW vs. Pool-HW",
    summary: "Warum muss Handwerker erst als Stamm-Handwerker angelegt werden — passt das noch zur Auktionslogik?",
    recommendation: "Konzept-Klarstellung: Marktplatz zeigt Stamm-HW UND Pool-HW; Stamm-HW ist optional/bevorzugt, Auktion läuft auch ohne Stamm-HW (Radius-Matching im Pool). Empfehlung: Tooltip/Erklär-Text auf Marktplatz-Seite ergänzen (\"Stamm-HW = bevorzugt, Pool = alle verfügbaren HW im Radius\"). Sprint AL oder Loop-28.",
    status: "backlog", owner: "claudecode",
    ref: "Loop-27 Triage · Sprint AL / Loop-28",
  },
  "d0ec6e39-1e6b-49df-945b-4c3c4cf446c9": {
    cat: "feature", sev: "medium",
    area: "Mieter-Melden-Wizard",
    summary: "Hier fehlt die Mieternummer / Wohneinheit-Referenz.",
    recommendation: "Migration loop23_tickets_wohneinheit_referenz ist live (Spalte existiert), UI-Feld fehlt noch im Wizard. Empfehlung: im Ticket-Wizard nach \"Adresse\" optionales Feld \"Wohneinheit / Mieternummer\" einfügen. Sprint AL.",
    status: "backlog", owner: "claudecode",
    ref: "Loop-27 Triage · Migration loop23_tickets_wohneinheit_referenz · Sprint AL",
  },
  "16d4d582-94d3-4daf-8ecc-00eeb57b85ea": {
    cat: "bug", sev: "low",
    area: "HW-Dashboard Begrüßung",
    summary: "Warum steht hier \"Hallo Mieter\", wenn es ein Handwerker ist?",
    recommendation: "Bereits gefixt via Sprint AJ: Rollen-Switcher + Begrüßung korrigiert. Heute live: \"Hallo, [Name]\" ohne Rollen-Präfix. Kein Handlungsbedarf — Feedback kam vor dem Fix.",
    status: "done", owner: "erledigt",
    ref: "Sprint AJ · verifiziert Loop-27",
  },
}

// Heuristik-Fallback: wenn kein manuelles Verdict da ist, klassifizieren
// wir die Nachricht roh nach Keywords. Verdict-Status = "waiting" damit
// der Admin sieht: "Cowork hat das noch nicht ausgewertet."
export function classifyHeuristisch(message: string | null | undefined): Verdict {
  const m = (message || "").toLowerCase().trim()
  let cat: VerdictCat = "ux"
  let sev: VerdictSev = "medium"
  if (m === "test" || m.length < 8) {
    cat = "test"; sev = "low"
  } else if (/blocker|crash|500|unauthorized|nicht moeglich|nicht möglich|funktioniert nicht|fehler beim/.test(m)) {
    cat = "bug"; sev = m.includes("blocker") || m.includes("crash") ? "blocker" : "high"
  } else if (/super|toll|cool|laeuft gut|läuft gut|intuitiv|schoen|schön|gefaellt|gefällt|gut geloest|gut gelöst|macht spass|macht spaß/.test(m)) {
    cat = "positive"; sev = "low"
  } else if (/waere cool|wäre cool|vermisse|fehlt|wuensche|wünsche|sollte koennen|sollte können|inline statt|direkt sehen/.test(m)) {
    cat = "feature"; sev = "medium"
  } else if (/verwirrend|wusste nicht|unklar/.test(m)) {
    cat = "ux"; sev = "medium"
  }
  return {
    cat, sev,
    area: "noch nicht klassifiziert",
    summary: "Cowork hat diese Nachricht noch nicht ausgewertet.",
    recommendation: "Wartet auf den nächsten Auto-Loop-Lauf (stündlich :17). Bis dahin: Heuristik-Klasse: " + cat + " / " + sev + ".",
    status: "waiting",
    owner: "cowork",
  }
}

// dbVerdicts: Live-Verdicts aus public.feedback_verdicts (Supabase), vom
// Dashboard geladen. Diese haben Vorrang vor der statischen VERDICTS-Map
// hier im Code, damit der Auto-Loop (oder Cowork manuell via SQL) neue
// Triage-Ergebnisse sofort im Dashboard sichtbar machen kann — ohne
// Code-Änderung + Git-Push. Die statische Map bleibt als Snapshot/Backup
// und Fallback für den Fall, dass die DB-Tabelle (noch) leer ist.
export function getVerdict(
  id: string,
  message?: string | null,
  dbVerdicts?: Record<string, Verdict> | null,
): Verdict {
  if (dbVerdicts && dbVerdicts[id]) return dbVerdicts[id]
  return VERDICTS[id] ?? classifyHeuristisch(message)
}
