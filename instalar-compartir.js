/* Instalar es opcional. Compartir la app nunca incluye la búsqueda ni el GPS. */
(() => {
  'use strict';
  const card = document.getElementById('avisoInstalacion');
  if (!card) return;
  const install = document.getElementById('btnAyudaInstalacion');
  const share = document.getElementById('btnCompartirApp');
  const dismiss = document.getElementById('btnOcultarInstalacion');
  const reopen = document.getElementById('btnReabrirInstalacion');
  const dialog = document.getElementById('ayudaInstalacion');
  const close = document.getElementById('btnCerrarInstalacion');
  const status = document.getElementById('estadoCompartirApp');
  const manual = document.getElementById('enlaceCompartirApp');
  const key = 'donde-viene:ocultar-instalacion';
  const appURL = new URL('./', location.href).href;
  const display = window.matchMedia('(display-mode: standalone)');
  let installed = navigator.standalone === true || display.matches;
  let deferred = null;
  let busy = false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(navigator.userAgent);
  function readDismissed() {
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
  }
  function update() {
    card.querySelector('strong').textContent = installed ? 'Compartí DondeViene' : 'Tu viaje, a un toque';
    card.querySelector('div p').textContent = installed ? 'Pasale la app a alguien que viaje en bus.' : 'Agregá DondeViene al inicio o compartila con alguien.';
    install.hidden = installed;
    install.disabled = busy;
    install.textContent = deferred ? 'Instalar app' : 'Cómo instalarla';
  }
  card.hidden = installed || readDismissed();
  update();
  function instructions() {
    document.getElementById('introInstalacion').textContent = ios ? 'En iPhone o iPad, seguí estos pasos en Safari.' : android ? 'En Android, la opción depende del navegador. Si no aparece, probá abrir el enlace en Chrome.' : 'Podés instalarla si tu navegador ofrece esa opción, o seguir usando el enlace.';
    const steps = ios ? [
      'Abrí DondeViene en Safari.',
      'Tocá Compartir; según la versión, puede estar dentro del menú de Safari.',
      'Elegí Agregar a Inicio o Agregar a la pantalla de inicio. Si no aparece, revisá Editar acciones al final de la lista.',
      'Si aparece Abrir como app web, activalo. Luego tocá Agregar.'
    ] : android ? [
      'Abrí el menú del navegador (normalmente ⋮).',
      'Elegí Instalar app o Agregar a pantalla de inicio, si aparece.',
      'Confirmá la instalación o el acceso directo.'
    ] : [
      'Buscá el icono de instalación junto a la dirección o abrí el menú del navegador.',
      'Elegí Instalar DondeViene o Instalar esta página como aplicación, si aparece.',
      'Confirmá. Si esa opción no está disponible, guardá la página en favoritos.'
    ];
    document.getElementById('pasosInstalacion').replaceChildren(...steps.map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else { dialog.setAttribute('open', ''); }
  }
  window.addEventListener('beforeinstallprompt', event => {
    if (installed) return;
    event.preventDefault(); deferred = event; update();
  });
  window.addEventListener('appinstalled', () => {
    const firstConfirmation = !installed;
    installed = true; deferred = null; update();
    if (firstConfirmation) window.dispatchEvent(new Event('donde-viene:app-instalada'));
    status.textContent = 'DondeViene instalada. Podés abrirla desde su icono.';
  });
  display.addEventListener?.('change', event => {
    installed = navigator.standalone === true || event.matches; update();
  });
  install.addEventListener('click', async () => {
    if (installed || busy) return;
    if (!deferred) { instructions(); return; }
    const prompt = deferred; deferred = null; busy = true; update();
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      status.textContent = result.outcome === 'accepted' ? 'Instalación solicitada. Seguí los pasos del navegador.' : 'Podés seguir usando DondeViene sin instalarla.';
    } catch {
      status.textContent = 'No pudimos abrir la instalación. Podés seguir los pasos manuales.';
      instructions();
    } finally { busy = false; update(); }
  });
  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    install.focus({preventScroll:true});
  }
  close.addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog();
  }});
  dialog.addEventListener('close', () => install.focus({preventScroll:true}));
  dismiss.addEventListener('click', () => {
    card.hidden = true;
    try { localStorage.setItem(key, '1'); } catch {}
    reopen.focus({preventScroll:true});
  });
  reopen.addEventListener('click', () => {
    card.hidden = false;
    card.scrollIntoView?.({block:'center',behavior:'smooth'});
    (installed ? share : install).focus({preventScroll:true});
  });
  function manualCopy() {
    manual.value = appURL; manual.hidden = false;
    manual.focus({preventScroll:true}); manual.select();
    status.textContent = 'Copiá este enlace para compartir DondeViene.';
  }
  share.addEventListener('click', async () => {
    if (share.disabled) return;
    share.disabled = true; manual.hidden = true; status.textContent = '';
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({title:'¿Dónde Viene?',text:'Encontrá buses y combinaciones para moverte por Montevideo y el área metropolitana.',url:appURL});
        window.dispatchEvent(new Event('donde-viene:app-compartida'));
        status.textContent = 'Se abrió la opción de compartir.';
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(appURL);
        window.dispatchEvent(new Event('donde-viene:enlace-app-copiado'));
        status.textContent = 'Enlace copiado. Pegalo donde quieras compartirlo.';
      } else manualCopy();
    } catch (error) {
      if (error?.name !== 'AbortError') manualCopy();
    } finally { share.disabled = false; }
  });
})();
