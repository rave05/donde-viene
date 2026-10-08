/* Guarda recetas de búsqueda, sin fijar una hora ni reutilizar ETAs anteriores. */
(() => {
  const DV = window.DV,
    KEY = "donde-viene-habituales-v1";
  let guardados = DV.leer(KEY, []);
  if (!Array.isArray(guardados)) guardados = [];
  guardados = guardados
    .filter(
      (r) =>
        DV.recetaValida(r) &&
        typeof r.nombre === "string" &&
        r.nombre.length <= 80 &&
        typeof r.id === "string",
    )
    .slice(0, DV.config.limiteHabituales);
  const section = document.createElement("details");
  section.className = "extras-block";
  section.innerHTML =
    '<summary>⭐ Viajes habituales</summary><div id="habitualesLista" class="extras-list"></div><button class="extras-button" id="btnGuardarHabitual" type="button">Guardar este recorrido</button><p class="extras-note">Se guardan en este navegador. Cada consulta busca los datos actuales.</p><p id="estadoHabituales" class="extras-status" role="status"></p>';
  document.querySelector('[aria-label="Lugares guardados"]').after(section);
  const list = document.getElementById("habitualesLista"),
    status = document.getElementById("estadoHabituales");
  const dialog = document.createElement("dialog");
  dialog.className = "extras-dialog";
  dialog.innerHTML =
    '<form id="formHabitual"><h3 id="tituloHabitual">Guardar viaje habitual</h3><label for="nombreHabitual">Nombre del recorrido</label><input id="nombreHabitual" maxlength="80" required placeholder="Ej: Ir al trabajo"><p id="resumenHabitual"></p><p id="errorHabitual" role="status"></p><div class="extras-row"><button class="extras-button" id="cancelarHabitual" type="button">Cancelar</button><button class="extras-button extras-primary" type="submit">Guardar</button></div></form>';
  dialog.setAttribute("aria-labelledby", "tituloHabitual");
  document.body.append(dialog);
  let editando = null,
    pendiente = null;
  function render() {
    list.replaceChildren();
    if (!guardados.length) {
      list.textContent = "Todavía no guardaste recorridos.";
      return;
    }
    for (const r of guardados) {
      const row = document.createElement("div");
      row.className = "extras-saved";
      const usar = document.createElement("button");
      usar.type = "button";
      usar.className = "extras-button";
      usar.textContent = r.nombre;
      usar.title = r.origen + " → " + r.destino;
      usar.addEventListener("click", async () => {
        if (document.getElementById("btnBuscarRuta").disabled) {
          status.textContent = "Esperá a que termine la búsqueda actual.";
          return;
        }
        DV.planificador.aplicar(null);
        window.DondeVieneApp.aplicarBusqueda(r);
        status.textContent = "Consultando " + r.nombre + "…";
        await window.DondeVieneApp.buscar();
        status.textContent = "Recorrido cargado: " + r.nombre + ".";
      });
      const editar = document.createElement("button");
      editar.type = "button";
      editar.className = "extras-button";
      editar.textContent = "Editar";
      editar.setAttribute("aria-label", "Editar " + r.nombre);
      editar.addEventListener("click", () => abrir(r));
      const borrar = document.createElement("button");
      borrar.type = "button";
      borrar.className = "extras-button";
      borrar.textContent = "Eliminar";
      borrar.setAttribute("aria-label", "Eliminar " + r.nombre);
      borrar.addEventListener("click", () => {
        const nuevos = guardados.filter((x) => x.id !== r.id);
        if (!DV.guardar(KEY, nuevos)) {
          status.textContent = "No se pudo guardar el cambio.";
          return;
        }
        guardados = nuevos;
        render();
        status.textContent = "Recorrido eliminado.";
      });
      row.append(usar, editar, borrar);
      list.append(row);
    }
  }
  function abrir(r) {
    pendiente = r || window.DondeVieneApp.leerBusqueda();
    if (!DV.recetaValida(pendiente)) {
      status.textContent = "Completá el origen y el destino antes de guardar.";
      return;
    }
    editando = r?.id || null;
    document.getElementById("nombreHabitual").value = r?.nombre || "";
    document.getElementById("resumenHabitual").textContent =
      pendiente.origen + " → " + pendiente.destino;
    document.getElementById("errorHabitual").textContent = "";
    dialog.showModal();
  }
  document
    .getElementById("btnGuardarHabitual")
    .addEventListener("click", () => abrir(null));
  document
    .getElementById("cancelarHabitual")
    .addEventListener("click", () => dialog.close());
  document.getElementById("formHabitual").addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById("nombreHabitual").value.trim();
    if (!nombre) return;
    if (!editando && guardados.length >= DV.config.limiteHabituales) {
      document.getElementById("errorHabitual").textContent =
        "Podés guardar hasta " + DV.config.limiteHabituales + " recorridos.";
      return;
    }
    const value = {
      id: editando || crypto.randomUUID?.() || String(Date.now()),
      nombre,
      origen: pendiente.origen,
      destino: pendiente.destino,
      preferencia: pendiente.preferencia,
    };
    const nuevos = editando
      ? guardados.map((r) => (r.id === editando ? value : r))
      : [...guardados, value];
    if (!DV.guardar(KEY, nuevos)) {
      document.getElementById("errorHabitual").textContent =
        "El navegador no pudo guardar el recorrido.";
      return;
    }
    guardados = nuevos;
    render();
    dialog.close();
    status.textContent = "Viaje guardado: " + nombre + ".";
  });
  render();
})();
