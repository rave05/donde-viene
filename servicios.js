/* URL del servicio auxiliar, activada únicamente después de verificar su despliegue. */
(() => {
  let pendiente;
  window.DV.servicios = {
    config() {
      if (!pendiente)
        pendiente = (async () => {
          const control = new AbortController(),
            timer = setTimeout(() => control.abort(), 5000);
          try {
            const local = await fetch("./datos/servicios.json", {
              signal: control.signal,
              cache: "no-cache",
            });
            if (!local.ok) throw Error("Servicio no disponible");
            const { url } = await local.json();
            if (!url) return { push: false, reportes: false };
            const base = new URL(url);
            if (
              base.protocol !== "https:" ||
              base.username ||
              base.password ||
              base.search ||
              base.hash
            )
              throw Error("Servicio inválido");
            const respuesta = await fetch(
              base.href.replace(/\/$/, "") + "/config",
              { signal: control.signal, cache: "no-store" },
            );
            if (!respuesta.ok) throw Error("Servicio no disponible");
            return {
              ...(await respuesta.json()),
              url: base.href.replace(/\/$/, ""),
            };
          } catch (_) {
            return { push: false, reportes: false };
          } finally {
            clearTimeout(timer);
          }
        })();
      return pendiente;
    },
  };
})();
