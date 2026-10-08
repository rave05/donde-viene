/* Presentación: conserva nodos y listeners del buscador, mapa y viaje. */
(() => {
  const workspace = document.querySelector(".map-workspace");
  const column = document.querySelector(".map-column");
  const panel = document.querySelector(".route-results-panel");
  const resultado = document.getElementById("resultadoRuta");
  if (!workspace || !column || !panel || !resultado) return;
  const sheet = document.createElement("details");
  sheet.className = "journey-sheet";
  const handle = document.createElement("summary");
  handle.className = "journey-sheet-handle";
  handle.innerHTML =
    '<span class="journey-sheet-grip" aria-hidden="true"></span><span class="journey-sheet-title">Tu viaje</span><span class="journey-sheet-hint">Ver detalles</span>';
  sheet.append(handle, resultado);
  panel.append(sheet);
  const mobile = window.matchMedia("(max-width: 999px)");
  function ubicar() {
    if (mobile.matches) column.append(panel);
    else
      workspace.insertBefore(
        panel,
        document.querySelector(".route-saved-panel"),
      );
    sheet.open = !mobile.matches;
    requestAnimationFrame(() => window.DondeVieneApp?.ajustarMapa?.());
  }
  function actualizar() {
    const elegido = resultado.querySelector(".trip-summary");
    const title =
      elegido?.querySelector("h3")?.textContent || "Estado de la búsqueda";
    handle.querySelector(".journey-sheet-title").textContent = title;
    const salida = elegido?.querySelector(".departure-time");
    const fuente = elegido?.querySelector(".departure-source");
    const hint = handle.querySelector(".journey-sheet-hint");
    hint.textContent = salida
      ? salida.textContent + " · " + fuente.textContent
      : elegido
        ? "Ver detalles del viaje"
        : "Ver estado";
    sheet.open = !mobile.matches || !elegido;
  }
  let inicio = null,
    arrastre = false;
  handle.addEventListener("pointerdown", (event) => {
    if (!mobile.matches || !event.isPrimary) return;
    inicio = event.clientY;
    arrastre = false;
    handle.setPointerCapture?.(event.pointerId);
  });
  handle.addEventListener("pointerup", (event) => {
    if (inicio === null) return;
    const delta = event.clientY - inicio;
    inicio = null;
    if (Math.abs(delta) < 25) return;
    arrastre = true;
    sheet.open = delta < 0;
  });
  handle.addEventListener("pointercancel", () => {
    inicio = null;
    arrastre = false;
  });
  handle.addEventListener("click", (event) => {
    if (arrastre) {
      event.preventDefault();
      arrastre = false;
    }
  });
  mobile.addEventListener("change", ubicar);
  new MutationObserver(actualizar).observe(resultado, { childList: true });
  ubicar();
  actualizar();
  const proximos = document.getElementById("proximos");
  function destacar() {
    const buses = [...proximos.querySelectorAll(".bus")];
    buses.forEach((bus, index) =>
      bus.classList.toggle("is-featured-bus", index === 0),
    );
  }
  new MutationObserver(destacar).observe(proximos, { childList: true });
  destacar();
})();
