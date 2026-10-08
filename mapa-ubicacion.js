/* Centra el mapa por pedido del usuario; no inicia búsquedas ni otro seguimiento. */
(() => {
  const panel = document.querySelector(".map-pick-controls");
  if (!panel) return;
  const boton = document.createElement("button");
  boton.type = "button";
  boton.id = "mapaMiUbicacion";
  boton.className = "map-location-button";
  boton.dataset.icon = "⌖";
  boton.textContent = "Centrar en mi ubicación";
  boton.setAttribute("aria-label", boton.textContent);
  boton.title = boton.textContent;
  const aviso = document.createElement("p");
  aviso.className = "map-gadget-help map-location-help";
  aviso.setAttribute("role", "status");
  aviso.hidden = true;
  panel.append(boton, aviso);
  let timer;
  function informar(texto, permanente = false) {
    clearTimeout(timer);
    aviso.textContent = texto;
    aviso.hidden = false;
    panel.closest(".map-card").classList.add("map-location-feedback");
    if (!permanente)
      timer = setTimeout(() => {
        aviso.hidden = true;
        panel.closest(".map-card").classList.remove("map-location-feedback");
      }, 5000);
  }
  boton.addEventListener("click", () => {
    if (document.body.classList.contains("trip-tracking-active")) {
      document.getElementById("btnCentrarViaje")?.click();
      informar("Volviendo a seguir tu viaje.");
      return;
    }
    if (document.getElementById("mapa").classList.contains("map-picking")) {
      informar("Confirmá o cancelá el punto antes de centrar el mapa.");
      return;
    }
    if (!navigator.geolocation) {
      informar("Este navegador no permite obtener tu ubicación.");
      return;
    }
    boton.disabled = true;
    boton.dataset.icon = "⌛";
    informar("Buscando tu ubicación…", true);
    const terminar = () => {
      boton.disabled = false;
      boton.dataset.icon = "⌖";
    };
    const fallar = (error) => {
      terminar();
      informar(
        error?.code === 1
          ? "Permití la ubicación en Safari y tocá el botón para reintentar."
          : "No pudimos obtener tu ubicación. Tocá el botón para reintentar.",
      );
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          terminar();
          if (
            document.body.classList.contains("trip-tracking-active") ||
            document.getElementById("mapa").classList.contains("map-picking")
          ) {
            informar(
              "La vista cambió. Tocá el botón para centrar cuando termines.",
            );
            return;
          }
          const { latitude: lat, longitude: lon, accuracy } = pos.coords;
          const timestamp = Number(pos.timestamp);
          if (
            ![lat, lon, accuracy, timestamp].every(Number.isFinite) ||
            Math.abs(lat) > 90 ||
            Math.abs(lon) > 180 ||
            accuracy < 0 ||
            accuracy > 150 ||
            Date.now() - timestamp > 30000 ||
            timestamp > Date.now() + 5000
          ) {
            informar(
              "La ubicación es antigua o poco precisa. Tocá el botón para reintentar.",
            );
            return;
          }
          window.DondeVieneApp.centrarUbicacionMapa({ lat, lon, accuracy });
          informar(
            "Mapa centrado en tu ubicación · precisión ±" +
              Math.round(accuracy) +
              " m.",
          );
        },
        fallar,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    } catch (_) {
      fallar();
    }
  });
})();
