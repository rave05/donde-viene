/* Une módulos mediante eventos, sin modificar el algoritmo de búsqueda ni seguir GPS por su cuenta. */
(() => {
  const DV = window.DV;
  let seleccionado = null;
  const creditos = document.createElement("p");
  creditos.className = "extras-note";
  creditos.innerHTML =
    'Caminatas: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · Puntos de recarga: Intendencia de Montevideo.';
  document.querySelector(".map-card").after(creditos);
  function aplicar({ candidato, contexto }) {
    seleccionado = { candidato, contexto };
    if (candidato.caminos)
      window.DondeVieneApp.dibujarCaminatas(candidato.caminos);
  }
  window.addEventListener("donde-viene:viaje-cambio", () => {
    seleccionado = null;
  });
  window.addEventListener("donde-viene:viaje-elegido", (e) => {
    aplicar(e.detail);
    DV.ultimoViaje.guardar(e.detail.candidato, e.detail.contexto, []);
  });
  window.addEventListener("donde-viene:mapa-viaje-listo", (e) => {
    if (seleccionado?.candidato !== e.detail.candidato) return;
    aplicar(e.detail);
    DV.ultimoViaje.guardar(
      e.detail.candidato,
      e.detail.contexto,
      window.obtenerGeometriaViajeActual?.() || [],
    );
  });
  window.addEventListener("donde-viene:viaje-restaurado", (e) =>
    aplicar(e.detail),
  );
})();
