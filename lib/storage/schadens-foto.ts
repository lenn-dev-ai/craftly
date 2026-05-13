// Helper für den Schadens-Foto-Bucket.
// Bucket: schadens-fotos (privat)
// In tickets.foto_url speichern wir nur den Storage-Pfad
// (z.B. "userId/timestamp-name.jpg") — beim Anzeigen wird daraus
// eine Signed URL erzeugt. Vorteil: bleibt resilient wenn der Bucket
// später public/private wechselt.

import type { SupabaseClient } from "@supabase/supabase-js"

export const BUCKET = "schadens-fotos"
export const SIGNED_URL_TTL_SEC = 60 * 30 // 30 Minuten

type AnyClient = SupabaseClient

export async function uploadSchadensFoto(
  supabase: AnyClient,
  userId: string,
  file: File,
): Promise<{ pfad: string } | { fehler: string }> {
  const sicher = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const pfad = `${userId}/${Date.now()}-${sicher}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(pfad, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    })
  if (error) return { fehler: error.message }
  return { pfad }
}

export async function getSchadensFotoUrl(
  supabase: AnyClient,
  pfad: string,
): Promise<string | null> {
  if (!pfad) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(pfad, SIGNED_URL_TTL_SEC)
  if (error || !data) return null
  return data.signedUrl
}
