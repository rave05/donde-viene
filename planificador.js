/* Fecha de salida y horarios estimados. Todos los horarios se interpretan en Montevideo. */
(() => {
  const DV = window.DV;
  const panel = document.createElement("details");
  panel.className = "extras-block";
  panel.innerHTML =
    '<summary>🕒 Planificar para más tarde</summary><div class="extras-row"><label for="momentoViaje">Salida</label><select id="momentoViaje"><option value="ahora">Ahora</option><option value="fecha">Elegir día y hora</option></select></div><div id="fechaViajeCampos" class="extras-row" hidden><label for="diaViaje">Día</label><input id="diaViaje" type="date"><label for="horaViaje">Hora de salida</label><input id="horaViaje" type="time"></div><p class="extras-note">Hora de Montevideo. Para otra fecha usamos horarios programados; pueden cambiar.</p><p id="errorPlanificador" class="extras-status" role="status"></p>';
  document.querySelector(".trip-preference").after(panel);
  const modo = document.getElementById("momentoViaje"),
    dia = document.getElementById("diaViaje"),
    hora = document.getElementById("horaViaje"),
    error = document.getElementById("errorPlanificador");
  const p = DV.fechaPartes(new Date());
  dia.value = [p.year, p.month, p.day].join("-");
  hora.value = p.hour + ":" + p.minute;
  dia.min = dia.value;
  document.getElementById("fechaViajeCampos").hidden = true;
  modo.addEventListener("change", () => {
    document.getElementById("fechaViajeCampos").hidden = modo.value !== "fecha";
    error.textContent = "";
  });
  function leerFecha() {
    if (modo.value === "ahora") return null;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dia.value) ||
      !/^\d{2}:\d{2}$/.test(hora.value)
    )
      throw new Error("Elegí el día y la hora de salida.");
    const fecha = new Date(dia.value + "T" + hora.value + ":00-03:00");
    if (
      !Number.isFinite(fecha.getTime()) ||
      fecha.getTime() < Date.now() - 60000 ||
      fecha.getTime() > Date.now() + 7 * 86400000
    )
      throw new Error(
        "Elegí una salida desde ahora hasta los próximos 7 días.",
      );
    return fecha.toISOString();
  }
  function aplicar(iso) {
    modo.value = iso ? "fecha" : "ahora";
    if (iso) {
      const p = DV.fechaPartes(new Date(iso));
      dia.value = [p.year, p.month, p.day].join("-");
      hora.value = p.hour + ":" + p.minute;
    }
    document.getElementById("fechaViajeCampos").hidden = !iso;
    panel.open = Boolean(iso);
    error.textContent = "";
  }
  DV.planificador = { leerFecha, aplicar };
})();
