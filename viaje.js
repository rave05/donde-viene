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
      '<ol class="trip-steps">' + pasos + '</ol>' +
      '<p class="trip-note">Las distancias de caminata son en línea recta. El recorrido por calles puede ser más largo. Consultá las llegadas del bus debajo del mapa.</p>' +
      (c.coincidenciaAproximada ? '<p class="trip-note">Confirmá el sentido de la línea antes de subir: esta opción coincide por número de línea.</p>' : '') + '</section>';
  };
})();
