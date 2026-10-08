(() => {
  let pasos = [];
  let indice = 0;
  let activa = false;
  const panel = document.createElement('section');
  panel.id = 'guiaViaje';
  panel.className = 'trip-guide';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Guía y seguimiento del viaje');
  panel.innerHTML = '<div class="trip-guide-header"><div><span id="progresoGuiaViaje" class="trip-guide-progress"></span><strong id="accionGuiaViaje" role="status"></strong></div><button id="btnSalirGuiaViaje" class="trip-guide-exit" type="button" aria-label="Salir del modo viaje">×</button></div>' +
    '<div class="trip-guide-controls"><button id="btnAnteriorGuiaViaje" class="trip-change" type="button">Anterior</button><button id="btnSiguienteGuiaViaje" class="trip-guide-next" type="button">Paso completado</button></div>' +
    '<button id="btnSeguirViaje" class="trip-start" type="button">Ya subí · seguir mi viaje</button><p id="estadoSeguimientoViaje" class="trip-tracking-status" role="status" hidden></p><button id="btnCentrarViaje" class="trip-change" type="button" hidden>Volver a seguirme</button><p class="trip-note">El seguimiento usa el GPS del teléfono. Mantené la app abierta y la pantalla encendida.</p>' +
    '<details id="detalleGuiaViaje"><summary>Detalles de este paso</summary><p id="descripcionGuiaViaje"></p><button id="btnMapaGuiaViaje" class="trip-change" type="button">Ver mapa</button></details>';
  document.body.appendChild(panel);
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
    document.body.classList.add('trip-guide-active');
    progreso.textContent = 'Paso ' + (indice + 1) + ' de ' + pasos.length + ' · Avance manual';
    accion.textContent = paso.titulo;
    descripcion.textContent = paso.descripcion;
    anterior.disabled = indice === 0;
    siguiente.textContent = indice === pasos.length - 1 ? 'Terminé el viaje' : 'Paso completado';
    const boton = document.getElementById('btnEmpezarViaje');
    if (boton) boton.textContent = 'Viaje en curso';
  }
  function cerrar(terminado = false) {
    window.seguimientoViaje?.detener();
    activa = false;
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
      descripcion: paso.querySelector('span')?.textContent || ''
    })).filter(paso => paso.titulo);
    if (!pasos.length) return;
    const estado = document.getElementById('estadoGuiaViaje');
    if (estado) { estado.hidden = true; estado.textContent = ''; }
    activa = true;
    indice = 0;
    detalle.open = false;
    renderizar();
  });
  document.getElementById('btnSeguirViaje').addEventListener('click', () => {
    if (!activa) return;
    const bus = pasos.findIndex(paso => paso.titulo.startsWith('🚌'));
    if (indice < bus) { indice = bus; renderizar(); }
    window.seguimientoViaje?.iniciar();
  });
  siguiente.addEventListener('click', () => {
    if (!activa) return;
    if (indice === pasos.length - 1) { cerrar(true); return; }
    indice++;
    detalle.open = false;
    renderizar();
  });
  anterior.addEventListener('click', () => {
    if (!activa || indice === 0) return;
    indice--;
    detalle.open = false;
    renderizar();
  });
  document.getElementById('btnSalirGuiaViaje').addEventListener('click', () => cerrar());
  document.getElementById('btnMapaGuiaViaje').addEventListener('click', () => {
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('mapa')?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'center' });
    detalle.open = false;
  });
  window.addEventListener('donde-viene:viaje-cambio', () => cerrar());
})();
