/*
 * ARCHIVED / OBSOLETE
 *
 * Diese Datei ist historisch und nicht mehr operative Source of Truth.
 *
 * Aktuelle Quellen:
 *   - ai/REPARO_OPERATING_SYSTEM.md
 *   - ai/SESSION_HANDOFF.md
 *
 * Nicht für neue Architektur- oder Produktentscheidungen verwenden.
 */

/**
 * Skeleton für /api/voice-call/ingest
 *
 * CC soll diese Datei nach app/api/voice-call/ingest/route.ts kopieren,
 * Supabase-Client + createTicketByVerwalter (aus Sprint G) anbinden, dann
 * mit `node PROMPTS/voice-ai-poc/test-webhook.js` lokal testen.
 *
 * Aufwand: ~1.5h
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
// import { createServerClient } from '@/lib/supabase/server'; // CC: anpassen an euer Pattern
// import { createTicketByVerwalter } from '@/lib/tickets'; // existiert nach Sprint G

// === KONFIG ===
const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET ?? '';
const SKIP_SIGNATURE_CHECK = process.env.NODE_ENV === 'development' && !WEBHOOK_SECRET;

// === HMAC VERIFY ===
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (SKIP_SIGNATURE_CHECK) return true; // local dev only
  if (!signature || !WEBHOOK_SECRET) return false;
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

// === MAIN ===
export async function POST(req: NextRequest) {
  // 1. Raw body lesen für HMAC
  const rawBody = await req.text();
  const sig = req.headers.get('x-vapi-signature');

  if (!verifySignature(rawBody, sig)) {
    console.warn('[voice-call/ingest] Invalid HMAC signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Payload parsen
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const msg = payload?.message;
  if (msg?.type !== 'end-of-call-report') {
    // Vapi schickt mehrere Event-Typen — wir reagieren nur auf end-of-call-report
    return NextResponse.json({ ok: true, skipped: msg?.type ?? 'unknown' }, { status: 200 });
  }

  const callId = msg?.call?.id;
  const callerPhone = msg?.call?.customer?.number;
  const data = msg?.structuredData;
  const endedReason = msg?.endedReason;

  // 3. Abbruch-Handling
  if (!data || endedReason === 'customer-ended-call') {
    console.info(`[voice-call/ingest] Call ${callId} ended without ticket (reason: ${endedReason})`);
    return NextResponse.json({ ok: true, ticket_id: null, reason: 'no_data' });
  }

  // 4. Verwalter via Telefonnummer identifizieren
  // TODO: CC anpassen an Supabase-Pattern in diesem Repo
  /*
  const supabase = createServerClient();
  const { data: verwalter, error } = await supabase
    .from('profiles')
    .select('id, telefon, rolle')
    .eq('telefon', callerPhone)
    .eq('rolle', 'verwalter')
    .maybeSingle();

  if (error || !verwalter) {
    console.warn(`[voice-call/ingest] Unknown caller: ${callerPhone}`);
    return NextResponse.json({ error: 'Unknown caller' }, { status: 403 });
  }
  */

  // 5. Ticket via Sprint-G-API anlegen
  // TODO: CC integrieren
  /*
  const einsatzort_manuell = [
    data.adresse_strasse,
    data.adresse_hausnummer,
  ].filter(Boolean).join(' ') +
    (data.adresse_plz ? `, ${data.adresse_plz}` : '') +
    (data.adresse_ort ? ` ${data.adresse_ort}` : '') +
    (data.wohnungs_bezeichnung ? `, ${data.wohnungs_bezeichnung}` : '');

  const ticket = await createTicketByVerwalter({
    verwalter_id: verwalter.id,
    mieter_telefon: data.mieter_telefon,
    einsatzort_manuell,
    gewerk: data.gewerk,
    beschreibung: data.beschreibung_kurz,
    dringlichkeit: data.dringlichkeit,
    eingetragen_via: 'voice-ai',
    voice_call_id: callId,
    voice_call_recording_url: msg.recordingUrl ?? null,
    voice_call_transcript: msg.transcript ?? null,
    voice_call_vollstaendigkeit_score: data.vollstaendigkeits_score ?? null,
  });
  */

  // 6. Optional: SMS an Verwalter (Twilio) — kann später
  // await sendSmsToVerwalter(callerPhone, ticket.id_kurz);

  // 7. Response (Mock-Werte solange Integration nicht steht)
  return NextResponse.json({
    ok: true,
    ticket_id: 'TODO_after_integration',
    call_id: callId,
    voice_data_score: data.vollstaendigkeits_score,
  });
}

// === GET (Health-Check für Vapi Dashboard) ===
export async function GET() {
  return NextResponse.json({
    service: 'reparo-voice-call-ingest',
    status: 'ok',
    version: 'v1',
  });
}
