/* Estimación orientativa: caminata + próxima salida programada + distancia del recorrido.
   La velocidad del bus es un supuesto configurable, no una ETA en vivo. */
(() => {
  const DV = window.DV;
  async function estimar(c, ctx) {
    const caminos = await DV.caminatas.paraViaje(c, ctx);
    const walking = Object.fromEntries(caminos.map((t) => [t.id, t]));
    c = {
      ...c,
      caminos,
      origen: {
        ...c.origen,
        distanciaRuta: walking.origen?.metros ?? c.origen.distanciaRuta,
      },
      destino: {
        ...c.destino,
        distanciaRuta: walking.destino?.metros ?? c.destino.distanciaRuta,
      },
      caminataCombinacion: walking.combinacion?.metros ?? c.caminataCombinacion,
    };
    const seconds = (id) =>
      (walking[id]?.metros || 0) / DV.config.velocidadCaminata;
    const salida = new Date(ctx.fechaSalida || Date.now());
    let time = salida.getTime() + seconds("origen") * 1000;
    const fechaEnParada = new Date(time).toISOString();
    const partes = [];
    for (const [i, tramo] of DV.tramosBus(c).entries()) {
      if (i) time += seconds("combinacion") * 1000;
      const next = await window.obtenerSalidaProgramada({
        linea: tramo.linea,
        stopId: tramo.subida.busstopId,
        destination: tramo.destination,
        fechaReferencia: new Date(time).toISOString(),
      });
      // La espera del primer bus sirve para ordenar aunque falte la geometría
      // o la salida sea demasiado lejana para estimar el viaje completo.
      if (i === 0 && next && Number.isFinite(next.secondsUntil)) {
        c.proximaSalida = {
          disponible: true,
          fecha: next.date,
          minutos: Math.ceil(
            (time - salida.getTime()) / 60000 + next.secondsUntil / 60,
          ),
          fuente: "programado",
        };
      }
      const geometry = await window.obtenerTramoLineaViaje(
        tramo.linea,
        tramo.destination,
        tramo.subida,
        tramo.bajada,
      );
      if (
        !next ||
        next.secondsUntil > 5400 ||
        !Array.isArray(geometry) ||
        geometry.length < 2
      )
        return {
          ...c,
          caminos,
          tiempo: {
            disponible: false,
            fechaEnParada,
            motivo: "Sin datos suficientes para estimar el tiempo total.",
          },
        };
      let meters = 0;
      for (let j = 1; j < geometry.length; j++)
        meters += DV.distancia(
          { lat: geometry[j - 1][0], lon: geometry[j - 1][1] },
          { lat: geometry[j][0], lon: geometry[j][1] },
        );
      const espera = next.secondsUntil,
        viaje = meters / (DV.config.velocidadBus / 3.6);
      time += (espera + viaje) * 1000;
      partes.push({
        linea: tramo.linea,
        salida: next.date,
        espera: Math.ceil(espera / 60),
        recorrido: Math.ceil(viaje / 60),
      });
    }
    time += seconds("destino") * 1000;
    const total = Math.ceil((time - salida.getTime()) / 60000);
    const margen = Math.max(5, Math.ceil(total * DV.config.margenTiempo));
    return {
      ...c,
      caminos,
      tiempo: {
        disponible: true,
        total,
        min: Math.max(1, total - margen),
        max: total + margen,
        partes,
        caminata: Math.ceil(
          caminos.reduce((s, t) => s + t.metros, 0) /
            DV.config.velocidadCaminata /
            60,
        ),
        fechaEnParada,
        fechaLlegada: new Date(time).toISOString(),
        fechaSalida: salida.toISOString(),
      },
    };
  }
  async function enriquecer(opciones, ctx) {
    const elegidas = window
      .ordenarOpcionesViaje(opciones, "transbordos")
      .slice(0, 24);
    const result = new Array(elegidas.length);
    let siguiente = 0;
    let cerrado = false;
    async function tarea() {
      while (!cerrado && siguiente < elegidas.length) {
        const i = siguiente++;
        try {
          const calculo = await estimar(elegidas[i], ctx);
          if (!cerrado) result[i] = calculo;
        } catch (_) {
          result[i] = {
            ...elegidas[i],
            tiempo: { disponible: false, motivo: "Tiempo sin confirmar." },
          };
        }
      }
    }
    let timer;
    await Promise.race([
      Promise.all([tarea(), tarea(), tarea()]),
      new Promise((resolve) => {
        timer = setTimeout(resolve, 25000);
      }),
    ]);
    cerrado = true;
    clearTimeout(timer);
    for (let i = 0; i < elegidas.length; i++)
      if (!result[i])
        result[i] = {
          ...elegidas[i],
          tiempo: {
            disponible: false,
            motivo: "La estimación tardó demasiado.",
          },
        };
    return [...result, ...opciones.filter((c) => !elegidas.includes(c))];
  }
  DV.estimacion = { estimar, enriquecer };
})();
