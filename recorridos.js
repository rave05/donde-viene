(() => {
  const cacheRecorridos = new Map();
  let manifiestoRecorridos = null;
  let lineaRecorridoMapa = null;

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
  };

  window.dibujarRecorridoSeleccionado = async function(candidato) {
    try {
      window.limpiarRecorridoSeleccionado();

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
        String(candidato.origen.busstopId);

      const destinoId =
        String(candidato.destino.busstopId);

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
            paradas.indexOf(origenId);

          const iDestino =
            paradas.indexOf(destinoId);

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

      const desde =
        Math.min(iShapeOrigen, iShapeDestino);

      const hasta =
        Math.max(iShapeOrigen, iShapeDestino);

      const tramo =
        shape.slice(desde, hasta + 1);

      if (tramo.length < 2) {
        return false;
      }

      lineaRecorridoMapa =
        L.polyline(
          tramo,
          {
            color: '#1769e0',
            weight: 6,
            opacity: 0.86,
            lineCap: 'round',
            lineJoin: 'round'
          }
        )
        .addTo(mapa);

      mapa.fitBounds(
        lineaRecorridoMapa.getBounds(),
        {
          padding: [55, 55],
          maxZoom: 15,
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
})();
