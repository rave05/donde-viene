/* Paradas publicadas del tramo elegido. Se muestran al iniciar la guía, sin consultas de buses en vivo. */
(() => {
  const DV = window.DV;
  let candidato = null,
    activa = false,
    version = 0;
  function limpiar() {
    version++;
    document.getElementById("paradasDelViaje")?.remove();
    window.DondeVieneApp?.limpiarParadasViaje?.();
  }
  async function cargar(c) {
    return Promise.all(
      DV.tramosBus(c).map(async (t) => {
        let paradas = [];
        try {
          paradas = String(t.subida.busstopId).startsWith("mtop:")
            ? await DV.metro.paradasTramo(c)
            : await window.obtenerParadasTramoViaje(
                t.linea,
                t.destination,
                t.subida,
                t.bajada,
              );
        } catch (_) {}
        return { linea: t.linea, destino: t.destination, paradas };
      }),
    );
  }
  async function mostrar() {
    if (!activa || !candidato) return;
    const c = candidato,
      sesion = ++version;
    const resumen = document.querySelector(".trip-summary");
    if (!resumen) return;
    let panel = document.getElementById("paradasDelViaje");
    if (!panel) {
      panel = document.createElement("details");
      panel.id = "paradasDelViaje";
      panel.className = "trip-detail";
      resumen.appendChild(panel);
    }
    const abierta = panel.open;
    panel.innerHTML =
      '<summary>🚏 Cargando paradas del recorrido…</summary><div data-paradas-contenido role="status"></div>';
    const tramos = await cargar(c);
    if (sesion !== version || !activa || candidato !== c || !panel.isConnected)
      return;
    window.DondeVieneApp.mostrarParadasViaje(tramos);
    const total = tramos.reduce((n, t) => n + t.paradas.length, 0);
    panel.innerHTML =
      "<summary>🚏 Paradas del recorrido · " +
      total +
      '</summary><p class="trip-note">Tocá una parada para verla en el mapa. El listado corresponde al tramo elegido; solicitá la parada para bajar.</p>' +
      tramos
        .map(
          (t, i) =>
            "<section><h4>" +
            DV.escape(
              (tramos.length > 1 ? "Bus " + (i + 1) + " · " : "") +
                t.linea +
                " → " +
                t.destino,
            ) +
            "</h4>" +
            (!t.paradas.length
              ? '<p class="trip-note">No pudimos confirmar el listado de paradas de este tramo.</p>'
              : '<ol class="trip-stop-list">' +
                t.paradas
                  .map(
                    (p, j) =>
                      '<li><button type="button" class="extras-button" data-parada-viaje="' +
                      i +
                      ":" +
                      j +
                      '"' +
                      (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)
                        ? " disabled"
                        : "") +
                      ">" +
                      DV.escape(p.nombre) +
                      (j === 0
                        ? " · Subida"
                        : j === t.paradas.length - 1
                          ? " · Bajada elegida"
                          : "") +
                      "</button></li>",
                  )
                  .join("") +
                "</ol>") +
            "</section>",
        )
        .join("");
    panel.open = abierta;
  }
  for (const nombre of [
    "donde-viene:viaje-elegido",
    "donde-viene:viaje-restaurado",
  ])
    window.addEventListener(nombre, (e) => {
      limpiar();
      candidato = e.detail.candidato;
    });
  window.addEventListener("donde-viene:viaje-cambio", () => {
    activa = false;
    candidato = null;
    limpiar();
  });
  window.addEventListener("donde-viene:guia-iniciada", () => {
    activa = true;
    mostrar();
  });
  window.addEventListener("donde-viene:guia-cerrada", () => {
    activa = false;
    limpiar();
  });
  window.addEventListener("donde-viene:mapa-viaje-listo", (e) => {
    if (activa && candidato === e.detail.candidato) mostrar();
  });
  document.addEventListener("click", (e) => {
    const boton = e.target.closest?.("[data-parada-viaje]");
    if (boton)
      window.DondeVieneApp.enfocarParadaViaje(boton.dataset.paradaViaje);
  });
  DV.paradasViaje = { cargar };
})();
