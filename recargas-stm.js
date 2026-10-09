/* Catálogo oficial IM. Las distancias no implican que el local esté abierto. */
(() => {
  const DV = window.DV;
  let catalogo = null,
    version = 0;
  const section = document.createElement("details");
  section.className = "extras-block";
  section.id = "miSTM";
  section.innerHTML =
    '<summary>💳 Mi STM</summary>' +
    '<p class="extras-note">Recargá online, consultá tu saldo o encontrá un local de recarga.</p>' +
    '<div class="stm-online-actions">' +
    '<a class="extras-button" href="https://stm.gub.uy/app/mistm/cuenta/" target="_blank" rel="noopener noreferrer">Recargar STM online ↗</a>' +
    '<a class="extras-button" href="https://stm.gub.uy/app/mistm/cuenta/" target="_blank" rel="noopener noreferrer">Consultar saldo en STM en línea ↗</a></div>' +
    '<p class="extras-note">Los accesos online abren el sitio oficial en otra pestaña. Para recargar, elegí “Recarga rápida” o ingresá a tu cuenta. Para consultar tu saldo, ingresá a tu cuenta de STM en línea.</p>' +
    '<details class="stm-help"><summary>¿Qué necesito para recargar online?</summary><p class="extras-note">Tu tarjeta debe estar adherida a STM en línea. La recarga rápida solicita la cédula del titular y el número de tarjeta. Ingresá esos datos y completá el pago en el sitio oficial.</p><p class="extras-note">El saldo de STM en línea puede diferir del saldo físico de la tarjeta y de los últimos viajes.</p><a href="https://montevideo.gub.uy/stm-en-linea" target="_blank" rel="noopener noreferrer">Cómo adherirse y usar STM en línea ↗</a></details>' +
    '<h3 class="stm-physical-title">Puntos físicos de recarga</h3>' +
    '<p class="extras-note">Buscá cerca del destino elegido o del centro del mapa, en Montevideo y otras zonas del catálogo oficial. Confirmá los horarios con el local.</p><button class="extras-button" id="btnBuscarRecargas" type="button">Encontrar puntos de recarga cercanos</button><button class="extras-button" id="btnOcultarRecargas" type="button" hidden>Ocultar puntos</button><p id="estadoRecargas" class="extras-status" role="status"></p><div id="listaRecargas" class="extras-list"></div>' +
    '<a class="stm-all-points" href="https://montevideo.gub.uy/tipo/area-tematica/sistema-de-transporte-metropolitano/locales-stm" target="_blank" rel="noopener noreferrer">Ver todos los locales en el sitio oficial ↗</a>';
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
