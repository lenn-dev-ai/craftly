"use client"

// Sprint AI — Test-Route für den neuen TicketWizard.
//
// Parallel zur Original-Route /dashboard-mieter/melden, damit ein
// Vergleich + Smoke-Test möglich ist, ohne die Original-Page zu
// brechen. Wenn der Wizard hier gut funktioniert, kann CC die
// Mieter-Page später ersetzen (1-Zeiler-Wrapper auf TicketWizard).

import { TicketWizard } from "@/components/wizard/TicketWizard"

export default function MeldenNeuPage() {
  return <TicketWizard variant="mieter" />
}
