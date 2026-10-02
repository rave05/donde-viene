(() => {
  const cacheRecorridos = new Map();
  let manifiestoRecorridos = null;
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

  function buscarParadaGlobal(stopId) {
    const clave = String(stopId);

    return (
      Array.isArray(window.todasLasParadas)
        ? window.todasLasParadas.find(
            parada =>
              String(parada?.busstopId) === clave
          )
        : null
    );
  }

  async function opcionesLineasPorParadas(paradas, maxLineas = 18) {
    const opciones = [];
    const vistas = new Set();

    for (const parada of paradas.slice(0, 30)) {
      const lineas =
        typeof window.obtenerLineasProgramadas === 'function'
          ? await window.obtenerLineasProgramadas(parada.busstopId)
          : [];

      for (const linea of lineas || []) {
        const numero = String(linea?.line || '');

        if (!numero || vistas.has(numero)) {
          continue;
        }

        vistas.add(numero);
        opciones.push({
          line: numero,
          destination: linea?.destination || '',
          parada
        });

        if (opciones.length >= maxLineas) {
          return opciones;
        }
      }
    }

    return opciones;
  }

  window.buscarCombinacionesRuta = async function(
    paradasOrigen,
    paradasDestino
  ) {
    try {
      const [opcionesOrigen, opcionesDestino] =
        await Promise.all([
          opcionesLineasPorParadas(paradasOrigen, 14),
          opcionesLineasPorParadas(paradasDestino, 14)
        ]);

      if (!opcionesOrigen.length || !opcionesDestino.length) {
        return [];
      }

      const lineasNecesarias =
        [...new Set([
          ...opcionesOrigen.map(item => item.line),
          ...opcionesDestino.map(item => item.line)
        ])];

      const datosPorLinea = new Map();

      await Promise.all(
        lineasNecesarias.map(async linea => {
          const datos = await cargarRecorridoLinea(linea);
          if (datos) {
            datosPorLinea.set(linea, datos);
          }
        })
      );

      const resultados = [];
      const vistos = new Set();
      const MAX_CAMINATA_TRANSFER = 350;

      function distanciaTransfer(paradaA, paradaB) {
        const a = paradaA?.location?.coordinates;
        const b = paradaB?.location?.coordinates;

        if (
          !Array.isArray(a) ||
          !Array.isArray(b)
        ) {
          return Infinity;
        }

        const lat1 = Number(a[1]);
        const lon1 = Number(a[0]);
        const lat2 = Number(b[1]);
        const lon2 = Number(b[0]);

        if (
          ![lat1, lon1, lat2, lon2]
            .every(Number.isFinite)
        ) {
          return Infinity;
        }

        const R = 6371000;
        const rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;

        const x =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1 * rad) *
          Math.cos(lat2 * rad) *
          Math.sin(dLon / 2) ** 2;

        return R * 2 * Math.atan2(
          Math.sqrt(x),
          Math.sqrt(1 - x)
        );
      }

      for (const primera of opcionesOrigen) {
        const patrones1 =
          datosPorLinea.get(primera.line)?.patterns || [];

        for (const segunda of opcionesDestino) {
          if (primera.line === segunda.line) {
            continue;
          }

          const patrones2 =
            datosPorLinea.get(segunda.line)?.patterns || [];

          for (const p1 of patrones1) {
            const stops1 =
              Array.isArray(p1.stops)
                ? p1.stops.map(String)
                : [];

            const iOrigen =
              stops1.indexOf(
                String(primera.parada.busstopId)
              );

            if (
              iOrigen < 0 ||
              iOrigen >= stops1.length - 1
            ) {
              continue;
            }

            const posteriores =
              stops1
                .slice(iOrigen + 1)
                .slice(0, 60)
                .map((stopId, offset) => ({
                  stopId,
                  index: iOrigen + 1 + offset,
                  parada: buscarParadaGlobal(stopId)
                }))
                .filter(item => item.parada);

            if (!posteriores.length) {
              continue;
            }

            for (const p2 of patrones2) {
              const stops2 =
                Array.isArray(p2.stops)
                  ? p2.stops.map(String)
                  : [];

              const iDestino =
                stops2.indexOf(
                  String(segunda.parada.busstopId)
                );

              if (iDestino <= 0) {
                continue;
              }

              const anteriores =
                stops2
                  .slice(Math.max(0, iDestino - 60), iDestino)
                  .map((stopId, offset) => ({
                    stopId,
                    index:
                      Math.max(0, iDestino - 60) + offset,
                    parada: buscarParadaGlobal(stopId)
                  }))
                  .filter(item => item.parada);

              if (!anteriores.length) {
                continue;
              }

              let mejorTransfer = null;

              for (const salida of posteriores) {
                for (const entrada of anteriores) {
                  const caminata =
                    distanciaTransfer(
                      salida.parada,
                      entrada.parada
                    );

                  if (
                    !Number.isFinite(caminata) ||
                    caminata > MAX_CAMINATA_TRANSFER
                  ) {
                    continue;
                  }

                  const scoreTramo =
                    (salida.index - iOrigen) +
                    (iDestino - entrada.index);

                  const puntajeTransfer =
                    scoreTramo * 35 +
                    caminata * 2.5;

                  if (
                    !mejorTransfer ||
                    puntajeTransfer <
                      mejorTransfer.puntajeTransfer
                  ) {
                    mejorTransfer = {
                      paradaBajar:
                        salida.parada,
                      paradaSubir:
                        entrada.parada,
                      caminata,
                      puntajeTransfer
                    };
                  }
                }
              }

              if (!mejorTransfer) {
                continue;
              }

              const clave =
                primera.line + '|' +
                segunda.line + '|' +
                String(
                  mejorTransfer.paradaBajar.busstopId
                ) + '|' +
                String(
                  mejorTransfer.paradaSubir.busstopId
                );

              if (vistos.has(clave)) {
                continue;
              }

              vistos.add(clave);

              resultados.push({
                tipo: 'combinacion',
                line1: primera.line,
                destination1:
                  p1.destination ||
                  primera.destination ||
                  '',
                line2: segunda.line,
                destination2:
                  p2.destination ||
                  segunda.destination ||
                  '',
                origen: primera.parada,
                combinacion:
                  mejorTransfer.paradaBajar,
                combinacion2:
                  mejorTransfer.paradaSubir,
                caminataCombinacion:
                  mejorTransfer.caminata,
                destino: segunda.parada,
                puntaje:
                  Number(
                    primera.parada.distanciaRuta || 0
                  ) +
                  Number(
                    segunda.parada.distanciaRuta || 0
                  ) +
                  mejorTransfer.puntajeTransfer
              });
            }
          }
        }
      }

      return resultados
        .sort((a, b) => a.puntaje - b.puntaje)
        .slice(0, 6);

    } catch (error) {
      console.warn(
        'No se pudieron buscar combinaciones:',
        error
      );
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
      String(paradaDesde?.busstopId || '');

    const hastaId =
      String(paradaHasta?.busstopId || '');

    let compatibles =
      patrones.filter(patron => {
        const stops =
          Array.isArray(patron.stops)
            ? patron.stops.map(String)
            : [];

        const iDesde = stops.indexOf(desdeId);
        const iHasta = stops.indexOf(hastaId);

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

  };
})();
