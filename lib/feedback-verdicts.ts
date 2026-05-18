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
    recommendation: "Beta-Blocker. Claude Code soll systematisch grep'en (auth.getUser() ohne Token-Argument) und alle Treffer mit B1.1-Pattern (Commit 1fd30db) fixen. Helper-Funktion in lib/auth/ zentralisieren statt route-by-route. Nebenbei H2/H3/H4 Auktions-Wording-Reste räumen.",
    status: "inprogress",
    owner: "claudecode",
    ref: "PROMPTS/auto-fix-2026-05-18-1400.md liegt bereit · Cowork-QA bestätigt",
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
  "f6d050a3-cb16-4fb1-8386-3a72e30cb9f0": {
    cat: "ux", sev: "medium",
    area: "Mieter-Wizard (/dashboard-mieter/melden) - Container-Centering",
    summary: "Wizard-Seite ist nach rechts verschoben statt zentriert.",
    recommendation: "Container-Klassen in app/dashboard-mieter/melden/page.tsx oder layout.tsx prüfen. Vermutlich fehlt mx-auto oder Sidebar drückt ohne Ausgleich. 1-Zeilen-Fix, S-Aufwand.",
    status: "inprogress",
    owner: "claudecode",
    ref: "M5 · PROMPTS/auto-fix-2026-05-18-1410.md",
  },
  "af5e426a-5d9d-44ef-adbb-318790ca7918": {
    cat: "bug", sev: "high",
    area: "HW-Dashboard (/dashboard-handwerker) - KPI-Kachel 'Offene Ausschreibung'",
    summary: "KPI-Kachel reagiert nicht auf Klick — sollte zur Ausschreibungs-Liste führen.",
    recommendation: "Click-Through aktivieren wie bei Verwalter (F9 / Commit 29626eb). Kpi-Komponente in app/dashboard-handwerker/page.tsx braucht href-Prop. S-Aufwand.",
    status: "inprogress",
    owner: "claudecode",
    ref: "H5 · PROMPTS/auto-fix-2026-05-18-1410.md",
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

export function getVerdict(id: string, message?: string | null): Verdict {
  return VERDICTS[id] ?? classifyHeuristisch(message)
}
