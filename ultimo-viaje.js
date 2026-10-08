/* Conserva instrucciones y geometría del último viaje. No guarda vehículos, ETAs ni GPS en vivo. */
(() => {
  const DV = window.DV,
    KEY = "donde-viene-ultimo-v1";
  const section = document.createElement("details");
  section.className = "extras-block";
  section.innerHTML =
    '<summary>📄 Último viaje guardado</summary><p id="resumenUltimoViaje"></p><button id="btnAbrirUltimoViaje" type="button" class="extras-button">Ver instrucciones guardadas</button><button id="btnBorrarUltimoViaje" type="button" class="extras-button">Borrar copia</button><p id="estadoUltimoViaje" class="extras-status" role="status"></p>';
  document.getElementById("resultadoRuta").before(section);
  let copia = null;
  function valida(value) {
    return (
      value?.version === 1 &&
      DV.recetaValida(value.contexto) &&
      value.candidato?.origen &&
      value.candidato?.destino &&
      (value.candidato.line || value.candidato.line1) &&
      typeof value.guardado === "string" &&
      Number.isFinite(Date.parse(value.guardado)) &&
      Array.isArray(value.geometria) &&
      value.geometria.length <= 4 &&
      value.geometria.every(
        (line) =>
          Array.isArray(line) &&
          line.length <= 10000 &&
          line.every(
            (p) =>
              Array.isArray(p) &&
              p.length === 2 &&
              p.every(Number.isFinite) &&
              Math.abs(p[0]) <= 90 &&
              Math.abs(p[1]) <= 180,
          ),
      )
    );
  }
  function render() {
    document.getElementById("btnAbrirUltimoViaje").disabled = !copia;
    document.getElementById("btnBorrarUltimoViaje").disabled = !copia;
    document.getElementById("resumenUltimoViaje").textContent = copia
      ? copia.contexto.origen +
        " → " +
        copia.contexto.destino +
        " · Guardado " +
        DV.fechaTexto(copia.guardado)
      : "Seleccioná un viaje para guardar sus instrucciones automáticamente.";
  }
  function guardar(c, ctx, geometria = []) {
    const value = {
      version: 1,
      candidato: c,
      contexto: ctx,
      geometria,
      guardado: new Date().toISOString(),
    };
    if (
      !valida(value) ||
      JSON.stringify(value).length > 600000 ||
      !DV.guardar(KEY, value)
    ) {
      document.getElementById("estadoUltimoViaje").textContent =
        "No pudimos conservar la copia en este navegador.";
      return;
    }
    copia = value;
    render();
    document.getElementById("estadoUltimoViaje").textContent =
      "Instrucciones guardadas. Sin conexión no se actualizan las llegadas ni se garantiza la disponibilidad del mapa.";
  }
  const saved = DV.leer(KEY, null);
  if (valida(saved)) copia = saved;
  render();
  document
    .getElementById("btnAbrirUltimoViaje")
    .addEventListener("click", () => {
      if (!copia) return;
      if (document.getElementById("btnBuscarRuta").disabled) {
        document.getElementById("estadoUltimoViaje").textContent =
          "Esperá a que termine la búsqueda actual antes de abrir la copia.";
        return;
      }
      window.DV.planificador.aplicar(null);
      window.DondeVieneApp.restaurarViaje(
        copia.candidato,
        copia.contexto,
        copia.geometria,
      );
      section.open = true;
      document.getElementById("estadoUltimoViaje").textContent =
        "Mostrando una copia guardada, sin consultar llegadas en vivo. Reconectate y buscá nuevamente para actualizarla.";
    });
  document
    .getElementById("btnBorrarUltimoViaje")
    .addEventListener("click", () => {
      if (!DV.guardar(KEY, null)) {
        document.getElementById("estadoUltimoViaje").textContent =
          "No se pudo borrar la copia.";
        return;
      }
      copia = null;
      render();
    });
  window.addEventListener("offline", () => {
    section.open = true;
    document.getElementById("estadoUltimoViaje").textContent =
      "Sin conexión. Podés abrir las instrucciones guardadas.";
  });
  DV.ultimoViaje = { guardar };
  if ("serviceWorker" in navigator)
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .catch(() => {
        document.getElementById("estadoUltimoViaje").textContent =
          "Las instrucciones se guardan, pero el navegador no pudo preparar la apertura sin conexión.";
      });
})();
