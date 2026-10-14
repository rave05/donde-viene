/* Rotación manual: ningún permiso de brújula ni GPS nuevo. */
(() => {
  const app = window.DondeVieneApp;
  const map = document.getElementById('mapa');
  const panel = document.querySelector('.map-pick-controls');
  if (!map || !panel || !app?.puedeRotarMapa?.()) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'mapaVolverNorte';
  button.className = 'map-north-button';
  button.setAttribute('aria-controls', 'mapa');
  button.title = 'Volver al norte. Girá el mapa con dos dedos.';
  button.innerHTML = '<span class="map-north-label" aria-hidden="true">N</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 20 12 16 5 20Z" fill="#1769e0"/><path d="m12 3 0 13 7 4Z" fill="#c6283c"/></svg>';
  const needle = button.querySelector('svg');
  function update() {
    const bearing = app.orientacionMapa();
    needle.style.transform = 'rotate(' + bearing + 'deg)';
    button.setAttribute('aria-label', bearing === 0 ? 'Norte arriba. Girá el mapa con dos dedos.' : 'Volver al norte; mapa girado ' + Math.round(bearing) + ' grados.');
  }
  button.addEventListener('click', () => app.rotarMapa(0));
  button.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      app.rotarMapa(app.orientacionMapa() + (e.key === 'ArrowLeft' ? -15 : 15));
    } else if (e.key === 'Home') {e.preventDefault();app.rotarMapa(0);}
  });
  // En Safari evita el zoom de la página solo dentro del mapa, no en toda la app.
  for (const event of ['gesturestart','gesturechange','gestureend'])
    map.addEventListener(event, e => e.preventDefault(), {passive:false});
  panel.append(button);
  app.alRotarMapa(update);
  update();
})();
