/* Esperas acotadas, incluido el cuerpo JSON. Nunca agrega reintentos automáticos. */
(() => {
  function errorTiempo() {
    const error = new Error('La conexión está tardando demasiado. Reintentá la búsqueda.');
    error.name = 'TimeoutError';
    return error;
  }
  function limitar(tarea, ms = 8000, signal) {
    const control = new AbortController();
    let timer, cerrar;
    const cancelado = new Promise((_, reject) => {
      cerrar = () => { control.abort(); reject(errorTiempo()); };
      if (signal?.aborted) cerrar();
      else {
        signal?.addEventListener('abort', cerrar, {once:true});
        timer = setTimeout(cerrar, ms);
      }
    });
    const trabajo = Promise.resolve().then(() => {
      if (control.signal.aborted) throw errorTiempo();
      return tarea(control.signal);
    });
    return Promise.race([trabajo, cancelado]).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cerrar);
    });
  }
  function json(url, options = {}, ms = 8000) {
    return limitar(async signal => {
      const r = await fetch(url, {...options, signal});
      if (!r.ok) { const error = new Error('HTTP ' + r.status); error.status=r.status; throw error; }
      return r.json();
    }, ms, options.signal);
  }
  function iniciar(ms = 45000) {
    const control = new AbortController(), hasta = Date.now() + ms;
    const timer = setTimeout(() => control.abort(), ms);
    return {
      signal: control.signal,
      esperar: promise => limitar(() => promise, Math.max(1,hasta-Date.now()),control.signal),
      cancelar() {control.abort();},
      finalizar() {clearTimeout(timer);},
    };
  }
  window.DVRed = {json, limitar, iniciar};
})();
