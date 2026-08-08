"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  MIETDAUER_MONATE,
  PAKETE,
  PFLICHT_DOKUMENTE,
  selbstauskunftSchema,
} from "@/lib/woonwoon/selbstauskunft-schema"

// WoonWoon Selbstauskunfts-Formular (Feldkatalog v1).
//
// Natives <form> + FormData-POST an /api/selbstauskunft — die Validierung
// läuft doppelt: clientseitig (zod, sofortiges Feedback) und serverseitig
// (dieselben Regeln + Token-Prüfung in der DB). Pflichtfelder sind so
// gesetzt, dass kein unvollständiges Formular abgeschickt werden kann.

interface Props {
  token: string
  vorbelegterName: string | null
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <legend className="px-2 text-sm font-semibold text-slate-900">{titel}</legend>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

const labelKlasse = "block text-sm font-medium text-slate-700"
const inputKlasse =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"

export default function SelbstauskunftFormular({ token, vorbelegterName }: Props) {
  const router = useRouter()
  const [fehler, setFehler] = useState<string | null>(null)
  const [sendet, setSendet] = useState(false)

  // Vorbelegung: "Vorname Nachname" aus der Anfrage aufteilen (best effort)
  const [vorname = "", ...rest] = (vorbelegterName ?? "").trim().split(/\s+/)
  const nachname = rest.join(" ")

  async function absenden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFehler(null)

    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set("token", token)

    // Clientseitige Validierung mit denselben zod-Regeln wie der Server
    const roh: Record<string, unknown> = {}
    fd.forEach((wert, key) => {
      if (typeof wert === "string" && !key.startsWith("dok_") && key !== "token") {
        roh[key] = wert
      }
    })
    roh.haustiere = fd.get("haustiere") === "ja"
    roh.raucher = fd.get("raucher") === "ja"
    roh.erklaerung_richtigkeit = fd.get("erklaerung_richtigkeit") === "ja" ? true : undefined
    roh.datenschutz_einwilligung = fd.get("datenschutz_einwilligung") === "ja" ? true : undefined

    const geprueft = selbstauskunftSchema.safeParse(roh)
    if (!geprueft.success) {
      const problem = geprueft.error.issues[0]
      setFehler(problem?.message ?? "Bitte alle Pflichtfelder ausfüllen.")
      // Bei 19 Pflichtfeldern hilft die Meldung allein nicht — direkt zum Feld.
      const feld = problem?.path?.[0]
      if (typeof feld === "string") {
        const el = form.elements.namedItem(feld)
        const ziel = el instanceof RadioNodeList ? el[0] : el
        if (ziel instanceof HTMLElement) {
          ziel.scrollIntoView({ block: "center", behavior: "smooth" })
          ziel.focus({ preventScroll: true })
        }
      }
      return
    }
    for (const { typ, label } of PFLICHT_DOKUMENTE) {
      const datei = fd.get(`dok_${typ}`)
      if (!(datei instanceof File) || datei.size === 0) {
        setFehler(`Bitte ${label} hochladen.`)
        return
      }
    }

    setSendet(true)
    try {
      const res = await fetch("/api/selbstauskunft", { method: "POST", body: fd })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setFehler(body?.error ?? "Das Absenden ist fehlgeschlagen. Bitte erneut versuchen.")
        setSendet(false)
        return
      }
      router.push(`/selbstauskunft/${token}/danke`)
    } catch {
      setFehler("Netzwerkfehler — bitte Verbindung prüfen und erneut versuchen.")
      setSendet(false)
    }
  }

  return (
    <form onSubmit={absenden} noValidate className="space-y-6">
      <Abschnitt titel="Persönliche Angaben">
        <div>
          <label htmlFor="anrede" className={labelKlasse}>Anrede</label>
          <select id="anrede" name="anrede" className={inputKlasse} defaultValue="">
            <option value="">Keine Angabe</option>
            <option value="herr">Herr</option>
            <option value="frau">Frau</option>
            <option value="divers">Divers</option>
          </select>
        </div>
        <div />
        <div>
          <label htmlFor="vorname" className={labelKlasse}>Vorname *</label>
          <input id="vorname" name="vorname" defaultValue={vorname} required autoComplete="given-name" className={inputKlasse} />
        </div>
        <div>
          <label htmlFor="nachname" className={labelKlasse}>Nachname *</label>
          <input id="nachname" name="nachname" defaultValue={nachname} required autoComplete="family-name" className={inputKlasse} />
        </div>
        <div>
          <label htmlFor="geburtsdatum" className={labelKlasse}>Geburtsdatum *</label>
          <input id="geburtsdatum" name="geburtsdatum" type="date" required className={inputKlasse} />
        </div>
        <div>
          <label htmlFor="telefon" className={labelKlasse}>Telefon *</label>
          <input id="telefon" name="telefon" type="tel" required autoComplete="tel" className={inputKlasse} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="email" className={labelKlasse}>E-Mail-Adresse *</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={inputKlasse} />
        </div>
      </Abschnitt>

      <Abschnitt titel="Aktuelle Anschrift">
        <div className="sm:col-span-2">
          <label htmlFor="strasse" className={labelKlasse}>Straße und Hausnummer *</label>
          <input id="strasse" name="strasse" required autoComplete="street-address" className={inputKlasse} />
        </div>
        <div>
          <label htmlFor="plz" className={labelKlasse}>PLZ *</label>
          <input id="plz" name="plz" required inputMode="numeric" pattern="\d{5}" autoComplete="postal-code" className={inputKlasse} />
        </div>
        <div>
          <label htmlFor="ort" className={labelKlasse}>Ort *</label>
          <input id="ort" name="ort" required autoComplete="address-level2" className={inputKlasse} />
        </div>
      </Abschnitt>

      <Abschnitt titel="Beruf und Einkommen">
        <div>
          <label htmlFor="beruf" className={labelKlasse}>Berufliche Tätigkeit *</label>
          <input id="beruf" name="beruf" required className={inputKlasse} />
        </div>
        <div>
          <label htmlFor="arbeitgeber" className={labelKlasse}>Arbeitgeber</label>
          <input id="arbeitgeber" name="arbeitgeber" className={inputKlasse} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="netto_einkommen_eur" className={labelKlasse}>
            Monatliches Nettoeinkommen (EUR) *
          </label>
          <input
            id="netto_einkommen_eur"
            name="netto_einkommen_eur"
            type="number"
            min={0}
            step="0.01"
            required
            className={inputKlasse}
          />
          <p className="mt-1 text-xs text-slate-500">
            Eine Bankverbindung wird bewusst nicht abgefragt.
          </p>
        </div>
      </Abschnitt>

      <Abschnitt titel="Haushalt">
        <div>
          <label htmlFor="anzahl_personen" className={labelKlasse}>Einziehende Personen *</label>
          <input
            id="anzahl_personen"
            name="anzahl_personen"
            type="number"
            min={1}
            max={20}
            defaultValue={1}
            required
            className={inputKlasse}
          />
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="haustiere" value="ja" className="h-4 w-4 rounded border-slate-300" />
            Haustiere
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="raucher" value="ja" className="h-4 w-4 rounded border-slate-300" />
            Raucher/in
          </label>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="haustiere_details" className={labelKlasse}>
            Falls Haustiere: welche?
          </label>
          <input id="haustiere_details" name="haustiere_details" className={inputKlasse} />
        </div>
      </Abschnitt>

      <Abschnitt titel="Mietwunsch">
        <div>
          <label htmlFor="einzug_ab" className={labelKlasse}>Gewünschter Einzug ab *</label>
          <input id="einzug_ab" name="einzug_ab" type="date" required className={inputKlasse} />
        </div>
        <div>
          <label htmlFor="mietdauer_monate" className={labelKlasse}>Mietdauer *</label>
          <select id="mietdauer_monate" name="mietdauer_monate" required defaultValue="" className={inputKlasse}>
            <option value="" disabled>Bitte wählen</option>
            {MIETDAUER_MONATE.map(m => (
              <option key={m} value={m}>{m} Monate</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <span className={labelKlasse}>Paket *</span>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {PAKETE.map(p => (
              <label
                key={p.wert}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 has-[:checked]:border-slate-900 has-[:checked]:ring-1 has-[:checked]:ring-slate-900"
              >
                <input type="radio" name="paket" value={p.wert} required className="h-4 w-4" />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      </Abschnitt>

      <Abschnitt titel="Nachweise">
        {PFLICHT_DOKUMENTE.map(({ typ, label }) => (
          <div key={typ} className="sm:col-span-2">
            <label htmlFor={`dok_${typ}`} className={labelKlasse}>{label} *</label>
            <input
              id={`dok_${typ}`}
              name={`dok_${typ}`}
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
            />
            <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG oder WebP · max. 10 MB</p>
          </div>
        ))}
      </Abschnitt>

      <Abschnitt titel="Mitteilung (optional)">
        <div className="sm:col-span-2">
          <label htmlFor="nachricht" className={labelKlasse}>
            Möchten Sie uns noch etwas mitteilen?
          </label>
          <textarea id="nachricht" name="nachricht" rows={3} maxLength={2000} className={inputKlasse} />
        </div>
      </Abschnitt>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="erklaerung_richtigkeit"
            value="ja"
            required
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>
            Ich bestätige, dass ich alle Angaben wahrheitsgemäß und vollständig
            gemacht habe. *
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="datenschutz_einwilligung"
            value="ja"
            required
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>
            Ich willige ein, dass meine Angaben und Unterlagen zur Prüfung meiner
            Mietanfrage verarbeitet werden. Die Daten werden vertraulich behandelt
            und nicht an Dritte weitergegeben. *
          </span>
        </label>
      </div>

      {fehler && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fehler}
        </div>
      )}

      <button
        type="submit"
        disabled={sendet}
        className="w-full rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sendet ? "Wird übermittelt …" : "Selbstauskunft absenden"}
      </button>
      <p className="pb-4 text-center text-xs text-slate-400">
        Mit * markierte Felder sind Pflichtfelder.
      </p>
    </form>
  )
}
