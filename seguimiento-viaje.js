(() => {
  let activo = false, watch = null, version = 0, seguir = true, ultima = null, reloj = null, tramo = null;
  const estado = () => document.getElementById('estadoSeguimientoViaje');
  const boton = () => document.getElementById('btnSeguirViaje');
  const centrar = () => document.getElementById('btnCentrarViaje');
  function informar(texto) { const e = estado(); if (e) { e.hidden = false; e.textContent = texto; } }
  const aviso = () => document.getElementById('avisoBajadaViaje');
  function ocultarAviso() { if (aviso()) { aviso().hidden = true; aviso().textContent = ''; } }
  function setTramo(nuevo) { tramo = nuevo || null; ocultarAviso(); mostrarUltima(); }
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
    if (edad < 0 || edad > 30000) { ocultarAviso(); informar('GPS sin actualizar. La posición mostrada es la última recibida.'); return; }
    if (ultima.accuracy > 150) { ocultarAviso(); informar('GPS poco preciso (±' + Math.round(ultima.accuracy) + ' m). Esperando una mejor ubicación.'); return; }
    const lat = Number(tramo?.lat), lon = Number(tramo?.lon);
    let texto = 'GPS activo · actualizado ' + new Date(ultima.timestamp).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (tramo?.lat != null && tramo.lat !== '' && tramo.lon != null && tramo.lon !== '' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      const metros = distancia(ultima.lat, ultima.lon, lat, lon);
      texto += ' · Bajada de este tramo a ' + (metros < 1000 ? Math.round(metros) + ' m' : (metros / 1000).toFixed(1).replace('.', ',') + ' km') + ' en línea recta';
      if (metros <= 250 && ultima.accuracy <= 80) {
        const mensaje = '📍 Te estás acercando a tu bajada: ' + tramo.nombre + '. Confirmá la parada antes de bajar. Después tocá “Ya bajé · continuar”.';
        const e = aviso();
        if (e) { if (e.textContent !== mensaje) e.textContent = mensaje; e.hidden = false; }
      } else ocultarAviso();
    } else {
      ocultarAviso();
      if (tramo) texto += ' · Ubicación de la bajada sin confirmar. Consultá los detalles del paso.';
    }
    informar(texto);
  }
  function observar() {
    detenerWatch();
    ultima = null;
    ocultarAviso();
    const sesion = version;
    informar('Buscando tu ubicación GPS…');
    try {
      watch = navigator.geolocation.watchPosition(pos => {
        if (!activo || sesion !== version || document.hidden) return;
        const {latitude: lat, longitude: lon, accuracy} = pos.coords;
        const timestamp = Number(pos.timestamp);
        if (![lat, lon, accuracy, timestamp].every(Number.isFinite) || accuracy < 0 || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
        const ahora = Date.now();
        if (timestamp > ahora + 5000 || (ultima && timestamp < ultima.timestamp)) return;
        if (ahora - timestamp > 30000) { ocultarAviso(); informar('GPS sin actualizar. Esperando una ubicación reciente.'); return; }
        const recibido = Math.min(timestamp, ahora);
        ultima = {lat, lon, accuracy, timestamp: recibido};
        if (Date.now() - timestamp <= 30000 && accuracy <= 150) window.mapaSeguimientoViaje?.actualizar(lat, lon, accuracy, seguir);
        mostrarUltima();
      }, error => {
        if (!activo || sesion !== version) return;
        ultima = null;
        ocultarAviso();
        if (error.code === 1) {
          detener();
          informar('No hay permiso de ubicación. Permití la ubicación en los ajustes del navegador y tocá “Ya subí” para reintentar. Podés continuar con los pasos manuales.');
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
    if (activo) reloj = setInterval(mostrarUltima, 5000);
  }
  function detener() {
    activo = false; ocultarAviso(); detenerWatch(); clearInterval(reloj); reloj = null; ultima = null;
    document.body.classList.remove('trip-tracking-active');
    window.mapaSeguimientoViaje?.preparar();
    if (boton()) { boton().disabled = false; boton().textContent = 'Ya subí · seguir mi viaje'; }
    if (estado()) estado().hidden = true;
    if (centrar()) centrar().hidden = true;
  }
  window.seguimientoViaje = { iniciar, detener, setTramo };
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
    if (document.hidden) { ultima = null; ocultarAviso(); detenerWatch(); informar('Seguimiento pausado mientras la app está en segundo plano.'); }
    else observar();
  });
  window.addEventListener('donde-viene:viaje-cambio', detener);
  window.addEventListener('pagehide', detener);
})();
