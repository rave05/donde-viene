/* Compara dos variantes de la misma consulta, sin nuevas solicitudes de transporte. */
(() => {
  const DV = window.DV,
    panel = document.createElement("details");
  panel.className = "extras-block compare-panel";
  panel.hidden = true;
  panel.innerHTML =
    '<summary>⇄ Comparar dos opciones</summary><div class="extras-row"><label for="compararUno">Opción A</label><select id="compararUno"></select><label for="compararDos">Opción B</label><select id="compararDos"></select></div><div id="tablaComparacion" class="compare-scroll"></div><p class="extras-note">Misma búsqueda y hora de consulta. Los tiempos totales son orientativos. “Sin confirmar” no significa que no exista servicio.</p>';
  document.getElementById("selectorRutaContenido").before(panel);
  const uno = panel.querySelector("#compararUno"),
    dos = panel.querySelector("#compararDos"),
    tabla = panel.querySelector("#tablaComparacion");
  let opciones = [];
  const titulo = (c) =>
    c.line1
      ? c.line1 +
        " → " +
        (c.destination1 || "") +
        " + " +
        c.line2 +
        " → " +
        (c.destination2 || "")
      : c.line + " → " + (c.destination || "");
  function datos(c) {
    const mismaParada =
      c.combinacion?.busstopId != null &&
      c.combinacion2?.busstopId != null &&
      String(c.combinacion.busstopId) === String(c.combinacion2.busstopId);
    const distancias = [
      c.origen?.distanciaRuta,
      c.destino?.distanciaRuta,
      ...(c.line1 ? [mismaParada ? 0 : c.caminataCombinacion] : []),
    ];
    const metros = distancias.every(
      (v) => v != null && Number.isFinite(Number(v)),
    )
      ? distancias.reduce((a, b) => a + Number(b), 0)
      : null;
    const salida = c.proximaSalida;
    return [
      titulo(c),
      c.line1 ? "1" : "0",
      metros == null ? "Sin confirmar" : Math.round(metros) + " m aprox.",
      c.tiempo?.disponible
        ? c.tiempo.min + "–" + c.tiempo.max + " min orientativos"
        : "Sin confirmar",
      salida?.disponible && Number.isFinite(Date.parse(salida.fecha))
        ? DV.fechaTexto(salida.fecha) +
          " · " +
          (salida.fuente === "programado" ? "programado" : "estimado")
        : "Sin confirmar",
      c.tiempo?.disponible && Number.isFinite(Date.parse(c.tiempo.fechaLlegada))
        ? DV.fechaTexto(c.tiempo.fechaLlegada) + " (orientativo)"
        : "Sin confirmar",
    ];
  }
  function mostrar() {
    const a = opciones[Number(uno.value)],
      b = opciones[Number(dos.value)];
    if (!a || !b) return;
    const x = datos(a),
      y = datos(b),
      nombres = [
        "Recorrido",
        "Transbordos",
        "Caminata total",
        "Tiempo total",
        "Primera salida",
        "Llegada al destino",
      ];
    tabla.innerHTML =
      '<table><caption>Comparación de viajes</caption><thead><tr><th scope="col">Dato</th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody>' +
      nombres
        .map(
          (n, i) =>
            '<tr><th scope="row">' +
            n +
            "</th><td>" +
            DV.escape(x[i]) +
            "</td><td>" +
            DV.escape(y[i]) +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table>";
  }
  window.addEventListener("donde-viene:opciones-listas", ({ detail }) => {
    opciones = detail.candidatos || [];
    panel.hidden = opciones.length < 2;
    panel.open = false;
    [uno, dos].forEach((s) => {
      s.replaceChildren();
      opciones.forEach((c, i) => {
        const o = document.createElement("option");
        o.value = i;
        o.textContent =
          i +
          1 +
          ". " +
          titulo(c) +
          " · " +
          (c.origen?.street1 || "parada") +
          " → " +
          (c.destino?.street1 || "bajada");
        s.append(o);
      });
    });
    uno.value = "0";
    dos.value = "1";
    mostrar();
  });
  // El panel pertenece a la consulta, no al viaje seleccionado.
  document.getElementById("btnBuscarRuta").addEventListener("click", () => {
    panel.hidden = true;
  });
  uno.addEventListener("change", mostrar);
  dos.addEventListener("change", mostrar);
  DV.comparacion = { datos };
})();
