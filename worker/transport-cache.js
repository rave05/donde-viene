/* Decorador: conserva el manejador original. Caché solo de recursos públicos conocidos. */
const pendientes = new Map();
export function recursoCacheable(request) {
  if (
    request.method !== "GET" ||
    request.headers.has("Authorization") ||
    request.headers.has("Cookie")
  )
    return null;
  const url = new URL(request.url),
    path = url.pathname;
  const params = new URLSearchParams(url.search);
  let ttl;
  if (path === "/stops" && !params.size) ttl = 3600;
  else if (/^\/stops\/\d+\/lines$/.test(path) && !params.size) ttl = 300;
  else if (
    path === "/buses" &&
    (!params.size ||
      ([...params.keys()].every((k) => k === "busstopId") &&
        /^\d+$/.test(params.get("busstopId"))))
  )
    ttl = 5;
  else if (
    /^\/stops\/\d+\/upcomingbuses$/.test(path) &&
    [...params.keys()].every((k) =>
      ["lineVariantIds", "amountperline"].includes(k),
    )
  ) {
    const ids = (params.get("lineVariantIds") || "").split(",");
    if (
      ids.length > 32 ||
      ids.some((x) => !/^\d+$/.test(x)) ||
      !/^[1-4]$/.test(params.get("amountperline") || "3")
    )
      return null;
    params.set("lineVariantIds", [...new Set(ids)].sort().join(","));
    params.set("amountperline", params.get("amountperline") || "3");
    ttl = 5;
  } else return null;
  // Parámetros duplicados no se normalizan: pueden cambiar el significado del manejador.
  if (
    new Set([...url.searchParams.keys()]).size !==
    [...url.searchParams.keys()].length
  )
    return null;
  params.sort();
  url.search = params.toString();
  return { key: new Request(url.href), ttl };
}
function publica(response) {
  const r = new Response(response.body, response);
  r.headers.set("Cache-Control", "no-store");
  const observado = Number(r.headers.get("X-DV-Observed-At"));
  if (Number.isFinite(observado) && observado > 0)
    r.headers.set(
      "Age",
      String(Math.max(0, Math.floor((Date.now() - observado) / 1000))),
    );
  return r;
}
export async function withSharedTransitCache(
  request,
  env,
  ctx,
  original,
  cache = caches.default,
) {
  const recurso = recursoCacheable(request);
  if (!recurso) return original(request, env, ctx);
  const hit = await cache.match(recurso.key);
  if (hit) return publica(hit);
  const key = recurso.key.url;
  if (!pendientes.has(key)) {
    // Evita crecimiento ilimitado: cuando está lleno consulta sin compartir.
    if (pendientes.size >= 200) return original(request, env, ctx);
    const promise = (async () => {
      const r = await original(recurso.key, env, ctx);
      const tipo = r.headers.get("Content-Type") || "";
      if (
        r.status !== 200 ||
        !tipo.includes("json") ||
        r.headers.has("Set-Cookie") ||
        /private|no-store/i.test(r.headers.get("Cache-Control") || "")
      )
        return r;
      const stored = new Response(r.body, r);
      stored.headers.set("Cache-Control", "public, max-age=" + recurso.ttl);
      stored.headers.set("X-DV-Observed-At", String(Date.now()));
      await cache.put(recurso.key, stored.clone()).catch(() => {});
      return stored;
    })();
    pendientes.set(key, promise);
    promise.finally(() => pendientes.delete(key)).catch(() => {});
  }
  return publica((await pendientes.get(key)).clone());
}
