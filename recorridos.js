(() => {
  const cacheRecorridos = new Map();
  let manifiestoRecorridos = null;
  let aliasesRecorridos = null;
  let redRecorridos = null;
  let lineaRecorridoMapa = null;
  let haloRecorridoMapa = null;
  let marcadorInicioRecorrido = null;
  let marcadorFinRecorrido = null;
  let capasCombinacion = [];

  async function cargarManifiestoRecorridos() {
    if (manifiestoRecorridos) {
      return manifiestoRecorridos;
    }

    const respuesta = await fetch(
      './recorridos/manifest.json',
      { cache: 'no-cache' }
    );

    if (!respuesta.ok) {
      return null;
    }

    manifiestoRecorridos = await respuesta.json();
    return manifiestoRecorridos;
  }

  async function cargarAliasesRecorridos() {
    if (aliasesRecorridos) {
      return aliasesRecorridos;
    }

    try {
      const respuesta =
        await fetch(
          './recorridos/aliases.json',
          { cache: 'no-cache' }
        );

      if (!respuesta.ok) {
        return null;
      }

      aliasesRecorridos =
        await respuesta.json();

      return aliasesRecorridos;
    } catch (error) {
      return null;
    }
  }

  function clavesCompatiblesParada(stopId) {
    const clave = String(stopId || '');
    const claves = new Set([clave]);

    const alias =
      aliasesRecorridos?.toAlias?.[clave];

    const id =
      aliasesRecorridos?.toId?.[clave];

    if (alias) {
      claves.add(String(alias));
    }

    if (id) {
      claves.add(String(id));
    }

    return claves;
  }

  function indiceParadaCompatible(stops, stopId) {
    const claves =
      clavesCompatiblesParada(stopId);

    return stops.findIndex(stop =>
      claves.has(String(stop))
    );
  }

  async function cargarRedRecorridos() {
    if (redRecorridos) {
      return redRecorridos;
    }

    try {
      const respuesta =
        await fetch(
          './recorridos/red.json',
          { cache: 'no-cache' }
        );

      if (!respuesta.ok) {
        return null;
      }

      redRecorridos =
        await respuesta.json();

      return redRecorridos;
    } catch (error) {
      console.warn(
        'No se pudo cargar la red global de recorridos:',
        error
      );
      return null;
    }
  }


  async function cargarRecorridoLinea(linea) {
    const clave = String(linea);

    if (cacheRecorridos.has(clave)) {
      return cacheRecorridos.get(clave);
    }

    const manifiesto = await cargarManifiestoRecorridos();
    const archivo = manifiesto?.lines?.[clave];

    if (!archivo) {
      return null;
    }

    const respuesta = await fetch(
      './recorridos/' + archivo,
      { cache: 'no-cache' }
    );

    if (!respuesta.ok) {
      return null;
    }

    const datos = await respuesta.json();
    cacheRecorridos.set(clave, datos);
    return datos;
  }

  function distanciaSimple(lat1, lon1, lat2, lon2) {
    const dLat = Number(lat1) - Number(lat2);
    const dLon = Number(lon1) - Number(lon2);

    return dLat * dLat + dLon * dLon;
  }

  function indiceShapeMasCercano(shape, lat, lon) {
    let mejorIndice = -1;
    let mejorDistancia = Infinity;

    for (let i = 0; i < shape.length; i++) {
      const punto = shape[i];
      const distancia =
        distanciaSimple(
          punto[0],
          punto[1],
          lat,
          lon
        );

      if (distancia < mejorDistancia) {
        mejorDistancia = distancia;
        mejorIndice = i;
      }
    }

    return mejorIndice;
  }

  function normalizar(valor = '') {
    return String(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  window.limpiarRecorridoSeleccionado = function() {
    if (lineaRecorridoMapa) {
      mapa.removeLayer(lineaRecorridoMapa);
      lineaRecorridoMapa = null;
    }

    if (haloRecorridoMapa) {
      mapa.removeLayer(haloRecorridoMapa);
      haloRecorridoMapa = null;
    }

    if (marcadorInicioRecorrido) {
      mapa.removeLayer(marcadorInicioRecorrido);
      marcadorInicioRecorrido = null;
    }

    if (marcadorFinRecorrido) {
      mapa.removeLayer(marcadorFinRecorrido);
      marcadorFinRecorrido = null;
    }

    for (const capa of capasCombinacion) {
      mapa.removeLayer(capa);
    }

    capasCombinacion = [];
  };

  window.dibujarRecorridoSeleccionado = async function(candidato) {
    try {
      window.limpiarRecorridoSeleccionado();
      await cargarAliasesRecorridos();

      if (
        !candidato?.line ||
        !candidato?.origen?.busstopId ||
        !candidato?.destino?.busstopId
      ) {
        return false;
      }

      const datos =
        await cargarRecorridoLinea(candidato.line);

      const patrones =
        Array.isArray(datos?.patterns)
          ? datos.patterns
          : [];

      if (!patrones.length) {
        return false;
      }

      const origenId =
        String(
          candidato.origen.gtfsStopId ||
          candidato.origen.busstopId
        );

      const destinoId =
        String(
          candidato.destino.gtfsStopId ||
          candidato.destino.busstopId
        );

      const destinoObjetivo =
        normalizar(candidato.destination);

      const origenCoords =
        candidato.origen.location?.coordinates;

      const destinoCoords =
        candidato.destino.location?.coordinates;

      if (
        !Array.isArray(origenCoords) ||
        !Array.isArray(destinoCoords)
      ) {
        return false;
      }

      let compatibles =
        patrones.filter(patron => {
          const paradas =
            Array.isArray(patron.stops)
              ? patron.stops.map(String)
              : [];

          const iOrigen =
            indiceParadaCompatible(paradas, origenId);

          const iDestino =
            indiceParadaCompatible(paradas, destinoId);

          return (
            iOrigen >= 0 &&
            iDestino >= 0 &&
            iOrigen !== iDestino &&
            Array.isArray(patron.shape) &&
            patron.shape.length >= 2
          );
        });

      if (destinoObjetivo && compatibles.length) {
        const porDestino =
          compatibles.filter(patron => {
            const n =
              normalizar(patron.destination);

            return (
              n === destinoObjetivo ||
              n.includes(destinoObjetivo) ||
              destinoObjetivo.includes(n)
            );
          });

        if (porDestino.length) {
          compatibles = porDestino;
        }
      }

      let patron =
        compatibles[0];

      // Fallback importante: en algunas rutas programadas el identificador
      // de parada usado por la app no coincide exactamente con el stop_id
      // guardado en el patrón. En ese caso elegimos el shape de la misma
      // línea que pasa más cerca de las dos paradas.
      if (!patron) {
        const candidatosShape =
          patrones
            .filter(p =>
              Array.isArray(p.shape) &&
              p.shape.length >= 2
            )
            .map(p => {
              const iOrigenShape =
                indiceShapeMasCercano(
                  p.shape,
                  Number(origenCoords[1]),
                  Number(origenCoords[0])
                );

              const iDestinoShape =
                indiceShapeMasCercano(
                  p.shape,
                  Number(destinoCoords[1]),
                  Number(destinoCoords[0])
                );

              if (
                iOrigenShape < 0 ||
                iDestinoShape < 0 ||
                iOrigenShape === iDestinoShape
              ) {
                return null;
              }

              const po = p.shape[iOrigenShape];
              const pd = p.shape[iDestinoShape];

              let puntaje =
                distanciaSimple(
                  po[0],
                  po[1],
                  Number(origenCoords[1]),
                  Number(origenCoords[0])
                ) +
                distanciaSimple(
                  pd[0],
                  pd[1],
                  Number(destinoCoords[1]),
                  Number(destinoCoords[0])
                );

              if (
                destinoObjetivo &&
                normalizar(p.destination) === destinoObjetivo
              ) {
                puntaje *= 0.5;
              }

              return {
                patron: p,
                puntaje
              };
            })
            .filter(Boolean)
            .sort((a, b) =>
              a.puntaje - b.puntaje
            );

        patron =
          candidatosShape[0]?.patron;
      }

      if (!patron) {
        return false;
      }

      const shape = patron.shape;

      const iShapeOrigen =
        indiceShapeMasCercano(
          shape,
          Number(origenCoords[1]),
          Number(origenCoords[0])
        );

      const iShapeDestino =
        indiceShapeMasCercano(
          shape,
          Number(destinoCoords[1]),
          Number(destinoCoords[0])
        );

      if (
        iShapeOrigen < 0 ||
        iShapeDestino < 0 ||
        iShapeOrigen === iShapeDestino
      ) {
        return false;
      }

      let tramo;

      if (iShapeOrigen < iShapeDestino) {
        tramo =
          shape.slice(
            iShapeOrigen,
            iShapeDestino + 1
          );
      } else {
        tramo =
          shape
            .slice(
              iShapeDestino,
              iShapeOrigen + 1
            )
            .reverse();
      }

      if (tramo.length < 2) {
        return false;
      }

      // Halo exterior para que el recorrido se lea bien
      // incluso sobre calles y avenidas del mapa base.
      haloRecorridoMapa =
        L.polyline(
          tramo,
          {
            color: '#ffffff',
            weight: 11,
            opacity: 0.92,
            lineCap: 'round',
            lineJoin: 'round'
          }
        )
        .addTo(mapa);

      lineaRecorridoMapa =
        L.polyline(
          tramo,
          {
            color: '#1769e0',
            weight: 7,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          }
        )
        .addTo(mapa);

      const iconoSubir =
        L.divIcon({
          className: '',
          html:
            '<div style="' +
              'background:#18a66a;' +
              'color:#fff;' +
              'border:3px solid #fff;' +
              'box-shadow:0 3px 10px rgba(0,0,0,.28);' +
              'border-radius:999px;' +
              'padding:5px 9px;' +
              'font:700 11px/1.1 system-ui,sans-serif;' +
              'white-space:nowrap;' +
            '">SUBIR</div>',
          iconSize: [58, 28],
          iconAnchor: [29, 14]
        });

      const iconoBajar =
        L.divIcon({
          className: '',
          html:
            '<div style="' +
              'background:#e54b4b;' +
              'color:#fff;' +
              'border:3px solid #fff;' +
              'box-shadow:0 3px 10px rgba(0,0,0,.28);' +
              'border-radius:999px;' +
              'padding:5px 9px;' +
              'font:700 11px/1.1 system-ui,sans-serif;' +
              'white-space:nowrap;' +
            '">BAJAR</div>',
          iconSize: [62, 28],
          iconAnchor: [31, 14]
        });

      marcadorInicioRecorrido =
        L.marker(
          tramo[0],
          {
            icon: iconoSubir,
            zIndexOffset: 2200
          }
        )
        .addTo(mapa);

      marcadorFinRecorrido =
        L.marker(
          tramo[tramo.length - 1],
          {
            icon: iconoBajar,
            zIndexOffset: 2200
          }
        )
        .addTo(mapa);

      const boundsRecorrido =
        lineaRecorridoMapa.getBounds();

      mapa.fitBounds(
        boundsRecorrido,
        {
          paddingTopLeft: [40, 55],
          paddingBottomRight: [40, 55],
          maxZoom: 16,
          animate: true
        }
      );

      return true;

    } catch (error) {
      console.warn(
        'No se pudo dibujar el recorrido seleccionado:',
        error
      );
      return false;
    }
  };

  function buscarParadaGlobal(stopId) {
    const claves =
      clavesCompatiblesParada(stopId);

    const encontrada =
      Array.isArray(window.todasLasParadas)
        ? window.todasLasParadas.find(
            parada =>
              claves.has(
                String(parada?.busstopId)
              )
          )
        : null;

    if (encontrada) {
      return {
        ...encontrada,
        gtfsStopId: String(stopId)
      };
    }

    const punto =
      redRecorridos?.coords?.[String(stopId)];

    if (
      Array.isArray(punto) &&
      punto.length >= 2
    ) {
      return {
        busstopId: String(stopId),
        gtfsStopId: String(stopId),
        street1: 'Parada GTFS',
        street2: '',
        location: {
          type: 'Point',
          coordinates: [
            Number(punto[1]),
            Number(punto[0])
          ]
        }
      };
    }

    return null;
  }

  async function opcionesLineasPorParadas(paradas, maxOpciones = 60) {
    const opciones = [];
    const vistas = new Set();

    for (const parada of paradas.slice(0, 40)) {
      const lineas =
        typeof window.obtenerLineasProgramadas === 'function'
          ? await window.obtenerLineasProgramadas(parada.busstopId)
          : [];

      for (const linea of lineas || []) {
        const numero =
          String(linea?.line || '');

        const destino =
          String(linea?.destination || '');

        const stopId =
          String(parada?.busstopId || '');

        // No deduplicamos solo por número de línea: una misma línea puede
        // aparecer en varias paradas cercanas y en sentidos distintos.
        // Para combinaciones necesitamos conservar esas alternativas.
        const clave =
          numero + '|' +
          destino + '|' +
          stopId;

        if (
          !numero ||
          !stopId ||
          vistas.has(clave)
        ) {
          continue;
        }

        vistas.add(clave);

        opciones.push({
          line: numero,
          destination: destino,
          parada
        });

        if (opciones.length >= maxOpciones) {
          return opciones;
        }
      }
    }

    return opciones;
  }

    function distanciaMetrosPuntos(
    lat1,
    lon1,
    lat2,
    lon2
  ) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (Number(lat2) - Number(lat1)) * rad;
    const dLon = (Number(lon2) - Number(lon1)) * rad;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(Number(lat1) * rad) *
      Math.cos(Number(lat2) * rad) *
      Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );
  }

  function entradasDesdePunto(
    punto,
    red,
    limiteParadas = 18,
    maxMetros = 1200,
    limiteEntradas = 120
  ) {
    const lat = Number(punto?.lat);
    const lon = Number(punto?.lon);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      return [];
    }

    const candidatos = [];
    const vistosCoord = new Set();

    for (const [stopId, coords] of Object.entries(red.coords || {})) {
      if (
        !Array.isArray(coords) ||
        !(red.byStop?.[String(stopId)]?.length)
      ) {
        continue;
      }

      const stopLat = Number(coords[0]);
      const stopLon = Number(coords[1]);

      if (
        !Number.isFinite(stopLat) ||
        !Number.isFinite(stopLon)
      ) {
        continue;
      }

      const distancia =
        distanciaMetrosPuntos(
          lat,
          lon,
          stopLat,
          stopLon
        );

      if (distancia > maxMetros) {
        continue;
      }

      // stop_id y stop_code pueden apuntar exactamente al mismo lugar.
      const coordKey =
        stopLat.toFixed(6) + '|' +
        stopLon.toFixed(6);

      if (vistosCoord.has(coordKey)) {
        continue;
      }

      vistosCoord.add(coordKey);

      candidatos.push({
        stopId: String(stopId),
        distancia,
        lat: stopLat,
        lon: stopLon
      });
    }

    candidatos.sort((a, b) =>
      a.distancia - b.distancia
    );

    const resultado = [];
    const vistosEntrada = new Set();

    for (const candidato of candidatos.slice(0, limiteParadas)) {
      const entradas =
        red.byStop?.[candidato.stopId] || [];

      const paradaBase =
        buscarParadaGlobal(
          candidato.stopId
        ) || {
          busstopId: candidato.stopId,
          gtfsStopId: candidato.stopId,
          street1: 'Parada GTFS',
          street2: '',
          location: {
            type: 'Point',
            coordinates: [
              candidato.lon,
              candidato.lat
            ]
          }
        };

      const parada = {
        ...paradaBase,
        gtfsStopId: candidato.stopId,
        distanciaRuta: candidato.distancia
      };

      for (const entrada of entradas) {
        const patronIndex =
          Number(entrada?.[0]);

        const secuencia =
          Number(entrada?.[1]);

        if (
          !Number.isInteger(patronIndex) ||
          !Number.isInteger(secuencia)
        ) {
          continue;
        }

        const clave =
          patronIndex + '|' +
          secuencia + '|' +
          candidato.stopId;

        if (vistosEntrada.has(clave)) {
          continue;
        }

        vistosEntrada.add(clave);

        resultado.push({
          patronIndex,
          secuencia,
          parada
        });

        if (resultado.length >= limiteEntradas) {
          return resultado;
        }
      }
    }

    return resultado;
  }

window.buscarCombinacionesRuta = async function(
    paradasOrigen,
    paradasDestino,
    origenPunto = null,
    destinoPunto = null
  ) {
    try {
      window.ultimoDiagnosticoCombinacion = {
        paradasOrigenEntrada:
          Array.isArray(paradasOrigen)
            ? paradasOrigen.length
            : -1,
        paradasDestinoEntrada:
          Array.isArray(paradasDestino)
            ? paradasDestino.length
            : -1,
        tipoOrigenEntrada:
          Array.isArray(paradasOrigen)
            ? 'array'
            : typeof paradasOrigen,
        tipoDestinoEntrada:
          Array.isArray(paradasDestino)
            ? 'array'
            : typeof paradasDestino,
        origenLat:
          Number(origenPunto?.lat),
        origenLon:
          Number(origenPunto?.lon),
        destinoLat:
          Number(destinoPunto?.lat),
        destinoLon:
          Number(destinoPunto?.lon),
        redCargada: false,
        patronesRed: 0,
        coordsRed: 0,
        paradasIndexadasRed: 0,
        paradasGTFSOrigen: 0,
        paradasGTFSDestino: 0,
        entradasOrigen: 0,
        entradasDestino: 0,
        candidatosCombinacion: 0,
        resultadoFinal: 0
      };
      await cargarAliasesRecorridos();

      const red =
        await cargarRedRecorridos();

      window.ultimoDiagnosticoCombinacion.redCargada =
        !!red;

      window.ultimoDiagnosticoCombinacion.patronesRed =
        Array.isArray(red?.patterns)
          ? red.patterns.length
          : 0;

      window.ultimoDiagnosticoCombinacion.coordsRed =
        red?.coords
          ? Object.keys(red.coords).length
          : 0;

      window.ultimoDiagnosticoCombinacion.paradasIndexadasRed =
        red?.byStop
          ? Object.keys(red.byStop).length
          : 0;

      if (
        !red ||
        !Array.isArray(red.patterns) ||
        !red.byStop ||
        !red.coords ||
        !origenPunto ||
        !destinoPunto
      ) {
        return [];
      }

      function distanciaMetrosLocal(
        lat1,
        lon1,
        lat2,
        lon2
      ) {
        const R = 6371000;
        const rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;

        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1 * rad) *
          Math.cos(lat2 * rad) *
          Math.sin(dLon / 2) ** 2;

        return R * 2 * Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        );
      }

      function paradasGTFSmasCercanas(
        punto,
        max = 8,
        radio = 1000
      ) {
        const lat = Number(punto.lat);
        const lon = Number(punto.lon);

        const candidatos = [];
        const vistosCoord = new Set();

        for (const [stopId, coords] of Object.entries(red.coords)) {
          if (
            !Array.isArray(coords) ||
            !(red.byStop?.[stopId]?.length)
          ) {
            continue;
          }

          const stopLat = Number(coords[0]);
          const stopLon = Number(coords[1]);

          if (
            !Number.isFinite(stopLat) ||
            !Number.isFinite(stopLon)
          ) {
            continue;
          }

          const distancia =
            distanciaMetrosLocal(
              lat,
              lon,
              stopLat,
              stopLon
            );

          if (distancia > radio) {
            continue;
          }

          const coordKey =
            stopLat.toFixed(6) + '|' +
            stopLon.toFixed(6);

          if (vistosCoord.has(coordKey)) {
            continue;
          }

          vistosCoord.add(coordKey);

          candidatos.push({
            stopId,
            lat: stopLat,
            lon: stopLon,
            distancia
          });
        }

        return candidatos
          .sort((a, b) =>
            a.distancia - b.distancia
          )
          .slice(0, max);
      }

      function paradaObjeto(item) {
        const existente =
          buscarParadaGlobal(item.stopId);

        return {
          ...(existente || {}),
          busstopId:
            existente?.busstopId ||
            item.stopId,
          gtfsStopId:
            item.stopId,
          street1:
            existente?.street1 ||
            'Parada cercana',
          street2:
            existente?.street2 ||
            '',
          distanciaRuta:
            item.distancia,
          location:
            existente?.location || {
              type: 'Point',
              coordinates: [
                item.lon,
                item.lat
              ]
            }
        };
      }

      const origenes =
        paradasGTFSmasCercanas(
          origenPunto,
          8,
          1000
        );

      const destinos =
        paradasGTFSmasCercanas(
          destinoPunto,
          8,
          1000
        );

      window.ultimoDiagnosticoCombinacion.paradasGTFSOrigen =
        origenes.length;

      window.ultimoDiagnosticoCombinacion.paradasGTFSDestino =
        destinos.length;

      if (!origenes.length || !destinos.length) {
        return [];
      }

      let totalEntradasOrigen = 0;
      let totalEntradasDestino = 0;

      for (const origenItem of origenes) {
        totalEntradasOrigen +=
          (red.byStop?.[origenItem.stopId] || []).length;
      }

      for (const destinoItem of destinos) {
        totalEntradasDestino +=
          (red.byStop?.[destinoItem.stopId] || []).length;
      }

      window.ultimoDiagnosticoCombinacion.entradasOrigen =
        totalEntradasOrigen;

      window.ultimoDiagnosticoCombinacion.entradasDestino =
        totalEntradasDestino;

      // Índice rápido: para cada patrón que llega cerca del destino,
      // guardamos la secuencia donde debe bajarse.
      const llegadaPorPatron = new Map();

      for (const destino of destinos) {
        const entradas =
          red.byStop?.[destino.stopId] || [];

        for (const entrada of entradas) {
          const patronIndex = Number(entrada?.[0]);
          const secuencia = Number(entrada?.[1]);

          if (
            !Number.isInteger(patronIndex) ||
            !Number.isInteger(secuencia)
          ) {
            continue;
          }

          const actual =
            llegadaPorPatron.get(patronIndex);

          if (
            !actual ||
            secuencia < actual.secuencia
          ) {
            llegadaPorPatron.set(
              patronIndex,
              {
                secuencia,
                destino
              }
            );
          }
        }
      }

      const candidatos = [];
      const vistos = new Set();

      for (const origen of origenes) {
        const entradasOrigen =
          red.byStop?.[origen.stopId] || [];

        for (const entradaOrigen of entradasOrigen) {
          const patron1Index =
            Number(entradaOrigen?.[0]);

          const seqOrigen =
            Number(entradaOrigen?.[1]);

          const patron1 =
            red.patterns?.[patron1Index];

          if (
            !patron1 ||
            !Array.isArray(patron1.s) ||
            !Number.isInteger(seqOrigen)
          ) {
            continue;
          }

          // Recorremos hacia adelante el primer bus.
          for (
            let i = seqOrigen + 1;
            i < patron1.s.length;
            i++
          ) {
            const stopTransfer =
              String(patron1.s[i]);

            const transferCoords =
              red.coords?.[stopTransfer];

            if (!Array.isArray(transferCoords)) {
              continue;
            }

            // Buscamos primero conexiones en la misma parada.
            // Si no alcanza, permitimos caminar hasta una parada GTFS
            // cercana (máximo 300 m) para tomar el segundo ómnibus.
            const conexionesCercanas = [];

            for (const [stop2, coords2] of Object.entries(red.coords)) {
              if (!Array.isArray(coords2)) {
                continue;
              }

              const entradas2 =
                red.byStop?.[String(stop2)] || [];

              if (!entradas2.length) {
                continue;
              }

              const caminata =
                distanciaMetrosLocal(
                  Number(transferCoords[0]),
                  Number(transferCoords[1]),
                  Number(coords2[0]),
                  Number(coords2[1])
                );

              if (caminata > 300) {
                continue;
              }

              conexionesCercanas.push({
                stop2: String(stop2),
                caminata,
                entradas: entradas2
              });
            }

            conexionesCercanas.sort((a, b) =>
              a.caminata - b.caminata
            );

            for (const grupo of conexionesCercanas.slice(0, 12)) {
              for (const conexion of grupo.entradas) {
                const patron2Index =
                  Number(conexion?.[0]);

                const seqTransfer =
                  Number(conexion?.[1]);

                if (
                  !Number.isInteger(patron2Index) ||
                  !Number.isInteger(seqTransfer) ||
                  patron2Index === patron1Index
                ) {
                  continue;
                }

                const patron2 =
                  red.patterns?.[patron2Index];

                if (
                  !patron2 ||
                  String(patron2.l || '') ===
                    String(patron1.l || '')
                ) {
                  continue;
                }

                const llegada =
                  llegadaPorPatron.get(
                    patron2Index
                  );

                if (
                  !llegada ||
                  llegada.secuencia <= seqTransfer
                ) {
                  continue;
                }

                const clave =
                  patron1Index + '|' +
                  patron2Index + '|' +
                  stopTransfer + '|' +
                  grupo.stop2 + '|' +
                  llegada.destino.stopId;

                if (vistos.has(clave)) {
                  continue;
                }

                vistos.add(clave);

                const paradaTransfer =
                  paradaObjeto({
                    stopId:
                      stopTransfer,
                    lat:
                      Number(transferCoords[0]),
                    lon:
                      Number(transferCoords[1]),
                    distancia:
                      0
                  });

                const coordsSubida =
                  red.coords?.[grupo.stop2];

                const paradaSubidaSegundo =
                  Array.isArray(coordsSubida)
                    ? paradaObjeto({
                        stopId:
                          grupo.stop2,
                        lat:
                          Number(coordsSubida[0]),
                        lon:
                          Number(coordsSubida[1]),
                        distancia:
                          grupo.caminata
                      })
                    : paradaTransfer;

                const paradaOrigen =
                  paradaObjeto(origen);

                const paradaDestino =
                  paradaObjeto(
                    llegada.destino
                  );

                candidatos.push({
                  tipo: 'combinacion',
                  line1:
                    String(patron1.l || ''),
                  destination1:
                    String(patron1.d || ''),
                  line2:
                    String(patron2.l || ''),
                  destination2:
                    String(patron2.d || ''),
                  origen:
                    paradaOrigen,
                  combinacion:
                    paradaTransfer,
                  combinacion2:
                    paradaSubidaSegundo,
                  caminataCombinacion:
                    grupo.caminata,
                  destino:
                    paradaDestino,
                  puntaje:
                    origen.distancia +
                    llegada.destino.distancia +
                    grupo.caminata * 2 +
                    (i - seqOrigen) * 20 +
                    (llegada.secuencia - seqTransfer) * 20
                });
              }
            }
          }
        }
      }

      window.ultimoDiagnosticoCombinacion.candidatosCombinacion =
        candidatos.length;

      const mejoresPorOpcion =
        new Map();

      for (
        const candidato of
        candidatos.sort((a, b) =>
          a.puntaje - b.puntaje
        )
      ) {
        const claveVisible =
          [
            String(candidato.line1 || ''),
            normalizar(candidato.destination1 || ''),
            String(candidato.line2 || ''),
            normalizar(candidato.destination2 || '')
          ].join('|');

        const anterior =
          mejoresPorOpcion.get(
            claveVisible
          );

        if (
          !anterior ||
          candidato.puntaje <
            anterior.puntaje
        ) {
          mejoresPorOpcion.set(
            claveVisible,
            candidato
          );
        }
      }

      const resultado =
        [...mejoresPorOpcion.values()]
          .sort((a, b) =>
            a.puntaje - b.puntaje
          )
          .slice(0, 6);

      window.ultimoDiagnosticoCombinacion.resultadoFinal =
        resultado.length;

      return resultado;

    } catch (error) {
      console.warn(
        'No se pudieron buscar combinaciones:',
        error
      );

      window.ultimoDiagnosticoCombinacion = {
        ...(window.ultimoDiagnosticoCombinacion || {}),
        error:
          error?.message ||
          String(error)
      };

      return [];
    }
  };

  async function tramoParaLinea(
    linea,
    destinoTexto,
    paradaDesde,
    paradaHasta
  ) {
    const datos =
      await cargarRecorridoLinea(linea);

    const patrones =
      Array.isArray(datos?.patterns)
        ? datos.patterns
        : [];

    const desdeId =
      String(
        paradaDesde?.gtfsStopId ||
        paradaDesde?.busstopId ||
        ''
      );

    const hastaId =
      String(
        paradaHasta?.gtfsStopId ||
        paradaHasta?.busstopId ||
        ''
      );

    let compatibles =
      patrones.filter(patron => {
        const stops =
          Array.isArray(patron.stops)
            ? patron.stops.map(String)
            : [];

        const iDesde = indiceParadaCompatible(stops, desdeId);
        const iHasta = indiceParadaCompatible(stops, hastaId);

        return (
          iDesde >= 0 &&
          iHasta >= 0 &&
          iDesde < iHasta &&
          Array.isArray(patron.shape) &&
          patron.shape.length >= 2
        );
      });

    const destinoObjetivo =
      normalizar(destinoTexto);

    if (destinoObjetivo && compatibles.length) {
      const porDestino =
        compatibles.filter(p => {
          const d = normalizar(p.destination);
          return (
            d === destinoObjetivo ||
            d.includes(destinoObjetivo) ||
            destinoObjetivo.includes(d)
          );
        });

      if (porDestino.length) {
        compatibles = porDestino;
      }
    }

    const patron = compatibles[0];

    if (!patron) {
      return null;
    }

    const coordsDesde =
      paradaDesde.location?.coordinates;

    const coordsHasta =
      paradaHasta.location?.coordinates;

    if (
      !Array.isArray(coordsDesde) ||
      !Array.isArray(coordsHasta)
    ) {
      return null;
    }

    const iShapeDesde =
      indiceShapeMasCercano(
        patron.shape,
        Number(coordsDesde[1]),
        Number(coordsDesde[0])
      );

    const iShapeHasta =
      indiceShapeMasCercano(
        patron.shape,
        Number(coordsHasta[1]),
        Number(coordsHasta[0])
      );

    if (
      iShapeDesde < 0 ||
      iShapeHasta < 0 ||
      iShapeDesde === iShapeHasta
    ) {
      return null;
    }

    if (iShapeDesde < iShapeHasta) {
      return patron.shape.slice(
        iShapeDesde,
        iShapeHasta + 1
      );
    }

    return patron.shape
      .slice(
        iShapeHasta,
        iShapeDesde + 1
      )
      .reverse();
  }

  function iconoEtiqueta(texto, fondo, ancho) {
    return L.divIcon({
      className: '',
      html:
        '<div style="' +
          'background:' + fondo + ';' +
          'color:#fff;' +
          'border:3px solid #fff;' +
          'box-shadow:0 3px 10px rgba(0,0,0,.28);' +
          'border-radius:999px;' +
          'padding:5px 9px;' +
          'font:700 11px/1.1 system-ui,sans-serif;' +
          'white-space:nowrap;' +
        '">' + texto + '</div>',
      iconSize: [ancho, 28],
      iconAnchor: [ancho / 2, 14]
    });
  }

  window.dibujarLineaDesdeParada = async function(
    linea,
    destinoTexto,
    parada,
    destinoRuta = null
  ) {
    try {
      if (
        !linea ||
        !parada?.busstopId ||
        !Array.isArray(parada?.location?.coordinates)
      ) {
        return false;
      }

      await cargarAliasesRecorridos();

      const datos =
        await cargarRecorridoLinea(linea);

      const patrones =
        Array.isArray(datos?.patterns)
          ? datos.patterns
          : [];

      if (!patrones.length) {
        return false;
      }

      const paradaId =
        String(
          parada.gtfsStopId ||
          parada.busstopId
        );

      const coords =
        parada.location.coordinates;

      const destinoObjetivo =
        normalizar(destinoTexto || '');

      const latDestinoRuta =
        Number(destinoRuta?.lat);

      const lonDestinoRuta =
        Number(destinoRuta?.lon);

      const limitarADestino =
        Number.isFinite(latDestinoRuta) &&
        Number.isFinite(lonDestinoRuta);

      const candidatos =
        patrones
          .filter(p =>
            Array.isArray(p.shape) &&
            p.shape.length >= 2
          )
          .map(p => {
            const stops =
              Array.isArray(p.stops)
                ? p.stops.map(String)
                : [];

            const idxStop =
              indiceParadaCompatible(
                stops,
                paradaId
              );

            const idxShape =
              indiceShapeMasCercano(
                p.shape,
                Number(coords[1]),
                Number(coords[0])
              );

            if (idxShape < 0) {
              return null;
            }

            let idxDestinoShape =
              p.shape.length - 1;

            let distanciaDestino =
              0;

            if (limitarADestino) {
              idxDestinoShape =
                indiceShapeMasCercano(
                  p.shape,
                  latDestinoRuta,
                  lonDestinoRuta
                );

              if (
                idxDestinoShape <= idxShape
              ) {
                return null;
              }

              distanciaDestino =
                distanciaSimple(
                  p.shape[idxDestinoShape][0],
                  p.shape[idxDestinoShape][1],
                  latDestinoRuta,
                  lonDestinoRuta
                );
            }

            let puntaje =
              distanciaSimple(
                p.shape[idxShape][0],
                p.shape[idxShape][1],
                Number(coords[1]),
                Number(coords[0])
              ) +
              distanciaDestino * 4;

            if (idxStop >= 0) {
              puntaje *= 0.2;
            }

            if (
              destinoObjetivo &&
              normalizar(p.destination) ===
                destinoObjetivo
            ) {
              puntaje *= 0.25;
            }

            return {
              patron: p,
              idxShape,
              idxDestinoShape,
              puntaje
            };
          })
          .filter(Boolean)
          .sort((a, b) =>
            a.puntaje - b.puntaje
          );

      const elegido =
        candidatos[0];

      if (!elegido) {
        return false;
      }

      const tramo =
        elegido.patron.shape.slice(
          elegido.idxShape,
          limitarADestino
            ? elegido.idxDestinoShape + 1
            : undefined
        );

      if (tramo.length < 2) {
        return false;
      }

      window.limpiarRecorridoSeleccionado();

      haloRecorridoMapa =
        L.polyline(tramo, {
          color: '#ffffff',
          weight: 11,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapa);

      lineaRecorridoMapa =
        L.polyline(tramo, {
          color: '#1769e0',
          weight: 7,
          opacity: 0.96,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapa);

      const iconoSubir =
        L.divIcon({
          className: '',
          html:
            '<div style="' +
              'background:#18a66a;' +
              'color:#fff;' +
              'border:3px solid #fff;' +
              'box-shadow:0 3px 10px rgba(0,0,0,.28);' +
              'border-radius:999px;' +
              'padding:5px 9px;' +
              'font:700 11px/1.1 system-ui,sans-serif;' +
              'white-space:nowrap;' +
            '">SUBIR</div>',
          iconSize: [58, 28],
          iconAnchor: [29, 14]
        });

      marcadorInicioRecorrido =
        L.marker(
          tramo[0],
          {
            icon: iconoSubir,
            zIndexOffset: 2200
          }
        ).addTo(mapa);

      if (limitarADestino) {
        const iconoBajar =
          L.divIcon({
            className: '',
            html:
              '<div style="' +
                'background:#e54b4b;' +
                'color:#fff;' +
                'border:3px solid #fff;' +
                'box-shadow:0 3px 10px rgba(0,0,0,.28);' +
                'border-radius:999px;' +
                'padding:5px 9px;' +
                'font:700 11px/1.1 system-ui,sans-serif;' +
                'white-space:nowrap;' +
              '">BAJAR</div>',
            iconSize: [62, 28],
            iconAnchor: [31, 14]
          });

        marcadorFinRecorrido =
          L.marker(
            tramo[tramo.length - 1],
            {
              icon: iconoBajar,
              zIndexOffset: 2200
            }
          ).addTo(mapa);
      }

      mapa.fitBounds(
        lineaRecorridoMapa.getBounds(),
        {
          paddingTopLeft: [40, 55],
          paddingBottomRight: [40, 55],
          maxZoom: 15,
          animate: true
        }
      );

      return true;
    } catch (error) {
      console.warn(
        'No se pudo dibujar la línea seleccionada:',
        error
      );
      return false;
    }
  };


  window.dibujarCombinacionRuta = async function(candidato) {
    try {
      window.limpiarRecorridoSeleccionado();

      const [tramo1, tramo2] =
        await Promise.all([
          tramoParaLinea(
            candidato.line1,
            candidato.destination1,
            candidato.origen,
            candidato.combinacion
          ),
          tramoParaLinea(
            candidato.line2,
            candidato.destination2,
            candidato.combinacion2 ||
              candidato.combinacion,
            candidato.destino
          )
        ]);

      if (!tramo1 || !tramo2) {
        return false;
      }

      const halo1 =
        L.polyline(tramo1, {
          color: '#ffffff',
          weight: 11,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapa);

      const linea1 =
        L.polyline(tramo1, {
          color: '#1769e0',
          weight: 7,
          opacity: 0.96,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapa);

      const halo2 =
        L.polyline(tramo2, {
          color: '#ffffff',
          weight: 11,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapa);

      const linea2 =
        L.polyline(tramo2, {
          color: '#7c3aed',
          weight: 7,
          opacity: 0.96,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapa);

      const marcadorSubir =
        L.marker(
          tramo1[0],
          {
            icon: iconoEtiqueta(
              'SUBIR',
              '#18a66a',
              58
            ),
            zIndexOffset: 2300
          }
        ).addTo(mapa);

      const marcadorCombinar =
        L.marker(
          tramo1[tramo1.length - 1],
          {
            icon: iconoEtiqueta(
              'COMBINAR',
              '#d79b00',
              78
            ),
            zIndexOffset: 2350
          }
        ).addTo(mapa);

      let caminataTransfer = null;
      let marcadorTomarSegundo = null;

      const coordBajarPrimero =
        candidato.combinacion?.location?.coordinates;

      const coordSubirSegundo =
        (
          candidato.combinacion2 ||
          candidato.combinacion
        )?.location?.coordinates;

      if (
        Array.isArray(coordBajarPrimero) &&
        Array.isArray(coordSubirSegundo) &&
        String(candidato.combinacion?.busstopId) !==
          String(
            (
              candidato.combinacion2 ||
              candidato.combinacion
            )?.busstopId
          )
      ) {
        caminataTransfer =
          L.polyline(
            [
              [
                Number(coordBajarPrimero[1]),
                Number(coordBajarPrimero[0])
              ],
              [
                Number(coordSubirSegundo[1]),
                Number(coordSubirSegundo[0])
              ]
            ],
            {
              color: '#6b7280',
              weight: 5,
              opacity: 0.9,
              dashArray: '8 10',
              lineCap: 'round'
            }
          )
          .addTo(mapa);

        marcadorTomarSegundo =
          L.marker(
            [
              Number(coordSubirSegundo[1]),
              Number(coordSubirSegundo[0])
            ],
            {
              icon: iconoEtiqueta(
                '2° BUS',
                '#7c3aed',
                68
              ),
              zIndexOffset: 2360
            }
          )
          .addTo(mapa);
      }

      const marcadorBajar =
        L.marker(
          tramo2[tramo2.length - 1],
          {
            icon: iconoEtiqueta(
              'BAJAR',
              '#e54b4b',
              62
            ),
            zIndexOffset: 2300
          }
        ).addTo(mapa);

      capasCombinacion.push(
        halo1,
        linea1,
        halo2,
        linea2,
        marcadorSubir,
        marcadorCombinar,
        marcadorBajar,
        ...(caminataTransfer
          ? [caminataTransfer]
          : []),
        ...(marcadorTomarSegundo
          ? [marcadorTomarSegundo]
          : [])
      );

      const bounds =
        L.latLngBounds([
          ...tramo1,
          ...tramo2
        ]);

      mapa.fitBounds(bounds, {
        paddingTopLeft: [45, 55],
        paddingBottomRight: [45, 55],
        maxZoom: 15,
        animate: true
      });

      return true;
    } catch (error) {
      console.warn(
        'No se pudo dibujar la combinación:',
        error
      );
      return false;
    }
  };
})();
