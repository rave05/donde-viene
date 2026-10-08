(function () {
  'use strict';

  const CLAVE = 'donde-viene:lugares:v1';
  const normalizar = valor => String(valor || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const lista = document.getElementById('favoritosLista');
  const estado = document.getElementById('estadoFavoritos');
  const editor = document.getElementById('editorFavorito');
  const nombre = document.getElementById('nombreFavorito');
  const ubicacion = document.getElementById('lugarFavorito');
  const error = document.getElementById('errorFavorito');
  const guardar = document.getElementById('btnConfirmarFavorito');
  const eliminar = document.getElementById('btnEliminarFavorito');
  let editando = null;
  let versionEditor = 0;
  let problemaLectura = false;

  function leer() {
    try {
      const datos = JSON.parse(localStorage.getItem(CLAVE) || '[]');
      if (!Array.isArray(datos)) return [];
      const ids = new Set();
      const nombres = new Set();
      return datos.filter(p => {
        if (!p || typeof p.id !== 'string' || !p.id || typeof p.nombre !== 'string' ||
            !p.nombre.trim() || p.nombre.length > 40 || typeof p.ubicacion !== 'string' ||
            !p.ubicacion.trim() || p.ubicacion.length > 240 ||
            !Number.isFinite(p.lat) || !Number.isFinite(p.lon) ||
            p.lat < -35.05 || p.lat > -34.65 || p.lon < -56.45 || p.lon > -55.90 ||
            ids.has(p.id) || nombres.has(normalizar(p.nombre))) return false;
        ids.add(p.id); nombres.add(normalizar(p.nombre)); return true;
      }).slice(0, 20).map(p => ({ id: p.id, nombre: p.nombre.trim(), ubicacion: p.ubicacion.trim(), lat: p.lat, lon: p.lon }));
    } catch (_) {
      problemaLectura = true;
      return [];
    }
  }

  let favoritos = leer();
  const comoLugar = p => ({ nombre: p.nombre, consulta: p.ubicacion, categoria: 'favorito', lat: p.lat, lon: p.lon });
  window.obtenerLugaresFavoritos = () => favoritos.map(comoLugar);
  window.buscarLugarFavorito = texto => {
    const clave = normalizar(texto);
    const p = favoritos.find(p => normalizar(p.nombre) === clave) ||
      favoritos.find(p => normalizar(p.ubicacion) === clave);
    return p ? comoLugar(p) : null;
  };

  function escribir(nuevos) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(nuevos));
      favoritos = nuevos;
      renderizar();
      return true;
    } catch (_) {
      error.textContent = 'El navegador no pudo guardar el lugar. Revisá el espacio disponible o probá fuera de la navegación privada.';
      return false;
    }
  }

  function aplicar(p) {
    const esDestino = document.getElementById('campoFavorito').value !== 'origen';
    const input = document.getElementById(esDestino ? 'destinoRuta' : 'origenRuta');
    input.value = p.nombre;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (esDestino) resaltarLugarDestino(comoLugar(p));
    estado.textContent = p.nombre + ' elegido como ' + (esDestino ? 'destino' : 'origen') + '.';
  }

  function abrir(p = null, nombreInicial = '') {
    versionEditor++;
    editando = p?.id || null;
    nombre.value = p?.nombre || nombreInicial;
    const destinoActual = document.getElementById('destinoRuta').value.trim();
    const conocido = window.buscarLugarFavorito(destinoActual);
    ubicacion.value = p?.ubicacion || conocido?.consulta || destinoActual;
    error.textContent = '';
    guardar.disabled = false;
    guardar.textContent = 'Guardar';
    eliminar.hidden = !p;
    document.getElementById('tituloFavorito').textContent = p ? 'Editar lugar' : 'Guardar lugar';
    editor.showModal();
  }

  function renderizar() {
    lista.replaceChildren();
    for (const p of favoritos) {
      const item = document.createElement('div'); item.className = 'favorite-item';
      const usar = document.createElement('button'); usar.type = 'button'; usar.className = 'favorite-chip';
      const icono = normalizar(p.nombre) === 'casa' ? '🏠' : normalizar(p.nombre) === 'trabajo' ? '💼' : '⭐';
      usar.textContent = icono + ' ' + p.nombre;
      usar.title = p.ubicacion;
      usar.setAttribute('aria-label', 'Usar ' + p.nombre + ': ' + p.ubicacion);
      usar.addEventListener('click', () => aplicar(p));
      const editar = document.createElement('button'); editar.type = 'button'; editar.className = 'favorite-edit';
      editar.textContent = '⋯'; editar.setAttribute('aria-label', 'Editar ' + p.nombre);
      editar.addEventListener('click', () => abrir(p));
      item.append(usar, editar); lista.appendChild(item);
    }
    for (const etiqueta of ['Casa', 'Trabajo']) {
      if (favoritos.some(p => normalizar(p.nombre) === normalizar(etiqueta))) continue;
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'favorite-chip favorite-item favorite-empty';
      button.textContent = '+ ' + etiqueta;
      button.setAttribute('aria-label', 'Guardar ' + etiqueta);
      button.addEventListener('click', () => abrir(null, etiqueta)); lista.appendChild(button);
    }
  }

  document.getElementById('btnGuardarFavorito').addEventListener('click', () => abrir());
  document.getElementById('btnCerrarFavorito').addEventListener('click', () => editor.close());
  editor.addEventListener('close', () => { versionEditor++; });
  document.getElementById('formFavorito').addEventListener('submit', async event => {
    event.preventDefault();
    if (guardar.disabled) return;
    const etiqueta = nombre.value.trim();
    const direccion = ubicacion.value.trim();
    const actual = editando;
    const version = versionEditor;
    error.textContent = '';
    if (!etiqueta || etiqueta.length > 40 || !direccion || direccion.length > 240) {
      error.textContent = 'Escribí un nombre y una dirección o lugar.'; return;
    }
    if (/^(mi ubicacion|ubicacion actual)$/i.test(normalizar(direccion))) {
      error.textContent = 'Usá una dirección fija para guardar este lugar.'; return;
    }
    const reservado = (window.LUGARES_MONTEVIDEO || []).some(p =>
      [p.nombre, p.consulta, ...(p.aliases || [])].some(n => normalizar(n) === normalizar(etiqueta)));
    if (reservado) {
      error.textContent = 'Usá un nombre personal, como Casa, Trabajo o Mi hospital.'; return;
    }
    if (favoritos.some(p => p.id !== actual && normalizar(p.nombre) === normalizar(etiqueta))) {
      error.textContent = 'Ya tenés un lugar con ese nombre. Elegí otro nombre o editá el guardado.'; return;
    }
    if (!actual && favoritos.length >= 20) {
      error.textContent = 'Podés guardar hasta 20 lugares. Eliminá uno para agregar otro.'; return;
    }
    guardar.disabled = true; guardar.textContent = 'Buscando lugar…';
    try {
      const punto = await geocodificarRuta(direccion);
      if (version !== versionEditor) return;
      if (!punto || !Number.isFinite(punto.lat) || !Number.isFinite(punto.lon) ||
          punto.lat < -35.05 || punto.lat > -34.65 || punto.lon < -56.45 || punto.lon > -55.90) {
        error.textContent = 'No encontramos ese lugar en Montevideo. Probá con una dirección más completa.'; return;
      }
      const nuevo = { id: actual || (window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)),
        nombre: etiqueta, ubicacion: direccion, lat: punto.lat, lon: punto.lon };
      const nuevos = actual ? favoritos.map(p => p.id === actual ? nuevo : p) : [...favoritos, nuevo];
      if (escribir(nuevos)) {
        editor.close(); estado.textContent = etiqueta + ' guardado en este navegador.';
      }
    } catch (_) {
      if (version === versionEditor) error.textContent = 'No pudimos buscar el lugar. Revisá la conexión e intentá nuevamente.';
    } finally {
      if (version === versionEditor) { guardar.disabled = false; guardar.textContent = 'Guardar'; }
    }
  });
  eliminar.addEventListener('click', () => {
    if (guardar.disabled || !editando) return;
    const p = favoritos.find(p => p.id === editando);
    if (escribir(favoritos.filter(p => p.id !== editando))) {
      editor.close(); estado.textContent = (p?.nombre || 'Lugar') + ' eliminado.';
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === CLAVE || event.key === null) { favoritos = leer(); renderizar(); }
  });

  iniciarSugerenciasLugares(ubicacion);
  renderizar();
  if (problemaLectura) estado.textContent = 'No pudimos leer los lugares guardados en este navegador.';

  const aviso = document.getElementById('avisoInstalacion');
  const ayuda = document.getElementById('ayudaInstalacion');
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  let oculto = false;
  try { oculto = localStorage.getItem('donde-viene:ocultar-instalacion') === '1'; } catch (_) {}
  aviso.hidden = !esIOS || instalada || oculto;
  document.getElementById('btnAyudaInstalacion').addEventListener('click', () => ayuda.showModal());
  document.getElementById('btnCerrarInstalacion').addEventListener('click', () => ayuda.close());
  document.getElementById('btnOcultarInstalacion').addEventListener('click', () => {
    aviso.hidden = true;
    try { localStorage.setItem('donde-viene:ocultar-instalacion', '1'); } catch (_) {}
  });
})();
