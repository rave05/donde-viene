const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM } = require("jsdom");
const dom = new JSDOM(
  '<button id="btnSeguirViaje"></button><button id="btnCentrarViaje" hidden></button><p id="estadoSeguimientoViaje" hidden></p><p id="avisoBajadaViaje" hidden></p><div id="mapa"></div>',
  {
    url: "https://example.test",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  },
);
const w = dom.window,
  d = w.document;
let now = 1700000000000,
  hidden = false,
  timer,
  updates = [],
  watches = [],
  clears = [];
w.Date.now = () => now;
w.setInterval = (fn) => {
  timer = fn;
  return 1;
};
w.clearInterval = () => {};
Object.defineProperty(d, "hidden", { get: () => hidden });
Object.defineProperty(w.navigator, "geolocation", {
  value: {
    watchPosition: (ok, error) => {
      watches.push({ ok, error });
      return watches.length;
    },
    clearWatch: (id) => clears.push(id),
  },
});
w.mapaSeguimientoViaje = {
  preparar() {},
  actualizar: (...a) => updates.push(a),
  alMover() {},
};
w.HTMLElement.prototype.scrollIntoView = () => {};
w.eval(fs.readFileSync("seguimiento-viaje.js", "utf8"));
const pos = (lat = -34.9, timestamp = now, accuracy = 20) => ({
  coords: { latitude: lat, longitude: -56.2, accuracy },
  timestamp,
});
try {
  w.seguimientoViaje.setTramo({ nombre: "Bajada", lat: -34.9, lon: -56.2 });
  w.seguimientoViaje.iniciar();
  watches[0].ok(pos());
  assert(!d.getElementById("avisoBajadaViaje").hidden);
  assert.equal(updates.length, 1);
  watches[0].ok(pos(-34.8, now - 1000));
  assert.equal(updates.length, 1, "No retrocede a una muestra anterior");
  watches[0].ok(pos(-34.8, now + 60000));
  assert.equal(updates.length, 1, "No acepta una lectura futura");
  watches[0].ok(pos(-99));
  assert.equal(updates.length, 1);
  watches[0].error({ code: 2 });
  timer();
  assert(
    d.getElementById("avisoBajadaViaje").hidden,
    "Una lectura previa no vuelve a generar alerta después de perder GPS",
  );
  now += 1000;
  watches[0].ok(pos());
  assert(!d.getElementById("avisoBajadaViaje").hidden);
  hidden = true;
  d.dispatchEvent(new w.Event("visibilitychange"));
  assert(d.getElementById("avisoBajadaViaje").hidden);
  assert.deepEqual(clears, [1]);
  hidden = false;
  d.dispatchEvent(new w.Event("visibilitychange"));
  assert.equal(watches.length, 2);
  timer();
  assert(
    d.getElementById("avisoBajadaViaje").hidden,
    "Al volver debe esperar un GPS nuevo",
  );
  const count = updates.length;
  watches[0].ok(pos());
  assert.equal(updates.length, count, "Ignora callbacks del watch cancelado");
  watches[1].ok(pos(-34.9, now - 60000));
  assert.equal(updates.length, count);
  assert(d.getElementById("avisoBajadaViaje").hidden);
  watches[1].ok(pos());
  assert(!d.getElementById("avisoBajadaViaje").hidden);
  now += 31000;
  timer();
  assert(d.getElementById("avisoBajadaViaje").hidden);
  assert.match(
    d.getElementById("estadoSeguimientoViaje").textContent,
    /sin actualizar/,
  );
  watches[1].ok(pos(-34.9, now, 120));
  assert(
    d.getElementById("avisoBajadaViaje").hidden,
    "No avisa de bajada con precisión insuficiente",
  );
  now += 100;
  watches[1].ok(pos());
  w.seguimientoViaje.setTramo({ nombre: "Inválida", lat: 100, lon: -56.2 });
  assert(d.getElementById("avisoBajadaViaje").hidden);
  w.seguimientoViaje.detener();
  assert(!d.body.classList.contains("trip-tracking-active"));
  console.log(
    "GPS del viaje: antigüedad, futuro, orden de lecturas, error, segundo plano, reanudación y precisión de bajada OK",
  );
} finally {
  dom.window.close();
}
