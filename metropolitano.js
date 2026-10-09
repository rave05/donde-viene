/* Piloto MTOP: secuencias de paradas y horas publicadas; sin interpolar ni consultar IDs MTOP en la API urbana. */
(() => {
  const DV = window.DV;
  let pendiente,
    versionMapa = 0,
    shapesPendientes;
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
  function adaptar(d, c, ctx) {
    const paradaMetro = (s, distanciaRuta) => ({
      busstopId: s.id, street1: nombre(s), street2: "",
      location: {coordinates:[s.lon,s.lat]}, distanciaRuta
    });
    const metroOrigen = paradaMetro(c.subida,c.caminataInicio);
    const metroDestino = paradaMetro(c.bajada,c.caminataFinal);
    const raw = {...c, p:{routeId:c.p.routeId,line:c.p.line,name:c.p.name,agency:c.p.agency}};
    const base = {puntaje:c.score, metropolitana:{opcion:raw,source:d.source,sourceDate:d.sourceDate}, tiempo:{disponible:false}};
    let candidato;
    if (!c.urbana) candidato = {...base,line:c.p.line,destination:c.p.name,origen:metroOrigen,destino:metroDestino};
    else if(c.saliendo) candidato = {...base,line1:c.p.line,destination1:c.p.name,line2:c.urbana.line,destination2:c.urbana.destination,
      origen:metroOrigen,combinacion:metroDestino,combinacion2:c.urbana.origen,destino:c.urbana.destino,caminataCombinacion:c.caminataCombinacion};
    else candidato = {...base,line1:c.urbana.line,destination1:c.urbana.destination,line2:c.p.line,destination2:c.p.name,
      origen:c.urbana.origen,combinacion:c.urbana.destino,combinacion2:metroOrigen,destino:metroDestino,caminataCombinacion:c.caminataCombinacion};
    if(c.horario && (!c.urbana || c.saliendo)) candidato.proximaSalida = {
      disponible:true,fuente:"programado",fecha:new Date(c.horario.salida).toISOString(),
      minutos:Math.max(0,Math.ceil((c.horario.salida-new Date(ctx.fechaSalida||Date.now()).getTime())/60000))
    };
    return candidato;
  }
  function nota(c, ctx) {
    const m=c.metropolitana, raw=m.opcion, esc=DV.escape;
    let html='<p class="trip-note">Horarios programados del MTOP; no son llegadas en vivo. Fuente actualizada el '+esc(m.sourceDate)+'.</p>';
    if(raw.horario) html+='<p class="trip-note">Paso programado del '+esc(raw.p.line)+' en '+esc(nombre(raw.subida))+': <strong>'+esc(hora(raw.horario.salida))+'</strong>.'+
      (raw.horario.llegada!=null?' Bajada programada: '+esc(hora(raw.horario.llegada))+'.':' Hora en la parada de bajada sin publicar.')+'</p>';
    else html+='<p class="trip-note">El MTOP no publica una próxima hora de paso en esta parada para la fecha consultada. No interpolamos horarios.</p>';
    if(raw.urbana) html+='<p class="trip-note"><strong>Combinación por recorrido: conexión horaria sin confirmar.</strong> No podemos asegurar que alcances el segundo bus.</p>';
    if(ctx.fechaLlegadaLimite) html+='<p class="trip-note">No podemos confirmar tu hora límite de llegada con estos datos. Las opciones no están verificadas para ese límite.</p>';
    return html+'<p class="trip-note">Confirmá servicios especiales y feriados con la empresa. <a href="'+esc(m.source)+'" target="_blank" rel="noopener">Fuente oficial MTOP</a>.</p>';
  }
  function render(d, opciones, ctx) {
    const candidatos=window.ordenarOpcionesViaje(opciones.map(c=>adaptar(d,c,ctx)),ctx.preferencia);
    const selector=window.crearSelectorViajesAgrupados(window.agruparOpcionesViaje(candidatos),ctx.preferencia);
    const advertencia='<p class="trip-note">Horarios programados del MTOP; no son llegadas en vivo. Combinación por recorrido: conexión horaria sin confirmar.</p>'+
      (ctx.fechaLlegadaLimite?'<p class="trip-note">Las opciones no están verificadas para ese límite de llegada.</p>':"");
    return {candidatos:selector.candidatos,html:advertencia+selector.html+(candidatos.length?"":'<p class="route-empty">No encontramos una opción del piloto cerca de ambos extremos ni una combinación comprobada por recorrido. Probá elegir una parada concreta.</p>')};
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
  async function tramoMetro(c) {
    if (!shapesPendientes)
      shapesPendientes = fetch("./metropolitano/shapes.json", {
        cache: "no-cache",
        signal: AbortSignal.timeout(12000),
      })
        .then((r) => {
          if (!r.ok) throw Error("Geometrías no disponibles");
          return r.json();
        })
        .catch((e) => {
          shapesPendientes = null;
          throw e;
        });
    const data = await shapesPendientes,
      shape = data.shapes[c.p.routeId];
    if (!shape) return null;
    const nearest = (s) =>
      shape.reduce(
        (best, point, i) =>
          distancia(s, { lat: point[0], lon: point[1] }) <
          distancia(s, { lat: shape[best][0], lon: shape[best][1] })
            ? i
            : best,
        0,
      );
    const a = nearest(c.subida),
      b = nearest(c.bajada);
    if (
      a >= b ||
      distancia(c.subida, { lat: shape[a][0], lon: shape[a][1] }) > 250 ||
      distancia(c.bajada, { lat: shape[b][0], lon: shape[b][1] }) > 250
    )
      return null;
    return shape.slice(a, b + 1);
  }
  async function paradasTramo(candidato) {
    const raw=candidato.metropolitana?.opcion; if(!raw)return [];
    const d=await cargar(), a=raw.subida.id.replace('mtop:',''), b=raw.bajada.id.replace('mtop:','');
    const p=d.patterns.find(p=>p.routeId===raw.p.routeId && p.stops.indexOf(a)>=0 && p.stops.indexOf(b)>p.stops.indexOf(a));
    if(!p)return [];
    return p.stops.slice(p.stops.indexOf(a),p.stops.indexOf(b)+1).map((id,n)=>({id:'mtop:'+id,nombre:nombre(d.stops[id]),lat:d.stops[id].lat,lon:d.stops[id].lon,posicion:n}));
  }
  async function seleccionar(candidato, ctx) {
    const version=++versionMapa, c=candidato.metropolitana.opcion;
    window.limpiarRecorridoSeleccionado?.();
    const resultados=await Promise.allSettled([tramoMetro(c),c.urbana && window.obtenerTramoLineaViaje ?
      window.obtenerTramoLineaViaje(c.urbana.line,c.urbana.destination,c.urbana.origen,c.urbana.destino) : Promise.resolve(null)]);
    if(version!==versionMapa) return false;
    const shapes=resultados.map(r=>r.status==="fulfilled"?r.value:null);
    const tramos=c.urbana?(c.saliendo?[shapes[0],shapes[1]]:[shapes[1],shapes[0]]):[shapes[0]];
    window.dibujarViajeConGeometrias(candidato,ctx,tramos);
    const estado=document.querySelector("[data-metro-estado]");
    if(estado) estado.textContent=tramos.every(t=>t?.length>1)?"Recorrido visible en el mapa. El metropolitano no tiene seguimiento del bus en vivo.":"Mostramos las paradas y los tramos disponibles. Una geometría oficial no pudo cargarse; podés volver a elegir la ruta para reintentar.";
    // La misma capa de caminatas por calles que usa el viaje urbano.
    if(DV.caminatas) {
      const caminos=await DV.caminatas.paraViaje(candidato,ctx);
      if(version!==versionMapa) return false;
      candidato.caminos=caminos;
      window.DondeVieneApp.dibujarCaminatas(caminos);
    }
    return version===versionMapa;
  }
  window.addEventListener("donde-viene:viaje-cambio",()=>{versionMapa++;});
  DV.metro={intentar,cobertura,directas,proximo,activo,cargar,tramoMetro,adaptar,nota,seleccionar,paradasTramo};
})();
