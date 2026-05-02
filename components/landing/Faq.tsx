"use client"
import { useState } from "react"

const FAQS: { frage: string; antwort: string }[] = [
  {
    frage: "Was kostet Reparo?",
    antwort:
      "Für Handwerker komplett kostenlos. Verwalter zahlen eine kleine Provision pro vermitteltem Auftrag — keine monatliche Grundgebühr, keine Mindestlaufzeit. Mieter zahlen nichts.",
  },
  {
    frage: "Gibt es eine Mindestlaufzeit?",
    antwort:
      "Nein. Du kannst dein Konto jederzeit pausieren oder löschen. Verwalter zahlen nur, wenn auch tatsächlich vermittelt wird.",
  },
  {
    frage: "Wie werden Handwerker geprüft?",
    antwort:
      "Bei der Registrierung wird der Gewerbenachweis hinterlegt. Anschließend bewerten Verwalter und Mieter jeden Auftrag — das öffentlich sichtbare Rating bestimmt das Ranking. Bei wiederholt schlechten Bewertungen wird das Profil automatisch geprüft und ggf. gesperrt.",
  },
  {
    frage: "Was passiert bei Reklamationen?",
    antwort:
      "Sowohl Verwalter als auch Mieter können nach Abschluss bewerten. Reklamationen können direkt im Ticket eingereicht werden — der Verwalter entscheidet, ob nachgebessert oder ein neuer Handwerker beauftragt wird. Bei wiederholten Beschwerden wird das Handwerker-Profil gesperrt.",
  },
  {
    frage: "In welchen Städten ist Reparo verfügbar?",
    antwort:
      "Aktuell deutschlandweit im Aufbau. Da wir eine offene Plattform sind, kannst du dich bereits jetzt in jeder Region anmelden — sobald genug Handwerker und Verwalter in deiner Stadt aktiv sind, läuft die Vermittlung automatisch.",
  },
  {
    frage: "Wann bekomme ich als Handwerker mein Geld?",
    antwort:
      "Nach Abnahme durch den Verwalter wird die Zahlung freigegeben. Der Verwalter zahlt direkt — Reparo behält nur die Provision ein. Eine optionale Plattform-Zahlungsabwicklung mit Treuhand-Funktion ist in Arbeit.",
  },
  {
    frage: "Was wenn ich als Handwerker den Preis zu niedrig finde?",
    antwort:
      "Du legst deinen Mindest-Stundensatz fest. Aufträge unter deiner Untergrenze werden dir gar nicht erst angezeigt. Die Auktions-Mechanik ist Markt — kein Preisdumping durch Vermittler.",
  },
  {
    frage: "Kann ich als Verwalter meinen Stamm-Handwerker behalten?",
    antwort:
      "Ja. Sie können einzelne Handwerker als Favoriten markieren und Aufträge auch direkt vergeben — die Auktion ist optional, kein Zwang. Favoriten erscheinen bei jeder neuen Meldung als bevorzugte Wahl.",
  },
  {
    frage: "Was passiert bei Notfällen wie Wasserschäden?",
    antwort:
      "Express-Modus: Aufträge mit Priorität „Dringend“ gehen sofort an verfügbare Handwerker im Umkreis. Push-Benachrichtigungen, Auktionsdauer auf Minuten verkürzt — der erste verfügbare Profi mit passender Qualifikation gewinnt.",
  },
]

export default function Faq() {
  const [offen, setOffen] = useState<number | null>(0)

  return (
    <div className="space-y-3">
      {FAQS.map((item, i) => {
        const istOffen = offen === i
        return (
          <div
            key={i}
            className={`rounded-xl border bg-white transition-all ${
              istOffen ? "border-[#3D8B7A]/40 shadow-sm" : "border-[#EDE8E1]"
            }`}
          >
            <button
              onClick={() => setOffen(istOffen ? null : i)}
              aria-expanded={istOffen}
              className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 cursor-pointer"
            >
              <span className="text-base font-semibold text-[#2D2A26]">{item.frage}</span>
              <span
                aria-hidden
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  istOffen ? "bg-[#3D8B7A] text-white rotate-45" : "bg-[#FAF8F5] text-[#8C857B]"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </button>
            {istOffen && (
              <div className="px-5 pb-5 -mt-1 text-sm text-[#6B665E] leading-relaxed">
                {item.antwort}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
