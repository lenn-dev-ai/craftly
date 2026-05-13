// Reparo Service Worker — Self-Destruct.
//
// Hintergrund: Frühere Version (reparo-v1) cached static assets cache-first
// ohne Revalidation. Folge: Bei Deploys blieben alte JS-Chunks (z.B. die
// Sidebar mit alter Link-Logik) im Browser-Cache, während HTML/Page-Bundle
// neu geladen wurde — inkonsistenter Mix, der zu falschen Navigations
// führen konnte (z.B. Mieter klickt → Admin-Panel).
//
// Reparo ist keine Offline-First-App. Diese Datei ist jetzt nur noch
// dafür da, bestehende SW-Registrierungen sauber aufzuräumen.

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Alle Caches löschen
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      // Self-Unregister
      await self.registration.unregister()
      // Alle Clients refreshen, damit sie das frische Bundle bekommen
      const clients = await self.clients.matchAll({ type: "window" })
      for (const client of clients) {
        // navigate() ist robuster als reload() in alten Safaris
        if ("navigate" in client && typeof client.navigate === "function") {
          client.navigate(client.url)
        }
      }
    })(),
  )
})

// Keine Fetch-Handler mehr — der Browser geht direkt ans Netz.
