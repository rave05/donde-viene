/* Direcciones oficiales locales: índice pequeño y descarga por calle, sin autocompletar en Nominatim. */
(() => {
  const DV = window.DV,
    archivos = new Map(),
    elegidas = new Map();
  const normalizar = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const calleClave = (s) =>
    normalizar(s)
      .replace(/\b(av|avda|avenida|bulevar|boulevard|bvar|bv|calle)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  async function cargar(path, gzip = false) {
    if (archivos.has(path)) return archivos.get(path);
    const promise = (async () => {
      const control = new AbortController(),
        timer = setTimeout(() => control.abort(), 6000);
      try {
        const r = await fetch("./datos/direcciones/" + path, {
          signal: control.signal,
        });
        if (!r.ok) throw Error("Direcciones no disponibles");
        if (!gzip) return await r.json();
        if (!window.DecompressionStream)
          throw Error("Compresión no disponible");
        return await new Response(
          r.body.pipeThrough(new DecompressionStream("gzip")),
        ).json();
      } finally {
        clearTimeout(timer);
      }
    })();
    archivos.set(path, promise);
    promise.catch(() => archivos.delete(path));
    if (archivos.size > 12)
      archivos.delete([...archivos.keys()].find((k) => k !== "indice.json"));
    return promise;
  }
  function separar(texto) {
    const m = String(texto)
      .trim()
      .match(/^(.+?)\s+(\d{1,6})\s*([^ ·]{0,5})$/i);
    return m
      ? {
          calle: calleClave(m[1]),
          puerta: Number(m[2]),
          letra: m[3].toUpperCase(),
        }
      : null;
  }
  async function sugerir(texto) {
    const q = separar(texto);
    if (!q || q.calle.length < 3) return [];
    const indice = await cargar("indice.json");
    const exactas = indice.calles.filter((c) => calleClave(c[0]) === q.calle);
    const coincidencias = exactas.length
      ? exactas
      : indice.calles.filter((c) =>
          q.calle
            .split(" ")
            .every((p) => calleClave(c[0]).split(" ").includes(p)),
        );
    const calles = coincidencias.slice(0, 3),
      calleUnica = coincidencias.length === 1;
    const grupos = await Promise.all(
      calles.map(async (c) => {
        const datos = await cargar(
          String(c[2]).padStart(2, "0") + ".json.gz",
          true,
        );
        const puntos = (datos[c[0]] || []).filter((p) => p[0] === q.puerta);
        return puntos
          .map((p, i) => {
            const nombre =
              c[1] +
              " " +
              p[0] +
              (p[1] ? " " + p[1] : "") +
              (puntos.length > 1 ? " · acceso " + (i + 1) : "");
            const punto = {
              lat: p[2],
              lon: p[3],
              nombre,
              tipo: "house",
              geocodificacionLocal: true,
              fuente: indice.fuente,
            };
            elegidas.set(nombre, punto);
            return {
              valor: nombre,
              nombre,
              icono: "📍",
              categoria: "Dirección oficial · Montevideo",
              direccion: true,
              punto,
              calleUnica,
              letra: p[1],
            };
          })
          .filter((o) => !q.letra || o.letra === q.letra);
      }),
    );
    while (elegidas.size > 100) elegidas.delete(elegidas.keys().next().value);
    return grupos.flat().slice(0, 6);
  }
  function qPuerta(texto) {
    return separar(texto.replace(/ · acceso \d+$/, ""))?.puerta;
  }
  async function resolver(texto) {
    if (elegidas.has(texto)) return { ...elegidas.get(texto) };
    let opciones;
    try {
      opciones = await sugerir(texto.replace(/ · acceso \d+$/, ""));
      const acceso = opciones.find(
        (o) =>
          o.valor === texto ||
          (o.letra &&
            !/^\d+$/.test(o.letra) &&
            o.valor.replace(
              " " + qPuerta(texto) + " " + o.letra,
              " " + qPuerta(texto) + o.letra,
            ) === texto),
      );
      if (acceso) return acceso.punto;
    } catch (_) {
      return null;
    }
    if (opciones.length === 1 && opciones[0].calleUnica)
      return opciones[0].punto;
    if (opciones.length)
      throw Error(
        "Esa dirección tiene varios accesos. Elegí uno de las sugerencias del campo.",
      );
    return null;
  }
  DV.direcciones = { sugerir, resolver, separar };
})();
