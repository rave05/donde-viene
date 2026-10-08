/* Mantiene el zoom entre consultas y sigue únicamente un vehículo identificable. */
(() => {
  window.crearVistaBusesMapa = (mapa) => {
    let sesion = null,
      encuadrado = false,
      seguido = null;
    const claveBus = (bus) => {
      const id = bus.busId ?? bus.id;
      return id == null || String(id).trim() === ""
        ? null
        : JSON.stringify([
            bus.companyId ?? bus.company ?? bus.companyName ?? "",
            String(id),
          ]);
    };
    return {
      reiniciar() {
        sesion = null;
        encuadrado = false;
        seguido = null;
      },
      iniciar(seleccion) {
        const nueva = JSON.stringify([
          seleccion?.sesionId,
          seleccion?.stopId,
          seleccion?.variantId,
        ]);
        if (nueva !== sesion) {
          sesion = nueva;
          encuadrado = false;
          seguido = null;
        }
      },
      seguir(bus, punto) {
        seguido = claveBus(bus);
        if (seguido === null) return;
        encuadrado = true;
        mapa.panTo(punto, { animate: true });
      },
      actualizar(bus, punto) {
        if (seguido !== null && seguido === claveBus(bus))
          mapa.panTo(punto, { animate: true });
      },
      encuadrar(puntos) {
        if (encuadrado || !puntos.length) return;
        encuadrado = true;
        if (puntos.length >= 2)
          mapa.fitBounds(puntos, {
            padding: [45, 45],
            maxZoom: 15,
            animate: true,
          });
        else mapa.setView(puntos[0], 15, { animate: true });
      },
    };
  };
})();
