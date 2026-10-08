(() => {
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g,
    caracter => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'}[caracter]));
  const distanciaValida = valor => valor != null && valor !== '' && Number.isFinite(Number(valor)) && Number(valor) >= 0;
  function distancia(valor) {
    if (!distanciaValida(valor)) return 'distancia sin confirmar';
    const metros = Number(valor);
    return metros >= 1000 ? (metros / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(metros) + ' m';
  }
  function parada(p) {
    return [p?.street1, p?.street2].filter(Boolean).join(' y ') || 'Parada ' + (p?.busstopId ?? 'sin confirmar');
  }
  function paso(titulo, detalle, bajada) {
    const coords = bajada?.location?.coordinates || [];
    const lat = Number(coords[1]), lon = Number(coords[0]);
    const valida = coords.length >= 2 && coords[0] != null && coords[1] != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    const datos = bajada ? ' data-bajada-nombre="' + escapar(parada(bajada)) + '"' + (valida ? ' data-bajada-lat="' + lat + '" data-bajada-lon="' + lon + '"' : '') : '';
    return '<li' + datos + '><strong>'  + escapar(titulo) + '</strong><span>' + escapar(detalle) + '</span></li>';
  }
  function bus(linea, sentido, subida, bajada) {
    return paso('🚌 Tomá el ' + linea + (sentido ? ' → ' + sentido : ''),
      (sentido ? 'Buscá en el cartel: ' + sentido + '. ' : 'Confirmá el destino en el cartel antes de subir. ') +
      'Subí en ' + parada(subida) + '. Bajá en ' + parada(bajada) + '.', bajada);
  }
  window.buscarVarianteCompatibleViaje = function(opciones, linea, destino, variantId) {
    const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    const numero = normalizar(linea);
    const mismaLinea = opciones.filter(opcion => normalizar(opcion.line) === numero);
    if (variantId != null && String(variantId).trim()) {
      return mismaLinea.find(opcion => String(opcion.lineVariantId ?? '') === String(variantId)) || null;
    }
    const sentido = normalizar(destino);
    if (!sentido) return null;
    return mismaLinea.find(opcion => normalizar(opcion.destination) === sentido) || null;
  };
  function caminataTotal(c) {
    const tramos = [c.origen?.distanciaRuta, c.destino?.distanciaRuta];
    if (c.line1 && c.line2) {
      const segunda = c.combinacion2 || c.combinacion;
      const misma = c.combinacion?.busstopId != null && String(c.combinacion.busstopId) === String(segunda?.busstopId);
      tramos.push(misma ? 0 : c.caminataCombinacion);
    }
    return tramos.every(distanciaValida) ? tramos.reduce((s, v) => s + Number(v), 0) : Infinity;
  }
  function minutosSalida(c) {
    const p = c.proximaSalida;
    return p?.disponible && Number.isFinite(p.minutos) && p.minutos >= 0 ? p.minutos : Infinity;
  }
  function textoSalida(c) {
    const minutos = minutosSalida(c);
    if (!Number.isFinite(minutos)) return 'Próxima salida sin confirmar';
    return (c.proximaSalida.fuente === 'estimado' ? 'Llegada estimada' : 'Programado') + ' · ' + minutos + ' min hasta la parada de subida';
  }
  function tarjetaSalida(c, contexto) {
    const p = c.proximaSalida;
    const fecha = new Date(p?.fecha);
    if (!Number.isFinite(minutosSalida(c)) || !Number.isFinite(fecha.getTime()) || !['estimado','programado'].includes(p?.fuente) || (contexto.fechaSalida && p.fuente === 'estimado')) return '';
    const estimada = p.fuente === 'estimado';
    const hora = new Intl.DateTimeFormat('es-UY', {timeZone:'America/Montevideo', hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(fecha);
    const etiqueta = estimada ? 'Llegada estimada' : 'Horario programado';
    const nota = estimada ? 'Estimación de la consulta; puede cambiar. Revisá las llegadas actualizadas debajo del mapa.' : 'No es una llegada en vivo. El servicio puede sufrir modificaciones.';
    return '<div class="departure-card" data-source="'+p.fuente+'"><span class="departure-source">'+etiqueta+'</span><strong class="departure-time">'+hora+'</strong><p class="departure-caption">En la parada de subida · '+escapar(parada(c.origen))+'</p><p class="departure-note">'+escapar(window.DV?.fechaTexto(p.fecha) || p.fecha)+' · '+nota+'</p></div>';
  }
  window.ordenarOpcionesViaje = function(opciones, preferencia = 'proximos') {
    const transbordos = c => c.line1 && c.line2 ? 1 : 0;
    return [...opciones].sort((a, b) => {
      const caminar = caminataTotal(a) - caminataTotal(b);
      const combinar = transbordos(a) - transbordos(b);
      const puntaje = (Number(a.puntaje) || 0) - (Number(b.puntaje) || 0);
      if (preferencia === 'proximos') {
        const espera = minutosSalida(a) - minutosSalida(b);
        if (espera) return espera;
      }
      if (preferencia === 'tiempo') {
        const tiempo = (a.tiempo?.disponible ? a.tiempo.total : Infinity) - (b.tiempo?.disponible ? b.tiempo.total : Infinity);
        if (tiempo) return tiempo;
      }
      return preferencia === 'caminar' ? (caminar || combinar || puntaje) : (combinar || caminar || puntaje);
    });
  };
  window.crearTarjetasViaje = function(opciones, preferencia = 'transbordos') {
    return opciones.map((c, indice) => {
      const combinada = Boolean(c.line1 && c.line2);
      const lineas = combinada ? c.line1 + ' + ' + c.line2 : c.line;
      const caminata = caminataTotal(c);
      const recomendacion = indice === 0 ?
        (preferencia === 'caminar' && Number.isFinite(caminata) ? 'Menor caminata entre las opciones encontradas' :
          preferencia === 'transbordos' ? 'Menos transbordos entre las opciones encontradas' : '') : '';
      const sentidos = combinada ?
        c.line1 + (c.destination1 ? ' → ' + c.destination1 : '') + ' · ' + c.line2 + (c.destination2 ? ' → ' + c.destination2 : '') :
        (c.destination ? 'Hacia ' + c.destination : 'Confirmá el sentido antes de subir');
      return '<button type="button" class="route-result route-result-button" data-route-index="' + indice + '">' +
        (recomendacion ? '<span class="trip-recommendation">' + escapar(recomendacion) + '</span>' : '') +
        '<div class="route-line">🚌 ' + escapar(lineas) + '</div>' +
        '<div class="route-meta">' + escapar(sentidos) + '</div>' +
        '<div class="trip-option-metrics">' + (combinada ? '1 transbordo' : 'Sin transbordos') + ' · 🚶 ' +
          (Number.isFinite(caminata) ? distancia(caminata) + ' en total aprox.' : 'Caminata sin confirmar') + '</div>' +
        '<div><strong>Subí en:</strong> ' + escapar(parada(c.origen)) + '</div>' +
        (combinada ? '<div><strong>Combiná en:</strong> ' + escapar(parada(c.combinacion)) +
          (c.combinacion2 && String(c.combinacion2.busstopId) !== String(c.combinacion?.busstopId) ?
            ' · Caminá ' + distancia(c.caminataCombinacion) + ' hasta ' + escapar(parada(c.combinacion2)) : '') + '</div>' : '') +
        '<div><strong>Bajá en:</strong> ' + escapar(parada(c.destino)) + '</div>' +
        (c.coincidenciaAproximada ? '<div class="route-meta">Confirmá el sentido: coincidencia por número de línea.</div>' : '') +
        '<div class="route-result-action">Ver viaje paso a paso →</div></button>';
    }).join('');
  };
  window.crearResumenViaje = function(c, contexto = {}) {
    if (!c?.origen || !c?.destino) return '';
    const combinada = Boolean(c.line1 && c.line2);
    const caminatas = [c.origen.distanciaRuta, c.destino.distanciaRuta];
    let pasos = paso('🚶 Llegá a la parada de subida',
      parada(c.origen) + ' · ' + distancia(c.origen.distanciaRuta) + ' desde el origen.');
    if (combinada) {
      pasos += bus(c.line1, c.destination1, c.origen, c.combinacion);
      const segunda = c.combinacion2 || c.combinacion;
      const misma = c.combinacion?.busstopId != null && String(c.combinacion.busstopId) === String(segunda?.busstopId);
      if (misma) {
        pasos += paso('🔁 Hacé la combinación en la misma parada', 'Esperá el ' + c.line2 + ' en ' + parada(segunda) + '.');
      } else {
        pasos += paso('🚶 Caminá a la parada de la combinación',
          'Desde ' + parada(c.combinacion) + ' hasta ' + parada(segunda) + ' · ' + distancia(c.caminataCombinacion) + '.');
      }
      caminatas.push(misma ? 0 : c.caminataCombinacion);
      pasos += bus(c.line2, c.destination2, segunda, c.destino);
    } else {
      pasos += bus(c.line, c.destination, c.origen, c.destino);
    }
    pasos += paso('🚶 Llegá a tu destino', distancia(c.destino.distanciaRuta) + ' desde la parada de bajada hasta ' + (contexto.destino || 'el destino') + '.');
    const total = caminatas.every(distanciaValida) ? caminatas.reduce((s, v) => s + Number(v), 0) : null;
    const calles = c.caminos?.length && c.caminos.every(t => t.tipo === 'calles');
    const titulo = combinada ? c.line1 + ' + ' + c.line2 + ' · 1 transbordo' : c.line + ' · Sin transbordos';
    const coordenadas = c.destino.location?.coordinates || [];
    const lat = Number(coordenadas[1]), lon = Number(coordenadas[0]);
    const destinoGPS = coordenadas.length >= 2 && Number.isFinite(lat) && Number.isFinite(lon) ? ' data-bajada-lat="' + lat + '" data-bajada-lon="' + lon + '"' : '';
    return '<section class="trip-summary" aria-labelledby="tituloResumenViaje"' + destinoGPS + '>' +
      '<div class="trip-heading"><div><span class="trip-eyebrow">Tu viaje elegido</span><h3 id="tituloResumenViaje">' + escapar(titulo) + '</h3></div>' +
      '<button type="button" class="trip-change" id="btnAlternativasViaje">Cambiar ruta</button></div>' +
      '<p class="trip-endpoints">' + escapar(contexto.origen || 'Origen') + ' → ' + escapar(contexto.destino || 'Destino') + '</p>' +
      tarjetaSalida(c, contexto) +
      (total != null ? '<p class="trip-walking">🚶 Caminata total aproximada: <strong>' + distancia(total) + '</strong></p>' : '') +
      (contexto.fechaSalida ? '<p class="trip-note">🕒 Salida planificada: ' + escapar(window.DV?.fechaTexto(contexto.fechaSalida) || contexto.fechaSalida) + '</p>' : '') +
      (c.tiempo?.disponible ? '<p class="trip-time">Tiempo total orientativo: ' + c.tiempo.min + '–' + c.tiempo.max + ' min</p><details class="trip-time-detail"><summary>Ver estimación del tiempo</summary><p>Caminata: ' + c.tiempo.caminata + ' min aprox.</p><ul>' + c.tiempo.partes.map(t => '<li>' + escapar(t.linea) + ': espera programada ' + t.espera + ' min + recorrido orientativo ' + t.recorrido + ' min.</li>').join('') + '</ul><p>No es una ETA en vivo. La espera puede cambiar y el recorrido no incluye el tránsito actual.</p></details>' : c.tiempo ? '<p class="trip-note">Tiempo total sin confirmar para esta hora.</p>' : '') +
      '<button type="button" class="trip-start" id="btnEmpezarViaje">Empezar viaje</button><p class="trip-guide-note" id="estadoGuiaViaje" role="status" hidden></p>' +
      '<details class="trip-detail"><summary><span class="trip-detail-closed">Ver pasos y caminatas</span><span class="trip-detail-open">Ocultar pasos y caminatas</span></summary>' +
      '<ol class="trip-steps">' + pasos + '</ol>' +
      '<p class="trip-note">' + (calles ? 'Caminatas orientativas por calles. Confirmá accesos y cruces; respetá la señalización.' : 'Uno o más tramos son en línea recta: el trayecto por calles puede ser más largo.') + ' Consultá las llegadas del bus debajo del mapa.</p></details>' +
      (c.coincidenciaAproximada ? '<p class="trip-note">Confirmá el sentido de la línea antes de subir: esta opción coincide por número de línea.</p>' : '') + '</section>';
  };
  window.agruparOpcionesViaje = function(opciones) {
    const grupos = new Map();
    const numero = valor => String(valor ?? '').trim().toUpperCase();
    for (const c of opciones) {
      const lineas = c.line1 && c.line2 ? [numero(c.line1), numero(c.line2)] : [numero(c.line)];
      const clave = JSON.stringify(lineas);
      if (!grupos.has(clave)) grupos.set(clave, { lineas, opciones: [] });
      grupos.get(clave).opciones.push(c);
    }
    return [...grupos.values()];
  };
  window.crearSelectorViajesAgrupados = function(grupos, preferencia = 'proximos') {
    const candidatos = [];
    const html = grupos.map((grupo, numeroGrupo) => {
      const variantes = grupo.opciones;
      const repetidas = grupo.lineas.map(linea => variantes.map(() => linea).join('/')).join(' + ');
      const distancias = variantes.map(caminataTotal).filter(Number.isFinite);
      const caminata = distancias.length ? (variantes.length > 1 ? 'Desde ' : '') + distancia(Math.min(...distancias)) + ' de caminata aprox.' : 'Caminata sin confirmar';
      const transbordos = grupo.lineas.length > 1 ? '1 transbordo' : 'Sin transbordos';
      const recomendacion = numeroGrupo === 0 ?
        (preferencia === 'caminar' && distancias.length ? 'Menor caminata encontrada' :
          preferencia === 'transbordos' ? 'Menos transbordos' : preferencia === 'proximos' && variantes.some(c => Number.isFinite(minutosSalida(c))) ? 'Bus más próximo entre opciones con datos' : preferencia === 'tiempo' && variantes.some(c => c.tiempo?.disponible) ? 'Menor tiempo entre opciones estimadas' : '') : '';
      function opcion(c, indiceVariante) {
        const indice = candidatos.push(c) - 1;
        const sentidos = c.line1 && c.line2 ?
          c.line1 + (c.destination1 ? ' → ' + c.destination1 : '') + ' · ' + c.line2 + (c.destination2 ? ' → ' + c.destination2 : '') :
          (c.destination ? 'Sentido: hacia ' + c.destination : 'Sentido sin confirmar');
        const total = caminataTotal(c);
        return '<button type="button" class="route-result-button trip-variant' + (variantes.length === 1 ? ' trip-single route-result' : '') + '" data-route-index="' + indice + '">' +
          (variantes.length === 1 && recomendacion ? '<span class="trip-recommendation">' + escapar(recomendacion) + '</span>' : '') +
          '<span class="trip-group-title">' + (variantes.length > 1 ? 'Variante ' + (indiceVariante + 1) : '🚌 ' + escapar(repetidas)) + '</span>' +
          '<span class="trip-variant-direction">' + escapar(sentidos) + '</span>' +
          '<span class="trip-group-metrics">' + transbordos + ' · 🚶 ' + (Number.isFinite(total) ? distancia(total) + ' aprox.' : 'Caminata sin confirmar') + '</span>' +
          '<span class="trip-group-metrics">🕒 ' + escapar(textoSalida(c)) + '</span>' +
          (c.tiempo?.disponible ? '<span class="trip-group-metrics">🕒 ' + c.tiempo.min + '–' + c.tiempo.max + ' min orientativos</span>' : '<span class="trip-variant-stops">Tiempo total sin confirmar</span>') +
          (variantes.length > 1 ? '<span class="trip-variant-stops">Subí: ' + escapar(parada(c.origen)) + ' · Bajá: ' + escapar(parada(c.destino)) +
            (c.line1 && c.line2 ? ' · Combiná: ' + escapar(parada(c.combinacion)) +
              (c.combinacion2 && String(c.combinacion2.busstopId) !== String(c.combinacion?.busstopId) ? ' → ' + escapar(parada(c.combinacion2)) : '') : '') + '</span>' : '') +
          (c.coincidenciaAproximada ? '<span class="trip-variant-stops">Confirmá el sentido antes de subir.</span>' : '') +
          '<span class="trip-variant-action">' + (variantes.length > 1 ? 'Elegir esta variante' : 'Ver viaje paso a paso') + ' →</span></button>';
      }
      if (variantes.length === 1) return opcion(variantes[0], 0);
      return '<details class="route-result trip-route-group"><summary>' +
        (recomendacion ? '<span class="trip-recommendation">' + escapar(recomendacion) + '</span>' : '') +
        '<span class="trip-group-title">🚌 ' + escapar(repetidas) + '</span>' +
        '<span class="trip-group-metrics">' + transbordos + ' · 🚶 ' + caminata + '</span>' +
        '<span class="trip-group-metrics">🕒 ' + escapar(textoSalida(variantes[0])) + '</span>' +
        '<span class="trip-variant-action">' + variantes.length + ' variantes · Elegir variante</span></summary>' +
        '<div class="trip-variants">' + variantes.map(opcion).join('') + '</div></details>';
    }).join('');
    return { html, candidatos };
  };
})();
