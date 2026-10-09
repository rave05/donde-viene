export function validarSuscripcion(s) {
  if (!s || typeof s.endpoint !== "string" || s.endpoint.length > 2048)
    throw Error("Suscripción inválida");
  const url = new URL(s.endpoint);
  // No se envía a servidores suministrados arbitrariamente por el cliente (SSRF).
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !(
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "push.apple.com" ||
      host.endsWith(".push.apple.com")
    )
  )
    throw Error("Proveedor push inválido");
  const key = s.keys?.p256dh,
    auth = s.keys?.auth;
  if (
    !/^[A-Za-z0-9_-]{87}=?$/.test(key || "") ||
    (!/^[A-Za-z0-9_-]{22}==?$/.test(auth || "") &&
      !/^[A-Za-z0-9_-]{22}$/.test(auth || ""))
  )
    throw Error("Claves inválidas");
  return { endpoint: s.endpoint, keys: { p256dh: key, auth } };
}
export function validarPreferencias(body) {
  if (
    !Array.isArray(body.lineas) ||
    body.lineas.length > 12 ||
    body.lineas.some(
      (x) => typeof x !== "string" || !/^[A-Z]{0,2}\d{1,3}[A-Z]?$/.test(x),
    )
  )
    throw Error("Líneas inválidas");
  let recordatorio = null;
  if (body.recordatorio) {
    const r = body.recordatorio;
    if (
      !Array.isArray(r.dias) ||
      !r.dias.length ||
      r.dias.length > 7 ||
      r.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.hora || "")
    )
      throw Error("Recordatorio inválido");
    recordatorio = { dias: [...new Set(r.dias)], hora: r.hora };
  }
  if (!body.lineas.length && !recordatorio)
    throw Error("Elegí avisos o recordatorio");
  return { lineas: [...new Set(body.lineas)], recordatorio };
}
export async function leerJSON(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw Error("Formato inválido");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Falta contenido");
  const partes = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16000) {
      await reader.cancel();
      throw Error("Contenido demasiado largo");
    }
    partes.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const p of partes) {
    data.set(p, offset);
    offset += p.length;
  }
  return JSON.parse(new TextDecoder().decode(data));
}
export async function hash(texto) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export function recordatorioActual(recordatorio, fecha) {
  if (!recordatorio) return null;
  const local = new Date(fecha.getTime() - 3 * 3600000),
    minutos = local.getUTCHours() * 60 + local.getUTCMinutes();
  const [h, m] = recordatorio.hora.split(":").map(Number),
    diferencia = minutos - h * 60 - m;
  return recordatorio.dias.includes(local.getUTCDay()) &&
    diferencia >= 0 &&
    diferencia < 5
    ? "recordatorio-" +
        local.toISOString().slice(0, 10) +
        "-" +
        recordatorio.hora
    : null;
}
