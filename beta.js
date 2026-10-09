/* Reportes voluntarios: solo texto visible, sin coordenadas ni envío automático. */
(() => {
  const d = document;
  const dialog = d.getElementById("reporteProblema");
  const texto = d.getElementById("textoReporte");
  const incluir = d.getElementById("incluirContextoReporte");
  const correo = d.getElementById("correoReporte");
  const estado = d.getElementById("estadoReporte");
  const categoria = d.getElementById("categoriaReporte");
  let contexto = "";
  let descripcion = "";
  const enviar = d.createElement("button");
  enviar.type = "button";
  enviar.className = "mobile-button";
  enviar.textContent = "Enviar reporte desde la app";
  enviar.hidden = true;
  d.querySelector("#reporteProblema .mobile-dialog-actions").append(enviar);
  const notaServidor = d.createElement("p");
  notaServidor.className = "favorite-note";
  notaServidor.hidden = true;
  notaServidor.textContent =
    "Al enviar desde la app se guarda el texto que ves aquí y la categoría durante 30 días. Podés quitar el contexto o editarlo antes de enviar. También podés usar el correo.";
  enviar.parentElement.before(notaServidor);
  let servicio = null,
    enviando = false,
    revision = 0;
  function disponibilidad() {
    window.DV?.servicios?.config().then((c) => {
      servicio = c;
      enviar.hidden = notaServidor.hidden = !c.reportes;
    });
  }
  // Los puntos elegidos en el mapa contienen coordenadas en su etiqueta.
  const lugar = (v) =>
    /^Punto en el mapa\s*\(/i.test(v || "")
      ? "Punto elegido en el mapa"
      : String(v || "").slice(0, 240);
  function actualizarCorreo() {
    correo.href =
      "mailto:dondevieneadvertisement@gmail.com?subject=" +
      encodeURIComponent("Reporte · " + categoria.value + " · ¿Dónde Viene?") +
      "&body=" +
      encodeURIComponent(texto.value);
  }
  d.getElementById("btnReportarProblema").addEventListener("click", () => {
    revision++;
    disponibilidad();
    const busqueda = window.DondeVieneApp.leerBusqueda();
    const c = window.DondeVieneApp.leerContextoReporte();
    const datos = {
      Origen: lugar(busqueda.origen),
      Destino: lugar(busqueda.destino),
      Líneas: c.lineas,
      Subida: c.subida,
      Combinación: c.combinacion,
      "Segunda parada": c.segundaParada,
      Bajada: c.bajada,
      Variante: c.variante,
      "Estado de llegadas": c.estado,
    };
    contexto =
      "\n\nRecorrido consultado:\n" +
      Object.entries(datos)
        .filter(([, v]) => v)
        .map(([k, v]) => k + ": " + v)
        .join("\n");
    descripcion =
      "Qué esperaba:\n\nQué pasó:\n\nFecha y hora (Montevideo): " +
      new Date().toLocaleString("es-UY", { timeZone: "America/Montevideo" });
    incluir.checked = true;
    texto.value = descripcion + contexto;
    estado.textContent = "";
    actualizarCorreo();
    dialog.showModal();
  });
  incluir.addEventListener("change", () => {
    revision++;
    if (texto.value.endsWith(contexto))
      descripcion = texto.value.slice(0, -contexto.length);
    else descripcion = texto.value;
    texto.value = (descripcion + (incluir.checked ? contexto : "")).slice(
      0,
      3000,
    );
    actualizarCorreo();
  });
  texto.addEventListener("input", () => {
    revision++;
    actualizarCorreo();
  });
  enviar.addEventListener("click", async () => {
    if (enviando || !servicio?.reportes) return;
    if (!texto.value.trim()) {
      estado.textContent = "Escribí qué pasó antes de enviar.";
      return;
    }
    enviando = true;
    enviar.disabled = true;
    const turno = revision;
    const control = new AbortController(),
      timer = setTimeout(() => control.abort(), 10000);
    try {
      const r = await fetch(servicio.url + "/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: categoria.value,
          texto: texto.value,
        }),
        signal: control.signal,
      });
      if (!r.ok)
        throw Error(
          "No pudimos confirmar el envío. Podés reintentar o usar el correo.",
        );
      const resultado = await r.json();
      if (!resultado.id) throw Error("El servidor no confirmó la recepción.");
      if (turno === revision)
        estado.textContent = "Reporte recibido. Código: " + resultado.id;
    } catch (e) {
      if (turno === revision)
        estado.textContent =
          e.name === "AbortError"
            ? "No pudimos confirmar si llegó el reporte. Podés usar el correo."
            : e.message;
    } finally {
      clearTimeout(timer);
      enviando = false;
      enviar.disabled = false;
    }
  });
  categoria.addEventListener("change", () => {
    revision++;
    actualizarCorreo();
  });
  d.getElementById("cerrarReporte").addEventListener("click", () =>
    dialog.close(),
  );
  d.getElementById("copiarReporte").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(texto.value);
      estado.textContent = "Reporte copiado. Pegalo en tu correo.";
    } catch (_) {
      texto.focus();
      texto.select();
      estado.textContent =
        "Seleccionamos el texto. Mantené pulsado para copiarlo.";
    }
  });
})();
