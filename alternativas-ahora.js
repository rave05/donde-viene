/* Reconsulta voluntaria: conserva el destino y usa una posición recién validada. */
(() => {
  const app = window.DondeVieneApp, DV = window.DV;
  const dialog = document.getElementById('alternativasAhora');
  const estado = document.getElementById('estadoAlternativasAhora');
  const desdeAqui = document.getElementById('alternativasDesdeAqui');
  const mismoOrigen = document.getElementById('alternativasMismoOrigen');
  const abrir = document.createElement('button');
  abrir.type = 'button'; abrir.className = 'trip-change alternatives-trigger';
  abrir.textContent = 'Mi bus no llegó · Buscar alternativas';
  let receta = null, version = 0, ocupado = false, permitirDesde = 0;
  function cancelar() { version++; dialog.close(); }
  function registrar({detail}) {
    version++;
    receta = {origen: detail.contexto.origen, destino: detail.contexto.destino, preferencia: detail.contexto.preferencia || app.leerBusqueda().preferencia};
    document.querySelector('.trip-summary #btnEmpezarViaje')?.after(abrir);
  }
  window.addEventListener('donde-viene:viaje-elegido', registrar);
  window.addEventListener('donde-viene:viaje-restaurado', registrar);
  window.addEventListener('donde-viene:viaje-cambio', () => { version++; receta = null; abrir.remove(); if (dialog.open) dialog.close(); });
  abrir.addEventListener('click', () => {
    if (!receta) return;
    document.getElementById('destinoAlternativasAhora').textContent = 'Destino: ' + receta.destino;
    mismoOrigen.textContent = /^mi ubicaci[oó]n$/i.test(receta.origen) ? 'Actualizar mi ubicación y buscar' : 'Repetir desde el origen elegido';
    estado.textContent = '';
    dialog.showModal();
  });
  document.getElementById('cerrarAlternativasAhora').addEventListener('click', cancelar);
  dialog.addEventListener('cancel', () => { version++; });
  function posicionActual() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(Error('Este navegador no permite obtener tu ubicación.'));
      navigator.geolocation.getCurrentPosition(pos => {
        const {latitude: lat, longitude: lon, accuracy} = pos.coords;
        const timestamp = Number(pos.timestamp);
        if (![lat, lon, accuracy, timestamp].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || accuracy < 0 || accuracy > 150 || Date.now() - timestamp > 30000 || timestamp > Date.now() + 5000) {
          reject(Error('La ubicación es antigua o poco precisa. Reintentá o repetí desde el origen elegido.')); return;
        }
        resolve({lat, lon, accuracy});
      }, error => reject(Error(error?.code === 1 ? 'No tenemos permiso de ubicación. Podés repetir desde el origen elegido.' : 'No pudimos obtener tu ubicación. Reintentá o usá el origen elegido.')),
      {enableHighAccuracy: true, maximumAge: 0, timeout: 15000});
    });
  }
  async function buscar(usarGPS) {
    if (ocupado || !receta) return;
    if (navigator.onLine === false) { estado.textContent = 'Reconectate para consultar alternativas actuales. Tu viaje sigue disponible.'; return; }
    if (document.getElementById('btnBuscarRuta').disabled) { estado.textContent = 'Ya hay una búsqueda en curso.'; return; }
    if (Date.now() < permitirDesde) { estado.textContent = 'Esperá ' + Math.ceil((permitirDesde - Date.now()) / 1000) + ' s antes de volver a consultar.'; return; }
    const consulta = {...receta}, turno = version;
    ocupado = true; desdeAqui.disabled = mismoOrigen.disabled = true;
    try {
      let punto = null;
      if (usarGPS || /^mi ubicaci[oó]n$/i.test(consulta.origen)) {
        estado.textContent = 'Buscando una ubicación reciente…';
        punto = await posicionActual();
      }
      if (turno !== version || !dialog.open) return;
      if (navigator.onLine === false) throw Error('Se perdió la conexión. Tu viaje sigue disponible; reconectate para buscar.');
      if (document.getElementById('btnBuscarRuta').disabled) throw Error('Ya hay una búsqueda en curso. Esperá a que termine.');
      if (punto) { app.centrarUbicacionMapa(punto); consulta.origen = 'Mi ubicación'; }
      app.aplicarBusqueda(consulta);
      DV.planificador.aplicar(null);
      permitirDesde = Date.now() + 30000;
      dialog.close();
      await app.buscar();
    } catch (error) {
      if (turno === version && dialog.open) estado.textContent = error.message || 'No pudimos buscar alternativas. Tu viaje sigue disponible.';
    } finally {
      ocupado = false; desdeAqui.disabled = mismoOrigen.disabled = false;
    }
  }
  desdeAqui.addEventListener('click', () => buscar(true));
  mismoOrigen.addEventListener('click', () => buscar(false));
})();
