(() => {
  const cacheLineasHorarios = new Map();
  let manifiestoHorarios = null;

  function normalizarHorarioTexto(valor = '') {
    return String(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  async function cargarManifiestoHorarios() {
    if (manifiestoHorarios) {
      return manifiestoHorarios;
    }

    const respuesta = await fetch(
      './horarios/manifest.json',
      { cache: 'no-cache' }
    );

    if (!respuesta.ok) {
      return null;
    }

    manifiestoHorarios = await respuesta.json();
    return manifiestoHorarios;
  }

  let indiceParadasHorarios = null;

  async function cargarIndiceParadasHorarios() {
    if (indiceParadasHorarios) {
      return indiceParadasHorarios;
    }

    const respuesta = await fetch(
      './horarios/paradas.json',
      { cache: 'no-cache' }
    );

    if (!respuesta.ok) {
      return {};
    }

    indiceParadasHorarios = await respuesta.json();
    return indiceParadasHorarios;
  }

  window.obtenerLineasProgramadas = async function(stopId) {
    try {
      const indice = await cargarIndiceParadasHorarios();
      const lineas = indice?.[String(stopId)];

      return Array.isArray(lineas)
        ? lineas
        : [];
    } catch (error) {
      console.warn(
        'No se pudieron cargar las líneas programadas:',
        error
      );
      return [];
    }
  };

  async function cargarHorarioLinea(linea) {
    const clave = String(linea);

    if (cacheLineasHorarios.has(clave)) {
      return cacheLineasHorarios.get(clave);
    }

    const manifiesto = await cargarManifiestoHorarios();
    const archivo = manifiesto?.lines?.[clave];

    if (!archivo) {
      return null;
    }

    const respuesta = await fetch(
      './horarios/' + archivo,
      { cache: 'no-cache' }
    );

    if (!respuesta.ok) {
      return null;
    }

    const datos = await respuesta.json();
    cacheLineasHorarios.set(clave, datos);
    return datos;
  }

  function partesFechaMontevideo(fecha = new Date()) {
    const formateador = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: 'America/Montevideo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
        hourCycle: 'h23'
      }
    );

    return Object.fromEntries(
      formateador
        .formatToParts(fecha)
        .filter(p => p.type !== 'literal')
        .map(p => [p.type, p.value])
    );
  }

  function sumarDias(partes, dias) {
    const fecha = new Date(
      Date.UTC(
        Number(partes.year),
        Number(partes.month) - 1,
        Number(partes.day) + dias,
        12
      )
    );

    const formateador = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
      }
    );

    return Object.fromEntries(
      formateador
        .formatToParts(fecha)
        .filter(p => p.type !== 'literal')
        .map(p => [p.type, p.value])
    );
  }

  function claveFecha(partes) {
    return String(partes.year) + String(partes.month) + String(partes.day);
  }

  function servicioActivo(serviceId, partes, datos) {
    const fecha = claveFecha(partes);
    const excepciones = datos.exceptions?.[fecha] || {};

    if (
      Array.isArray(excepciones.remove) &&
      excepciones.remove.includes(serviceId)
    ) {
      return false;
    }

    if (
      Array.isArray(excepciones.add) &&
      excepciones.add.includes(serviceId)
    ) {
      return true;
    }

    const calendario = datos.services?.[serviceId];

    if (!calendario) {
      return false;
    }

    if (
      fecha < calendario.start ||
      fecha > calendario.end
    ) {
      return false;
    }

    const indice = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6
    }[partes.weekday];

    return (
      indice != null &&
      calendario.days?.[indice] === '1'
    );
  }

  function segundosAHora(segundos) {
    const valor =
      ((Number(segundos) % 86400) + 86400) % 86400;

    const hh = String(
      Math.floor(valor / 3600)
    ).padStart(2, '0');

    const mm = String(
      Math.floor((valor % 3600) / 60)
    ).padStart(2, '0');

    return hh + ':' + mm;
  }

  async function obtenerProximoProgramado(seleccion) {
    const datos = await cargarHorarioLinea(seleccion.linea);

    if (!datos) {
      return null;
    }

    const parada =
      datos.stops?.[String(seleccion.stopId)];

    if (!parada) {
      return null;
    }

    let destinos = Object.keys(parada);

    if (!destinos.length) {
      return null;
    }

    const objetivo =
      normalizarHorarioTexto(seleccion.destination);

    if (objetivo) {
      const coincidencias = destinos.filter(destino => {
        const n = normalizarHorarioTexto(destino);

        return (
          n === objetivo
        );
      });

      if (!coincidencias.length) return null;
      destinos = coincidencias;
    }

    const referencia = seleccion.fechaReferencia ? new Date(seleccion.fechaReferencia) : new Date();
    if (!Number.isFinite(referencia.getTime())) return null;
    const ahora = partesFechaMontevideo(referencia);

    const segundosAhora =
      Number(ahora.hour) * 3600 +
      Number(ahora.minute) * 60 +
      Number(ahora.second);

    let mejor = null;

    for (let desplazamiento = -1; desplazamiento <= 7; desplazamiento++) {
      const fecha = sumarDias(ahora, desplazamiento);

      for (const destino of destinos) {
        const servicios = parada[destino];

        for (const [serviceId, horarios] of Object.entries(servicios)) {
          if (
            !servicioActivo(serviceId, fecha, datos) ||
            !Array.isArray(horarios)
          ) {
            continue;
          }

          for (const segundos of horarios) {
            const diferencia =
              desplazamiento * 86400 +
              Number(segundos) -
              segundosAhora;

            if (diferencia < 0) {
              continue;
            }

            if (!mejor || diferencia < mejor.diferencia) {
              mejor = {
                diferencia,
                segundos: Number(segundos),
                destino
              };
            }
          }
        }
      }
    }

    if (!mejor) {
      return null;
    }

    return {
      found: true,
      secondsUntil: mejor.diferencia,
      date: new Date(referencia.getTime() + mejor.diferencia * 1000).toISOString(),
      time: segundosAHora(mejor.segundos),
      minutesUntil: Math.max(
        0,
        Math.round(mejor.diferencia / 60)
      ),
      destination: mejor.destino
    };
  }

  window.obtenerSalidaProgramada = obtenerProximoProgramado;

  window.agregarProximoProgramado = async function(seleccion) {
    if (
      !seleccion ||
      seleccion.sesionId !== sesionProximos
    ) {
      return;
    }

    try {
      const datos =
        await obtenerProximoProgramado(seleccion);

      if (
        seleccion.sesionId !== sesionProximos
      ) {
        return;
      }

      const tarjeta =
        document.createElement('div');

      tarjeta.className =
        'aviso-info horario-programado';

      if (datos?.found && datos.time) {
        const espera =
          formatearEsperaProgramada(
            datos.minutesUntil
          );

        tarjeta.innerHTML =
          '<div class="horario-cabecera">' +
            '<span class="horario-etiqueta">🕒 PROGRAMADO</span>' +
            '<span class="horario-no-vivo">No es ETA en vivo</span>' +
          '</div>' +
          '<div class="horario-principal">' +
            '<span class="horario-hora">' + datos.time + '</span>' +
            (espera ? '<span class="horario-espera">' + espera + '</span>' : '') +
          '</div>' +
          (
            datos.destination
              ? '<div class="horario-destino">→ ' + datos.destination + '</div>'
              : ''
          ) +
          '<span class="horario-aclaracion">' +
            'Horario planificado según GTFS. Puede sufrir modificaciones.' +
          '</span>';
      } else {
        tarjeta.innerHTML =
          '<div class="horario-cabecera">' +
            '<span class="horario-etiqueta">🕒 PROGRAMADO</span>' +
            '<span class="horario-no-vivo">Sin datos</span>' +
          '</div>' +
          '<div class="horario-destino">Sin horario programado disponible.</div>' +
          '<span class="horario-aclaracion">' +
            'Todavía no tenemos un horario estático para esta línea y parada.' +
          '</span>';
      }

      proximos.appendChild(tarjeta);

    } catch (error) {
      console.warn(
        'No se pudo consultar el horario programado local:',
        error
      );
    }
  };
})();

