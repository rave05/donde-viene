/* Orientación para la primera subida: estimaciones, nunca garantía de alcanzar el bus. */
(() => {
  const DV = window.DV;
  function evaluar(c, salida, ahora = Date.now(), sinConexion = false) {
    const pie = c.caminos?.find(t => t.id === 'origen');
    if (sinConexion) return {tipo: 'incierto', titulo: 'Sin datos en vivo', texto: 'Reconectate para comparar la caminata con la llegada del bus.'};
    if (!salida?.disponible || salida.fuente !== 'estimado' || c.coincidenciaAproximada) return {tipo: 'incierto', titulo: 'Todavía no podemos confirmarlo', texto: 'Necesitamos una llegada en vivo y la variante confirmada. El horario programado no alcanza para decidir.'};
    const consulta = Date.parse(salida.consultadoEn), llegada = Date.parse(salida.fecha);
    if (!Number.isFinite(consulta) || ahora - consulta > 90000 || consulta > ahora + 5000 || !Number.isFinite(llegada)) return {tipo: 'incierto', titulo: 'Necesitamos una llegada actualizada', texto: 'La estimación anterior puede haber cambiado.'};
    if (pie?.tipo !== 'calles' || pie.metros == null || !Number.isFinite(Number(pie.metros)) || Number(pie.metros) < 0) return {tipo: 'incierto', titulo: 'Caminata por confirmar', texto: 'La distancia en línea recta no alcanza para saber si llegás a tiempo.'};
    const caminata = Number(pie.metros) / DV.config.velocidadCaminata;
    const espera = (llegada - ahora) / 1000;
    const margen = espera - caminata;
    const detalle = 'Desde el origen consultado: ' + Math.ceil(caminata / 60) + ' min a pie aprox. · Bus: ' + Math.max(0, Math.ceil(espera / 60)) + ' min estimados.';
    if (margen < 0) return {tipo: 'tarde', titulo: 'No parece darte el tiempo', texto: detalle + ' Conviene considerar el siguiente; confirmá las llegadas.'};
    if (margen < 120) return {tipo: 'justo', titulo: 'Vas justo', texto: detalle + ' Hay poco margen para cruces o demoras. Considerá el siguiente.'};
    return {tipo: 'margen', titulo: 'Podrías llegar con margen', texto: detalle + ' La caminata y la llegada pueden cambiar.'};
  }
  DV.abordaje = { evaluar };
  let candidato = null, salida = null, copia = false, tarjeta = null;
  function pintar() {
    if (!tarjeta?.isConnected || !candidato) return;
    const r = evaluar(candidato, salida, Date.now(), copia || navigator.onLine === false);
    tarjeta.dataset.estado = r.tipo;
    tarjeta.querySelector('.boarding-title').textContent = r.titulo;
    tarjeta.querySelector('.boarding-message').textContent = r.texto;
  }
  function mostrar(detail, guardado = false) {
    candidato = detail.candidato; salida = candidato.proximaSalida; copia = guardado;
    const resumen = document.querySelector('.trip-summary');
    if (!resumen) return;
    tarjeta?.remove();
    tarjeta = document.createElement('section');
    tarjeta.className = 'boarding-card';
    tarjeta.setAttribute('aria-label', 'Antes de subir');
    tarjeta.innerHTML = '<span class="trip-eyebrow">¿Llego a tomarlo?</span><strong class="boarding-title"></strong><p class="boarding-message"></p><details><summary>¿Dónde espero y qué cartel busco?</summary><p class="boarding-stop"></p><p class="boarding-direction"></p><p class="boarding-transfer"></p><button type="button" class="trip-change boarding-map">Ver parada en mapa</button><p class="trip-note">Confirmá el número de parada y el sentido en la señalización antes de subir.</p></details>';
    const p = candidato.origen;
    const nombre = [p?.street1, p?.street2].filter(Boolean).join(' y ') || 'Nombre de parada sin confirmar';
    tarjeta.querySelector('.boarding-stop').textContent = 'Esperá en: ' + nombre + (p?.busstopId != null ? ' · Parada ' + p.busstopId : '');
    const destino = candidato.line1 ? candidato.destination1 : candidato.destination;
    tarjeta.querySelector('.boarding-direction').textContent = 'Buscá el ' + (candidato.line1 || candidato.line || 'bus') + (destino ? ' → ' + destino : ' · Sentido sin confirmar') + (candidato.coincidenciaAproximada ? '. Esta opción coincide por número de línea: confirmá el destino.' : '. Comprobá ese destino en el cartel del bus.');
    const transferencia = tarjeta.querySelector('.boarding-transfer');
    transferencia.hidden = !candidato.line2;
    transferencia.textContent = candidato.line2 ? 'Después combinás con el ' + candidato.line2 + (candidato.destination2 ? ' → ' + candidato.destination2 : ' · Sentido sin confirmar') + '.' : '';
    const punto = DV.coord(p), boton = tarjeta.querySelector('.boarding-map');
    boton.hidden = !punto;
    boton.addEventListener('click', () => { if (punto) window.DondeVieneApp.enfocar(punto); });
    const ancla = resumen.querySelector('.departure-card') || resumen.querySelector('.trip-endpoints');
    ancla.after(tarjeta);
    pintar();
  }
  window.addEventListener('donde-viene:viaje-elegido', e => mostrar(e.detail));
  window.addEventListener('donde-viene:viaje-restaurado', e => mostrar(e.detail, true));
  window.addEventListener('donde-viene:viaje-cambio', () => { candidato = null; salida = null; tarjeta?.remove(); tarjeta = null; });
  window.addEventListener('donde-viene:llegadas-recibidas', ({detail: d}) => {
    if (!candidato || copia || d.stopId != candidato.origen?.busstopId) return;
    const variante = candidato.line1 ? candidato.lineVariantId1 : candidato.lineVariantId;
    if (variante == null || String(variante) !== String(d.variantId)) return;
    const etas = (d.buses || []).filter(b => b.lineVariantId == null || String(b.lineVariantId) === String(variante))
      .map(b => b.eta == null || b.eta === '' ? NaN : Number(b.eta)).filter(e => Number.isFinite(e) && e >= 0);
    salida = etas.length ? {disponible: true, fuente: 'estimado', fecha: new Date(d.timestamp + Math.min(...etas) * 1000).toISOString(), consultadoEn: new Date(d.timestamp).toISOString()} : null;
    pintar();
  });
  setInterval(pintar, 10000);
  window.addEventListener('offline', pintar);
  window.addEventListener('online', pintar);
})();
