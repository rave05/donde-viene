/* Los enlaces contienen solo la receta de búsqueda; nunca ETAs ni coordenadas GPS. */
(() => {
  const DV = window.DV;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "extras-button";
  button.textContent = "Compartir recorrido";
  document.getElementById("btnBuscarRuta").after(button);
  const status = document.createElement("p");
  status.className = "extras-status";
  status.setAttribute("role", "status");
  document.querySelector(".trip-preference").before(status);
  const manual = document.createElement("input");
  manual.type = "url";
  manual.readOnly = true;
  manual.hidden = true;
  manual.setAttribute("aria-label", "Enlace del recorrido para copiar");
  manual.className = "extras-link";
  status.after(manual);
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    manual.hidden = true;
    manual.value = '';
    status.textContent = '';
    const r = { ...window.DondeVieneApp.leerBusqueda() };
    // Las etiquetas personales (Casa/Trabajo) no existen en otro teléfono.
    for (const campo of ['origen', 'destino']) {
      const favorito = window.buscarLugarFavorito?.(r[campo]);
      if (typeof favorito?.consulta === 'string') r[campo] = favorito.consulta;
    }
    if (!DV.recetaValida(r)) {
      status.textContent = "Completá el origen y el destino para compartir.";
      return;
    }
    if (/^(mi ubicaci[oó]n|ubicaci[oó]n actual)$/i.test(r.origen)) {
      status.textContent =
        "Para compartir, elegí un lugar o una dirección como origen.";
      return;
    }
    let fecha, limite;
    try {
      fecha = DV.planificador.leerFecha();
      limite = DV.planificador.leerLimite(fecha);
    } catch (e) {
      status.textContent = e.message;
      return;
    }
    const url = new URL(location.href);
    url.search = "";
    url.hash =
      "viaje=" +
      encodeURIComponent(
        JSON.stringify({
          ...r,
          version: 1,
          fechaSalida: fecha,
          fechaLlegadaLimite: limite,
        }),
      );
    button.disabled = true;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "¿Dónde Viene? · Recorrido",
          text: r.origen + " → " + r.destino,
          url: url.href,
        });
        status.textContent = "Recorrido compartido.";
      } else {
        await navigator.clipboard.writeText(url.href);
        status.textContent = "Enlace copiado.";
      }
      manual.hidden = true;
    } catch (e) {
      if (e.name === "AbortError") return;
      manual.value = url.href;
      manual.hidden = false;
      manual.select();
      status.textContent = "Copiá este enlace para compartir el recorrido.";
    } finally {
      button.disabled = false;
    }
  });
  try {
    if (!location.hash.startsWith("#viaje=")) return;
    const r = JSON.parse(decodeURIComponent(location.hash.slice(7)));
    if (r.version !== 1 || !DV.recetaValida(r))
      throw new Error("Enlace inválido");
    window.DondeVieneApp.aplicarBusqueda(r);
    const fecha =
      r.fechaSalida &&
      Number.isFinite(Date.parse(r.fechaSalida)) &&
      Date.parse(r.fechaSalida) > Date.now() &&
      Date.parse(r.fechaSalida) <= Date.now() + 7 * 86400000
        ? r.fechaSalida
        : null;
    const limite =
      r.fechaLlegadaLimite &&
      Number.isFinite(Date.parse(r.fechaLlegadaLimite)) &&
      Date.parse(r.fechaLlegadaLimite) > Date.now() &&
      Date.parse(r.fechaLlegadaLimite) <= Date.now() + 7 * 86400000
        ? r.fechaLlegadaLimite
        : null;
    DV.planificador.aplicar(fecha, limite);
    status.textContent =
      "Recorrido compartido cargado. Tocá “Buscar ruta” para consultar opciones.";
  } catch (_) {
    status.textContent =
      "El enlace del recorrido no es válido. Podés buscar un viaje normalmente.";
  }
})();
