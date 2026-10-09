/* Reportes voluntarios: solo texto visible, sin coordenadas ni envío automático. */
(() => {
  const d = document;
  const dialog = d.getElementById("reporteProblema");
  const texto = d.getElementById("textoReporte");
  const incluir = d.getElementById("incluirContextoReporte");
  const correo = d.getElementById("correoReporte");
  const estado = d.getElementById("estadoReporte");
  let contexto = "";
  let descripcion = "";
  // Los puntos elegidos en el mapa contienen coordenadas en su etiqueta.
  const lugar = (v) => /^Punto en el mapa\s*\(/i.test(v || "") ? "Punto elegido en el mapa" : String(v || "").slice(0, 240);
  function actualizarCorreo() {
    correo.href = "mailto:dondevieneadvertisement@gmail.com?subject=" +
      encodeURIComponent("Reporte beta · ¿Dónde Viene?") + "&body=" + encodeURIComponent(texto.value);
  }
  d.getElementById("btnReportarProblema").addEventListener("click", () => {
    const busqueda = window.DondeVieneApp.leerBusqueda();
    const c = window.DondeVieneApp.leerContextoReporte();
    const datos = {
      Origen: lugar(busqueda.origen), Destino: lugar(busqueda.destino),
      Líneas: c.lineas, Subida: c.subida, Combinación: c.combinacion,
      "Segunda parada": c.segundaParada, Bajada: c.bajada, Variante: c.variante,
      "Estado de llegadas": c.estado
    };
    contexto = "\n\nRecorrido consultado:\n" + Object.entries(datos)
      .filter(([, v]) => v).map(([k, v]) => k + ": " + v).join("\n");
    descripcion = "Qué esperaba:\n\nQué pasó:\n\nFecha y hora (Montevideo): " +
      new Date().toLocaleString("es-UY", { timeZone: "America/Montevideo" });
    incluir.checked = true;
    texto.value = descripcion + contexto;
    estado.textContent = "";
    actualizarCorreo();
    dialog.showModal();
  });
  incluir.addEventListener("change", () => {
    if (texto.value.endsWith(contexto)) descripcion = texto.value.slice(0, -contexto.length);
    else descripcion = texto.value;
    texto.value = (descripcion + (incluir.checked ? contexto : "")).slice(0, 3000);
    actualizarCorreo();
  });
  texto.addEventListener("input", actualizarCorreo);
  d.getElementById("cerrarReporte").addEventListener("click", () => dialog.close());
  d.getElementById("copiarReporte").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(texto.value);
      estado.textContent = "Reporte copiado. Pegalo en tu correo.";
    } catch (_) {
      texto.focus(); texto.select();
      estado.textContent = "Seleccionamos el texto. Mantené pulsado para copiarlo.";
    }
  });
})();
