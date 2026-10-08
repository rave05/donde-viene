/* Reordena nodos existentes para conservar sus listeners y el motor del viaje. */
(() => {
  const planner = document.querySelector(".route-planner");
  const mapCard = document.querySelector(".map-card");
  const result = document.getElementById("resultadoRuta");
  if (!planner || !mapCard || !result) return;
  const workspace = document.createElement("div");
  workspace.className = "map-workspace";
  planner.before(workspace);
  const column = document.createElement("div");
  column.className = "map-column";
  column.append(mapCard);
  const results = document.createElement("section");
  results.className = "route-results-panel";
  results.setAttribute("aria-label", "Viaje elegido");
  results.append(result);
  const saved = document.createElement("section");
  saved.className = "route-saved-panel";
  saved.setAttribute("aria-label", "Lugares y viajes guardados");
  for (const node of [
    planner.querySelector(".favorite-section"),
    document.getElementById("btnGuardarHabitual")?.closest("details"),
    document.getElementById("btnAbrirUltimoViaje")?.closest("details"),
  ])
    if (node) saved.append(node);

  const more = document.createElement("details");
  more.className = "route-more-options";
  const summary = document.createElement("summary");
  summary.textContent = "Más opciones";
  more.append(summary);
  const preference = planner.querySelector(".trip-preference");
  const planned = document.getElementById("momentoViaje")?.closest("details");
  const share = [...planner.querySelectorAll(".route-fields > button")].find(
    (button) => button.id !== "btnBuscarRuta",
  );
  const link = planner.querySelector(".extras-link");
  const status = link?.previousElementSibling;
  for (const node of [preference, planned, share, status, link])
    if (node) more.append(node);
  planner.append(more);
  workspace.append(planner, column, results, saved);

  const updateResult = () => {
    results.hidden = !result.hasChildNodes();
  };
  updateResult();
  new MutationObserver(updateResult).observe(result, { childList: true });
  const resize = () =>
    requestAnimationFrame(() => window.DondeVieneApp?.ajustarMapa?.());
  const expand = document.createElement("button");
  expand.type = "button";
  expand.className = "extras-button map-expand-button";
  expand.textContent = "Ampliar mapa";
  expand.setAttribute("aria-label", "Ampliar mapa");
  expand.setAttribute("aria-expanded", "false");
  expand.setAttribute("aria-controls", "mapa");
  expand.addEventListener("click", () => {
    const abierto = mapCard.classList.toggle("is-expanded");
    expand.textContent = abierto ? "Reducir mapa" : "Ampliar mapa";
    expand.setAttribute("aria-label", expand.textContent);
    expand.title = expand.textContent;
    expand.dataset.icon = abierto ? "⤡" : "⤢";
    expand.setAttribute("aria-expanded", String(abierto));
    resize();
  });
  mapCard.querySelector(".map-pick-controls")?.append(expand);
  if (!expand.isConnected) mapCard.prepend(expand);
  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resize();
  });
})();
