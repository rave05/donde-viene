/* Piloto MTOP: secuencias de paradas y horas publicadas; sin interpolar ni consultar IDs MTOP en la API urbana. */
(() => {
  const DV = window.DV;
  let pendiente,
    opcionesActuales = [];
  const normalizar = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  const distancia = (a, b) => DV.distancia(a, b);
  function cargar() {
    if (!pendiente)
      pendiente = fetch("./metropolitano/corredor.json", {
        cache: "no-cache",
        signal: AbortSignal.timeout(12000),
      })
        .then((r) => {
          if (!r.ok)
            throw Error(
              "No pudimos cargar los horarios metropolitanos. Reintentá.",
            );
          return r.json();
        })
        .catch((e) => {
          pendiente = null;
          throw e;
        });
    return pendiente;
  }
  function fechaLocal(fecha) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(fecha)
        .filter((x) => x.type !== "literal")
        .map((x) => [x.type, x.value]),
    );
    return new Date(`${p.year}-${p.month}-${p.day}T00:00:00-03:00`);
  }
  function activo(d, service, fecha) {
    const iso = new Date(fecha.getTime() - 3 * 3600000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const e = d.exceptions.find(
      (x) => x.service_id === service && x.date === iso,
    );
    if (e) return e.exception_type === "1";
    const s = d.services[service],
      day = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ][new Date(fecha.getTime() - 3 * 3600000).getUTCDay()];
    return !!s && iso >= s.start_date && iso <= s.end_date && s[day] === "1";
  }
  function proximo(d, p, i, j, referencia) {
    const base = fechaLocal(referencia);
    let mejor = null;
    for (let day = -1; day <= 7; day++) {
      const fecha = new Date(base.getTime() + day * 86400000);
      const servicios = Object.fromEntries(
        Object.keys(d.services).map((id) => [id, activo(d, id, fecha)]),
      );
      for (const t of p.trips) {
        if (!servicios[t.service] || t.times[i] == null) continue;
        const salida = fecha.getTime() + t.times[i] * 1000;
        if (salida < referencia.getTime()) continue;
        const llegada =
          t.times[j] == null ? null : fecha.getTime() + t.times[j] * 1000;
        if (llegada != null && llegada < salida) continue;
        if (!mejor || salida < mejor.salida)
          mejor = { salida, llegada, tripId: t.id };
      }
    }
    return mejor;
  }
  function cobertura(p) {
    return (
      Number(p.lat) >= -34.79 &&
      Number(p.lat) <= -34.66 &&
      Number(p.lon) >= -56.25 &&
      Number(p.lon) <= -56.15
    );
  }
  function directas(d, origen, destino, referencia, radio = 800) {
    const candidates = [];
    for (const p of d.patterns) {
      const cercaA = p.stops
        .map((id, i) => ({
          i,
          s: d.stops[id],
          metros: distancia(origen, d.stops[id]),
        }))
        .filter((x) => x.metros <= radio)
        .sort((a, b) => a.metros - b.metros)
        .slice(0, 4);
      const cercaB = p.stops
        .map((id, i) => ({
          i,
          s: d.stops[id],
          metros: distancia(destino, d.stops[id]),
        }))
        .filter((x) => x.metros <= radio)
        .sort((a, b) => a.metros - b.metros)
        .slice(0, 4);
      let best = null;
      for (const a of cercaA)
        for (const b of cercaB) {
          if (b.i <= a.i) continue;
          const ref = new Date(referencia.getTime() + (a.metros / 1.25) * 1000);
          const horario = proximo(d, p, a.i, b.i, ref);
          // Un calendario vencido no se ofrece como servicio vigente.
          const base = fechaLocal(ref);
          if (
            !p.trips.some((t) =>
              Array.from(
                { length: 8 },
                (_, day) => new Date(base.getTime() + day * 86400000),
              ).some((f) => activo(d, t.service, f)),
            )
          )
            continue;
          const score = a.metros + b.metros + (horario ? 0 : 1500);
          const c = {
            p,
            subida: a.s,
            bajada: b.s,
            caminataInicio: a.metros,
            caminataFinal: b.metros,
            horario,
            score,
          };
          if (
            !best ||
            score < best.score ||
            (score === best.score &&
              (horario?.salida || Infinity) <
                (best.horario?.salida || Infinity))
          )
            best = c;
        }
      if (best) candidates.push(best);
    }
    return candidates.sort(
      (a, b) =>
        (a.horario?.salida || Infinity) - (b.horario?.salida || Infinity) ||
        a.score - b.score,
    );
  }
  function urbanaCerca(p, radio = 300) {
    return (window.todasLasParadas || [])
      .map((s) => ({
        ...s,
        distanciaRuta: distancia(p, {
          lat: s.location?.coordinates?.[1],
          lon: s.location?.coordinates?.[0],
        }),
      }))
      .filter((s) => s.distanciaRuta <= radio)
      .sort((a, b) => a.distanciaRuta - b.distanciaRuta)
      .slice(0, 8);
  }
  async function combinar(d, origen, destino, referencia) {
    if (!window.buscarDirectasPorRed || !window.todasLasParadas?.length)
      return [];
    const saliendo = cobertura(origen);
    const urbano = saliendo ? destino : origen;
    const puntos = Object.values(d.stops)
      .filter(
        (s) =>
          s.lat < -34.79 &&
          /TERMINAL B.BRUM|PZA\.?\s*COLON|PLAZA 1o MAYO/i.test(s.name),
      )
      .sort((a, b) => distancia(a, urbano) - distancia(b, urbano));
    const elegidos = [];
    for (const p of puntos)
      if (!elegidos.some((s) => distancia(s, p) < 250)) {
        elegidos.push(p);
        if (elegidos.length === 3) break;
      }
    const output = [];
    for (const punto of elegidos) {
      const metros = (
        saliendo
          ? directas(d, origen, punto, referencia)
          : directas(d, punto, destino, referencia)
      )
        .filter((c) => distancia(saliendo ? c.bajada : c.subida, punto) <= 300)
        .slice(0, 2);
      for (const metro of metros) {
        const intercambio = saliendo ? metro.bajada : metro.subida;
        const urbanas = saliendo
          ? await window.buscarDirectasPorRed(
              urbanaCerca(intercambio),
              destino,
              800,
            )
          : await window.buscarDirectasPorRed(
              urbanaCerca(origen, 800),
              intercambio,
              300,
            );
        for (const u of urbanas.slice(0, 2)) {
          const parada = saliendo ? u.origen : u.destino;
          const caminar = distancia(intercambio, {
            lat: parada.location?.coordinates?.[1],
            lon: parada.location?.coordinates?.[0],
          });
          if (!Number.isFinite(caminar) || caminar > 300) continue;
          output.push({
            ...metro,
            urbana: u,
            saliendo,
            caminataCombinacion: caminar,
            score:
              metro.score +
              caminar +
              Number((saliendo ? u.destino : u.origen).distanciaRuta || 0),
          });
        }
      }
    }
    return output;
  }
  const nombre = (s) =>
    s.description ? `${s.name} · ${s.description}` : s.name;
  const urbanoNombre = (s) =>
    [s.street1, s.street2].filter(Boolean).join(" y ") ||
    `Parada ${s.busstopId}`;
  const metros = (n) => `${Math.round(n)} m aprox. en línea recta`;
  const hora = (t) =>
    new Intl.DateTimeFormat("es-UY", {
      timeZone: "America/Montevideo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(t));
  function render(d, opciones, ctx) {
    opcionesActuales = opciones;
    const esc = DV.escape;
    let html =
      '<section class="metro-results"><h3>Las Piedras–Montevideo · piloto</h3><p class="trip-note">Horarios programados del MTOP; no son llegadas en vivo. Fuente actualizada el ' +
      esc(d.sourceDate) +
      ". Las caminatas por calles pueden ser más largas.</p>";
    if (ctx.fechaLlegadaLimite)
      html +=
        '<p class="trip-note">No podemos confirmar tu hora límite de llegada con estos datos. Las opciones siguientes no están verificadas para ese límite.</p>';
    if (!opciones.length)
      html +=
        "<p>No encontramos un recorrido del piloto a menos de 800 m de ambos extremos, ni una combinación comprobada por recorrido. Esto no confirma que no exista un servicio. Probá elegir una parada concreta.</p>";
    for (const [i, c] of opciones.entries()) {
      const lineas = c.urbana
        ? c.saliendo
          ? `${c.p.line} + ${c.urbana.line}`
          : `${c.urbana.line} + ${c.p.line}`
        : c.p.line;
      const detallesMetro = `<li><strong>${esc(c.p.agency.name)} ${esc(c.p.line)}</strong> · ${esc(c.p.name)}<br>Subí en ${esc(nombre(c.subida))}.<br>Bajá en ${esc(nombre(c.bajada))}.</li>`;
      const detallesUrbano = c.urbana
        ? `<li><strong>Urbano ${esc(c.urbana.line)}</strong> hacia ${esc(c.urbana.destination)}<br>Subí en ${esc(urbanoNombre(c.urbana.origen))}.<br>Bajá en ${esc(urbanoNombre(c.urbana.destino))}.</li>`
        : "";
      const inicio =
        c.urbana && !c.saliendo
          ? Number(c.urbana.origen.distanciaRuta)
          : c.caminataInicio;
      const fin =
        c.urbana && c.saliendo
          ? Number(c.urbana.destino.distanciaRuta)
          : c.caminataFinal;
      html += `<article class="extras-block"><h4>${esc(lineas)} · ${c.urbana ? "1 transbordo" : "Directo"}</h4><p>${c.horario ? `Paso programado del ${esc(c.p.line)} en ${esc(nombre(c.subida))}: <strong>${esc(hora(c.horario.salida))}</strong>.${c.horario.llegada != null ? ` Bajada programada: ${esc(hora(c.horario.llegada))}.` : " Hora en la parada de bajada sin publicar."}` : "El MTOP no publica una próxima hora de paso en esta parada para la fecha consultada. No interpolamos horarios."}</p>${c.urbana ? '<p class="trip-note"><strong>Combinación por recorrido: conexión horaria sin confirmar.</strong> No podemos asegurar que alcances el segundo bus. Consultá el urbano y dejá margen antes de salir.</p>' : ""}<details><summary>Ver pasos y paradas</summary><p>🚶 Desde el origen: ${esc(metros(inicio))}.</p><ol>${c.urbana && !c.saliendo ? detallesUrbano : ""}${c.urbana && !c.saliendo ? `<li>🚶 Combinación: ${esc(metros(c.caminataCombinacion))}.</li>` : ""}${detallesMetro}${c.urbana && c.saliendo ? `<li>🚶 Combinación: ${esc(metros(c.caminataCombinacion))}.</li>${detallesUrbano}` : ""}</ol><p>🚶 Hasta el destino: ${esc(metros(fin))}.</p><button type="button" class="extras-button" data-metro-mapa="${i}">Ver paradas en mapa</button></details></article>`;
    }
    return (
      html +
      '<p class="trip-note">La fuente no incluye excepciones de feriados para este corredor. Confirmá servicios especiales con la empresa. <a href="' +
      esc(d.source) +
      '" target="_blank" rel="noopener">Fuente oficial MTOP</a>.</p></section>'
    );
  }
  async function intentar(origen, destino, ctx) {
    if (!cobertura(origen) && !cobertura(destino)) return null;
    const d = await cargar(),
      ref = new Date(ctx.fechaSalida || Date.now());
    const directos = directas(d, origen, destino, ref);
    const combinadas = await combinar(d, origen, destino, ref);
    const unicas = new Map();
    for (const c of [...directos, ...combinadas]) {
      const k = [
        c.p.agency.name,
        c.p.line,
        c.p.name,
        c.urbana?.line || "",
        c.urbana?.destination || "",
      ].join("|");
      if (!unicas.has(k)) unicas.set(k, c);
    }
    const opciones = [...unicas.values()]
      .sort(
        (a, b) => Number(!!a.urbana) - Number(!!b.urbana) || a.score - b.score,
      )
      .slice(0, 8);
    return render(d, opciones, ctx);
  }
  document.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-metro-mapa]");
    if (!boton) return;
    const c = opcionesActuales[Number(boton.dataset.metroMapa)];
    if (!c) return;
    const points = [
      { ...c.subida, nombre: nombre(c.subida) },
      { ...c.bajada, nombre: nombre(c.bajada) },
    ];
    if (c.urbana)
      for (const s of [c.urbana.origen, c.urbana.destino])
        points.push({
          lat: s.location.coordinates[1],
          lon: s.location.coordinates[0],
          nombre: urbanoNombre(s),
        });
    window.DondeVieneApp.mostrarParadasMetropolitanas(points);
  });
  DV.metro = { intentar, cobertura, directas, proximo, activo, cargar };
})();
