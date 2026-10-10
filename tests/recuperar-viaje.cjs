const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM } = require("jsdom");
const KEY = "donde-viene-en-curso-v1";
const summary =
  '<section class="trip-summary"><button id="btnEmpezarViaje">Empezar viaje</button><p id="estadoGuiaViaje" hidden></p><ol class="trip-steps"><li><strong>🚶 Caminá a la parada</strong><span>Caminata inicial</span></li><li data-bajada-nombre="Combinación" data-bajada-lat="-34.9" data-bajada-lon="-56.2"><strong>🚌 Tomá el 494</strong><span>Primer bus</span></li><li><strong>🚶 Caminá al segundo bus</strong><span>Trasbordo</span></li><li data-bajada-nombre="Destino" data-bajada-lat="-34.91" data-bajada-lon="-56.19"><strong>🚌 Tomá el 230</strong><span>Segundo bus</span></li><li><strong>🚶 Llegá al destino</strong><span>Última caminata</span></li></ol></section>';
function preparar(saved) {
  const dom = new JSDOM(
    '<main><section class="route-planner"><button id="btnBuscarRuta">Buscar</button></section><div id="resultadoRuta">' +
      summary +
      '</div></main><div id="mapa"></div>',
    {
      url: "https://example.test/donde-viene/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window,
    d = w.document;
  let watches = 0,
    clears = 0,
    restored = 0,
    fetches = 0;
  if (saved) w.localStorage.setItem(KEY, saved);
  w.HTMLElement.prototype.scrollIntoView = () => {};
  Object.defineProperty(w.navigator, "geolocation", {
    value: { watchPosition: () => ++watches, clearWatch: () => clears++ },
  });
  w.fetch = () => {
    fetches++;
    throw Error("No se deben consultar llegadas");
  };
  w.eval(fs.readFileSync("app-util.js", "utf8"));
  w.DV.planificador = { aplicar() {} };
  w.DondeVieneApp = {
    restaurarViaje() {
      restored++;
      w.dispatchEvent(new w.Event("donde-viene:viaje-cambio"));
      d.getElementById("resultadoRuta").innerHTML = summary;
    },
  };
  for (const f of [
    "seguimiento-viaje.js",
    "guia-viaje.js",
    "ultimo-viaje.js",
    "viaje-en-curso.js",
  ])
    w.eval(fs.readFileSync(f, "utf8"));
  return {
    dom,
    w,
    d,
    click: (id) => d.getElementById(id).click(),
    stats: () => ({ watches, clears, restored, fetches }),
  };
}
const a = preparar();
let saved;
try {
  a.w.DV.ultimoViaje.guardar(
    {
      line1: "494",
      line2: "230",
      origen: { busstopId: "a" },
      destino: { busstopId: "b" },
      proximaSalida: { date: "2026-10-10T10:00:00Z" },
    },
    {
      origen: "Paso de la Arena",
      destino: "Tres Cruces",
      preferencia: "proximos",
    },
    [
      [
        [-34.9, -56.2],
        [-34.91, -56.19],
      ],
    ],
  );
  a.click("btnEmpezarViaje");
  a.click("btnSeguirViaje");
  assert.equal(a.w.guiaViaje.estado().indice, 1);
  assert.equal(a.stats().watches, 1);
  a.click("btnSiguienteGuiaViaje");
  assert.equal(
    a.stats().clears,
    1,
    "Bajar del primer bus detiene ese seguimiento",
  );
  a.click("btnSeguirViaje");
  assert.equal(
    a.w.guiaViaje.estado().indice,
    3,
    "Ya subí durante el trasbordo pasa al segundo bus",
  );
  assert.equal(a.stats().watches, 2);
  saved = a.w.localStorage.getItem(KEY);
  assert(saved);
  assert(!saved.includes("proximaSalida"));
  assert(!saved.includes("accuracy"));
  assert(!saved.includes("timestamp"));
  a.w.dispatchEvent(new a.w.Event("pagehide"));
  assert(
    a.w.localStorage.getItem(KEY),
    "Cerrar la página conserva el avance manual",
  );
} finally {
  a.dom.window.close();
}
const b = preparar(saved);
try {
  assert(!b.d.querySelector(".trip-recovery").hidden);
  assert.equal(b.stats().watches, 0);
  assert.equal(b.stats().restored, 0, "La recuperación espera el toque");
  b.d.getElementById("btnBuscarRuta").disabled = true;
  b.click("btnRetomarViajeGuardado");
  assert.equal(b.stats().restored, 0);
  assert(!b.d.querySelector(".trip-recovery").hidden);
  b.d.getElementById("btnBuscarRuta").disabled = false;
  b.click("btnRetomarViajeGuardado");
  assert.equal(b.stats().restored, 1);
  assert.equal(b.w.guiaViaje.estado().indice, 3);
  assert.match(b.d.getElementById("accionGuiaViaje").textContent, /230/);
  assert.equal(b.stats().watches, 0, "Retomar no inicia GPS");
  assert.equal(b.stats().fetches, 0);
  assert(!b.d.getElementById("guiaViaje").hidden);
  b.click("btnSeguirViaje");
  assert.equal(b.stats().watches, 1);
  b.click("btnSiguienteGuiaViaje");
  assert(
    b.d.getElementById("btnSeguirViaje").hidden,
    "No propone abordar después del último bus",
  );
  b.click("btnTerminarGuiaViaje");
  assert.equal(b.w.localStorage.getItem(KEY), "null");
} finally {
  b.dom.window.close();
}
for (const change of [
  (v) => (v.version = 2),
  (v) => (v.guardado = Date.now() - 13 * 60 * 60 * 1000),
  (v) => (v.guardado = Date.now() + 60000),
  (v) => (v.guia.indice = 99),
  (v) => (v.guia.pasos[0].titulo = "x".repeat(501)),
  (v) => (v.guia.pasos[3].bajada.lat = 100),
  (v) => (v.recorrido.geometria = [[[NaN, 0]]]),
]) {
  const v = JSON.parse(saved);
  change(v);
  const t = preparar(JSON.stringify(v));
  try {
    assert(t.d.querySelector(".trip-recovery").hidden);
    assert.equal(t.stats().watches, 0);
  } finally {
    t.dom.window.close();
  }
}
for (const action of ["btnDescartarViajeGuardado", "cambio"]) {
  const t = preparar(saved);
  try {
    if (action === "cambio")
      t.w.dispatchEvent(new t.w.Event("donde-viene:viaje-cambio"));
    else t.click(action);
    assert.equal(t.w.localStorage.getItem(KEY), "null");
    assert(t.d.querySelector(".trip-recovery").hidden);
  } finally {
    t.dom.window.close();
  }
}
const fail = preparar();
try {
  fail.w.DV.ultimoViaje.guardar(
    { line: "494", origen: { busstopId: "a" }, destino: { busstopId: "b" } },
    { origen: "A", destino: "B", preferencia: "proximos" },
    [],
  );
  fail.w.DV.guardar = () => false;
  fail.click("btnEmpezarViaje");
  assert(fail.w.guiaViaje.estado());
  assert.match(
    fail.d.getElementById("estadoGuiaViaje").textContent,
    /No pudimos guardar/,
  );
} finally {
  fail.dom.window.close();
}
const deletion = preparar(saved);
try {
  const normal = deletion.w.DV.guardar;
  deletion.w.DV.guardar = () => false;
  deletion.click("btnDescartarViajeGuardado");
  assert.equal(deletion.w.localStorage.getItem(KEY), saved);
  assert(!deletion.d.querySelector(".trip-recovery").hidden);
  assert(deletion.d.getElementById("btnRetomarViajeGuardado").hidden);
  assert.match(
    deletion.d.getElementById("estadoRecuperacionViaje").textContent,
    /podría reaparecer/,
  );
  deletion.w.DV.guardar = normal;
  deletion.click("btnDescartarViajeGuardado");
  assert.equal(deletion.w.localStorage.getItem(KEY), "null");
  assert(deletion.d.querySelector(".trip-recovery").hidden);
} finally {
  deletion.dom.window.close();
}
const quota = preparar();
try {
  const guardarNormal = quota.w.DV.guardar;
  const contexto = { origen: 'A', destino: 'B', preferencia: 'proximos' };
  const candidato = { line: '494', origen: { busstopId: 'a' }, destino: { busstopId: 'b' } };
  quota.w.DV.ultimoViaje.guardar(candidato, contexto);
  // La copia grande puede exceder la cuota mientras el avance todavía cabe.
  quota.w.DV.guardar = (key, value) => key === 'donde-viene-ultimo-v1' ? false : guardarNormal(key, value);
  quota.w.DV.ultimoViaje.guardar({ ...candidato, line: '230' }, { ...contexto, destino: 'C' });
  quota.click('btnEmpezarViaje');
  const actual = JSON.parse(quota.w.localStorage.getItem(KEY));
  assert.equal(actual.recorrido.candidato.line, '230');
  assert.equal(actual.recorrido.contexto.destino, 'C');
  assert.match(quota.d.getElementById('estadoUltimoViaje').textContent, /no pudimos guardar/);
  quota.w.DV.ultimoViaje.guardar({ ...candidato, line: '' }, contexto);
  assert.equal(quota.w.DV.ultimoViaje.obtenerCopia(), null, 'Una copia inválida no conserva la ruta anterior en memoria');
} finally {
  quota.dom.window.close();
}
console.log(
  "Recuperación: paso de combinación, cierre, espera de búsqueda, restauración explícita sin GPS/ETAs, fin, descarte, vencimiento, datos inválidos y almacenamiento bloqueado OK",
);
