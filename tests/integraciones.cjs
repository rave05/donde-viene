const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { gunzipSync } = require("node:zlib");
const root = path.resolve(__dirname, "..");
const dom = new JSDOM(fs.readFileSync(root + "/index.html", "utf8"), {
    url: "https://example.test/",
    runScripts: "outside-only",
  }),
  w = dom.window,
  d = w.document;
w.eval(fs.readFileSync(root + "/app-util.js", "utf8"));
const load = (f) => w.eval(fs.readFileSync(root + "/" + f, "utf8"));
w.AbortController = AbortController;
w.DecompressionStream = DecompressionStream;
w.Response = Response;
let reads = 0;
w.fetch = async (url) => {
  reads++;
  return new Response(
    fs.readFileSync(path.join(root, String(url).replace(/^\.\//, ""))),
  );
};
load("direcciones.js");
load("planificador.js");
load("comparar-viajes.js");
load("informacion-oficial.js");
load("servicios.js");
load("notificaciones.js");
(async () => {
  const opts = await w.DV.direcciones.sugerir("18 de julio 1263");
  assert(opts.length > 0);
  assert(opts.every((o) => o.punto.lat < -34 && o.punto.lon < -55));
  const count = reads;
  await w.DV.direcciones.sugerir("18 de julio 1264");
  assert.equal(reads, count, "Índice y fragmento compartidos");
  const resolved = await w.DV.direcciones.resolver(opts[0].valor);
  assert(resolved.geocodificacionLocal);
  assert.equal(
    await w.DV.direcciones.resolver("calle que no existe 999999"),
    null,
  );
  const duplicada = await w.DV.direcciones.sugerir("18 de julio 1263");
  if (duplicada.length > 1) {
    await assert.rejects(
      () => w.DV.direcciones.resolver("18 de julio 1263"),
      /varios accesos/,
    );
  }
  assert.equal(await w.DV.direcciones.resolver("Hospital de Clínicas"), null);
  const indice = JSON.parse(
    fs.readFileSync(root + "/datos/direcciones/indice.json"),
  );
  assert(indice.calles.length > 4000);
  const filas = Object.values(
    JSON.parse(
      gunzipSync(fs.readFileSync(root + "/datos/direcciones/00.json.gz")),
    ),
  ).flat();
  assert(
    filas.every(
      (p) =>
        p[2] >= -35.05 && p[2] <= -34.65 && p[3] >= -56.45 && p[3] <= -55.9,
    ),
  );
  w.DV.planificador.aplicar(null);
  assert.equal(w.DV.planificador.leerLimite(), null);
  const salida = new Date(Date.now() + 3600000).toISOString(),
    limite = new Date(Date.now() + 7200000).toISOString();
  w.DV.planificador.aplicar(salida, limite);
  assert.equal(
    Date.parse(w.DV.planificador.leerLimite(salida)),
    Math.floor(Date.parse(limite) / 60000) * 60000,
  );
  assert.throws(() =>
    w.DV.planificador.leerLimite(new Date(Date.now() + 10800000).toISOString()),
  );
  const valid = {
    tiempo: { disponible: true, total: 40, max: 50, fechaSalida: salida },
  };
  assert.equal(
    w.DV.planificador.filtrarLlegada(
      [
        valid,
        { tiempo: { disponible: false } },
        {
          tiempo: {
            disponible: true,
            total: 80,
            max: 100,
            fechaSalida: salida,
          },
        },
      ],
      limite,
    ).length,
    1,
  );
  w.DV.planificador.aplicar(null);
  assert.equal(
    w.DV.planificador.leerLimite(),
    null,
    "Alternativas no heredan límite",
  );
  const c = {
    line: "127",
    destination: "ADUANA",
    origen: { distanciaRuta: 100 },
    destino: { distanciaRuta: 200 },
  };
  assert(w.DV.comparacion.datos(c).includes("Sin confirmar"));
  assert.equal(
    w.DV.comparacion.datos({
      ...c,
      line1: "127",
      line2: "185",
      combinacion: { busstopId: 1 },
      combinacion2: { busstopId: 2 },
    })[2],
    "Sin confirmar",
  );
  assert(!w.DV.comparacion.datos(c).join("").includes("NaN"));
  w.dispatchEvent(
    new w.CustomEvent("donde-viene:opciones-listas", {
      detail: {
        candidatos: [c, { ...c, line: "185" }],
        contexto: {},
        consultadoEn: new Date().toISOString(),
      },
    }),
  );
  assert(!d.querySelector(".compare-panel").hidden);
  assert(d.querySelector("#tablaComparacion").textContent.includes("185"));
  const avisos = JSON.parse(
    fs.readFileSync(root + "/datos/avisos-oficiales.json"),
  ).avisos;
  assert.equal(
    w.DV.informacionOficial.vigentes(avisos, "2026-10-10T23:59:00-03:00")
      .length,
    1,
  );
  assert.equal(
    w.DV.informacionOficial.vigentes(avisos, "2026-10-11T00:00:00-03:00")
      .length,
    0,
  );
  assert(
    w.DV.informacionOficial.afecta(avisos[0], {
      ...c,
      line: "76",
      destination: "CERRO",
    }),
  );
  assert(
    !w.DV.informacionOficial.afecta(avisos[0], {
      ...c,
      line: "76",
      destination: "PUNTA CARRETAS",
    }),
  );
  assert.equal((await w.DV.servicios.config()).push, false);
  assert(
    d.getElementById("activarAvisos").disabled,
    "Sin servidor no se solicita permiso",
  );
  // Scripts externos e inline se compilan, y todos los elementos usados existen.
  const vm = require("node:vm");
  for (const s of d.querySelectorAll("script:not([src])"))
    new vm.Script(s.textContent);
  dom.window.close();
  console.log(
    "Integraciones: direcciones reales, caché de fragmentos, límite con margen, comparación, vigencia/sentido y push sin falsas activaciones OK",
  );
})().catch((e) => {
  console.error(e);
  dom.window.close();
  process.exitCode = 1;
});
