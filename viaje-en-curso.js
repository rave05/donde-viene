/* Recupera instrucciones y avance manual. Nunca guarda ni reinicia el GPS o las llegadas. */
(() => {
  const DV = window.DV,
    KEY = "donde-viene-en-curso-v1",
    MAX_EDAD = 12 * 60 * 60 * 1000;
  const panel = document.createElement("section");
  panel.className = "extras-block trip-recovery";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Recuperar viaje sin finalizar");
  panel.innerHTML =
    '<strong>Tenés un viaje sin finalizar</strong><p id="resumenViajeRecuperable"></p><p class="extras-note">Retomá el paso donde estabas. Las llegadas guardadas no están en vivo; el GPS se activa cuando vos lo pidas.</p><div class="extras-row"><button id="btnRetomarViajeGuardado" class="extras-button" type="button">Retomar viaje</button><button id="btnDescartarViajeGuardado" class="extras-button" type="button">Descartar</button></div><p id="estadoRecuperacionViaje" class="extras-status" role="status"></p>';
  document.querySelector(".route-planner")?.before(panel);
  if (!panel.isConnected) document.querySelector("main")?.prepend(panel);
  let recuperando = false,
    pendiente = null;
  const estado = panel.querySelector("#estadoRecuperacionViaje");
  function valida(value) {
    if (!value || value.version !== 1 || !Number.isFinite(value.guardado))
      return false;
    const edad = Date.now() - value.guardado;
    return (
      edad >= 0 &&
      edad <= MAX_EDAD &&
      window.guiaViaje.validaEstado(value.guia) &&
      DV.ultimoViaje.valida(value.recorrido) &&
      JSON.stringify(value).length <= 700000
    );
  }
  function descartar() {
    if (recuperando) return;
    if (!DV.guardar(KEY, null)) {
      panel.querySelector("strong").textContent =
        "No pudimos borrar el avance guardado";
      panel.querySelector("#btnRetomarViajeGuardado").hidden = true;
      panel.querySelector("#btnDescartarViajeGuardado").textContent =
        "Reintentar borrado";
      estado.textContent =
        "El registro podría reaparecer al abrir la app. Reintentá el borrado o revisá los permisos de almacenamiento del navegador.";
      panel.hidden = false;
      return;
    }
    pendiente = null;
    panel.hidden = true;
  }
  function guardar() {
    if (recuperando) return;
    const guia = window.guiaViaje.estado(),
      recorrido = DV.ultimoViaje.obtenerCopia();
    if (!guia || !recorrido) return;
    const value = { version: 1, guardado: Date.now(), guia, recorrido };
    if (!valida(value) || !DV.guardar(KEY, value)) {
      const nota = document.getElementById("estadoGuiaViaje");
      if (nota) {
        nota.hidden = false;
        nota.textContent =
          "No pudimos guardar el avance. El viaje sigue en esta pantalla, pero podría perderse si cerrás la app.";
      }
      return;
    }
    pendiente = null;
    panel.hidden = true;
  }
  const saved = DV.leer(KEY, null);
  if (valida(saved)) {
    pendiente = saved;
    panel.querySelector("#resumenViajeRecuperable").textContent =
      saved.recorrido.contexto.origen +
      " → " +
      saved.recorrido.contexto.destino +
      " · Paso " +
      (saved.guia.indice + 1) +
      " de " +
      saved.guia.pasos.length +
      " · Guardado " +
      DV.fechaTexto(saved.guardado);
    panel.hidden = false;
  } else if (saved) DV.guardar(KEY, null);
  panel
    .querySelector("#btnRetomarViajeGuardado")
    .addEventListener("click", () => {
      if (!pendiente || !valida(pendiente)) {
        descartar();
        return;
      }
      const value = pendiente;
      recuperando = true;
      try {
        if (!DV.ultimoViaje.restaurar(value.recorrido)) {
          estado.textContent =
            "Esperá a que termine la búsqueda actual y reintentá.";
          return;
        }
        if (!window.guiaViaje.retomar(value.guia))
          throw Error("No se pudo recuperar el paso");
        pendiente = null;
        panel.hidden = true;
        const nota = document.getElementById("estadoSeguimientoViaje");
        if (nota) {
          nota.hidden = false;
          nota.textContent =
            "Viaje recuperado. Tocá “Ya subí” si querés volver a activar el GPS para este tramo.";
        }
      } catch (_) {
        estado.textContent =
          "No pudimos recuperar el viaje. Podés reintentar o buscar una ruta nueva.";
      } finally {
        recuperando = false;
      }
      if (!pendiente) guardar();
    });
  panel
    .querySelector("#btnDescartarViajeGuardado")
    .addEventListener("click", descartar);
  for (const nombre of [
    "donde-viene:guia-actualizada",
    "donde-viene:mapa-viaje-listo",
  ])
    window.addEventListener(nombre, guardar);
  for (const nombre of ["donde-viene:guia-cerrada", "donde-viene:viaje-cambio"])
    window.addEventListener(nombre, descartar);
})();
