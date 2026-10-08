/* Utilidades compartidas. No depende del mapa ni del motor de rutas. */
(() => {
  const DV = (window.DV = window.DV || {});
  DV.config = {
    velocidadCaminata: 1.25,
    velocidadBus: 18,
    margenTiempo: 0.25,
    limiteHabituales: 12,
  };
  DV.escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[ch],
    );
  DV.leer = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  };
  DV.guardar = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  };
  DV.coord = (point) => {
    const c = point?.location?.coordinates;
    const lat = c ? c[1] : point?.lat,
      lon = c ? c[0] : point?.lon;
    if (lat == null || lon == null || lat === "" || lon === "") return null;
    const result = { lat: Number(lat), lon: Number(lon) };
    return Number.isFinite(result.lat) &&
      Number.isFinite(result.lon) &&
      Math.abs(result.lat) <= 90 &&
      Math.abs(result.lon) <= 180
      ? result
      : null;
  };
  DV.distancia = (a, b) => {
    if (!a || !b) return Infinity;
    const r = Math.PI / 180;
    const v =
      Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
      Math.cos(a.lat * r) *
        Math.cos(b.lat * r) *
        Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
  };
  DV.fechaTexto = (date) =>
    new Intl.DateTimeFormat("es-UY", {
      timeZone: "America/Montevideo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(date));
  DV.fechaPartes = (date) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(date)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    );
  DV.recetaValida = (value) =>
    value &&
    typeof value.origen === "string" &&
    typeof value.destino === "string" &&
    value.origen.trim().length > 0 &&
    value.destino.trim().length > 0 &&
    value.origen.length <= 240 &&
    value.destino.length <= 240 &&
    ["transbordos", "caminar", "tiempo"].includes(value.preferencia);
  DV.tramosBus = (c) =>
    c.line1 && c.line2
      ? [
          {
            linea: c.line1,
            destination: c.destination1,
            subida: c.origen,
            bajada: c.combinacion,
          },
          {
            linea: c.line2,
            destination: c.destination2,
            subida: c.combinacion2 || c.combinacion,
            bajada: c.destino,
          },
        ]
      : [
          {
            linea: c.line,
            destination: c.destination,
            subida: c.origen,
            bajada: c.destino,
          },
        ];
  DV.tramosPie = (c, ctx) => {
    const tramos = [
      {
        id: "origen",
        desde: DV.coord(ctx.puntoOrigen),
        hasta: DV.coord(c.origen),
      },
    ];
    if (c.line1 && c.line2)
      tramos.push({
        id: "combinacion",
        desde: DV.coord(c.combinacion),
        hasta: DV.coord(c.combinacion2 || c.combinacion),
      });
    tramos.push({
      id: "destino",
      desde: DV.coord(c.destino),
      hasta: DV.coord(ctx.puntoDestino),
    });
    return tramos.filter((t) => t.desde && t.hasta);
  };
})();
