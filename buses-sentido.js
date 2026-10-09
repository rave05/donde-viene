/* GPS sin ETA: confirma avance ANTES de la parada sobre el recorrido, no cercanía radial. */
(() => {
  const RADIO = 6371000,
    rad = Math.PI / 180;
  function proyeccion(shape, punto) {
    const [lat, lon] = punto;
    const escala = Math.cos(lat * rad);
    let recorrido = 0;
    const opciones = [];
    for (let i = 1; i < shape.length; i++) {
      const a = shape[i - 1],
        b = shape[i];
      if (!a || !b || ![...a, ...b].every(Number.isFinite)) return null;
      const ax = (a[1] - lon) * rad * RADIO * escala,
        ay = (a[0] - lat) * rad * RADIO;
      const bx = (b[1] - lon) * rad * RADIO * escala,
        by = (b[0] - lat) * rad * RADIO;
      const dx = bx - ax,
        dy = by - ay,
        largo = Math.hypot(dx, dy);
      if (!largo) continue;
      const t = Math.max(
        0,
        Math.min(1, -(ax * dx + ay * dy) / (largo * largo)),
      );
      opciones.push({
        distancia: Math.hypot(ax + t * dx, ay + t * dy),
        avance: recorrido + t * largo,
      });
      recorrido += largo;
    }
    opciones.sort((a, b) => a.distancia - b.distancia);
    const mejor = opciones[0];
    if (!mejor) return null;
    // Cruces, bucles o calles de ida/vuelta demasiado cercanos: no elegir una rama a ciegas.
    if (
      opciones.some(
        (p) =>
          p.distancia <= mejor.distancia + 20 &&
          Math.abs(p.avance - mejor.avance) > 200,
      )
    )
      return { ...mejor, ambiguo: true };
    return mejor;
  }
  window.crearFiltroSentidoBuses = (shapes, parada) => {
    const rutas = shapes
      .map((shape) => ({ shape, parada: proyeccion(shape, parada) }))
      .filter((r) => r.parada && r.parada.distancia <= 100);
    const historial = new Map();
    return (bus, timestamp) => {
      const coords = bus.location?.coordinates;
      const id = bus.busId ?? bus.id;
      if (
        id == null ||
        !Array.isArray(coords) ||
        coords.length < 2 ||
        ![coords[0], coords[1], timestamp].every(Number.isFinite)
      )
        return false;
      const clave = JSON.stringify([
        bus.companyId ?? bus.company ?? bus.companyName ?? "",
        String(id),
      ]);
      const puntos = rutas.map((r) => ({
        actual: proyeccion(r.shape, [coords[1], coords[0]]),
        parada: r.parada,
      }));
      const candidatos = puntos
        .map((p, i) => ({ ...p, i }))
        .filter((p) => p.actual && p.actual.distancia <= 120);
      const anterior = historial.get(clave);
      if (!anterior || timestamp > anterior.timestamp)
        historial.set(clave, { timestamp, puntos });
      if (
        !candidatos.length ||
        !anterior ||
        timestamp <= anterior.timestamp ||
        timestamp - anterior.timestamp > 90000
      )
        return false;
      // Todas las ramas compatibles deben ubicarlo antes de la parada y avanzando.
      return candidatos.every((p) => {
        const previo = anterior.puntos[p.i]?.actual;
        if (
          !previo ||
          previo.distancia > 120 ||
          previo.ambiguo ||
          p.actual.ambiguo ||
          p.parada.ambiguo
        )
          return false;
        const avance = p.actual.avance - previo.avance;
        const tiempo = (timestamp - anterior.timestamp) / 1000;
        return (
          p.actual.avance <= p.parada.avance &&
          previo.avance <= p.parada.avance &&
          avance >= 40 &&
          avance / tiempo <= 35
        );
      });
    };
  };
})();
