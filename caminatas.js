/* Servicio de caminatas local: caché de pares, tiempo límite y alternativa explícita. */
(() => {
  const DV = window.DV,
    cache = new Map(),
    pendientes = new Map();
  let worker = null,
    serial = 0;
  function obtener(desde, hasta) {
    if (DV.distancia(desde, hasta) < 5)
      return Promise.resolve({
        puntos: [
          [desde.lat, desde.lon],
          [hasta.lat, hasta.lon],
        ],
        metros: DV.distancia(desde, hasta),
        tipo: "calles",
      });
    const key = [desde.lat, desde.lon, hasta.lat, hasta.lon]
      .map((v) => v.toFixed(6))
      .join("|");
    if (cache.has(key)) return cache.get(key);
    const promise = new Promise((resolve) => {
      if (!window.Worker) {
        resolve(null);
        return;
      }
      try {
        if (!worker) {
          worker = new Worker("./caminatas-worker.js?v=20261008-1");
          worker.onmessage = (e) => {
            const p = pendientes.get(e.data.id);
            if (!p) return;
            clearTimeout(p.timeout);
            pendientes.delete(e.data.id);
            p.resolve(
              e.data.result ? { ...e.data.result, tipo: "calles" } : null,
            );
          };
          worker.onerror = () => {
            for (const p of pendientes.values()) {
              clearTimeout(p.timeout);
              p.resolve(null);
            }
            pendientes.clear();
            worker.terminate();
            worker = null;
          };
        }
        const id = ++serial;
        const timeout = setTimeout(() => {
          pendientes.delete(id);
          resolve(null);
        }, 15000);
        pendientes.set(id, { resolve, timeout });
        worker.postMessage({ id, desde, hasta });
      } catch (_) {
        resolve(null);
      }
    });
    cache.set(key, promise);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return promise;
  }
  async function paraViaje(c, ctx) {
    return Promise.all(DV.tramosPie(c, ctx).map(async tramo => {
      const calculo = await obtener(tramo.desde, tramo.hasta);
      return {
        ...tramo,
        ...(calculo || {
          tipo: "recta",
          metros: DV.distancia(tramo.desde, tramo.hasta),
          puntos: [
            [tramo.desde.lat, tramo.desde.lon],
            [tramo.hasta.lat, tramo.hasta.lon],
          ],
        }),
      };
    }));
  }
  DV.caminatas = { obtener, paraViaje };
})();
