const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = require("node:path").resolve(__dirname, "..");
const source = (name) =>
  name.endsWith(".gz")
    ? require("node:zlib")
        .gunzipSync(fs.readFileSync(root + "/" + name))
        .toString("utf8")
    : fs.readFileSync(root + "/" + name, "utf8");
function context(extra = {}) {
  const window = {};
  const ctx = {
    window,
    Intl,
    Date,
    Math,
    Number,
    console,
    setTimeout,
    clearTimeout,
    ...extra,
  };
  vm.createContext(ctx);
  vm.runInContext(source("app-util.js"), ctx);
  vm.runInContext(source("viaje.js"), ctx);
  return ctx;
}
async function probarWorker(data, from, to) {
  let answer;
  const self = {
    postMessage(v) {
      answer = v;
    },
  };
  const c = {
    self,
    fetch: async () =>
      new Response(require("node:zlib").gzipSync(JSON.stringify(data))),
    Response,
    Blob,
    DecompressionStream,
    TextDecoder,
    Uint8Array,
    Float64Array,
    Int32Array,
    Map,
    Set,
    Math,
  };
  vm.createContext(c);
  vm.runInContext(source("caminatas-worker.js"), c);
  await self.onmessage({ data: { id: 1, desde: from, hasta: to } });
  return answer.result;
}
(async () => {
  const c = context();
  const DV = c.window.DV;
  assert.equal(DV.coord({ lat: null, lon: 0 }), null);
  assert.equal(
    DV.recetaValida({ origen: "A", destino: "B", preferencia: "tiempo" }),
    true,
  );
  const red = {
    nodes: [
      [-34.9, -56.2],
      [-34.9, -56.199],
      [-34.899, -56.199],
    ],
    edges: [
      [0, 1],
      [1, 2],
    ],
  };
  const from = { lat: -34.9, lon: -56.2 },
    to = { lat: -34.899, lon: -56.199 };
  const ruta = await probarWorker(red, from, to);
  assert.ok(
    ruta.metros > DV.distancia(from, to) + 20,
    "El trazado debe seguir las calles, sin cortar la esquina",
  );
  assert.ok(ruta.puntos.length >= 5);
  const desconectada = {
    nodes: [
      [-34.9, -56.2],
      [-34.9, -56.199],
      [-34.895, -56.19],
      [-34.895, -56.189],
    ],
    edges: [
      [0, 1],
      [2, 3],
    ],
  };
  assert.equal(
    await probarWorker(desconectada, from, { lat: -34.895, lon: -56.19 }),
    null,
  );
  const actual = JSON.parse(source("datos/caminatas.json.gz"));
  assert.ok(actual.nodes.length > 10000);
  assert.equal(actual.licencia, "ODbL-1.0");
  const real = await probarWorker(
    actual,
    { lat: -34.89308731, lon: -56.16402591 },
    { lat: -34.8938334, lon: -56.1665762 },
  );
  assert.ok(
    real && real.metros > 250 && real.metros < 1200,
    "Caminata real hacia Tres Cruces",
  );
  const data = {
    services: { s: { start: "20200101", end: "20301231", days: "1111111" } },
    exceptions: { 20261010: { remove: ["s"] } },
    stops: { 1: { Centro: { s: [3600, 32400, 90000] } } },
  };
  c.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url.includes("manifest") ? { lines: { 157: "157.json" } } : data,
  });
  vm.runInContext(source("horarios.js"), c);
  const next = await c.window.obtenerSalidaProgramada({
    linea: "157",
    stopId: 1,
    destination: "Céntro",
    fechaReferencia: "2026-10-09T08:30:00-03:00",
  });
  assert.equal(next.time, "09:00");
  assert.equal(next.secondsUntil, 1800);
  assert.equal(next.date, "2026-10-09T12:00:00.000Z");
  assert.equal(
    await c.window.obtenerSalidaProgramada({
      linea: "157",
      stopId: 1,
      destination: "Centro Sur",
      fechaReferencia: "2026-10-09T08:30:00-03:00",
    }),
    null,
  );
  const madrugada = await c.window.obtenerSalidaProgramada({
    linea: "157",
    stopId: 1,
    destination: "Centro",
    fechaReferencia: "2026-10-09T00:30:00-03:00",
  });
  assert.equal(madrugada.time, "01:00");
  assert.equal(madrugada.secondsUntil, 1800);
  const sinServicio = await c.window.obtenerSalidaProgramada({
    linea: "157",
    stopId: 1,
    destination: "Centro",
    fechaReferencia: "2031-01-02T00:30:00-03:00",
  });
  assert.equal(sinServicio, null);
  const calls = [];
  DV.caminatas = {
    paraViaje: async () => [
      { id: "origen", tipo: "calles", metros: 150 },
      { id: "combinacion", tipo: "calles", metros: 100 },
      { id: "destino", tipo: "calles", metros: 200 },
    ],
  };
  c.window.obtenerSalidaProgramada = async (s) => {
    calls.push(s);
    return {
      secondsUntil: 300,
      date: new Date(Date.parse(s.fechaReferencia) + 300000).toISOString(),
    };
  };
  c.window.obtenerTramoLineaViaje = async () => [
    [-34.9, -56.2],
    [-34.91, -56.2],
  ];
  vm.runInContext(source("estimacion-viaje.js"), c);
  const origin = { busstopId: 1, distanciaRuta: 10 },
    transfer = { busstopId: 2 },
    dest = { busstopId: 3, distanciaRuta: 10 };
  const trip = {
    line1: "L1",
    line2: "163",
    origen: origin,
    combinacion: transfer,
    destino: dest,
  };
  const calc = await DV.estimacion.estimar(trip, {
    fechaSalida: "2026-10-09T08:00:00-03:00",
  });
  assert.equal(calc.tiempo.disponible, true);
  assert.equal(calc.origen.distanciaRuta, 150);
  assert.ok(
    Date.parse(calls[0].fechaReferencia) >
      Date.parse("2026-10-09T08:00:00-03:00"),
  );
  assert.ok(
    Date.parse(calls[1].fechaReferencia) >
      Date.parse(calls[0].fechaReferencia) + 300000,
  );
  assert.equal(calc.tiempo.partes.length, 2);
  assert.ok(calc.tiempo.total > 20);
  c.window.obtenerSalidaProgramada = async () => null;
  assert.equal(
    (
      await DV.estimacion.estimar(trip, {
        fechaSalida: "2026-10-09T08:00:00-03:00",
      })
    ).tiempo.disponible,
    false,
  );
  const orden = c.window.ordenarOpcionesViaje(
    [
      { line: "A", tiempo: { disponible: false } },
      { line: "B", tiempo: { disponible: true, total: 40 } },
      { line: "C", tiempo: { disponible: true, total: 25 } },
    ],
    "tiempo",
  );
  assert.equal(orden[0].line, "C");
  assert.equal(orden[2].line, "A");
  const stm = JSON.parse(source("datos/recargas-stm.json"));
  assert.ok(stm.locales.length > 2000);
  const colon = stm.locales.find((p) => p.nombre.includes("TERMINAL COLON"));
  assert.ok(
    colon.lat < -34.79 &&
      colon.lat > -34.81 &&
      colon.lon < -56.21 &&
      colon.lon > -56.24,
    "Conversión UTM correcta",
  );
  // Una ruta futura nunca debe consultar vehículos de ahora.
  const html = source("index.html");
  const seleccionar = html.slice(
    html.indexOf("    async function seleccionarLinea("),
    html.indexOf("    function cancelarActualizacionProximos("),
  );
  let vivo = 0,
    modo = "";
  const plan = {
    window: {
      DV,
      obtenerSalidaProgramada: async () => ({
        date: "2026-10-09T12:00:00.000Z",
        destination: "Centro",
      }),
    },
    paradaActual: { busstopId: 1 },
    suprimirScrollAutomatico: true,
    contextoViajeActivo: { fechaSalida: "2026-10-09T08:00:00-03:00" },
    resultadoRuta: { querySelector: () => true },
    seccionLineas: {},
    seccionProximos: {},
    setSeccionColapsada() {},
    sesionProximos: 0,
    proximos: { innerHTML: "" },
    lineaActual: null,
    variantActual: null,
    escaparHTML: DV.escape,
    informarLlegadas(value) {
      modo = value;
    },
    fetch() {
      vivo++;
    },
    cargarProximos() {
      vivo++;
    },
  };
  plan.cancelarActualizacionProximos = () => {
    plan.sesionProximos++;
  };
  vm.createContext(plan);
  vm.runInContext(seleccionar, plan);
  await plan.seleccionarLinea(
    { line: "157", lineVariantId: 883, destination: "Centro" },
    {},
  );
  assert.equal(vivo, 0);
  assert.equal(modo, "programado");
  assert.match(plan.proximos.innerHTML, /0?9\/10/);
  let resolver;
  plan.window.obtenerSalidaProgramada = () =>
    new Promise((resolve) => (resolver = resolve));
  const pendiente = plan.seleccionarLinea(
    { line: "157", destination: "Centro" },
    {},
  );
  plan.sesionProximos++;
  plan.proximos.innerHTML = "Otro viaje";
  resolver({ date: "2026-10-09T12:00:00.000Z" });
  await pendiente;
  assert.equal(
    plan.proximos.innerHTML,
    "Otro viaje",
    "Un horario anterior no debe pisar una selección nueva",
  );
  const swEvents = {};
  vm.runInNewContext(source("sw.js"), {
    self: {
      addEventListener: (name, f) => (swEvents[name] = f),
      location: { origin: "https://example.test" },
      registration: { scope: "https://example.test/donde-viene/" },
    },
    URL,
  });
  let captured = false;
  swEvents.fetch({
    request: {
      method: "GET",
      url: "https://donde-viene-api.darriulatmaster.workers.dev/buses",
    },
    respondWith() {
      captured = true;
    },
  });
  assert.equal(
    captured,
    false,
    "El service worker no debe interceptar la API en vivo",
  );
  console.log(
    "OK: calles reales/sin conexiones falsas, fechas/fines de vigencia/sentidos/madrugada, espera de ambos buses, tiempos incompletos, clasificación, proyección STM y API fuera de caché.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
