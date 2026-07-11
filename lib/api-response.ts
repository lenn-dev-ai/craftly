import { NextResponse } from "next/server"

// Kanonisches Server-Fehlerformat (Audit 11.07.2026).
//
// Prüfung ergab: die 71 API-Routen nutzen bereits durchgängig
// { error: "<text>" } + HTTP-Status (einzige Ausnahme: /api/cron/keep-alive
// mit { ok:false } passend zu seinem { ok:true }-Erfolg — bewusst so). Ein
// Massenrefactor wäre also Churn ohne Nutzen. Dieser Helper ist der
// Sollzustand für NEUE Routen, damit die Konsistenz erhalten bleibt.
export function errorResponse(status: number, error: string, code?: string) {
  return NextResponse.json(code ? { error, code } : { error }, { status })
}

export const unauthorized = (msg = "Unauthorized") => errorResponse(401, msg)
export const forbidden = (msg = "Forbidden") => errorResponse(403, msg)
export const badRequest = (msg = "Ungültige Anfrage") => errorResponse(400, msg)
export const notFound = (msg = "Nicht gefunden") => errorResponse(404, msg)
export const serverError = (msg = "Interner Fehler") => errorResponse(500, msg)
