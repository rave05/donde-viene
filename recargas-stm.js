/* Catálogo oficial IM. Las distancias no implican que el local esté abierto. */
(() => {
  const DV = window.DV;
  let catalogo = null,
    version = 0;
  const section = document.createElement("details");
  section.className = "extras-block";
  section.innerHTML =
    '<summary>💳 Recargar la STM cerca</summary><p class="extras-note">Busca cerca del destino elegido o del centro del mapa. Confirmá los horarios con el local.</p><button class="extras-button" id="btnBuscarRecargas" type="button">Mostrar puntos cercanos</button><button class="extras-button" id="btnOcultarRecargas" type="button" hidden>Ocultar puntos</button><p id="estadoRecargas" class="extras-status" role="status"></p><div id="listaRecargas" class="extras-list"></div>';
  document.querySelector(".map-card").after(section);
  const status = document.getElementById("estadoRecargas"),
    list = document.getElementById("listaRecargas"),
    buscar = document.getElementById("btnBuscarRecargas"),
    ocultar = document.getElementById("btnOcultarRecargas");
  buscar.addEventListener("click", async () => {
    const v = ++version;
    buscar.disabled = true;
    status.textContent = "Cargando puntos de recarga…";
    try {
      if (!catalogo) {
        const response = await fetch("./datos/recargas-stm.json");
        if (!response.ok) throw Error();
        catalogo = await response.json();
      }
      if (v !== version) return;
      const centro = DV.coord(window.DondeVieneApp.centro());
      const puntos = catalogo.locales
        .filter((p) => DV.coord(p))
        .map((p) => ({ ...p, distancia: DV.distancia(centro, p) }))
        .filter((p) => p.distancia <= 5000)
        .sort((a, b) => a.distancia - b.distancia)
        .slice(0, 8);
      list.replaceChildren();
      window.DondeVieneApp.mostrarRecargas(puntos);
      ocultar.hidden = false;
      for (const p of puntos) {
        const row = document.createElement("div");
        row.className = "extras-recharge";
        const title = document.createElement("strong");
        title.textContent = p.nombre;
        const text = document.createElement("p");
        text.textContent =
          p.direccion + " · " + Math.round(p.distancia) + " m en línea recta";
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "Horarios y servicio";
        const info = document.createElement("p");
        info.textContent = [p.horarios, p.servicio, p.telefono]
          .filter(Boolean)
          .join(" · ");
        details.append(summary, info);
        const ver = document.createElement("button");
        ver.className = "extras-button";
        ver.type = "button";
        ver.textContent = "Ver en el mapa";
        ver.addEventListener("click", () => window.DondeVieneApp.enfocar(p));
        row.append(title, text, details, ver);
        list.append(row);
      }
      status.textContent =
        (puntos.length
          ? puntos.length + " puntos encontrados."
          : "No encontramos puntos a menos de 5 km.") +
        " Datos IM preparados el " +
        DV.fechaTexto(catalogo.actualizado) +
        ".";
    } catch (_) {
      if (v === version)
        status.textContent =
          "No pudimos cargar los puntos de recarga. Probá nuevamente con conexión.";
    } finally {
      if (v === version) buscar.disabled = false;
    }
  });
  ocultar.addEventListener("click", () => {
    version++;
    window.DondeVieneApp.ocultarRecargas();
    ocultar.hidden = true;
    buscar.disabled = false;
    list.replaceChildren();
    status.textContent = "Puntos ocultos.";
  });
})();
