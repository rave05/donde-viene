/* Compacta los controles existentes sin reemplazar sus listeners. */
(() => {
  const panel = document.querySelector(".map-pick-controls");
  if (!panel) return;
  const toolbar = document.createElement("div");
  toolbar.className = "map-gadget-bar";
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", "Herramientas del mapa");
  for (const [button, icon, label] of [
    [document.getElementById("elegirOrigenMapa"), "A", "Elegir origen en mapa"],
    [
      document.getElementById("elegirDestinoMapa"),
      "B",
      "Elegir destino en mapa",
    ],
    [panel.querySelector(".map-expand-button"), "⤢", "Ampliar mapa"],
  ]) {
    if (!button) continue;
    button.dataset.icon = icon;
    button.setAttribute("aria-label", label);
    button.title = label;
    toolbar.append(button);
  }
  const emptyRow = panel.querySelector(".extras-row");
  if (emptyRow && !emptyRow.children.length) emptyRow.remove();
  const help = document.createElement("div");
  help.className = "map-gadget-help";
  const estado = document.getElementById("estadoPuntoMapa");
  const acciones = document.getElementById("accionesPuntoMapa");
  help.append(estado, acciones);
  panel.append(toolbar, help);
  // Reutiliza la búsqueda y la capa existentes: un solo estado para ambos accesos.
  const buscarRecargas = document.getElementById("btnBuscarRecargas");
  const ocultarRecargas = document.getElementById("btnOcultarRecargas");
  const estadoRecargas = document.getElementById("estadoRecargas");
  if (buscarRecargas && ocultarRecargas && estadoRecargas) {
    const recargas = document.createElement("button");
    recargas.type = "button";
    recargas.id = "mapaToggleRecargas";
    recargas.setAttribute("aria-controls", "mapa");
    toolbar.append(recargas);
    const aviso = document.createElement("p");
    aviso.className = "map-gadget-help map-recharge-help";
    aviso.setAttribute("role", "status");
    panel.append(aviso);
    let avisoTimer;
    function sincronizarRecargas() {
      const visibles = !ocultarRecargas.hidden;
      const cargando = buscarRecargas.disabled;
      const label = visibles
        ? "Ocultar puntos de recarga STM"
        : "Mostrar puntos de recarga STM";
      recargas.textContent = label;
      recargas.setAttribute("aria-label", label);
      recargas.title = label;
      recargas.setAttribute("aria-pressed", String(visibles));
      recargas.disabled = cargando;
      recargas.dataset.icon = cargando ? "⌛" : "💳";
    }
    function mostrarAvisoRecargas() {
      clearTimeout(avisoTimer);
      aviso.textContent = estadoRecargas.textContent;
      aviso.hidden = !aviso.textContent;
      const card = panel.closest(".map-card");
      card.classList.toggle("map-recharge-feedback", !aviso.hidden);
      if (!buscarRecargas.disabled)
        avisoTimer = setTimeout(() => {
          aviso.hidden = true;
          card.classList.remove("map-recharge-feedback");
        }, 5000);
    }
    recargas.addEventListener("click", () => {
      if (ocultarRecargas.hidden) buscarRecargas.click();
      else ocultarRecargas.click();
    });
    const observer = new MutationObserver(sincronizarRecargas);
    observer.observe(buscarRecargas, {
      attributes: true,
      attributeFilter: ["disabled"],
    });
    observer.observe(ocultarRecargas, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
    new MutationObserver(mostrarAvisoRecargas).observe(estadoRecargas, {
      childList: true,
      subtree: true,
    });
    sincronizarRecargas();
    mostrarAvisoRecargas();
  }
  let timer;
  function actualizar() {
    clearTimeout(timer);
    const activo = !acciones.hidden;
    const inicial = estado.textContent.startsWith("Elegí un campo");
    help.hidden = inicial;
    panel
      .closest(".map-card")
      .classList.toggle("map-gadget-feedback", !inicial);
    if (!activo && !inicial)
      timer = setTimeout(() => {
        help.hidden = true;
        panel.closest(".map-card").classList.remove("map-gadget-feedback");
      }, 5000);
  }
  new MutationObserver(actualizar).observe(estado, {
    childList: true,
    subtree: true,
  });
  new MutationObserver(actualizar).observe(acciones, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  actualizar();
  window.DondeVieneApp.ajustarMapa?.();
})();
