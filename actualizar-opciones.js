/* Actualización manual de la comparación. Reutiliza la búsqueda y sus límites. */
(() => {
  const button = document.getElementById("btnActualizarOpcionesRuta");
  const estado = document.getElementById("horaOpcionesRuta");
  let consulta = null;
  let actualizando = false;
  window.addEventListener("donde-viene:opciones-listas", ({ detail }) => {
    consulta = detail.contexto;
    const hora = new Intl.DateTimeFormat("es-UY", {
      timeZone: "America/Montevideo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(detail.consultadoEn));
    estado.textContent =
      "Opciones consultadas a las " + hora + ". Las llegadas pueden cambiar.";
  });
  button.addEventListener("click", async () => {
    if (
      actualizando ||
      !consulta ||
      document.getElementById("btnBuscarRuta").disabled
    )
      return;
    actualizando = true;
    button.disabled = true;
    button.textContent = "Actualizando…";
    try {
      window.DondeVieneApp.aplicarBusqueda(consulta);
      window.DV.planificador.aplicar(
        consulta.fechaSalida || null,
        consulta.fechaLlegadaLimite || null,
      );
      document.getElementById("btnCerrarSelectorRuta").click();
      await window.DondeVieneApp.buscar();
    } finally {
      actualizando = false;
      button.disabled = false;
      button.textContent = "Actualizar opciones";
    }
  });
})();
