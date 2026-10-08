const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const w = {};
vm.runInNewContext(fs.readFileSync("buses-mapa-vista.js", "utf8"), {
  window: w,
});
let zoom = 17,
  fits = 0,
  pans = [];
const mapa = {
  fitBounds: () => {
    fits++;
    zoom = 15;
  },
  setView: (_, z) => {
    fits++;
    zoom = z;
  },
  panTo: (p) => {
    pans.push(Array.from(p));
  },
};
const vista = w.crearVistaBusesMapa(mapa);
const seleccion = { sesionId: 1, stopId: 546, variantId: 883 };
const bus = { busId: 255, companyId: 1 };
vista.iniciar(seleccion);
vista.encuadrar([
  [-34.9, -56.2],
  [-34.91, -56.21],
]);
assert.equal(fits, 1);
zoom = 18;
vista.seguir(bus, [-34.91, -56.21]);
for (let i = 0; i < 3; i++) {
  vista.iniciar(seleccion);
  vista.actualizar(bus, [-34.92 - i / 1000, -56.22]);
  vista.encuadrar([
    [-34.9, -56.2],
    [-34.92, -56.22],
  ]);
  assert.equal(zoom, 18, "El refresco conserva el zoom manual");
}
assert.equal(fits, 1);
assert.equal(pans.length, 4);
vista.actualizar({ busId: 255, companyId: 2 }, [-34.8, -56.1]);
vista.actualizar({ busId: 259, companyId: 1 }, [-34.8, -56.1]);
assert.equal(pans.length, 4, "No sigue otro coche ni otra empresa");
vista.iniciar({ ...seleccion, sesionId: 2 });
vista.actualizar(bus, [-34.8, -56.1]);
assert.equal(
  pans.length,
  4,
  "Cambiar de selección elimina el seguimiento anterior",
);
vista.encuadrar([[-34.8, -56.1]]);
assert.equal(fits, 2);
zoom = 16;
vista.encuadrar([[-34.9, -56.2]]);
assert.equal(zoom, 16);
vista.seguir({}, [-34.8, -56.1]);
vista.actualizar({}, [-34.7, -56.1]);
assert.equal(pans.length, 4);
vista.reiniciar();
vista.iniciar(seleccion);
vista.encuadrar([]);
assert.equal(fits, 2);
vista.encuadrar([[-34.9, -56.2]]);
assert.equal(fits, 3);
console.log(
  "OK: encuadre inicial único, refrescos conservan zoom, seguimiento por coche/empresa y reinicio al cambiar selección.",
);
