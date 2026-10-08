const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const fs = require("node:fs");
const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
  url: "https://rave05.github.io/donde-viene/",
  runScripts: "outside-only",
});
const w = dom.window,
  d = w.document;
let click,
  libres = 0,
  marcado;
w.DondeVieneApp = {
  alElegirPuntoMapa(fn) {
    click = fn;
    return () => {
      libres++;
      click = null;
    };
  },
  vistaPuntoMapa() {},
  marcarPuntoBusqueda(campo, punto) {
    marcado = { campo, punto };
  },
};
w.eval(fs.readFileSync("app-util.js", "utf8"));
w.eval(fs.readFileSync("mapa-puntos.js", "utf8"));
d.getElementById("origenRuta").value = "Origen anterior";
d.getElementById("elegirOrigenMapa").click();
click({ lat: -34.9, lon: -56.16 });
assert.equal(d.getElementById("origenRuta").value, "Origen anterior");
d.getElementById("cancelarPuntoMapa").click();
assert.equal(d.getElementById("origenRuta").value, "Origen anterior");
assert.equal(libres, 1);
d.getElementById("elegirDestinoMapa").click();
click({ lat: 0, lon: 0 });
assert.equal(d.getElementById("confirmarPuntoMapa").disabled, true);
click({ lat: -34.9011, lon: -56.1645 });
d.getElementById("confirmarPuntoMapa").click();
assert.equal(marcado.campo, "destino");
assert.equal(libres, 2);
const texto = d.getElementById("destinoRuta").value;
const resuelto = w.DV.puntosMapa.resolver(texto);
assert.equal(resuelto.lat, -34.9011);
assert.equal(resuelto.lon, -56.1645);
assert.equal(resuelto.geocodificacionLocal, true);
assert.equal(
  w.DV.puntosMapa.resolver("Punto en el mapa (0.000000, 0.000000)"),
  null,
);
assert.equal(w.DV.puntosMapa.resolver("Punto en el mapa (-34.9, NaN)"), null);
assert.ok(
  w.DV.recetaValida({
    origen: "Origen anterior",
    destino: texto,
    preferencia: "proximos",
  }),
);
assert.equal(d.getElementById("accionesPuntoMapa").hidden, true);
assert.equal(d.getElementById("mapa").classList.contains("map-picking"), false);
dom.window.close();
console.log(
  "OK: selección y confirmación, cancelar sin modificar, limpieza de listeners, coordenadas y recetas persistentes.",
);
