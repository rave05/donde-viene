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

  function buscarParadaGlobal(stopId) {
    const claves =
      clavesCompatiblesParada(stopId);

    return (
      Array.isArray(window.todasLasParadas)
        ? window.todasLasParadas.find(
            parada =>
              claves.has(
                String(parada?.busstopId)
              )
          )
        : null
    );
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

  window.buscarCombinacionesRuta = async function(
    paradasOrigen,
    paradasDestino
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

      function entradasParadas(paradas, limite = 90) {
        const resultado = [];
        const vistos = new Set();

        const clavesCoords =
          Object.entries(red.coords || {});

        function claveGTFSmasCercana(parada) {
          const coords =
            parada?.location?.coordinates;

          if (!Array.isArray(coords)) {
            return null;
          }

          const lat =
            Number(coords[1]);

          const lon =
            Number(coords[0]);

          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
          ) {
            return null;
          }

          let mejor = null;

          for (const [clave, punto] of clavesCoords) {
            if (!Array.isArray(punto)) {
              continue;
            }

            const dLat =
              (Number(punto[0]) - lat);

            const dLon =
              (Number(punto[1]) - lon);

            const metros =
              Math.sqrt(
                dLat * dLat +
                dLon * dLon
              ) * 111000;

            if (
              metros <= 300 &&
              (!mejor || metros < mejor.metros)
            ) {
              mejor = {
                clave,
                metros
              };
            }
          }

          return mejor?.clave || null;
        }

        for (const parada of paradas.slice(0, 35)) {
          const claves =
            clavesCompatiblesParada(
              parada.busstopId
            );

          let encontroEntradas = false;

          for (const clave of claves) {
            const entradas =
              red.byStop[String(clave)] || [];

            if (entradas.length) {
              encontroEntradas = true;
            }

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

              const key =
                patronIndex + '|' +
                secuencia + '|' +
                String(parada.busstopId);

              if (vistos.has(key)) {
                continue;
              }

              vistos.add(key);

              resultado.push({
                patronIndex,
                secuencia,
                parada
              });

              if (resultado.length >= limite) {
                return resultado;
              }
            }
          }

          // Último fallback: si los IDs de API y GTFS no coinciden,
          // asociamos la parada a la parada GTFS más cercana (máx. 300 m).
          // Esto equivale a "caminar hasta la parada más cercana".
          if (!encontroEntradas) {
            const claveCercana =
              claveGTFSmasCercana(parada);

            const entradas =
              claveCercana
                ? red.byStop[String(claveCercana)] || []
                : [];

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

              const key =
                patronIndex + '|' +
                secuencia + '|geo|' +
                String(parada.busstopId);

              if (vistos.has(key)) {
                continue;
              }

              vistos.add(key);

              resultado.push({
                patronIndex,
                secuencia,
                parada
              });

              if (resultado.length >= limite) {
                return resultado;
              }
            }
          }
        }

        return resultado;
      }

      function distanciaStops(stopA, stopB) {
        const a =
          red.coords[String(stopA)];

        const b =
          red.coords[String(stopB)];

        if (
          !Array.isArray(a) ||
          !Array.isArray(b)
        ) {
          return Infinity;
        }

        const lat1 = Number(a[0]);
        const lon1 = Number(a[1]);
        const lat2 = Number(b[0]);
        const lon2 = Number(b[1]);

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

      const origenEntradas =
        entradasParadas(
          paradasOrigen,
          90
        );

      const destinoEntradas =
        entradasParadas(
          paradasDestino,
          90
        );

      if (
        !origenEntradas.length ||
        !destinoEntradas.length
      ) {
        return [];
      }

      const resultados = [];
      const vistos = new Set();
      const MAX_TRANSFER = 500;

      for (const origenItem of origenEntradas) {
        const p1 =
          red.patterns[origenItem.patronIndex];

        if (
          !p1 ||
          !Array.isArray(p1.s) ||
          origenItem.secuencia >= p1.s.length - 1
        ) {
          continue;
        }

        for (const destinoItem of destinoEntradas) {
          const p2 =
            red.patterns[destinoItem.patronIndex];

          if (
            !p2 ||
            !Array.isArray(p2.s) ||
            destinoItem.secuencia <= 0 ||
            String(p1.l) === String(p2.l)
          ) {
            continue;
          }

          let mejorTransfer = null;

          // Buscamos el punto de transferencia únicamente en el tramo
          // posterior al origen del primer bus y anterior al destino
          // del segundo bus.
          const inicio1 =
            origenItem.secuencia + 1;

          const fin1 =
            Math.min(
              p1.s.length,
              inicio1 + 75
            );

          const inicio2 =
            Math.max(
              0,
              destinoItem.secuencia - 75
            );

          for (
            let i = inicio1;
            i < fin1;
            i++
          ) {
            const stop1 =
              String(p1.s[i]);

            for (
              let j = inicio2;
              j < destinoItem.secuencia;
              j++
            ) {
              const stop2 =
                String(p2.s[j]);

              let caminata;

              if (stop1 === stop2) {
                caminata = 0;
              } else {
                caminata =
                  distanciaStops(
                    stop1,
                    stop2
                  );
              }

              if (
                !Number.isFinite(caminata) ||
                caminata > MAX_TRANSFER
              ) {
                continue;
              }

              const score =
                (i - origenItem.secuencia) * 28 +
                (destinoItem.secuencia - j) * 28 +
                caminata * 2.2;

              if (
                !mejorTransfer ||
                score < mejorTransfer.score
              ) {
                mejorTransfer = {
                  stop1,
                  stop2,
                  caminata,
                  score
                };
              }
            }
          }

          if (!mejorTransfer) {
            continue;
          }

          const paradaBajar =
            buscarParadaGlobal(
              mejorTransfer.stop1
            );

          const paradaSubir =
            buscarParadaGlobal(
              mejorTransfer.stop2
            );

          if (
            !paradaBajar ||
            !paradaSubir
          ) {
            continue;
          }

          const clave =
            String(p1.l) + '|' +
            String(p2.l) + '|' +
            String(mejorTransfer.stop1) + '|' +
            String(mejorTransfer.stop2);

          if (vistos.has(clave)) {
            continue;
          }

          vistos.add(clave);

          resultados.push({
            tipo: 'combinacion',
            line1: String(p1.l),
            destination1:
              String(p1.d || ''),
            line2: String(p2.l),
            destination2:
              String(p2.d || ''),
            origen:
              origenItem.parada,
            combinacion:
              paradaBajar,
            combinacion2:
              paradaSubir,
            caminataCombinacion:
              mejorTransfer.caminata,
            destino:
              destinoItem.parada,
            puntaje:
              Number(
                origenItem.parada.distanciaRuta || 0
              ) +
              Number(
                destinoItem.parada.distanciaRuta || 0
              ) +
              mejorTransfer.score
          });
        }
      }

      let ordenados =
        resultados
          .sort((a, b) =>
            a.puntaje - b.puntaje
          )
          .slice(0, 6);

      // Fallback geográfico: si no encontramos una intersección por IDs
      // de parada, buscamos dos recorridos cuyos shapes se acerquen entre
      // sí. Esto cubre casos reales donde las paradas de combinación están
      // enfrentadas o usan identificadores distintos.
      if (!ordenados.length) {
        const origenLineas =
          [...new Set(
            origenEntradas
              .map(item =>
                red.patterns[item.patronIndex]?.l
              )
              .filter(Boolean)
          )]
          .slice(0, 18);

        const destinoLineas =
          [...new Set(
            destinoEntradas
              .map(item =>
                red.patterns[item.patronIndex]?.l
              )
              .filter(Boolean)
          )]
          .slice(0, 18);

        const datosLineas = new Map();

        await Promise.all(
          [...new Set([
            ...origenLineas,
            ...destinoLineas
          ])].map(async linea => {
            const datos =
              await cargarRecorridoLinea(linea);

            if (datos) {
              datosLineas.set(
                String(linea),
                datos
              );
            }
          })
        );

        const candidatosGeo = [];

        for (const linea1 of origenLineas) {
          const patrones1 =
            datosLineas.get(String(linea1))?.patterns || [];

          for (const linea2 of destinoLineas) {
            if (String(linea1) === String(linea2)) {
              continue;
            }

            const patrones2 =
              datosLineas.get(String(linea2))?.patterns || [];

            for (const p1 of patrones1.slice(0, 10)) {
              for (const p2 of patrones2.slice(0, 10)) {
                if (
                  !Array.isArray(p1.shape) ||
                  !Array.isArray(p2.shape)
                ) {
                  continue;
                }

                let mejor = null;

                // Muestreo para mantener el cálculo liviano.
                const paso1 =
                  Math.max(1, Math.floor(p1.shape.length / 120));

                const paso2 =
                  Math.max(1, Math.floor(p2.shape.length / 120));

                for (let i = 0; i < p1.shape.length; i += paso1) {
                  const a = p1.shape[i];

                  for (let j = 0; j < p2.shape.length; j += paso2) {
                    const b = p2.shape[j];

                    const d =
                      Math.sqrt(
                        distanciaSimple(
                          a[0], a[1],
                          b[0], b[1]
                        )
                      ) * 111000;

                    if (
                      d <= 500 &&
                      (!mejor || d < mejor.d)
                    ) {
                      mejor = {
                        d,
                        punto1: a,
                        punto2: b
                      };
                    }
                  }
                }

                if (!mejor) {
                  continue;
                }

                const parada1 =
                  Array.isArray(window.todasLasParadas)
                    ? window.todasLasParadas
                        .map(parada => {
                          const coords =
                            parada.location?.coordinates;

                          if (!Array.isArray(coords)) {
                            return null;
                          }

                          return {
                            parada,
                            d:
                              distanciaSimple(
                                Number(coords[1]),
                                Number(coords[0]),
                                mejor.punto1[0],
                                mejor.punto1[1]
                              )
                          };
                        })
                        .filter(Boolean)
                        .sort((a, b) => a.d - b.d)[0]?.parada
                    : null;

                const parada2 =
                  Array.isArray(window.todasLasParadas)
                    ? window.todasLasParadas
                        .map(parada => {
                          const coords =
                            parada.location?.coordinates;

                          if (!Array.isArray(coords)) {
                            return null;
                          }

                          return {
                            parada,
                            d:
                              distanciaSimple(
                                Number(coords[1]),
                                Number(coords[0]),
                                mejor.punto2[0],
                                mejor.punto2[1]
                              )
                          };
                        })
                        .filter(Boolean)
                        .sort((a, b) => a.d - b.d)[0]?.parada
                    : null;

                if (!parada1 || !parada2) {
                  continue;
                }

                candidatosGeo.push({
                  tipo: 'combinacion',
                  line1: String(linea1),
                  destination1: String(p1.destination || ''),
                  line2: String(linea2),
                  destination2: String(p2.destination || ''),
                  origen: paradasOrigen[0],
                  combinacion: parada1,
                  combinacion2: parada2,
                  caminataCombinacion: mejor.d,
                  destino: paradasDestino[0],
                  puntaje:
                    Number(paradasOrigen[0]?.distanciaRuta || 0) +
                    Number(paradasDestino[0]?.distanciaRuta || 0) +
                    mejor.d * 2.5
                });
              }
            }
          }
        }

        ordenados =
          candidatosGeo
            .sort((a, b) =>
              a.puntaje - b.puntaje
            )
            .slice(0, 6);
      }

      return ordenados;

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
