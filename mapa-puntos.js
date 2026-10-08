/* Los puntos elegidos se codifican en el texto de búsqueda: funcionan también
   en viajes habituales y enlaces sin depender de un estado oculto del mapa. */
(() => {
  const DV = window.DV;
  const valido = (p) =>
    p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    p.lat >= -35.05 &&
    p.lat <= -34.65 &&
    p.lon >= -56.45 &&
    p.lon <= -55.9;
  function nombre(p) {
    return (
      "Punto en el mapa (" + p.lat.toFixed(6) + ", " + p.lon.toFixed(6) + ")"
    );
  }
  function resolver(texto) {
    const m = /^Punto en el mapa \((-?\d+\.\d{1,6}), (-?\d+\.\d{1,6})\)$/.exec(
      texto,
    );
    if (!m) return null;
    const p = { lat: Number(m[1]), lon: Number(m[2]) };
    return valido(p)
      ? { ...p, nombre: nombre(p), geocodificacionLocal: true }
      : null;
  }
  DV.puntosMapa = { resolver, nombre, valido };
  const panel = document.createElement("div");
  panel.className = "map-pick-controls";
  panel.innerHTML =
    '<div class="extras-row"><button type="button" class="extras-button" id="elegirOrigenMapa">Elegir origen en mapa</button><button type="button" class="extras-button" id="elegirDestinoMapa">Elegir destino en mapa</button></div><p id="estadoPuntoMapa" class="extras-status" role="status">Elegí un campo y después tocá un punto del mapa.</p><div id="accionesPuntoMapa" class="extras-row" hidden><button type="button" class="extras-button" id="confirmarPuntoMapa" disabled>Usar este punto</button><button type="button" class="extras-button" id="cancelarPuntoMapa">Cancelar</button></div>';
  document.querySelector(".map-card").prepend(panel);
  const estado = panel.querySelector("#estadoPuntoMapa"),
    acciones = panel.querySelector("#accionesPuntoMapa"),
    confirmar = panel.querySelector("#confirmarPuntoMapa");
  let campo = null,
    punto = null,
    liberar = null;
  function terminar() {
    liberar?.();
    liberar = null;
    window.DondeVieneApp.vistaPuntoMapa(null);
    document.getElementById("mapa").classList.remove("map-picking");
    acciones.hidden = true;
    panel
      .querySelector("#elegirOrigenMapa")
      .setAttribute("aria-pressed", "false");
    panel
      .querySelector("#elegirDestinoMapa")
      .setAttribute("aria-pressed", "false");
    campo = null;
    punto = null;
  }
  function iniciar(destino) {
    if (document.getElementById("btnBuscarRuta").disabled) {
      estado.textContent = "Esperá a que termine la búsqueda.";
      return;
    }
    if (document.body.classList.contains("trip-tracking-active")) {
      estado.textContent =
        "Terminá el seguimiento del viaje antes de cambiar el origen o destino.";
      return;
    }
    terminar();
    campo = destino;
    panel
      .querySelector(
        destino === "origen" ? "#elegirOrigenMapa" : "#elegirDestinoMapa",
      )
      .setAttribute("aria-pressed", "true");
    acciones.hidden = false;
    confirmar.disabled = true;
    estado.textContent = "Tocá un punto para elegir el " + campo + ".";
    document.getElementById("mapa").classList.add("map-picking");
    liberar = window.DondeVieneApp.alElegirPuntoMapa((p) => {
      punto = valido(p) ? p : null;
      confirmar.disabled = !punto;
      window.DondeVieneApp.vistaPuntoMapa(punto);
      estado.textContent = punto
        ? (campo === "origen" ? "Origen" : "Destino") +
          " elegido. Confirmá o tocá otro punto."
        : "Elegí un punto dentro de Montevideo y su área cercana.";
    });
  }
  panel
    .querySelector("#elegirOrigenMapa")
    .addEventListener("click", () => iniciar("origen"));
  panel
    .querySelector("#elegirDestinoMapa")
    .addEventListener("click", () => iniciar("destino"));
  panel.querySelector("#cancelarPuntoMapa").addEventListener("click", () => {
    terminar();
    estado.textContent =
      "Selección cancelada. Podés seguir usando el buscador.";
  });
  confirmar.addEventListener("click", () => {
    if (!punto || !campo) return;
    const elegido = { ...punto },
      destino = campo;
    const input = document.getElementById(destino + "Ruta");
    input.value = nombre(elegido);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    terminar();
    window.DondeVieneApp.marcarPuntoBusqueda(destino, elegido);
    estado.textContent =
      (destino === "origen" ? "Origen" : "Destino") +
      " agregado. Completá el otro campo y tocá “Buscar ruta”.";
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && campo) {
      terminar();
      estado.textContent = "Selección cancelada.";
    }
  });
  window.addEventListener("donde-viene:viaje-cambio", terminar);
})();
