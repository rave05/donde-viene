/* Información con fuente y fecha. Un catálogo incompleto nunca certifica una ruta accesible. */
(() => {
  const DV = window.DV;
  let datos = null,
    version = 0;
  const normalizar = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  function vigentes(avisos, fecha = Date.now()) {
    const t = new Date(fecha).getTime();
    return avisos.filter(
      (a) => Date.parse(a.desde) <= t && t < Date.parse(a.hasta),
    );
  }
  function afecta(aviso, c) {
    return DV.tramosBus(c).some((t) =>
      aviso.lineas.some(
        (l) =>
          String(l.linea) === String(t.linea) &&
          (!l.sentido ||
            normalizar(t.destination).includes(normalizar(l.sentido))),
      ),
    );
  }
  async function cargar() {
    if (!datos)
      datos = Promise.all(
        ["avisos-oficiales.json", "accesibilidad-lugares.json"].map(
          async (file) => {
            const control = new AbortController(),
              timer = setTimeout(() => control.abort(), 6000);
            try {
              const r = await fetch("./datos/" + file, {
                signal: control.signal,
                cache: "no-cache",
              });
              if (!r.ok) throw Error("Datos no disponibles");
              return await r.json();
            } finally {
              clearTimeout(timer);
            }
          },
        ),
      ).catch((e) => {
        datos = null;
        throw e;
      });
    return datos;
  }
  const panel = document.createElement("details");
  panel.className = "extras-block official-info";
  panel.innerHTML =
    '<summary>ℹ️ Avisos, accesibilidad y clima</summary><div id="contenidoOficial"></div><p class="extras-note"><a href="https://montevideo.gub.uy/noticias/movilidad" target="_blank" rel="noopener noreferrer">Ver publicaciones oficiales de movilidad</a> · <a href="https://www.inumet.gub.uy/" target="_blank" rel="noopener noreferrer">Pronóstico y alertas de INUMET</a></p><p class="extras-note">Los avisos aquí son una selección revisada, no un servicio exhaustivo en tiempo real. La ausencia de un aviso no confirma circulación normal.</p>';
  document.getElementById("resultadoRuta").after(panel);
  const contenido = panel.querySelector("#contenidoOficial");
  let seleccion = null;
  async function mostrar() {
    const turno = ++version,
      elegido = seleccion;
    contenido.textContent = "Consultando información publicada…";
    try {
      const [avisos, lugares] = await cargar();
      if (turno !== version) return;
      const activos = vigentes(
        avisos.avisos,
        elegido?.contexto.fechaSalida || Date.now(),
      ).filter((a) => !elegido || afecta(a, elegido.candidato));
      const punto = elegido?.contexto.puntoDestino;
      const cerca = punto
        ? lugares.lugares
            .filter((p) => DV.distancia(punto, p) < 100)
            .sort((a, b) => DV.distancia(punto, a) - DV.distancia(punto, b))
            .slice(0, 3)
        : [];
      contenido.innerHTML =
        '<p class="extras-note">Avisos revisados: ' +
        DV.escape(avisos.revisado) +
        ".</p>" +
        (activos.length
          ? activos
              .map(
                (a) =>
                  "<p><strong>" +
                  DV.escape(a.titulo) +
                  "</strong><br>" +
                  DV.escape(a.detalle) +
                  '<br><a target="_blank" rel="noopener noreferrer" href="' +
                  DV.escape(a.fuente) +
                  '">Consultar aviso de la Intendencia</a></p>',
              )
              .join("")
          : "<p>No hay avisos vigentes en nuestra selección para " +
            (elegido ? "las líneas y sentidos elegidos" : "esta fecha") +
            ".</p>") +
        "<p>Accesibilidad y refugio de las paradas: <strong>sin información verificada</strong>. Confirmá las condiciones antes de viajar.</p>" +
        (cerca.length
          ? '<h4>Lugares del catálogo oficial a menos de 100 m del destino</h4><p class="extras-note">Proximidad no significa que sea el mismo edificio. Son datos históricos; no verifican el acceso actual ni la accesibilidad del bus o la ruta.</p>' +
            cerca
              .map(
                (p) =>
                  "<details><summary>" +
                  DV.escape(p.nombre) +
                  "</summary><p>" +
                  DV.escape(p.direccion) +
                  " · Revisión del registro: " +
                  DV.escape(p.revisado) +
                  "</p><ul>" +
                  Object.entries(p.caracteristicas)
                    .map(
                      ([k, v]) =>
                        "<li>" + DV.escape(k) + ": " + DV.escape(v) + "</li>",
                    )
                    .join("") +
                  "</ul></details>",
              )
              .join("") +
            '<p><a target="_blank" rel="noopener noreferrer" href="' +
            DV.escape(lugares.fuente) +
            '">Fuente del catálogo de lugares accesibles</a></p>'
          : '<p class="extras-note">' +
            (elegido
              ? "Sin registro de un lugar accesible cercano en este catálogo."
              : "Elegí un viaje para consultar el catálogo cerca de tu destino.") +
            "</p>");
      if (elegido && activos.length) panel.open = true;
    } catch (_) {
      if (turno === version)
        contenido.textContent =
          "No pudimos cargar los datos. Podés consultar las fuentes oficiales en los enlaces.";
    }
  }
  panel.addEventListener("toggle", () => {
    if (panel.open) mostrar();
  });
  window.addEventListener("donde-viene:viaje-elegido", (e) => {
    seleccion = e.detail;
    mostrar();
  });
  window.addEventListener("donde-viene:viaje-restaurado", () => {
    version++;
    seleccion = null;
    panel.open = false;
    contenido.textContent =
      "Reconectate y buscá un viaje para revisar información actual.";
  });
  window.addEventListener("donde-viene:viaje-cambio", () => {
    version++;
    seleccion = null;
    panel.open = false;
    contenido.textContent =
      "Elegí un viaje o abrí este panel para revisar avisos.";
  });
  DV.informacionOficial = { vigentes, afecta };
})();
