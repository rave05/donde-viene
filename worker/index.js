import {
  hash,
  leerJSON,
  validarSuscripcion,
  validarPreferencias,
} from "./validacion.js";
import { procesarAvisos } from "./push.js";
import { withSharedTransitCache, recursoCacheable } from "./transport-cache.js";
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url),
      origin = request.headers.get("Origin");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Expose-Headers": "Age, X-DV-Observed-At",
    };
    if (origin === env.APP_ORIGIN)
      headers["Access-Control-Allow-Origin"] = origin;
    const json = (d, status = 200, extra = {}) =>
      new Response(JSON.stringify(d), {
        status,
        headers: { ...headers, ...extra },
      });
    if (origin && origin !== env.APP_ORIGIN)
      return json({ error: "Origen no permitido" }, 403);
    if (request.method === "OPTIONS")
      return json({}, 200, {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "600",
      });
    if (url.pathname === "/config" && request.method === "GET")
      return json({
        reportes: Boolean(env.DB && env.PUBLIC_LIMIT),
        transporte: Boolean(env.TRANSPORTE && env.PUBLIC_LIMIT),
        cacheTransporte: Boolean(
          env.TRANSPORTE &&
            env.PUBLIC_LIMIT &&
            env.CACHE_PUBLIC_TRANSIT === "true",
        ),
        push: Boolean(
          env.DB &&
            env.PUBLIC_LIMIT &&
            env.VAPID_PUBLIC_KEY &&
            env.VAPID_PRIVATE_KEY,
        ),
        vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
      });
    if (url.pathname === "/admin/reports" && request.method === "GET") {
      if (
        !env.ADMIN_TOKEN ||
        request.headers.get("Authorization") !== "Bearer " + env.ADMIN_TOKEN
      )
        return json({ error: "No autorizado" }, 401);
      if (!env.DB) return json({ error: "Servicio no configurado" }, 503);
      const result = await env.DB.prepare(
        "SELECT * FROM reports ORDER BY creado DESC LIMIT 100",
      ).all();
      return json(result.results);
    }
    if (url.pathname === "/admin/push" && request.method === "GET") {
      if (!env.ADMIN_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.ADMIN_TOKEN)
        return json({ error: "No autorizado" }, 401);
      if (!env.DB) return json({ error: "Servicio no configurado" }, 503);
      const subscriptions = await env.DB.prepare("SELECT recordatorio, actualizado FROM subscriptions ORDER BY actualizado DESC LIMIT 100").all();
      const deliveries = await env.DB.prepare("SELECT event_id, estado, creado FROM deliveries ORDER BY creado DESC LIMIT 100").all();
      return json({ subscriptions: subscriptions.results, deliveries: deliveries.results });
    }
    if (
      request.method === "GET" &&
      env.TRANSPORTE &&
      recursoCacheable(request)
    ) {
      if (!env.PUBLIC_LIMIT)
        return json({ error: "Límite no configurado" }, 503);
      const rate = await env.PUBLIC_LIMIT.limit({
        key: await hash(request.headers.get("CF-Connecting-IP") || "unknown"),
      });
      if (!rate.success)
        return json({ error: "Esperá antes de reintentar" }, 429, {
          "Retry-After": "60",
        });
      // Service binding conserva los secretos y la autenticación del Worker original.
      const r = await withSharedTransitCache(request, env, ctx, (req) =>
        env.TRANSPORTE.fetch(req),
      );
      const out = new Response(r.body, r);
      for (const [k, v] of Object.entries(headers))
        if (k !== "Content-Type") out.headers.set(k, v);
      return out;
    }
    if (
      request.method !== "POST" ||
      !["/subscriptions", "/unsubscribe", "/reports"].includes(url.pathname)
    )
      return json({ error: "No encontrado" }, 404);
    if (origin !== env.APP_ORIGIN)
      return json({ error: "Origen requerido" }, 403);
    if (!env.DB || !env.PUBLIC_LIMIT)
      return json({ error: "Servicio no configurado" }, 503);
    const rate = await env.PUBLIC_LIMIT.limit({
      key: await hash(request.headers.get("CF-Connecting-IP") || "unknown"),
    });
    if (!rate.success)
      return json({ error: "Esperá antes de reintentar" }, 429, {
        "Retry-After": "60",
      });
    try {
      const body = await leerJSON(request);
      if (url.pathname === "/reports") {
        const categorias = [
          "Bus o sentido incorrecto",
          "Horario o llegada",
          "Dirección o parada",
          "Mapa o funcionamiento",
          "Accesibilidad",
          "Sugerencia",
        ];
        if (
          !categorias.includes(body.categoria) ||
          typeof body.texto !== "string" ||
          !body.texto.trim() ||
          body.texto.length > 3000
        )
          throw Error("Reporte inválido");
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO reports(id,categoria,texto,creado) VALUES(?,?,?,?)",
        )
          .bind(id, body.categoria, body.texto.trim(), Date.now())
          .run();
        return json({ id }, 201);
      }
      if (url.pathname === "/unsubscribe") {
        if (
          typeof body.token !== "string" ||
          !/^[a-f0-9]{64}$/.test(body.token)
        )
          throw Error("Token inválido");
        const row = await env.DB.prepare(
          "SELECT id FROM subscriptions WHERE token=?",
        )
          .bind(body.token)
          .first();
        if (row)
          await env.DB.batch([
            env.DB.prepare("DELETE FROM subscriptions WHERE token=?").bind(
              body.token,
            ),
            env.DB.prepare(
              "DELETE FROM deliveries WHERE subscription_id=?",
            ).bind(row.id),
          ]);
        return json({ ok: true });
      }
      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY)
        return json({ error: "Push no configurado" }, 503);
      const subscription = validarSuscripcion(body.subscription),
        prefs = validarPreferencias(body),
        id = await hash(subscription.endpoint);
      const existente = await env.DB.prepare(
        "SELECT token FROM subscriptions WHERE id=?",
      )
        .bind(id)
        .first();
      // El endpoint por sí solo no autoriza cambiar preferencias de otra suscripción.
      if (existente && body.token !== existente.token)
        return json(
          {
            error:
              "Suscripción ya registrada; desactivá y volvé a activar en tu dispositivo",
          },
          409,
        );
      const token =
        existente?.token ||
        (await hash(crypto.randomUUID() + crypto.randomUUID()));
      await env.DB.prepare(
        "INSERT INTO subscriptions(id,token,subscription,lineas,recordatorio,actualizado) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,lineas=excluded.lineas,recordatorio=excluded.recordatorio,actualizado=excluded.actualizado",
      )
        .bind(
          id,
          token,
          JSON.stringify(subscription),
          JSON.stringify(prefs.lineas),
          prefs.recordatorio ? JSON.stringify(prefs.recordatorio) : null,
          Date.now(),
        )
        .run();
      return json({ token }, 201);
    } catch (error) {
      return json(
        {
          error:
            error instanceof SyntaxError
              ? "JSON inválido"
              : "No se pudo procesar la solicitud",
        },
        400,
      );
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(procesarAvisos(env, new Date(event.scheduledTime)));
  },
};
