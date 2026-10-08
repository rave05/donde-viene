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
