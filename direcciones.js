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
      .replace(
        /\b(av|avda|avenida|bulevar|boulevard|bvar|bv|calle|cno|camino|dr|doctor|dra|doctora|gral|general|ing|ingeniero|pte|presidente|br)\b/g,
        "",
      )
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
      archivos.delete(
        [...archivos.keys()].find((k) => !k.endsWith("indice.json")),
      );
    return promise;
  }
  function textoLocal(texto) {
    return String(texto)
      .trim()
      .replace(/,\s*Montevideo(?:\s*,\s*Uruguay)?\s*$/i, "")
      .replace(/\s+· cruce \d+$/, "");
  }
  function separar(texto) {
    texto = textoLocal(texto).replace(
      /\s+(?:n[º°]|nro\.?|numero|número|#)\s*(?=\d)/i,
      " ",
    );
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
    const cruces = separarCruce(texto);
    const q = separar(texto);
    if (!q || q.calle.length < 3)
      return cruces.length ? sugerirCruces(cruces) : [];
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
    const opciones = grupos.flat().slice(0, 6);
    return opciones.length
      ? opciones
      : cruces.length
        ? sugerirCruces(cruces)
        : [];
  }
  function separarCruce(texto) {
    const limpio = textoLocal(texto);
    const divisiones = [
      ...limpio.matchAll(/\s+(?:y|esq\.?|esquina|con|&)\s+|\s*[&/]\s*/gi),
    ];
    return divisiones
      .map((m) => [
        calleClave(limpio.slice(0, m.index)),
        calleClave(limpio.slice(m.index + m[0].length)),
      ])
      .filter((p) => p.every((s) => s.length >= 2));
  }
  function buscarCalles(nombres, consulta) {
    const exactas = nombres
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => calleClave(c) === consulta);
    if (exactas.length) return exactas;
    const palabras = consulta.split(" ");
    return nombres
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => {
        const tokens = calleClave(c).split(" ");
        return palabras.every((p, j) =>
          tokens.some((t) =>
            j === palabras.length - 1 ? t.startsWith(p) : t === p,
          ),
        );
      });
  }
  async function sugerirCruces(divisiones) {
    const indice = await cargar("cruces-indice.json");
    const pares = new Map();
    for (const [a, b] of divisiones) {
      const primera = buscarCalles(indice.calles, a),
        segunda = buscarCalles(indice.calles, b);
      for (const x of primera.slice(0, 8))
        for (const y of segunda.slice(0, 8)) {
          if (x.i === y.i) continue;
          const [menor, mayor] = [x.i, y.i].sort((a, b) => a - b);
          pares.set(menor + ":" + mayor, {
            menor,
            mayor,
            unica: primera.length === 1 && segunda.length === 1,
          });
        }
    }
    const fragmentos = [
      ...new Set([...pares.values()].map((p) => p.menor % indice.fragmentos)),
    ];
    const grupos = await Promise.all(
      fragmentos.map((n) =>
        cargar("cruces-" + String(n).padStart(2, "0") + ".json"),
      ),
    );
    const filas = grupos.flat().filter((p) => pares.has(p[0] + ":" + p[1]));
    const cantidades = new Map();
    filas.forEach((p) => {
      const k = p[0] + ":" + p[1];
      cantidades.set(k, (cantidades.get(k) || 0) + 1);
    });
    const vistas = new Map();
    const opciones = filas
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3])
      .map((p) => {
        const clave = p[0] + ":" + p[1],
          n = (vistas.get(clave) || 0) + 1;
        vistas.set(clave, n);
        const nombre =
          indice.calles[p[0]] +
          " y " +
          indice.calles[p[1]] +
          (cantidades.get(clave) > 1 ? " · cruce " + n : "");
        const punto = {
          nombre,
          lat: p[2],
          lon: p[3],
          tipo: "intersection",
          geocodificacionLocal: true,
          fuente: indice.fuente,
        };
        elegidas.set(nombre, punto);
        return {
          valor: nombre,
          nombre,
          icono: "📍",
          categoria: "Cruce oficial · Montevideo",
          direccion: true,
          punto,
          calleUnica: pares.get(clave).unica && filas.length === 1,
        };
      })
      .slice(0, 6);
    while (elegidas.size > 100) elegidas.delete(elegidas.keys().next().value);
    return opciones;
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
  DV.direcciones = { sugerir, resolver, separar, separarCruce };
})();
