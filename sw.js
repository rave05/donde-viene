/* Cachea la interfaz y datos estáticos. Nunca guarda respuestas de la API de transporte. */
const CACHE = "dv-shell-20261009-v23";
const CORE = [
  "index.html",
  "metropolitano.js",
  "direcciones.js",
  "comparar-viajes.js",
  "informacion-oficial.js",
  "integraciones.css",
  "notificaciones.js",
  "servicios.js",
  "datos/servicios.json",
  "datos/avisos-oficiales.json",
  "datos/accesibilidad-lugares.json",
  "app-util.js",
  "viaje.js",
  "viaje.css",
  "mobile.js",
  "mobile.css",
  "patrocinios.css",
  "lugares.js",
  "horarios.js",
  "recorridos.js",
  "guia-viaje.js",
  "seguimiento-viaje.js",
  "planificador.js",
  "caminatas.js",
  "caminatas-worker.js",
  "estimacion-viaje.js",
  "proximos-viaje.js",
  "actualizar-opciones.js",
  "mapa-puntos.js",
  "mapa-layout.js",
  "mapa-gadgets.js",
  "mapa-ubicacion.js",
  "redisenio.js",
  "redisenio.css",
  "buses-mapa-vista.js",
  "buses-sentido.js",
  "actualizacion-buses.js",
  "mapa-gadgets.css",
  "mapa-layout.css",
  "viajes-habituales.js",
  "compartir-viaje.js",
  "ultimo-viaje.js",
  "recargas-stm.js",
  "patrocinios-locales.js",
  "extras-viaje.js",
  "extras.css",
  "bienvenida.js",
  "bienvenida.css",
  "beta.js",
  "beta.css",
  "abordaje.js",
  "abordaje.css",
  "alternativas-ahora.js",
  "alternativas-ahora.css",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "datos/recargas-stm.json",
  "datos/caminatas.json.gz",
  "datos/patrocinios.json",
];
const LEAFLET = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(
        CORE.map(
          (path) =>
            new Request(new URL(path, self.registration.scope).href, {
              cache: "reload",
            }),
        ),
      );
      await Promise.allSettled(
        LEAFLET.map(async (url) => {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response);
        }),
      );
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("dv-shell-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET") return;
  const isLeaflet = LEAFLET.includes(url.href);
  if (url.origin !== self.location.origin && !isLeaflet) return;
  if (
    !isLeaflet &&
    !url.pathname.startsWith(new URL(self.registration.scope).pathname)
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          if (response.ok)
            await cache.put(
              new URL("index.html", self.registration.scope).href,
              response.clone(),
            );
          return response;
        } catch (_) {
          return (
            (await cache.match(
              new URL("index.html", self.registration.scope).href,
            )) || Response.error()
          );
        }
      })(),
    );
    return;
  }
  if (!isLeaflet && !/\.(js|css|json|gz|webmanifest|png)$/.test(url.pathname))
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      const fijo =
        isLeaflet ||
        /\/(horarios|recorridos)\/.*\.json$/.test(url.pathname) ||
        /\/datos\/direcciones\/.*\.(json|gz)$/.test(url.pathname) ||
        url.pathname.endsWith("/datos/caminatas.json.gz") ||
        url.pathname.endsWith(".png");
      if (fijo && cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const key = new URL(request.url);
          key.search = "";
          await cache.put(key.href, response.clone());
        }
        if (!response.ok && cached) return cached;
        return response;
      } catch (_) {
        return cached || Response.error();
      }
    })(),
  );
});

/* Solo contenido del servicio propio; nunca abre URLs suministradas por el payload. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch (_) {}
  event.waitUntil(
    self.registration.showNotification("¿Dónde Viene?", {
      body: String(
        payload.body || "Tenés un aviso para revisar en la app.",
      ).slice(0, 240),
      icon: new URL("icons/icon-192.png", self.registration.scope).href,
      tag: String(payload.tag || "aviso").slice(0, 80),
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL("index.html", self.registration.scope).href;
      const abiertas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const app = abiertas.find((c) =>
        c.url.startsWith(self.registration.scope),
      );
      if (app) return app.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
