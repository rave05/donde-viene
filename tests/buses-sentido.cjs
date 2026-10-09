const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const w = {};
const shape = [
  [0, 0],
  [0, 0.04],
  [0.04, 0.04],
  [0.04, 0],
];
vm.runInNewContext(fs.readFileSync("buses-sentido.js", "utf8"), { window: w });
const bus = (lat, lon, extra = {}) => ({
  busId: 161,
  companyId: 1,
  location: { coordinates: [lon, lat] },
  ...extra,
});
let filtro = w.crearFiltroSentidoBuses([shape], [0, 0.01]);
assert.equal(filtro(bus(0, 0.003), 1000), false);
assert.equal(
  filtro(bus(0, 0.004), 31000),
  true,
  "Antes de la parada y avanzando",
);
assert.equal(
  filtro(bus(0, 0.004), 31000),
  false,
  "No reutiliza una muestra cacheada como prueba de movimiento",
);
assert.equal(filtro(bus(0, 0.003), 61000), false, "Sentido contrario");
filtro = w.crearFiltroSentidoBuses([shape], [0, 0.01]);
const distanciaRadial = (lon) => Math.hypot(0.04, lon - 0.01);
assert.ok(distanciaRadial(0.03) < distanciaRadial(0.035));
assert.equal(filtro(bus(0.04, 0.035), 1000), false);
assert.equal(
  filtro(bus(0.04, 0.03), 31000),
  false,
  "Ya pasó la parada aunque disminuya la distancia radial",
);
filtro = w.crearFiltroSentidoBuses([shape], [0, 0.01]);
filtro(bus(0.01, 0.003), 1000);
assert.equal(filtro(bus(0.01, 0.004), 31000), false, "Fuera del recorrido");
filtro = w.crearFiltroSentidoBuses([shape], [0, 0.01]);
filtro(bus(0, 0.003), 1000);
assert.equal(filtro(bus(0, 0.004, { companyId: 2 }), 31000), false);
assert.equal(filtro(bus(0, 0.004, { busId: undefined }), 31000), false);
assert.equal(
  filtro(bus(0, 0.004), 101000),
  false,
  "Historial demasiado antiguo",
);
filtro = w.crearFiltroSentidoBuses([shape], [0, 0.035]);
filtro(bus(0, 0.001), 1000);
assert.equal(
  filtro(bus(0, 0.03), 2000),
  false,
  "Salto GPS incompatible con el intervalo",
);
filtro = w.crearFiltroSentidoBuses(
  [
    [
      [0, 0],
      [0, 0.04],
      [0, 0],
    ],
  ],
  [0, 0.01],
);
filtro(bus(0, 0.003), 1000);
assert.equal(
  filtro(bus(0, 0.004), 31000),
  false,
  "Ramas superpuestas ambiguas",
);
assert.equal(
  w.crearFiltroSentidoBuses([], [0, 0.01])(bus(0, 0.003), 1000),
  false,
);
const patron = JSON.parse(
  fs.readFileSync("tests/fixtures/127-aduana.json", "utf8"),
);
const parada = patron.shape[Math.floor(patron.shape.length / 3)];
filtro = w.crearFiltroSentidoBuses([patron.shape], parada);
filtro(bus(...patron.shape.at(-20)), 1000);
assert.equal(
  filtro(bus(...patron.shape.at(-10)), 31000),
  false,
  "127 hacia Aduana: coche lejos después de la subida",
);
vm.runInNewContext(fs.readFileSync("recorridos.js", "utf8"), {
  window: w,
  fetch: async (url) => ({
    ok: true,
    json: async () =>
      url.includes("manifest")
        ? { lines: { 127: "127.json" } }
        : url.includes("aliases")
          ? { toAlias: {}, toId: {} }
          : { patterns: [patron] },
  }),
});
(async () => {
  // Ejecuta también el fallback real del frontend, no solo el clasificador.
  const html = fs.readFileSync("index.html", "utf8");
  const inicio = html.indexOf("    async function mostrarBusesLejanos(");
  const fin = html.indexOf("    function mostrarProximos(", inicio);
  const errores = [];
  let actuales = [],
    mostrados = [],
    programados = 0;
  const context = {
    window: {
      crearFiltroSentidoBuses: w.crearFiltroSentidoBuses,
      obtenerPatronesParaParada: async () => [shape],
    },
    sesionProximos: 1,
    filtroSentidoActivo: null,
    proximos: { innerHTML: "", appendChild() {} },
    cacheBusesEnVivo: { timestamp: 1000 },
    obtenerBusesEnVivo: async () => actuales,
    informarLlegadas() {},
    limpiarMarcadoresBusesVivos() {
      mostrados = [];
    },
    mostrarMarcadoresBusesVivos: (p) => {
      mostrados = p;
    },
    agregarProximoProgramado: async () => {
      programados++;
    },
    distanciaMetros: () => 13700,
    formatearDistancia: () => "13,7 km",
    document: { createElement: () => ({}) },
    console: { error: (e) => errores.push(e) },
  };
  vm.createContext(context);
  vm.runInContext(html.slice(inicio, fin), context);
  const seleccion = {
    sesionId: 1,
    stopId: 546,
    variantId: 883,
    linea: "127",
    destination: "Aduana",
    stopLat: 0,
    stopLon: 0.01,
  };
  actuales = [bus(0.04, 0.035, { lineVariantId: 883 })];
  await context.mostrarBusesLejanos(seleccion);
  context.cacheBusesEnVivo.timestamp = 31000;
  actuales = [bus(0.04, 0.03, { lineVariantId: 883 })];
  await context.mostrarBusesLejanos(seleccion);
  assert.equal(mostrados.length, 0);
  assert.equal(programados, 2);
  assert.match(
    context.proximos.innerHTML,
    /avance hacia esta parada no está confirmado/,
  );
  context.filtroSentidoActivo = null;
  context.cacheBusesEnVivo.timestamp = 1000;
  actuales = [bus(0, 0.003, { lineVariantId: 883 })];
  await context.mostrarBusesLejanos(seleccion);
  context.cacheBusesEnVivo.timestamp = 31000;
  actuales = [bus(0, 0.004, { lineVariantId: 883 })];
  await context.mostrarBusesLejanos(seleccion);
  assert.equal(mostrados.length, 1);
  assert.equal(errores.length, 0);
  assert.equal(
    (await w.obtenerPatronesParaParada("127", "ADUANA", patron.stops[0]))
      .length,
    1,
  );
  assert.equal(
    (
      await w.obtenerPatronesParaParada(
        "127",
        "Paso de la Arena",
        patron.stops[0],
      )
    ).length,
    0,
  );
  assert.equal(
    (await w.obtenerPatronesParaParada("127", "Aduana", "inexistente")).length,
    0,
  );
  console.log(
    "OK: avance antes de parada, coche ya pasado aunque se acerque radialmente, sentido contrario, GPS ambiguo/cacheado/antiguo y recorrido real 127 Aduana.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
