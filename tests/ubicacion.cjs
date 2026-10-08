const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
  runScripts: "outside-only",
  url: "https://example.test/",
});
const w = dom.window,
  d = w.document;
let requests = 0,
  success,
  failure,
  centrado,
  seguimientos = 0;
w.DondeVieneApp = {
  centrarUbicacionMapa: (p) => {
    centrado = p;
  },
};
w.requestAnimationFrame = (fn) => fn();
Object.defineProperty(w.navigator, "geolocation", {
  configurable: true,
  value: {
    getCurrentPosition: (ok, fail, options) => {
      requests++;
      success = ok;
      failure = fail;
      assert.equal(options.maximumAge, 0);
    },
  },
});
for (const name of [
  "app-util",
  "mapa-puntos",
  "mapa-layout",
  "mapa-gadgets",
  "mapa-ubicacion",
])
  w.eval(fs.readFileSync(name + ".js", "utf8"));
assert.equal(requests, 0, "No pide GPS al cargar");
const b = d.getElementById("mapaMiUbicacion");
d.getElementById("origenRuta").value = "Terminal Paso de la Arena";
d.getElementById("destinoRuta").value = "Tres Cruces";
const resultado = d.getElementById("resultadoRuta");
resultado.textContent = "Ruta elegida";
b.click();
b.click();
assert.equal(requests, 1);
assert.equal(b.disabled, true);
success({
  timestamp: Date.now(),
  coords: { latitude: -34.9, longitude: -56.2, accuracy: 20 },
});
assert.equal(b.disabled, false);
assert.equal(centrado.lat, -34.9);
assert.equal(d.getElementById("origenRuta").value, "Terminal Paso de la Arena");
assert.equal(d.getElementById("destinoRuta").value, "Tres Cruces");
assert.equal(resultado.textContent, "Ruta elegida");
centrado = null;
b.click();
failure({ code: 1 });
assert.equal(b.disabled, false);
assert.match(d.querySelector(".map-location-help").textContent, /Permití/);
for (const [accuracy, timestamp] of [
  [300, Date.now()],
  [10, Date.now() - 60000],
]) {
  b.click();
  success({
    timestamp,
    coords: { latitude: -34.9, longitude: -56.2, accuracy },
  });
  assert.equal(centrado, null);
  assert.equal(b.disabled, false);
}
const volver = d.createElement("button");
volver.id = "btnCentrarViaje";
volver.addEventListener("click", () => seguimientos++);
d.body.append(volver);
const anteriores = requests;
d.body.classList.add("trip-tracking-active");
b.click();
assert.equal(seguimientos, 1);
assert.equal(requests, anteriores, "Reutiliza el seguimiento existente");
d.body.classList.remove("trip-tracking-active");
d.getElementById("mapa").classList.add("map-picking");
b.click();
assert.equal(requests, anteriores);
d.getElementById("mapa").classList.remove("map-picking");
b.click();
d.body.classList.add("trip-tracking-active");
success({
  timestamp: Date.now(),
  coords: { latitude: -34.9, longitude: -56.2, accuracy: 20 },
});
assert.equal(
  centrado,
  null,
  "Descarta una posición que llega después de iniciar viaje",
);
d.body.classList.remove("trip-tracking-active");
delete w.navigator.geolocation;
b.click();
assert.match(d.querySelector(".map-location-help").textContent, /no permite/);
dom.window.close();
console.log(
  "OK: centrar sin cambiar ruta, sin GPS automático, bloqueo simultáneo, permiso, precisión, antigüedad y seguimiento existente.",
);
