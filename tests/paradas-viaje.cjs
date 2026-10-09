const fs = require("fs"),
  path = require("path"),
  assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, ".."),
  src = (p) => fs.readFileSync(path.join(root, p), "utf8");
const dom = new JSDOM(
    '<main><section class="trip-summary"><button id="btnEmpezarViaje">Empezar viaje</button><ol class="trip-steps"><li><strong>🚌 Tomá el 144</strong><span>Viaje</span></li></ol></section></main><div id="mapa"></div>',
    { url: "https://example.test/", runScripts: "outside-only" },
  ),
  w = dom.window;
const fetches = [];
w.fetch = async (u) => {
  fetches.push(u);
  return {
    ok: true,
    json: async () => JSON.parse(src(u.replace(/^\.\//, ""))),
  };
};
for (const f of [
  "app-util.js",
  "recorridos.js",
  "metropolitano.js",
  "guia-viaje.js",
  "paradas-viaje.js",
])
  w.eval(src(f));
const red = JSON.parse(src("recorridos/red.json")),
  p = JSON.parse(src("recorridos/144.json")).patterns.find(
    (p) => p.stops.length > 15,
  );
w.todasLasParadas = Object.entries(red.coords).map(([id, c]) => ({
  busstopId: id,
  street1: "Esquina " + id,
  location: { coordinates: [c[1], c[0]] },
}));
const stop = (id) => w.todasLasParadas.find((s) => s.busstopId === id),
  c = {
    line: "144",
    destination: p.destination,
    origen: stop(p.stops[3]),
    destino: stop(p.stops[12]),
  };
let drawn = null,
  focused = null;
w.DondeVieneApp = {
  mostrarParadasViaje: (t) => {
    drawn = t;
  },
  limpiarParadasViaje: () => {
    drawn = null;
  },
  enfocarParadaViaje: (k) => {
    focused = k;
  },
};
const fire = (type, detail) =>
    w.dispatchEvent(new w.CustomEvent(type, { detail })),
  tick = () => new Promise((r) => setTimeout(r, 25));
(async () => {
  const stops = await w.obtenerParadasTramoViaje(
    c.line,
    c.destination,
    c.origen,
    c.destino,
  );
  assert.deepEqual(
    Array.from(stops, (s) => s.id),
    p.stops.slice(3, 13),
    "solo paradas intermedias, en sentido correcto",
  );
  assert(
    stops.every(
      (s) => Number.isFinite(s.lat) && s.nombre.startsWith("Esquina"),
    ),
  );
  assert.equal(
    (
      await w.obtenerParadasTramoViaje(
        c.line,
        c.destination,
        c.destino,
        c.origen,
      )
    ).length,
    0,
    "no invierte sentido",
  );
  assert.equal(
    (
      await w.obtenerParadasTramoViaje(
        c.line,
        "Otro sentido",
        c.origen,
        c.destino,
      )
    ).length,
    0,
  );
  fire("donde-viene:viaje-elegido", { candidato: c });
  assert.equal(drawn, null, "no muestra antes de iniciar");
  w.document.getElementById("btnEmpezarViaje").click();
  await tick();
  assert.equal(drawn[0].paradas.length, 10);
  assert(w.document.getElementById("paradasDelViaje"));
  w.document.getElementById("paradasDelViaje").open = true;
  w.document.querySelector('[data-parada-viaje="0:4"]').click();
  assert.equal(focused, "0:4");
  w.document.getElementById("btnSalirGuiaViaje").click();
  assert.equal(w.document.getElementById("guiaViaje").hidden, true);
  assert.equal(w.document.getElementById("btnVolverGuiaViaje").hidden, false);
  assert.equal(drawn[0].paradas.length, 10, "minimizar mantiene las paradas");
  w.document.getElementById("btnVolverGuiaViaje").click();
  assert.equal(w.document.getElementById("guiaViaje").hidden, false);
  w.document.getElementById("btnTerminarGuiaViaje").click();
  assert.equal(drawn, null);
  assert(!w.document.getElementById("paradasDelViaje"));
  const data = await w.DV.metro.cargar(),
    a = data.stops["24204"],
    b = data.stops["24001"];
  const raw = w.DV.metro
      .directas(data, a, b, new Date("2026-10-09T12:00:00-03:00"))
      .find((c) => c.p.line === "230"),
    m = w.DV.metro.adaptar(data, raw, {});
  const metro = await w.DV.metro.paradasTramo(m),
    ids = raw.p.stops.slice(
      raw.p.stops.indexOf(raw.subida.id.replace("mtop:", "")),
      raw.p.stops.indexOf(raw.bajada.id.replace("mtop:", "")) + 1,
    );
  assert.deepEqual(
    Array.from(metro, (s) => s.id),
    ids.map((id) => "mtop:" + id),
  );
  assert(metro.length > 20);
  const metroReverse = w.DV.metro.adaptar(
    data,
    w.DV.metro
      .directas(data, b, a, new Date("2026-10-09T12:00:00-03:00"))
      .find((c) => c.p.line === "230"),
    {},
  );
  assert(
    (await w.DV.metro.paradasTramo(metroReverse)).length > 20,
    "vuelta metropolitana",
  );
  const combo = {
    ...m,
    line: null,
    line1: m.line,
    destination1: m.destination,
    line2: c.line,
    destination2: c.destination,
    origen: m.origen,
    combinacion: m.destino,
    combinacion2: c.origen,
    destino: c.destino,
  };
  const combined = await w.DV.paradasViaje.cargar(combo);
  assert.equal(combined.length, 2);
  assert(combined[0].paradas.every((p) => p.id.startsWith("mtop:")));
  assert.equal(combined[1].paradas.length, 10);
  // Una descarga vieja no puede mostrar paradas después de salir o cambiar de viaje.
  let release;
  const real = w.obtenerParadasTramoViaje;
  w.obtenerParadasTramoViaje = () =>
    new Promise((r) => {
      release = r;
    });
  fire("donde-viene:viaje-elegido", { candidato: c });
  fire("donde-viene:guia-iniciada");
  fire("donde-viene:viaje-cambio");
  release(stops);
  await tick();
  assert.equal(drawn, null);
  assert(!w.document.getElementById("paradasDelViaje"));
  w.obtenerParadasTramoViaje = real;
  assert(
    fetches.every((u) => u.startsWith("./")),
    "solo datos estáticos; sin API urbana para MTOP",
  );
  const vm = require("vm");
  for (const script of new JSDOM(
    src("index.html"),
  ).window.document.querySelectorAll("script:not([src])"))
    new vm.Script(script.textContent);
  console.log(
    "Paradas del viaje: orden, sentido, tramo, inicio/salida, selección en mapa, metro ida/vuelta, combinación y cancelación OK",
  );
  dom.window.close();
})().catch((e) => {
  console.error(e);
  dom.window.close();
  process.exitCode = 1;
});
