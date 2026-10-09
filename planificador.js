/* Fecha de salida y horarios estimados. Todos los horarios se interpretan en Montevideo. */
(() => {
  const DV = window.DV;
  const panel = document.createElement("details");
  panel.className = "extras-block";
  panel.innerHTML =
    '<summary>🕒 Salida y hora de llegada</summary><div class="extras-row"><label for="momentoViaje">Salida</label><select id="momentoViaje"><option value="ahora">Ahora</option><option value="fecha">Elegir día y hora</option></select></div><div id="fechaViajeCampos" class="extras-row" hidden><label for="diaViaje">Día</label><input id="diaViaje" type="date"><label for="horaViaje">Hora de salida</label><input id="horaViaje" type="time"></div><div class="extras-row"><label><input id="usarLimiteLlegada" type="checkbox"> Tengo que llegar antes de…</label></div><div id="limiteLlegadaCampos" class="extras-row" hidden><label for="diaLlegada">Día de llegada</label><input id="diaLlegada" type="date"><label for="horaLlegada">Hora límite</label><input id="horaLlegada" type="time"></div><p class="extras-note">El límite filtra los viajes desde la salida elegida, con un margen orientativo. No garantiza la llegada ni busca la última salida posible.</p><p class="extras-note">Hora de Montevideo. Para otra fecha usamos horarios programados; pueden cambiar.</p><p id="errorPlanificador" class="extras-status" role="status"></p>';
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
  const usarLimite = document.getElementById("usarLimiteLlegada"),
    diaLlegada = document.getElementById("diaLlegada"),
    horaLlegada = document.getElementById("horaLlegada");
  diaLlegada.value = dia.value;
  diaLlegada.min = dia.min;
  const futuro = DV.fechaPartes(new Date(Date.now() + 3600000));
  diaLlegada.value = [futuro.year, futuro.month, futuro.day].join("-");
  horaLlegada.value = futuro.hour + ":" + futuro.minute;
  usarLimite.addEventListener("change", () => {
    document.getElementById("limiteLlegadaCampos").hidden = !usarLimite.checked;
  });
  function leerLimite(salida = leerFecha()) {
    if (!usarLimite.checked) return null;
    const f = new Date(
      diaLlegada.value + "T" + horaLlegada.value + ":00-03:00",
    );
    if (
      !Number.isFinite(f.getTime()) ||
      f.getTime() <= new Date(salida || Date.now()).getTime() ||
      f.getTime() > Date.now() + 7 * 86400000
    )
      throw Error(
        "Elegí una llegada posterior a la salida, dentro de los próximos 7 días.",
      );
    return f.toISOString();
  }
  function filtrarLlegada(opciones, limite) {
    const max = Date.parse(limite);
    return opciones.filter((c) => {
      const t = c.tiempo;
      return (
        t?.disponible &&
        Number.isFinite(t.max) &&
        t.max >= t.total &&
        Number.isFinite(Date.parse(t.fechaSalida)) &&
        Date.parse(t.fechaSalida) + t.max * 60000 <= max
      );
    });
  }
  const aplicarSalida = aplicar;
  DV.planificador = {
    leerFecha,
    leerLimite,
    filtrarLlegada,
    aplicar(iso, limite = null) {
      aplicarSalida(iso);
      usarLimite.checked = Boolean(limite);
      document.getElementById("limiteLlegadaCampos").hidden = !limite;
      if (limite) {
        const p = DV.fechaPartes(new Date(limite));
        diaLlegada.value = [p.year, p.month, p.day].join("-");
        horaLlegada.value = p.hour + ":" + p.minute;
        panel.open = true;
      }
    },
  };
})();
