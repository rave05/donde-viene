/* Campañas manuales, sin seguimiento de personas ni analíticas. Lista vacía: no muestra anuncios. */
(() => {
  const DV = window.DV;
  let campaigns = [];
  const container = document.createElement("section");
  container.className = "extras-sponsors";
  container.hidden = true;
  container.setAttribute("aria-label", "Publicidad cerca del destino");
  document.getElementById("resultadoRuta").after(container);
  let current = null;
  function render() {
    container.replaceChildren();
    const point = DV.coord(current);
    if (!point) {
      container.hidden = true;
      return;
    }
    const now = Date.now();
    const near = campaigns
      .filter(
        (c) =>
          c.activo &&
          DV.coord(c) &&
          typeof c.nombre === "string" &&
          typeof c.texto === "string" &&
          c.url &&
          /^https:\/\//.test(c.url) &&
          (!c.desde || Date.parse(c.desde) <= now) &&
          (!c.hasta || Date.parse(c.hasta) >= now) &&
          DV.distancia(point, c) <=
            Math.min(5000, Math.max(100, Number(c.radioMetros) || 1000)),
      )
      .slice(0, 2);
    container.hidden = !near.length;
    for (const c of near) {
      const card = document.createElement("article");
      const label = document.createElement("small");
      label.textContent = "PUBLICIDAD · PATROCINIO";
      const name = document.createElement("strong");
      name.textContent = c.nombre;
      const text = document.createElement("p");
      text.textContent = c.texto;
      const link = document.createElement("a");
      link.href = c.url;
      link.textContent = "Ver comercio";
      link.target = "_blank";
      link.rel = "noopener noreferrer sponsored";
      card.append(label, name, text, link);
      container.append(card);
    }
  }
  fetch("./datos/patrocinios.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => {
      campaigns = Array.isArray(data) ? data : [];
      render();
    })
    .catch(() => {});
  window.addEventListener("donde-viene:viaje-elegido", (e) => {
    current = e.detail.contexto.puntoDestino;
    render();
  });
  window.addEventListener("donde-viene:viaje-cambio", () => {
    current = null;
    render();
  });
})();
