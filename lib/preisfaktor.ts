export type PreisfaktorResult = {
  faktor: number
  dringlichkeitsFaktor: number
  angebotsFaktor: number
  label: string
  color: string
}

export function berechnePreisfaktor(
  prioritaet: "planbar" | "zeitnah" | "notfall",
  verfuegbareHW: number
): PreisfaktorResult {
  const dringlichkeitsFaktor =
    prioritaet === "notfall" ? 1.7 :
    prioritaet === "zeitnah" ? 1.3 : 1.0

  const angebotsFaktor =
    verfuegbareHW <= 1 ? 1.5 :
    verfuegbareHW <= 4 ? 1.25 : 1.0

  const faktor = Math.round(dringlichkeitsFaktor * angebotsFaktor * 100) / 100

  const label =
    faktor >= 2.0 ? "Sehr hohe Nachfrage" :
    faktor >= 1.5 ? "Hohe Nachfrage" :
    faktor >= 1.2 ? "Erhöhte Nachfrage" : "Normaler Marktpreis"

  const color =
    faktor >= 2.0 ? "text-red-600 bg-red-50" :
    faktor >= 1.5 ? "text-amber-600 bg-amber-50" :
    faktor >= 1.2 ? "text-yellow-600 bg-yellow-50" : "text-green-700 bg-green-50"

  return { faktor, dringlichkeitsFaktor, angebotsFaktor, label, color }
}

export function berechneRichtpreis(basisPreis: number, faktor: number): number {
  return Math.round(basisPreis * faktor)
}
