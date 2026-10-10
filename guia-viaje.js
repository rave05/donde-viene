(() => {
  let pasos = [];
  let indice = 0;
  let activa = false;
  const panel = document.createElement('section');
  panel.id = 'guiaViaje';
  panel.className = 'trip-guide';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Guía y seguimiento del viaje');
  panel.innerHTML = '<div class="trip-guide-header"><div><span id="progresoGuiaViaje" class="trip-guide-progress"></span><strong id="accionGuiaViaje" role="status"></strong></div><button id="btnSalirGuiaViaje" class="trip-guide-exit" type="button" aria-label="Minimizar guía del viaje">×</button></div>' +
    '<div id="avisoBajadaViaje" class="trip-alight-alert" role="status" aria-live="polite" aria-atomic="true" hidden></div><div class="trip-guide-controls"><button id="btnAnteriorGuiaViaje" class="trip-change" type="button">Anterior</button><button id="btnSiguienteGuiaViaje" class="trip-guide-next" type="button">Paso completado</button></div>' +
    '<button id="btnSeguirViaje" class="trip-start" type="button">Ya subí · seguir mi viaje</button><p id="estadoSeguimientoViaje" class="trip-tracking-status" role="status" hidden></p><button id="btnCentrarViaje" class="trip-change" type="button" hidden>Volver a seguirme</button><p class="trip-note">Al acercarte a la bajada, verás un aviso para este tramo. El seguimiento usa el GPS del teléfono. Mantené la app abierta y la pantalla encendida.</p>' +
    '<details id="detalleGuiaViaje"><summary>Detalles de este paso</summary><p id="descripcionGuiaViaje"></p><button id="btnMapaGuiaViaje" class="trip-change" type="button">Ver mapa</button></details>' +
    '<button id="btnPantallaViaje" class="trip-change" type="button" aria-pressed="false">Mantener pantalla encendida</button><p id="estadoPantallaViaje" class="trip-note" role="status" hidden></p>' +
    '<button id="btnAvisoViaje" class="trip-change" type="button">Activar aviso de viaje activo</button><p id="estadoAvisoViaje" class="trip-note" role="status" hidden></p><button id="btnTerminarGuiaViaje" class="trip-change" type="button">Finalizar viaje</button>';
  document.body.appendChild(panel);
  const volver = document.createElement('button');
  volver.id = 'btnVolverGuiaViaje';
  volver.className = 'trip-resume';
  volver.type = 'button';
  volver.textContent = '🚌 Viaje activo · volver';
  volver.hidden = true;
  document.body.appendChild(volver);
  const pantalla = document.getElementById('btnPantallaViaje');
  const estadoPantalla = document.getElementById('estadoPantallaViaje');
  let mantenerPantalla = false, bloqueoPantalla = null, pantallaVersion = 0, solicitandoPantalla = false;
  pantalla.hidden = !navigator.wakeLock?.request;
  function informarPantalla(texto) {
    estadoPantalla.textContent = texto;
    estadoPantalla.hidden = !texto;
    pantalla.setAttribute('aria-pressed', String(!!bloqueoPantalla && !bloqueoPantalla.released));
    pantalla.textContent = bloqueoPantalla ? 'Permitir que la pantalla se apague' : solicitandoPantalla ? 'Cancelar pantalla encendida' : 'Mantener pantalla encendida';
  }
  function liberarPantalla(conservar = false) {
    pantallaVersion++;
    solicitandoPantalla = false;
    mantenerPantalla = conservar && mantenerPantalla;
    const anterior = bloqueoPantalla;
    bloqueoPantalla = null;
    if (anterior && !anterior.released) Promise.resolve(anterior.release()).catch(() => {});
    informarPantalla(mantenerPantalla ? 'Pantalla encendida en pausa. Se reintentará cuando vuelvas a la app.' : '');
  }
  async function pedirPantalla() {
    if (!activa || !mantenerPantalla || document.hidden || !navigator.wakeLock?.request) return;
    const version = ++pantallaVersion;
    solicitandoPantalla = true;
    informarPantalla('Intentando mantener la pantalla encendida…');
    try {
      const bloqueo = await navigator.wakeLock.request('screen');
      if (version !== pantallaVersion || !activa || !mantenerPantalla || document.hidden) {
        if (!bloqueo.released) await bloqueo.release();
        return;
      }
      solicitandoPantalla = false;
      if (bloqueo.released) throw Error('Bloqueo liberado');
      bloqueoPantalla = bloqueo;
      bloqueo.addEventListener('release', () => {
        if (bloqueoPantalla !== bloqueo) return;
        bloqueoPantalla = null;
        if (!document.hidden) mantenerPantalla = false;
        informarPantalla(document.hidden ? 'Pantalla encendida en pausa. Se reintentará cuando vuelvas a la app.' : 'El teléfono liberó la pantalla encendida. Podés reintentar; revisá la batería y los ajustes de ahorro.');
      });
      informarPantalla('Pantalla encendida solicitada. Consume más batería; el teléfono puede desactivarla si necesita ahorrar energía.');
    } catch (_) {
      if (version !== pantallaVersion) return;
      solicitandoPantalla = false;
      mantenerPantalla = false;
      informarPantalla('No pudimos mantener la pantalla encendida. Revisá la batería y los ajustes del teléfono o reintentá.');
    }
  }
  pantalla.addEventListener('click', () => {
    if (!activa) return;
    if (mantenerPantalla) {
      liberarPantalla();
      informarPantalla('La pantalla vuelve a seguir los ajustes del teléfono.');
    } else {
      mantenerPantalla = true;
      pedirPantalla();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) liberarPantalla(true);
    else if (mantenerPantalla && activa) pedirPantalla();
  });
  window.addEventListener('pagehide', () => liberarPantalla());
  let avisoVersion = 0;
  const etiquetaAviso = 'donde-viene-viaje-activo';
  function informarAviso(texto) {
    const estado = document.getElementById('estadoAvisoViaje');
    estado.hidden = false;
    estado.textContent = texto;
  }
  async function limpiarAviso() {
    try {
      const registro = await navigator.serviceWorker?.getRegistration();
      const avisos = await registro?.getNotifications({ tag: etiquetaAviso });
      avisos?.forEach(aviso => aviso.close());
    } catch (_) {}
  }
  async function mostrarAviso(pedirPermiso = false) {
    const version = avisoVersion;
    if (!('Notification' in window) || !navigator.serviceWorker) {
      if (pedirPermiso) informarAviso('En iPhone, abrí la app desde su icono en Inicio para usar las notificaciones.');
      return;
    }
    try {
      let permiso = Notification.permission;
      if (pedirPermiso && permiso === 'default') permiso = await Notification.requestPermission();
      if (!activa || version !== avisoVersion) return;
      if (permiso !== 'granted') {
        if (pedirPermiso) informarAviso('El aviso necesita permiso de notificaciones. Podés revisarlo en los ajustes del dispositivo.');
        return;
      }
      const registro = await navigator.serviceWorker.getRegistration();
      if (!activa || version !== avisoVersion) return;
      if (!registro) throw new Error('Sin registro');
      await registro.showNotification('¿Dónde Viene? · Viaje activo', {
        body: 'Tenés un viaje en curso. Tocá para volver a la app. El GPS se pausa si la app queda en segundo plano.',
        tag: etiquetaAviso,
        icon: new URL('icons/bus-192.png', registro.scope).href,
        data: { tipo: 'viaje-activo' }
      });
      if (!activa || version !== avisoVersion) { await limpiarAviso(); return; }
      document.getElementById('btnAvisoViaje').hidden = true;
      informarAviso('Aviso de viaje activo enviado. Su visibilidad en la pantalla de bloqueo depende de los ajustes del teléfono.');
    } catch (_) {
      if (activa && version === avisoVersion) informarAviso('No pudimos mostrar el aviso. Podés reintentarlo con el botón.');
    }
  }
  const progreso = document.getElementById('progresoGuiaViaje');
  const accion = document.getElementById('accionGuiaViaje');
  const descripcion = document.getElementById('descripcionGuiaViaje');
  const anterior = document.getElementById('btnAnteriorGuiaViaje');
  const siguiente = document.getElementById('btnSiguienteGuiaViaje');
  const detalle = document.getElementById('detalleGuiaViaje');
  function renderizar() {
    const paso = pasos[indice];
    if (!activa || !paso) return;
    panel.hidden = false;
    volver.hidden = true;
    document.body.classList.add('trip-guide-active');
    progreso.textContent = 'Paso ' + (indice + 1) + ' de ' + pasos.length + ' · Avance manual';
    accion.textContent = paso.titulo;
    descripcion.textContent = paso.descripcion;
    anterior.disabled = indice === 0;
    siguiente.textContent = indice === pasos.length - 1 ? 'Terminé el viaje' : paso.bajada ? 'Ya bajé · continuar' : 'Paso completado';
    window.seguimientoViaje?.setTramo(paso.bajada);
    const boton = document.getElementById('btnEmpezarViaje');
    if (boton) boton.textContent = 'Viaje en curso';
    document.getElementById('btnSeguirViaje').hidden = !pasos.slice(indice).some(paso => paso.titulo.startsWith('🚌'));
    window.dispatchEvent(new Event('donde-viene:guia-actualizada'));
  }
  function cambiarPaso(nuevo) {
    if (nuevo !== indice) window.seguimientoViaje?.detener();
    indice = nuevo;
    detalle.open = false;
    renderizar();
  }
  function validaEstado(value) {
    return value && Array.isArray(value.pasos) && value.pasos.length > 0 && value.pasos.length <= 50 &&
      Number.isInteger(value.indice) && value.indice >= 0 && value.indice < value.pasos.length &&
      value.pasos.every(paso => {
        if (!paso || typeof paso.titulo !== 'string' || !paso.titulo.trim() || paso.titulo.length > 500 ||
          typeof paso.descripcion !== 'string' || paso.descripcion.length > 3000) return false;
        const b = paso.bajada;
        if (b == null) return true;
        if (typeof b.nombre !== 'string' || !b.nombre.trim() || b.nombre.length > 240) return false;
        if ((b.lat == null || b.lat === '') && (b.lon == null || b.lon === '')) return true;
        const coordValida = v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '');
        return coordValida(b.lat) && coordValida(b.lon) &&
          Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lon)) && Math.abs(Number(b.lat)) <= 90 && Math.abs(Number(b.lon)) <= 180;
      });
  }
  window.guiaViaje = {
    validaEstado,
    estado() { return activa ? { pasos: pasos.map(paso => ({ ...paso, bajada: paso.bajada ? { ...paso.bajada } : null })), indice } : null; },
    retomar(value) {
      if (!validaEstado(value)) return false;
      liberarPantalla();
      window.seguimientoViaje?.detener();
      pasos = value.pasos.map(paso => ({ ...paso, bajada: paso.bajada ? { ...paso.bajada } : null }));
      indice = value.indice;
      activa = true;
      avisoVersion++;
      document.getElementById('btnAvisoViaje').hidden = false;
      document.getElementById('estadoAvisoViaje').hidden = true;
      detalle.open = false;
      renderizar();
      window.dispatchEvent(new Event('donde-viene:guia-iniciada'));
      return true;
    }
  };
  function cerrar(terminado = false) {
    liberarPantalla();
    window.seguimientoViaje?.detener();
    activa = false;
    avisoVersion++;
    limpiarAviso();
    volver.hidden = true;
    window.dispatchEvent(new Event('donde-viene:guia-cerrada'));
    pasos = [];
    indice = 0;
    panel.hidden = true;
    detalle.open = false;
    document.body.classList.remove('trip-guide-active');
    const boton = document.getElementById('btnEmpezarViaje');
    if (boton) boton.textContent = terminado ? 'Volver a empezar' : 'Empezar viaje';
    const estado = document.getElementById('estadoGuiaViaje');
    if (estado) {
      estado.hidden = !terminado;
      estado.textContent = terminado ? 'Marcaste este viaje como terminado.' : '';
    }
  }
  document.addEventListener('click', event => {
    if (!event.target.closest?.('#btnEmpezarViaje')) return;
    if (activa) { renderizar(); return; }
    const resumen = document.querySelector('.trip-summary');
    pasos = Array.from(resumen?.querySelectorAll('.trip-steps li') || []).map(paso => ({
      titulo: paso.querySelector('strong')?.textContent || '',
      descripcion: paso.querySelector('span')?.textContent || '',
      bajada: paso.dataset?.bajadaNombre ? { nombre: paso.dataset.bajadaNombre, lat: paso.dataset.bajadaLat, lon: paso.dataset.bajadaLon } : null
    })).filter(paso => paso.titulo);
    if (!pasos.length) return;
    const estado = document.getElementById('estadoGuiaViaje');
    if (estado) { estado.hidden = true; estado.textContent = ''; }
    activa = true;
    avisoVersion++;
    document.getElementById('btnAvisoViaje').hidden = false;
    document.getElementById('estadoAvisoViaje').hidden = true;
    indice = 0;
    detalle.open = false;
    renderizar();
    window.dispatchEvent(new Event('donde-viene:guia-iniciada'));
    mostrarAviso();
  });
  document.getElementById('btnSeguirViaje').addEventListener('click', () => {
    if (!activa) return;
    const bus = pasos.findIndex((paso, i) => i >= indice && paso.titulo.startsWith('🚌'));
    if (bus < 0) return;
    if (indice < bus) cambiarPaso(bus);
    window.seguimientoViaje?.iniciar();
  });
  siguiente.addEventListener('click', () => {
    if (!activa) return;
    if (indice === pasos.length - 1) { cerrar(true); return; }
    cambiarPaso(indice + 1);
  });
  anterior.addEventListener('click', () => {
    if (!activa || indice === 0) return;
    cambiarPaso(indice - 1);
  });
  document.getElementById('btnSalirGuiaViaje').addEventListener('click', () => {
    panel.hidden = true;
    volver.hidden = !activa;
    document.body.classList.remove('trip-guide-active');
  });
  volver.addEventListener('click', renderizar);
  document.getElementById('btnTerminarGuiaViaje').addEventListener('click', () => cerrar(true));
  document.getElementById('btnAvisoViaje').addEventListener('click', () => mostrarAviso(true));
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.tipo === 'abrir-viaje-activo' && activa) renderizar();
  });
  document.getElementById('btnMapaGuiaViaje').addEventListener('click', () => {
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('mapa')?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'center' });
    detalle.open = false;
  });
  window.addEventListener('donde-viene:viaje-cambio', () => cerrar());
})();
