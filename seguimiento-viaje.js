(() => {
  let activo = false, watch = null, version = 0, seguir = true, ultima = null, reloj = null;
  const estado = () => document.getElementById('estadoSeguimientoViaje');
  const boton = () => document.getElementById('btnSeguirViaje');
  const centrar = () => document.getElementById('btnCentrarViaje');
  function informar(texto) { const e = estado(); if (e) { e.hidden = false; e.textContent = texto; } }
  function distancia(lat, lon, lat2, lon2) {
    const rad = Math.PI / 180;
    const a = Math.sin((lat2 - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon) * rad / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function detenerWatch() {
    version++;
    if (watch !== null) navigator.geolocation?.clearWatch(watch);
    watch = null;
  }
  function mostrarUltima() {
    if (!activo || !ultima || document.hidden) return;
    const edad = Date.now() - ultima.timestamp;
    if (edad > 30000) { informar('GPS sin actualizar. La posición mostrada es la última recibida.'); return; }
    if (ultima.accuracy > 150) { informar('GPS poco preciso (±' + Math.round(ultima.accuracy) + ' m). Esperando una mejor ubicación.'); return; }
    const resumen = document.querySelector('.trip-summary');
    const lat = Number(resumen?.dataset.bajadaLat), lon = Number(resumen?.dataset.bajadaLon);
    let texto = 'GPS activo · actualizado ' + new Date(ultima.timestamp).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (resumen?.dataset.bajadaLat && resumen?.dataset.bajadaLon && Number.isFinite(lat) && Number.isFinite(lon)) {
      const metros = distancia(ultima.lat, ultima.lon, lat, lon);
      texto += metros < 250 && ultima.accuracy <= 80 ? ' · Cerca de la parada final de bajada. Confirmá antes de bajar.' : ' · Bajada final a ' + (metros < 1000 ? Math.round(metros) + ' m' : (metros / 1000).toFixed(1).replace('.', ',') + ' km') + ' en línea recta';
    }
    informar(texto);
  }
  function observar() {
    detenerWatch();
    const sesion = version;
    informar('Buscando tu ubicación GPS…');
    try {
      watch = navigator.geolocation.watchPosition(pos => {
        if (!activo || sesion !== version || document.hidden) return;
        const {latitude: lat, longitude: lon, accuracy} = pos.coords;
        const timestamp = Number(pos.timestamp);
        if (![lat, lon, accuracy, timestamp].every(Number.isFinite) || accuracy < 0 || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
        ultima = {lat, lon, accuracy, timestamp};
        if (Date.now() - timestamp <= 30000 && accuracy <= 150) window.mapaSeguimientoViaje?.actualizar(lat, lon, accuracy, seguir);
        mostrarUltima();
      }, error => {
        if (!activo || sesion !== version) return;
        if (error.code === 1) {
          detener();
          informar('No hay permiso de ubicación. Permití el GPS en Safari y tocá “Ya subí” para reintentar. Podés continuar con los pasos manuales.');
        } else informar('No pudimos actualizar el GPS. Esperando señal; podés seguir con los pasos manuales.');
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    } catch (_) { detener(); informar('El navegador no pudo iniciar el GPS. Podés continuar con los pasos manuales.'); }
  }
  function iniciar() {
    if (activo) return;
    if (!navigator.geolocation) { informar('Este navegador no ofrece GPS. Podés continuar con los pasos manuales.'); return; }
    activo = true; seguir = true; ultima = null;
    document.body.classList.add('trip-tracking-active');
    if (boton()) { boton().textContent = 'Seguimiento GPS activo'; boton().disabled = true; }
    if (centrar()) centrar().hidden = true;
    document.getElementById('mapa')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    window.mapaSeguimientoViaje?.preparar();
    observar();
    reloj = setInterval(mostrarUltima, 5000);
  }
  function detener() {
    activo = false; detenerWatch(); clearInterval(reloj); reloj = null; ultima = null;
    document.body.classList.remove('trip-tracking-active');
    window.mapaSeguimientoViaje?.preparar();
    if (boton()) { boton().disabled = false; boton().textContent = 'Ya subí · seguir mi viaje'; }
    if (estado()) estado().hidden = true;
    if (centrar()) centrar().hidden = true;
  }
  window.seguimientoViaje = { iniciar, detener };
  window.mapaSeguimientoViaje?.alMover(() => {
    if (!activo) return;
    seguir = false;
    if (centrar()) centrar().hidden = false;
  });
  document.addEventListener('click', event => {
    if (!event.target.closest?.('#btnCentrarViaje') || !activo) return;
    seguir = true; if (centrar()) centrar().hidden = true;
    if (ultima && Date.now() - ultima.timestamp <= 30000 && ultima.accuracy <= 150) window.mapaSeguimientoViaje?.actualizar(ultima.lat, ultima.lon, ultima.accuracy, true);
  });
  document.addEventListener('visibilitychange', () => {
    if (!activo) return;
    if (document.hidden) { detenerWatch(); informar('Seguimiento pausado mientras la app está en segundo plano.'); }
    else observar();
  });
  window.addEventListener('donde-viene:viaje-cambio', detener);
  window.addEventListener('pagehide', detener);
})();
