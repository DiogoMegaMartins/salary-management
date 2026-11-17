/* Only public shell resources. Financial data and API responses are NEVER cached here. */
const SHELL = "particao-shell-__SHELL_VERSION__";
let allowed = [];
const base = new URL("./", self.location.href);
const href = path => new URL(path, base).href;
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const manifest = await fetch(href("precache.json"), { cache: "no-store" }).then(r => r.json());
    const cache = await caches.open(SHELL);
    await cache.addAll(manifest.map(href));
    await cache.put(href("__shell_manifest__"), new Response(JSON.stringify(manifest)));
    // Do not interrupt active clients or their financial drafts.
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys())
      if (name.startsWith("particao-shell-") && name !== SHELL) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.pathname.includes("/api/") || url.pathname.includes("/port/")) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    if (!allowed.length) {
      const manifest = await cache.match(href("__shell_manifest__"));
      allowed = manifest ? (await manifest.json()).map(href) : [];
    }
    if (request.mode === "navigate") {
      try { return await fetch(request); }
      catch { return await cache.match(href("index.html")) || Response.error(); }
    }
    // Never answer arbitrary paths from private caches or expose the encrypted vault endpoint.
    if (allowed.includes(url.href)) return await cache.match(request) || fetch(request);
    return fetch(request);
  })());
});
