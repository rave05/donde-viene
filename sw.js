/* Cachea la interfaz y datos estáticos. Nunca guarda respuestas de la API de transporte. */
const CACHE = "dv-shell-20261010-v42";
const CORE = [
  "index.html",
  "ayuda.html",
  "acerca.html",
  "privacidad.html",
  "informacion.css",
  "app-informacion.css",
  "metropolitano.js",
  "paradas-viaje.js",
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
  "mascota.js",
  "mascota-flotante.js",
  "mascota.css",
  "mobile.js",
  "mobile.css",
  "patrocinios.css",
  "lugares.js",
  "horarios.js",
  "recorridos.js",
  "guia-viaje.js",
  "viaje-en-curso.js",
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
  "icons/bus-192.png",
  "icons/bus-512.png",
  "icons/bus-apple-180.png",
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
// Un fallo de almacenamiento no debe convertir una respuesta de red en un error.
async function abrirCache() {
  try { return await caches.open(CACHE); } catch (_) { return null; }
}
async function leerCache(cache, key) {
  try { return await cache?.match(key, { ignoreSearch: true }); } catch (_) { return null; }
}
async function guardarCache(cache, key, response) {
  try { await cache?.put(key, response.clone()); } catch (_) {}
}
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
    const scope = new URL(self.registration.scope);
    const page = new URL(request.url);
    page.search = "";
    page.hash = "";
    const navigationKey = page.pathname === scope.pathname
      ? new URL("index.html", scope).href
      : page.href;
    event.respondWith(
      (async () => {
        const cache = await abrirCache();
        try {
          const response = await fetch(request);
          if (response.ok)
            await guardarCache(cache, navigationKey, response);
          else if (response.status >= 500) {
            const cached = await leerCache(cache, navigationKey);
            if (cached) return cached;
          }
          return response;
        } catch (_) {
          return (
            (await leerCache(cache, navigationKey)) || Response.error()
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
      const cache = await abrirCache();
      const cached = await leerCache(cache, request);
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
          await guardarCache(cache, key.href, response);
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
      icon: new URL("icons/bus-192.png", self.registration.scope).href,
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
      if (app) {
        if (event.notification.data?.tipo === 'viaje-activo') app.postMessage({ tipo: 'abrir-viaje-activo' });
        return app.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
