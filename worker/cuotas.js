/* Límites propios para cuidar D1 y push en Workers Free. No activa facturación. */
export const CUOTAS_DIARIAS = Object.freeze({ reports: 500, subscriptions: 200, testPush: 200 });
export const MAX_SUSCRIPCIONES = 300;
export const VERSION_SEGURIDAD = "20261014-1";

export async function reservarOperacion(db, tipo, now = Date.now()) {
  const limite = CUOTAS_DIARIAS[tipo];
  if (!limite) throw Error("Cuota desconocida");
  const fecha = new Date(now).toISOString().slice(0, 10);
  // Namespace reservado: los IDs reales de suscripciones son hashes hexadecimales.
  // Reutiliza el esquema desplegado; no necesita una migración para empezar a proteger.
  const row = await db.prepare(
    "INSERT INTO deliveries(subscription_id,event_id,estado,creado) VALUES('__budget__',?,1,?) " +
    "ON CONFLICT(subscription_id,event_id) DO UPDATE SET estado=deliveries.estado+1 " +
    "WHERE deliveries.estado < ? RETURNING estado",
  ).bind(fecha + ":" + tipo, now, limite).first();
  return Boolean(row);
}

export function segundosHastaRenovacion(now = Date.now()) {
  return Math.max(1, Math.ceil((86400000 - now % 86400000) / 1000));
}
