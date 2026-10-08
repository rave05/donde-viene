const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const src = (n) => fs.readFileSync(path.join(root, n), "utf8");
function preparar(hash = "") {
  const dom = new JSDOM(src("index.html"), {
    url: "https://example.test/donde-viene/" + hash,
    runScripts: "outside-only",
  });
  const w = dom.window,
    d = w.document;
  let searches = 0,
    shared = "",
    restored = null;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.HTMLInputElement.prototype.select = function () {};
  w.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url.includes("recargas")
        ? JSON.parse(src("datos/recargas-stm.json"))
        : [],
  });
  Object.defineProperty(w.navigator, "clipboard", {
    value: {
      writeText: async (value) => {
        shared = value;
      },
    },
  });
  w.eval(src("app-util.js"));
  w.DondeVieneApp = {
    leerBusqueda: () => ({
      origen: d.getElementById("origenRuta").value,
      destino: d.getElementById("destinoRuta").value,
      preferencia: d.getElementById("preferenciaViaje").value,
    }),
    aplicarBusqueda: (r) => {
      d.getElementById("origenRuta").value = r.origen;
      d.getElementById("destinoRuta").value = r.destino;
      d.getElementById("preferenciaViaje").value = r.preferencia;
    },
    buscar: async () => {
      searches++;
    },
    centro: () => ({ lat: -34.89383, lon: -56.16657 }),
    mostrarRecargas() {},
    ocultarRecargas() {},
    enfocar() {},
    restaurarViaje: (...a) => {
      restored = a;
    },
  };
  for (const n of [
    "planificador",
    "viajes-habituales",
    "compartir-viaje",
    "ultimo-viaje",
    "recargas-stm",
    "patrocinios-locales",
  ])
    w.eval(src(n + ".js"));
  w.requestAnimationFrame = (fn) => fn();
  w.eval(src("mapa-layout.js"));
  assert.ok(d.querySelector(".map-column #mapa"));
  assert.ok(d.querySelector(".route-saved-panel #habitualesLista"));
  assert.ok(d.querySelector(".route-more-options #preferenciaViaje"));
  assert.equal(d.querySelector(".route-more-options").open, false);
  const expand = d.querySelector(".map-expand-button");
  expand.click();
  assert.equal(expand.getAttribute("aria-expanded"), "true");
  expand.click();
  assert.equal(expand.getAttribute("aria-expanded"), "false");
  return {
    dom,
    w,
    d,
    searches: () => searches,
    shared: () => shared,
    restored: () => restored,
  };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
(async () => {
  const x = preparar(),
    { w, d } = x;
  w.DondeVieneApp.aplicarBusqueda({
    origen: "Terminal Paso de la Arena",
    destino: "Tres Cruces",
    preferencia: "caminar",
  });
  d.getElementById("btnGuardarHabitual").click();
  d.getElementById("nombreHabitual").value = "Ir al trabajo";
  d.getElementById("formHabitual").dispatchEvent(
    new w.Event("submit", { cancelable: true }),
  );
  assert.ok(
    d.getElementById("habitualesLista").textContent.includes("Ir al trabajo"),
  );
  d.querySelector("#habitualesLista button").click();
  await flush();
  assert.equal(x.searches(), 1);
  assert.equal(d.getElementById("momentoViaje").value, "ahora");
  d.querySelector('[aria-label="Editar Ir al trabajo"]').click();
  d.getElementById("nombreHabitual").value = "Volver a casa";
  d.getElementById("formHabitual").dispatchEvent(
    new w.Event("submit", { cancelable: true }),
  );
  assert.ok(
    d.getElementById("habitualesLista").textContent.includes("Volver a casa"),
  );
  d.querySelector('[aria-label="Eliminar Volver a casa"]').click();
  assert.equal(
    JSON.parse(w.localStorage.getItem("donde-viene-habituales-v1")).length,
    0,
  );
  const share = [...d.querySelectorAll("button")].find(
    (b) => b.textContent === "Compartir recorrido",
  );
  share.click();
  await flush();
  assert.ok(x.shared().includes("#viaje="));
  const link = new URL(x.shared());
  const y = preparar(link.hash);
  assert.equal(y.d.getElementById("destinoRuta").value, "Tres Cruces");
  assert.equal(
    y.searches(),
    0,
    "Un enlace no debe iniciar consultas ni solicitar GPS por sí solo",
  );
  d.getElementById("origenRuta").value = "Mi ubicación";
  share.click();
  await flush();
  assert.match(
    d.body.textContent,
    /elegí un lugar o una dirección como origen/,
  );
  d.getElementById("momentoViaje").value = "fecha";
  d.getElementById("momentoViaje").dispatchEvent(new w.Event("change"));
  assert.equal(d.getElementById("fechaViajeCampos").hidden, false);
  d.getElementById("diaViaje").value = "2020-01-01";
  d.getElementById("horaViaje").value = "10:00";
  assert.throws(() => w.DV.planificador.leerFecha());
  w.DV.planificador.aplicar(null);
  assert.equal(w.DV.planificador.leerFecha(), null);
  const c = {
      line: "157",
      origen: { busstopId: 1 },
      destino: { busstopId: 2 },
    },
    ctx = { origen: "A", destino: "B", preferencia: "transbordos" };
  w.DV.ultimoViaje.guardar(c, ctx, [
    [
      [-34.9, -56.2],
      [-34.8, -56.1],
    ],
  ]);
  d.getElementById("btnAbrirUltimoViaje").click();
  assert.equal(x.restored()[0].line, "157");
  const stored = w.localStorage.getItem("donde-viene-ultimo-v1");
  assert.ok(!stored.includes("eta"));
  d.getElementById("btnBorrarUltimoViaje").click();
  assert.equal(d.getElementById("btnAbrirUltimoViaje").disabled, true);
  d.getElementById("btnBuscarRecargas").click();
  await flush();
  assert.ok(d.getElementById("listaRecargas").children.length > 0);
  assert.ok(d.getElementById("listaRecargas").children.length <= 8);
  d.getElementById("btnOcultarRecargas").click();
  assert.equal(d.getElementById("listaRecargas").children.length, 0);
  assert.equal(
    d.querySelector('[aria-label="Publicidad cerca del destino"]').hidden,
    true,
    "Una lista de campañas vacía no debe mostrar anuncios",
  );
  x.dom.window.close();
  y.dom.window.close();
  console.log(
    "OK: guardar/usar/editar/eliminar, compartir/abrir enlace sin auto consultas, planificación, copia guardada, recargas y campañas vacías.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
