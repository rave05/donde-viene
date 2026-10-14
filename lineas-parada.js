/* Líneas, horarios y nombres de destino en paralelo; los buses no bloquean indefinidamente. */
(() => {
  window.obtenerLineasParadaRapido = async function(stopId, apiBase, cache, cacheMs, tiempos = {}) {
    const key = String(stopId), guardado = cache.get(key);
    const vigente = guardado && Date.now() - guardado.timestamp < cacheMs;
    const api = vigente ? Promise.resolve(guardado.data)
      : window.DVRed.json(apiBase + '/stops/' + encodeURIComponent(key) + '/lines', {}, tiempos.lineas || 5000);
    const programadas = window.obtenerLineasProgramadas
      ? window.DVRed.limitar(() => window.obtenerLineasProgramadas(stopId), tiempos.horarios || 8000)
      : Promise.resolve([]);
    const buses = vigente ? Promise.resolve([])
      : window.DVRed.json(apiBase + '/buses?busstopId=' + encodeURIComponent(key), {}, tiempos.buses || 2500);
    const [live, schedule, vehicles] = await Promise.allSettled([api, programadas, buses]);
    const gtfs = schedule.status === 'fulfilled' && Array.isArray(schedule.value) ? schedule.value : [];
    if (live.status === 'rejected' && !gtfs.length) throw live.reason;
    let lineas = live.status === 'fulfilled' && Array.isArray(live.value)
      ? live.value.map(linea => ({...linea})) : [];
    const info = new Map();
    if (vehicles.status === 'fulfilled' && Array.isArray(vehicles.value))
      for (const bus of vehicles.value) if (bus.lineVariantId != null) info.set(String(bus.lineVariantId),bus);
    lineas = lineas.map(linea => ({...linea,
      destination: linea.destination || info.get(String(linea.lineVariantId))?.destination || '',
      origin: linea.origin || info.get(String(linea.lineVariantId))?.origin || '',
    }));
    if (!vigente && live.status === 'fulfilled' && Array.isArray(live.value))
      cache.set(key,{timestamp:Date.now(),data:lineas.map(linea=>({...linea}))});
    const claves = new Set(lineas.map(l => String(l.line)+'|'+String(l.destination||'').trim().toUpperCase()));
    for (const linea of gtfs) {
      const clave = String(linea.line)+'|'+String(linea.destination||'').trim().toUpperCase();
      if (linea.line && !claves.has(clave)) {
        lineas.push({...linea,lineVariantId:null,source:'gtfs'});
        claves.add(clave);
      }
    }
    return lineas;
  };
})();
