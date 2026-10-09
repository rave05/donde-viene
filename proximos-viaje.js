/* Consulta la primera subida sin activar el seguimiento ni modificar la selección.
   Cada par parada/variante se consulta una vez por búsqueda, con un límite global. */
(() => {
  const DV = window.DV;
  async function enriquecer(opciones, ctx) {
    if (ctx.fechaSalida || !window.DondeVieneApp?.apiBase) return opciones;
    const resultado = opciones.map((c) => ({ ...c }));
    const grupos = new Map();
    for (const c of resultado) {
      const variante = c.line1 ? c.lineVariantId1 : c.lineVariantId;
      if (
        variante == null ||
        String(variante).trim() === "" ||
        c.coincidenciaAproximada
      )
        continue;
      const clave = c.origen.busstopId + "|" + variante;
      if (!grupos.has(clave))
        grupos.set(clave, {
          parada: c.origen.busstopId,
          variante,
          opciones: [],
        });
      grupos.get(clave).opciones.push(c);
    }
    const consultas = [...grupos.values()].slice(0, 24);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let siguiente = 0;
    async function tarea() {
      while (!controller.signal.aborted && siguiente < consultas.length) {
        const grupo = consultas[siguiente++];
        try {
          const url =
            window.DondeVieneApp.apiBase +
            "/stops/" +
            encodeURIComponent(grupo.parada) +
            "/upcomingbuses?lineVariantIds=" +
            encodeURIComponent(grupo.variante) +
            "&amountperline=3";
          const respuesta = await fetch(url, { signal: controller.signal });
          if (respuesta.status === 429) {
            controller.abort();
            break;
          }
          if (!respuesta.ok) continue;
          const buses = await respuesta.json();
          if (!Array.isArray(buses) || controller.signal.aborted) continue;
          const ahora = Date.now();
          for (const c of grupo.opciones) {
            const metros =
              c.caminos?.find((t) => t.id === "origen")?.metros ??
              c.origen.distanciaRuta;
            if (!Number.isFinite(Number(metros)) || metros == null) continue;
            const caminata = Number(metros) / DV.config.velocidadCaminata;
            const etas = buses
              .filter(
                (b) =>
                  b.lineVariantId == null ||
                  String(b.lineVariantId) === String(grupo.variante),
              )
              .map((b) => (b.eta == null || b.eta === "" ? NaN : Number(b.eta)))
              .filter(
                (eta) => Number.isFinite(eta) && eta >= Math.max(0, caminata),
              );
            if (!etas.length) continue;
            const eta = Math.min(...etas);
            c.proximaSalida = {
              disponible: true,
              minutos: Math.ceil(eta / 60),
              fecha: new Date(ahora + eta * 1000).toISOString(),
              fuente: "estimado",
              consultadoEn: new Date(ahora).toISOString(),
            };
          }
        } catch (_) {
          /* El horario programado permanece como respaldo. */
        }
      }
    }
    try {
      await Promise.all([tarea(), tarea(), tarea()]);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    return resultado;
  }
  DV.proximosViaje = { enriquecer };
})();
