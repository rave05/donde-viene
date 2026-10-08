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
  function paso(titulo, detalle) {
    return '<li><strong>' + escapar(titulo) + '</strong><span>' + escapar(detalle) + '</span></li>';
  }
  function bus(linea, sentido, subida, bajada) {
    return paso('🚌 Tomá el ' + linea + (sentido ? ' → ' + sentido : ''),
      'Subí en ' + parada(subida) + '. Bajá en ' + parada(bajada) + '.');
  }
  function caminataTotal(c) {
    const tramos = [c.origen?.distanciaRuta, c.destino?.distanciaRuta];
    if (c.line1 && c.line2) {
      const segunda = c.combinacion2 || c.combinacion;
      const misma = c.combinacion?.busstopId != null && String(c.combinacion.busstopId) === String(segunda?.busstopId);
      tramos.push(misma ? 0 : c.caminataCombinacion);
    }
    return tramos.every(distanciaValida) ? tramos.reduce((s, v) => s + Number(v), 0) : Infinity;
  }
  window.ordenarOpcionesViaje = function(opciones, preferencia = 'transbordos') {
    const transbordos = c => c.line1 && c.line2 ? 1 : 0;
    return [...opciones].sort((a, b) => {
      const caminar = caminataTotal(a) - caminataTotal(b);
      const combinar = transbordos(a) - transbordos(b);
      const puntaje = (Number(a.puntaje) || 0) - (Number(b.puntaje) || 0);
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
    const titulo = combinada ? c.line1 + ' + ' + c.line2 + ' · 1 transbordo' : c.line + ' · Sin transbordos';
    return '<section class="trip-summary" aria-labelledby="tituloResumenViaje">' +
      '<div class="trip-heading"><div><span class="trip-eyebrow">Tu viaje elegido</span><h3 id="tituloResumenViaje">' + escapar(titulo) + '</h3></div>' +
      '<button type="button" class="trip-change" id="btnAlternativasViaje">Cambiar ruta</button></div>' +
      '<p class="trip-endpoints">' + escapar(contexto.origen || 'Origen') + ' → ' + escapar(contexto.destino || 'Destino') + '</p>' +
      (total != null ? '<p class="trip-walking">🚶 Caminata total aproximada: <strong>' + distancia(total) + '</strong></p>' : '') +
      '<button type="button" class="trip-start" id="btnEmpezarViaje">Empezar viaje</button><p class="trip-guide-note" id="estadoGuiaViaje" role="status" hidden></p>' +
      '<details class="trip-detail"><summary><span class="trip-detail-closed">Ver pasos y caminatas</span><span class="trip-detail-open">Ocultar pasos y caminatas</span></summary>' +
      '<ol class="trip-steps">' + pasos + '</ol>' +
      '<p class="trip-note">Las distancias de caminata son en línea recta. El recorrido por calles puede ser más largo. Consultá las llegadas del bus debajo del mapa.</p></details>' +
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
  window.crearSelectorViajesAgrupados = function(grupos, preferencia = 'transbordos') {
    const candidatos = [];
    const html = grupos.map((grupo, numeroGrupo) => {
      const variantes = grupo.opciones;
      const repetidas = grupo.lineas.map(linea => variantes.map(() => linea).join('/')).join(' + ');
      const distancias = variantes.map(caminataTotal).filter(Number.isFinite);
      const caminata = distancias.length ? (variantes.length > 1 ? 'Desde ' : '') + distancia(Math.min(...distancias)) + ' de caminata aprox.' : 'Caminata sin confirmar';
      const transbordos = grupo.lineas.length > 1 ? '1 transbordo' : 'Sin transbordos';
      const recomendacion = numeroGrupo === 0 ?
        (preferencia === 'caminar' && distancias.length ? 'Menor caminata encontrada' :
          preferencia === 'transbordos' ? 'Menos transbordos' : '') : '';
      function opcion(c, indiceVariante) {
        const indice = candidatos.push(c) - 1;
        const sentidos = c.line1 && c.line2 ?
          c.line1 + (c.destination1 ? ' → ' + c.destination1 : '') + ' · ' + c.line2 + (c.destination2 ? ' → ' + c.destination2 : '') :
          (c.destination ? 'Hacia ' + c.destination : 'Sentido sin confirmar');
        const total = caminataTotal(c);
        return '<button type="button" class="route-result-button trip-variant' + (variantes.length === 1 ? ' trip-single route-result' : '') + '" data-route-index="' + indice + '">' +
          (variantes.length === 1 && recomendacion ? '<span class="trip-recommendation">' + escapar(recomendacion) + '</span>' : '') +
          '<span class="trip-group-title">' + (variantes.length > 1 ? 'Variante ' + (indiceVariante + 1) : '🚌 ' + escapar(repetidas)) + '</span>' +
          '<span class="trip-variant-direction">' + escapar(sentidos) + '</span>' +
          '<span class="trip-group-metrics">' + transbordos + ' · 🚶 ' + (Number.isFinite(total) ? distancia(total) + ' aprox.' : 'Caminata sin confirmar') + '</span>' +
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
        '<span class="trip-variant-action">' + variantes.length + ' variantes · Elegir variante</span></summary>' +
        '<div class="trip-variants">' + variantes.map(opcion).join('') + '</div></details>';
    }).join('');
    return { html, candidatos };
  };
})();
