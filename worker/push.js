import webpush from "web-push";
import { validarSuscripcion, recordatorioActual } from "./validacion.js";
export async function enviarPush(subscription, payload, env) {
  validarSuscripcion(subscription);
  const details = webpush.generateRequestDetails(
    subscription,
    JSON.stringify(payload),
    {
      TTL: 300,
      urgency: "normal",
      vapidDetails: {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
      },
    },
  );
  const response = await fetch(details.endpoint, {
    method: details.method,
    headers: details.headers,
    body: details.body,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  return response.status;
}
export async function procesarAvisos(env, fecha = new Date()) {
  if (!env.DB || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  let avisos = [];
  try {
    const r = await fetch(env.AVISOS_URL, {
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const d = await r.json();
      avisos = Array.isArray(d.avisos)
        ? d.avisos.filter(
            (a) =>
              Date.parse(a.desde) <= fecha.getTime() &&
              fecha.getTime() < Date.parse(a.hasta),
          )
        : [];
    }
  } catch (_) {}
  const now = fecha.getTime();
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM deliveries WHERE creado < ? OR (estado = 0 AND creado < ?)",
    ).bind(now - 30 * 86400000, now - 600000),
    env.DB.prepare("DELETE FROM subscriptions WHERE actualizado < ?").bind(
      now - 180 * 86400000,
    ),
    env.DB.prepare("DELETE FROM reports WHERE creado < ?").bind(
      now - 30 * 86400000,
    ),
  ]);
  // Páginas con concurrencia máxima 3; no dispara cientos de solicitudes simultáneas.
  let cursor = "";
  for (;;) {
    const { results } = await env.DB.prepare(
      "SELECT * FROM subscriptions WHERE id > ? ORDER BY id LIMIT 50",
    )
      .bind(cursor)
      .all();
    if (!results.length) break;
    cursor = results.at(-1).id;
    let indice = 0;
    async function tarea() {
      while (indice < results.length) {
        const row = results[indice++];
        let sub, lineas, recordatorio;
        try {
          sub = JSON.parse(row.subscription);
          lineas = JSON.parse(row.lineas);
          recordatorio = JSON.parse(row.recordatorio || "null");
        } catch (_) {
          continue;
        }
        const recordatorioId = recordatorioActual(recordatorio, fecha);
        const events = avisos
          .filter((a) =>
            a.lineas?.some((l) => lineas.includes(String(l.linea))),
          )
          .map((a) => ({
            id: "aviso-" + a.id,
            body: "Hay un aviso oficial para una de tus líneas. Abrí la app para revisar el sentido y las paradas afectadas.",
          }));
        if (recordatorioId)
          events.push({
            id: recordatorioId,
            body: "Es hora de revisar tu viaje habitual. Consultá las próximas salidas antes de salir.",
          });
        for (const e of events) {
          const claim = await env.DB.prepare(
            "INSERT OR IGNORE INTO deliveries(subscription_id,event_id,creado) VALUES(?,?,?)",
          )
            .bind(row.id, e.id, now)
            .run();
          if (!claim.meta.changes) continue;
          let status;
          try {
            status = await enviarPush(sub, { body: e.body, tag: e.id }, env);
          } catch (_) {
            status = 503;
          }
          if (status === 404 || status === 410) {
            await env.DB.prepare("DELETE FROM subscriptions WHERE id=?")
              .bind(row.id)
              .run();
            break;
          }
          if (status >= 200 && status < 300)
            await env.DB.prepare(
              "UPDATE deliveries SET estado=1 WHERE subscription_id=? AND event_id=?",
            )
              .bind(row.id, e.id)
              .run();
          // Fallos se reintentan tras diez minutos, sin un bucle contra el proveedor.
        }
      }
    }
    await Promise.all([tarea(), tarea(), tarea()]);
  }
}
