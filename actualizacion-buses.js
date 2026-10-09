/* Una sola consulta seleccionada: ritmo normal y espera creciente ante errores. */
(() => {
  window.crearRitmoBuses = (normal = 20000) => {
    let espera = normal;
    return {
      intervalo: () => espera,
      exito: () => { espera = normal; },
      reiniciar: () => { espera = normal; },
      fallo(status, retryAfter) {
        const segundos = Number(retryAfter);
        const fecha = Date.parse(retryAfter);
        const pedido = retryAfter == null ? 0 : Number.isFinite(segundos)
          ? segundos * 1000 : Number.isFinite(fecha) ? fecha - Date.now() : 0;
        espera = Math.max(Math.min(120000, espera * 2), status === 429 ? 60000 : 0, pedido);
      }
    };
  };
})();
