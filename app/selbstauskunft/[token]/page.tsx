import type { Metadata } from "next"
import { createServiceRoleClient } from "@/lib/supabase-server"
import SelbstauskunftFormular from "./SelbstauskunftFormular"

// WoonWoon: Öffentliche Selbstauskunfts-Seite (Zero-Login, Token-Link).
//
// Der Interessent bekommt einen Link /selbstauskunft/<token> per Mail.
// Diese Server-Component löst das Token auf und rendert das Formular —
// ungültige/abgelaufene Tokens sehen nur eine neutrale Fehlermeldung,
// bereits eingereichte Anfragen einen Hinweis statt des Formulars.

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  // absolute: das Root-Template hängt sonst "| Reparo" an eine
  // WoonWoon-gebrandete Seite.
  title: { absolute: "Digitale Selbstauskunft | WoonWoon" },
  robots: { index: false, follow: false },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface AnfrageInfo {
  objekt: string | null
  interessent_name: string | null
  status: string
}

function Rahmen({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900">WoonWoon</p>
          <p className="mt-1 text-sm text-slate-500">
            REK Berlin Home Service GmbH · Digitale Selbstauskunft
          </p>
        </header>
        {children}
      </div>
    </main>
  )
}

function Hinweis({ titel, text }: { titel: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">{titel}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  )
}

export default async function SelbstauskunftSeite({
  params,
}: {
  params: { token: string }
}) {
  const token = params.token

  if (!UUID_RE.test(token)) {
    return (
      <Rahmen>
        <Hinweis
          titel="Link ungültig"
          text="Dieser Zugangslink ist nicht gültig. Bitte nutzen Sie den Link aus unserer E-Mail oder melden Sie sich bei Ihrer Ansprechperson."
        />
      </Rahmen>
    )
  }

  // Defensiv: solange die Migration noch nicht angewendet ist, darf die
  // Seite nicht crashen — dann erscheint die neutrale Fehlermeldung.
  let anfrage: AnfrageInfo | null = null
  try {
    const admin = createServiceRoleClient()
    const { data } = await admin
      .rpc("anfrage_by_token", { p_token: token })
      .maybeSingle<AnfrageInfo>()
    anfrage = data ?? null
  } catch {
    anfrage = null
  }

  if (!anfrage) {
    return (
      <Rahmen>
        <Hinweis
          titel="Link ungültig oder abgelaufen"
          text="Dieser Zugangslink ist ungültig oder nicht mehr aktiv. Bitte melden Sie sich bei Ihrer Ansprechperson, um einen neuen Link zu erhalten."
        />
      </Rahmen>
    )
  }

  if (anfrage.status !== "offen") {
    return (
      <Rahmen>
        <Hinweis
          titel="Bereits eingereicht"
          text="Für diese Anfrage liegt uns Ihre Selbstauskunft bereits vor. Wir melden uns, sobald wir sie geprüft haben — Sie müssen nichts weiter tun."
        />
      </Rahmen>
    )
  }

  return (
    <Rahmen>
      {anfrage.objekt && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Ihre Anfrage
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-800">{anfrage.objekt}</p>
        </div>
      )}
      <SelbstauskunftFormular
        token={token}
        vorbelegterName={anfrage.interessent_name}
      />
    </Rahmen>
  )
}
