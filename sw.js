// Tombstone service worker for the site root.
//
// Earlier deploys served the Classic game from the site root and registered a
// service worker at this URL (/<repo>/sw.js) that precached the whole app
// shell. The root is now just the chooser landing page, but returning visitors
// still have that old worker controlling this scope, so it keeps serving the
// cached old Classic page instead of the new chooser — and the unregister
// script inside index.html never runs, because the page never actually loads.
//
// Browsers re-fetch the registered service-worker script on navigation, so
// shipping this self-destructing worker at the same URL makes the stale one
// update to a no-op that wipes its caches, unregisters itself, and reloads any
// open tabs. The next load then comes straight from the network — the chooser.
//
// The per-game workers under /classic/ and /rpg/ live at different URLs and are
// untouched by this.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});
