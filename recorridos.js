(() => {
  // Comparte también las descargas en curso; un fallo permite reintentar.
  const archivosPendientes = new Map();
  function cargarJSON(url) {
    if (!archivosPendientes.has(url)) {
      const descarga = (async () => {
        const respuesta = await fetch(url, { cache: 'no-cache' });
        if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
        return respuesta.json();
      })().catch(error => { archivosPendientes.delete(url); throw error; });
      archivosPendientes.set(url, descarga);
    }
    return archivosPendientes.get(url);
  }

  const cacheRecorridos = new Map();
  let manifiestoRecorridos = null;
  let aliasesRecorridos = null;
  let redRecorridos = null;
  let indiceConexionesCaminata = null;
  let lineaRecorridoMapa = null;
  let haloRecorridoMapa = null;
  let marcadorInicioRecorrido = null;
  let marcadorFinRecorrido = null;
  let lineaCaminataFinal = null;
  let marcadorCaminataFinal = null;
  let capasCombinacion = [];
  let versionDibujoRecorrido = 0;

  async function cargarManifiestoRecorridos() {
    if (manifiestoRecorridos) {
      return manifiestoRecorridos;
    }

    const datosDescargados = await cargarJSON('./recorridos/manifest.json');
    manifiestoRecorridos = datosDescargados;
    return manifiestoRecorridos;
  }

  async function cargarAliasesRecorridos() {
    if (aliasesRecorridos) {
      return aliasesRecorridos;
    }

    try {
      const datosDescargados = await cargarJSON('./recorridos/aliases.json');
aliasesRecorridos =
        datosDescargados;

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
      const datosDescargados = await cargarJSON('./recorridos/red.json');
redRecorridos =
        datosDescargados;

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

    const datosDescargados = await cargarJSON('./recorridos/' + archivo);
    const datos = datosDescargados;
    cacheRecorridos.set(clave, datos);
    return datos;
  }

  // Solo patrones del sentido elegido que contienen la parada; sin aproximar destinos.
  window.obtenerPatronesParaParada = async function(linea, destino, stopId) {
    try {
      if (!normalizar(destino) || !stopId) return [];
      await cargarAliasesRecorridos();
      const datos = await cargarRecorridoLinea(linea);
      return (datos?.patterns || []).filter(p =>
        normalizar(p.destination) === normalizar(destino) &&
        indiceParadaCompatible((p.stops || []).map(String), stopId) >= 0 &&
        Array.isArray(p.shape) && p.shape.length >= 2
      ).map(p => p.shape);
    } catch (_) { return []; }
  };

  function distanciaSimple(lat1, lon1, lat2, lon2) {
    const dLat = Number(lat1) - Number(lat2);
    const dLon = Number(lon1) - Number(lon2);

    return dLat * dLat + dLon * dLon;
  }

  function distanciaMetrosCoords(lat1, lon1, lat2, lon2) {
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

  function crearIndiceConexionesCaminata(red) {
    const tamano = 0.004;
    const celdas = new Map();
    const cache = new Map();
    let orden = 0;
    for (const [stop2, coords] of Object.entries(red.coords || {})) {
      const entradas = red.byStop?.[String(stop2)] || [];
      if (!Array.isArray(coords) || !entradas.length) continue;
      const lat = Number(coords[0]), lon = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const clave = Math.floor(lat / tamano) + '|' + Math.floor(lon / tamano);
      if (!celdas.has(clave)) celdas.set(clave, []);
      celdas.get(clave).push({ stop2: String(stop2), lat, lon, entradas, orden: orden++ });
    }
    return (lat, lon) => {
      const clave = lat + '|' + lon;
      if (cache.has(clave)) return cache.get(clave);
      const margenLat = 300 / 110000;
      const margenLon = margenLat / Math.max(0.01, Math.abs(Math.cos(lat * Math.PI / 180)));
      const cercanas = [];
      for (let y = Math.floor((lat - margenLat) / tamano); y <= Math.floor((lat + margenLat) / tamano); y++) {
        for (let x = Math.floor((lon - margenLon) / tamano); x <= Math.floor((lon + margenLon) / tamano); x++) {
          for (const parada of celdas.get(y + '|' + x) || []) {
            const caminata = distanciaMetrosCoords(lat, lon, parada.lat, parada.lon);
            if (caminata <= 300) cercanas.push({ ...parada, caminata });
          }
        }
      }
      cercanas.sort((a, b) => a.caminata - b.caminata || a.orden - b.orden);
      const resultado = cercanas.slice(0, 12);
      cache.set(clave, resultado);
      return resultado;
    };
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
    // Invalida cualquier dibujo asíncrono anterior que todavía
    // esté esperando archivos GTFS. Así una ruta vieja no puede
    // reaparecer encima de una selección nueva.
    versionDibujoRecorrido++;

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

    if (lineaCaminataFinal) {
      mapa.removeLayer(lineaCaminataFinal);
      lineaCaminataFinal = null;
    }

    if (marcadorCaminataFinal) {
      mapa.removeLayer(marcadorCaminataFinal);
      marcadorCaminataFinal = null;
    }

    for (const capa of capasCombinacion) {
      mapa.removeLayer(capa);
    }

    capasCombinacion = [];
  };

  function crearTramoCaminataFinal(
    puntoInicio,
    destinoRuta
  ) {
    if (
      !Array.isArray(puntoInicio) ||
      puntoInicio.length < 2
    ) {
      return null;
    }

    const latDestino =
      Number(destinoRuta?.lat);

    const lonDestino =
      Number(destinoRuta?.lon);

    if (
      !Number.isFinite(latDestino) ||
      !Number.isFinite(lonDestino)
    ) {
      return null;
    }

    const latInicio =
      Number(puntoInicio[0]);

    const lonInicio =
      Number(puntoInicio[1]);

    const distancia =
      distanciaMetrosCoords(
        latInicio,
        lonInicio,
        latDestino,
        lonDestino
      );

    if (
      !Number.isFinite(distancia) ||
      distancia <= 50
    ) {
      return null;
    }

    const linea =
      L.polyline(
        [
          [latInicio, lonInicio],
          [latDestino, lonDestino]
        ],
        {
          color: '#6b7280',
          weight: 5,
          opacity: 0.9,
          dashArray: '8 10',
          lineCap: 'round'
        }
      ).addTo(mapa);

    const icono =
      L.divIcon({
        className: '',
        html:
          '<div style="' +
            'background:#fff;' +
            'border:3px solid #1769e0;' +
            'box-shadow:0 3px 10px rgba(0,0,0,.22);' +
            'border-radius:999px;' +
            'padding:4px 8px;' +
            'font:700 16px/1 system-ui,sans-serif;' +
            'white-space:nowrap;' +
          '">🚶</div>',
        iconSize: [42, 32],
        iconAnchor: [21, 16]
      });

    const marcador =
      L.marker(
        [
          (latInicio + latDestino) / 2,
          (lonInicio + lonDestino) / 2
        ],
        {
          icon: icono,
          zIndexOffset: 2250
        }
      ).addTo(mapa);

    return {
      linea,
      marcador,
      distancia,
      destino: [latDestino, lonDestino]
    };
  }


  window.dibujarRecorridoSeleccionado = async function(
    candidato,
    destinoRuta = null
  ) {
    try {
      window.limpiarRecorridoSeleccionado();

      const sesionDibujo =
        versionDibujoRecorrido;

      await cargarAliasesRecorridos();

      if (sesionDibujo !== versionDibujoRecorrido) {
        return false;
      }

      if (
        !candidato?.line ||
        !candidato?.origen?.busstopId ||
        !candidato?.destino?.busstopId
      ) {
        return false;
      }

      const datos =
        await cargarRecorridoLinea(candidato.line);

      if (sesionDibujo !== versionDibujoRecorrido) {
        return false;
      }

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

      const caminataFinal =
        crearTramoCaminataFinal(
          tramo[tramo.length - 1],
          destinoRuta
        );

      if (caminataFinal) {
        lineaCaminataFinal =
          caminataFinal.linea;

        marcadorCaminataFinal =
          caminataFinal.marcador;
      }

      const boundsRecorrido =
        lineaRecorridoMapa.getBounds();

      if (caminataFinal) {
        boundsRecorrido.extend(
          caminataFinal.destino
        );
      }

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

window.buscarDirectasPorRed = async function(
    paradasOrigen,
    destinoPunto,
    radioDestino = 800
  ) {
    try {
      await cargarAliasesRecorridos();

      const red =
        await cargarRedRecorridos();

      if (
        !red ||
        !Array.isArray(red.patterns) ||
        !red.byStop ||
        !red.coords
      ) {
        return [];
      }

      const latDestino =
        Number(destinoPunto?.lat);

      const lonDestino =
        Number(destinoPunto?.lon);

      if (
        !Number.isFinite(latDestino) ||
        !Number.isFinite(lonDestino)
      ) {
        return [];
      }

      const mejores =
        new Map();

      for (const paradaOrigen of paradasOrigen || []) {
        const stopIdBase =
          String(
            paradaOrigen?.gtfsStopId ||
            paradaOrigen?.busstopId ||
            ''
          );

        if (!stopIdBase) {
          continue;
        }

        const clavesOrigen =
          clavesCompatiblesParada(
            stopIdBase
          );

        const entradas = [];

        for (const clave of clavesOrigen) {
          for (
            const entrada of
            red.byStop?.[String(clave)] || []
          ) {
            entradas.push(entrada);
          }
        }

        for (const entrada of entradas) {
          const patronIndex =
            Number(entrada?.[0]);

          const secuenciaOrigen =
            Number(entrada?.[1]);

          if (
            !Number.isInteger(patronIndex) ||
            !Number.isInteger(secuenciaOrigen)
          ) {
            continue;
          }

          const patron =
            red.patterns?.[patronIndex];

          if (
            !patron ||
            !Array.isArray(patron.s)
          ) {
            continue;
          }

          let mejorDestino = null;

          for (
            let i = secuenciaOrigen + 1;
            i < patron.s.length;
            i++
          ) {
            const stopIdDestino =
              String(patron.s[i]);

            const coordsDestino =
              red.coords?.[stopIdDestino];

            if (
              !Array.isArray(coordsDestino) ||
              coordsDestino.length < 2
            ) {
              continue;
            }

            const distanciaDestino =
              distanciaMetrosCoords(
                Number(coordsDestino[0]),
                Number(coordsDestino[1]),
                latDestino,
                lonDestino
              );

            if (
              !mejorDestino ||
              distanciaDestino <
                mejorDestino.distancia
            ) {
              mejorDestino = {
                stopId:
                  stopIdDestino,
                secuencia:
                  i,
                distancia:
                  distanciaDestino
              };
            }
          }

          if (
            !mejorDestino ||
            mejorDestino.distancia >
              Number(radioDestino)
          ) {
            continue;
          }

          const paradaDestino =
            buscarParadaGlobal(
              mejorDestino.stopId
            );

          if (!paradaDestino) {
            continue;
          }

          paradaDestino.distanciaRuta =
            mejorDestino.distancia;

          const candidato = {
            tipo: 'directa',
            line:
              String(patron.l || ''),
            destination:
              String(patron.d || ''),
            origen:
              paradaOrigen,
            destino:
              paradaDestino,
            coincidenciaAproximada:
              false,
            detectadaPorRed:
              true,
            puntaje:
              Number(
                paradaOrigen?.distanciaRuta ||
                0
              ) +
              mejorDestino.distancia
          };

          if (!candidato.line) {
            continue;
          }

          const claveVista =
            candidato.line + '|' +
            normalizar(
              candidato.destination
            );

          const anterior =
            mejores.get(claveVista);

          if (
            !anterior ||
            candidato.puntaje <
              anterior.puntaje
          ) {
            mejores.set(
              claveVista,
              candidato
            );
          }
        }
      }

      return [...mejores.values()]
        .sort((a, b) =>
          a.puntaje - b.puntaje
        );
    } catch (error) {
      console.warn(
        'No se pudieron buscar directas por red GTFS:',
        error
      );

      return [];
    }
  };


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

      // Evitamos combinaciones demasiado cerca del punto de subida.
      // Si el primer bus recorre menos de 800 m hasta el trasbordo,
      // normalmente al usuario le conviene caminar ese tramo.
      const MIN_TRAMO_PRIMER_BUS_COMBINACION_METROS = 800;
      if (!indiceConexionesCaminata) indiceConexionesCaminata = crearIndiceConexionesCaminata(red);

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

            const distanciaPrimerTramo =
              distanciaMetrosLocal(
                Number(origen.lat),
                Number(origen.lon),
                Number(transferCoords[0]),
                Number(transferCoords[1])
              );

            if (
              distanciaPrimerTramo <
                MIN_TRAMO_PRIMER_BUS_COMBINACION_METROS
            ) {
              continue;
            }

            // Buscamos primero conexiones en la misma parada.
            // Si no alcanza, permitimos caminar hasta una parada GTFS
            // cercana (máximo 300 m) para tomar el segundo ómnibus.
            const conexionesCercanas = indiceConexionesCaminata(
              Number(transferCoords[0]), Number(transferCoords[1])
            );

            for (const grupo of conexionesCercanas) {
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
                  String(patron2.l || '')
                    .trim()
                    .toUpperCase() ===
                  String(patron1.l || '')
                    .trim()
                    .toUpperCase()
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
                  distanciaPrimerTramo,
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

  window.lineaLlegaADestinoRuta = async function(
    linea,
    destinoTexto,
    parada,
    destinoRuta,
    radioDestino = 800
  ) {
    try {
      if (
        !linea ||
        !parada?.busstopId ||
        !Array.isArray(parada?.location?.coordinates)
      ) {
        return false;
      }

      const latDestino =
        Number(destinoRuta?.lat);

      const lonDestino =
        Number(destinoRuta?.lon);

      if (
        !Number.isFinite(latDestino) ||
        !Number.isFinite(lonDestino)
      ) {
        return true;
      }

      await cargarAliasesRecorridos();

      const datos =
        await cargarRecorridoLinea(linea);

      const patrones =
        Array.isArray(datos?.patterns)
          ? datos.patterns
          : [];

      const paradaId =
        String(
          parada.gtfsStopId ||
          parada.busstopId
        );

      const coordsParada =
        parada.location.coordinates;

      const destinoObjetivo =
        normalizar(destinoTexto || '');
      if (!destinoObjetivo) return false;

      for (const patron of patrones) {
        if (normalizar(patron.destination) !== destinoObjetivo) continue;
        if (
          !Array.isArray(patron.shape) ||
          patron.shape.length < 2
        ) {
          continue;
        }

        const stops =
          Array.isArray(patron.stops)
            ? patron.stops.map(String)
            : [];

        const idxStop =
          indiceParadaCompatible(
            stops,
            paradaId
          );

        if (idxStop < 0) {
          continue;
        }

        const idxShapeInicio =
          indiceShapeMasCercano(
            patron.shape,
            Number(coordsParada[1]),
            Number(coordsParada[0])
          );

        if (
          idxShapeInicio < 0 ||
          idxShapeInicio >= patron.shape.length - 1
        ) {
          continue;
        }

        let mejorDistanciaDestino =
          Infinity;

        for (
          let i = idxShapeInicio + 1;
          i < patron.shape.length;
          i++
        ) {
          const punto =
            patron.shape[i];

          const distancia =
            distanciaMetrosCoords(
              punto[0],
              punto[1],
              latDestino,
              lonDestino
            );

          if (distancia < mejorDistanciaDestino) {
            mejorDistanciaDestino =
              distancia;
          }
        }

        if (
          mejorDistanciaDestino <=
            Number(radioDestino)
        ) {
          return true;
        }

      }

      return false;
    } catch (error) {
      console.warn(
        'No se pudo validar si la línea llega al destino:',
        error
      );

      return false;
    }
  };


  window.dibujarLineaDesdeParada = async function(
    linea,
    destinoTexto,
    parada,
    destinoRuta = null
  ) {
    try {
      // La nueva selección reemplaza inmediatamente cualquier shape
      // anterior, incluso mientras cargamos el GTFS de esta línea.
      window.limpiarRecorridoSeleccionado();

      const sesionDibujo =
        versionDibujoRecorrido;

      if (
        !linea ||
        !parada?.busstopId ||
        !Array.isArray(parada?.location?.coordinates)
      ) {
        return false;
      }

      await cargarAliasesRecorridos();

      if (sesionDibujo !== versionDibujoRecorrido) {
        return false;
      }

      const datos =
        await cargarRecorridoLinea(linea);

      if (sesionDibujo !== versionDibujoRecorrido) {
        return false;
      }

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

      if (sesionDibujo !== versionDibujoRecorrido) {
        return false;
      }

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

        const caminataFinal =
          crearTramoCaminataFinal(
            tramo[tramo.length - 1],
            destinoRuta
          );

        if (caminataFinal) {
          lineaCaminataFinal =
            caminataFinal.linea;

          marcadorCaminataFinal =
            caminataFinal.marcador;
        }
      }

      const boundsLinea =
        lineaRecorridoMapa.getBounds();

      if (
        limitarADestino &&
        lineaCaminataFinal
      ) {
        boundsLinea.extend([
          latDestinoRuta,
          lonDestinoRuta
        ]);
      }

      mapa.fitBounds(
        boundsLinea,
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


  // Adaptadores de lectura para estimación y copia del último viaje.
  window.obtenerTramoLineaViaje = tramoParaLinea;
  window.obtenerGeometriaViajeActual = () => {
    const capas = lineaRecorridoMapa ? [lineaRecorridoMapa] : capasCombinacion;
    return capas.filter(c => typeof c.getLatLngs === 'function' && c.options?.color !== '#ffffff' && !c.options?.dashArray)
      .map(c => c.getLatLngs().filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(p => [p.lat, p.lng])).filter(p => p.length > 1);
  };
  window.ocultarCaminatasAproximadas = () => {
    if (lineaCaminataFinal) mapa.removeLayer(lineaCaminataFinal);
    for (const c of capasCombinacion) if (c.options?.dashArray && typeof c.getLatLngs === 'function') mapa.removeLayer(c);
  };

  window.dibujarCombinacionRuta = async function(
    candidato,
    destinoRuta = null
  ) {
    try {
      window.limpiarRecorridoSeleccionado();

      const sesionDibujo =
        versionDibujoRecorrido;

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

      if (sesionDibujo !== versionDibujoRecorrido) {
        return false;
      }

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

      const caminataFinal =
        crearTramoCaminataFinal(
          tramo2[tramo2.length - 1],
          destinoRuta
        );

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
          : []),
        ...(caminataFinal
          ? [
              caminataFinal.linea,
              caminataFinal.marcador
            ]
          : [])
      );

      const bounds =
        L.latLngBounds([
          ...tramo1,
          ...tramo2
        ]);

      if (caminataFinal) {
        bounds.extend(
          caminataFinal.destino
        );
      }

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
  // Geometrías externas verificadas: usa los mismos trazos, etiquetas y capas del mapa urbano.
  window.dibujarViajeConGeometrias = function(c, ctx, tramos) {
    window.limpiarRecorridoSeleccionado();
    const puntos=[], combinar=Boolean(c.line1 && c.line2);
    const coord=s=>{const p=window.DV.coord(s);return p?[p.lat,p.lon]:null;};
    const etiqueta=(s,texto,fondo,ancho)=>{
      const p=coord(s); if(!p)return;
      puntos.push(p);
      capasCombinacion.push(L.marker(p,{icon:iconoEtiqueta(texto,fondo,ancho),zIndexOffset:2300}).addTo(mapa));
    };
    for(const [i,tramo] of tramos.entries()) {
      if(!Array.isArray(tramo)||tramo.length<2)continue;
      puntos.push(...tramo);
      capasCombinacion.push(
        L.polyline(tramo,{color:'#ffffff',weight:11,opacity:0.92,lineCap:'round',lineJoin:'round'}).addTo(mapa),
        L.polyline(tramo,{color:i===0?'#1769e0':'#7c3aed',weight:7,opacity:0.96,lineCap:'round',lineJoin:'round'}).addTo(mapa)
      );
    }
    etiqueta(c.origen,'SUBIR','#18a66a',58);
    if(combinar) {
      etiqueta(c.combinacion,'COMBINAR','#d79b00',78);
      if(String(c.combinacion.busstopId)!==String((c.combinacion2||c.combinacion).busstopId))
        etiqueta(c.combinacion2,'2° BUS','#7c3aed',68);
    }
    etiqueta(c.destino,'BAJAR','#e54b4b',62);
    for(const t of window.DV.tramosPie(c,ctx)) {
      const walk=crearTramoCaminataFinal([t.desde.lat,t.desde.lon],t.hasta);
      if(walk)capasCombinacion.push(walk.linea,walk.marcador);
      puntos.push([t.desde.lat,t.desde.lon],[t.hasta.lat,t.hasta.lon]);
    }
    if(puntos.length>1)mapa.fitBounds(L.latLngBounds(puntos),{
      paddingTopLeft:[45,55],paddingBottomRight:[45,55],maxZoom:15,animate:true
    });
    mapa.invalidateSize();
    return tramos.every(t=>Array.isArray(t)&&t.length>1);
  };
})();

