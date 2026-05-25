"use client"

// Sprint AI — Test-Route für den Verwalter-Wizard via shared TicketWizard.
// Parallel zur Original-Route, damit Vergleich + Smoke-Test möglich sind.

import { TicketWizard } from "@/components/wizard/TicketWizard"

export default function NeuesTicketNeuPage() {
  return <TicketWizard variant="verwalter" showAnruferFelder />
}
