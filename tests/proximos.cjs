const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = vm.createContext({
  window: {},
  setTimeout,
  clearTimeout,
  AbortController,
  console,
});
for (const file of ["app-util.js", "viaje.js", "proximos-viaje.js"])
  vm.runInContext(fs.readFileSync(file, "utf8"), context);
const DV = context.window.DV;
const stop = { busstopId: 1, distanciaRuta: 150 };
const trip = (line, min) => ({
  line,
  origen: stop,
  destino: stop,
  proximaSalida:
    min == null
      ? undefined
      : { disponible: true, minutos: min, fuente: "programado" },
});
async function main() {
  const opciones = [
    trip("127", 120),
    trip("163", 8),
    trip("494"),
    trip("127", 5),
  ];
  const sorted = context.window.ordenarOpcionesViaje(opciones, "proximos");
  assert.deepEqual(
    Array.from(sorted, (c) => c.proximaSalida?.minutos),
    [5, 8, 120, undefined],
  );
  const grupos = context.window.agruparOpcionesViaje(sorted);
  assert.equal(grupos[0].lineas[0], "127");
  assert.equal(grupos[0].opciones[0].proximaSalida.minutos, 5);
  const html = context.window.crearSelectorViajesAgrupados(
    grupos,
    "proximos",
  ).html;
  assert.match(html, /Programado · 5 min/);
  assert.match(html, /Programado · 120 min/);
  assert.match(html, /Próxima salida sin confirmar/);
  assert.ok(
    DV.recetaValida({ origen: "A", destino: "B", preferencia: "proximos" }),
  );
  context.window.DondeVieneApp = { apiBase: "https://api.example" };
  let calls = 0;
  context.fetch = async () => {
    calls++;
    return {
      ok: true,
      json: async () => [
        { eta: 60, lineVariantId: 7 }, // No alcanza a caminar 150 m en un minuto.
        { eta: 300, lineVariantId: 7 },
        { eta: 180, lineVariantId: 99 }, // Otra variante.
        { eta: null },
        { eta: -2 },
        { eta: "" },
      ],
    };
  };
  const enriched = await DV.proximosViaje.enriquecer(
    [
      { ...trip("127", 120), lineVariantId: 7 },
      { ...trip("127", 130), lineVariantId: 7 },
    ],
    {},
  );
  assert.equal(calls, 1, "Una consulta compartida por parada/variante");
  assert.equal(enriched[0].proximaSalida.minutos, 5);
  assert.equal(enriched[0].proximaSalida.fuente, "estimado");
  await DV.proximosViaje.enriquecer(enriched, {
    fechaSalida: "2026-10-09T10:00:00Z",
  });
  assert.equal(calls, 1, "Fechas futuras nunca usan llegadas actuales");
  context.fetch = async () => {
    throw Error("Sin conexión");
  };
  const respaldo = await DV.proximosViaje.enriquecer(
    [{ ...trip("127", 120), lineVariantId: 7 }],
    {},
  );
  assert.equal(respaldo[0].proximaSalida.minutos, 120);
  DV.caminatas = {
    paraViaje: async () => [
      { id: "origen", metros: 150 },
      { id: "destino", metros: 0 },
    ],
  };
  context.window.obtenerSalidaProgramada = async (s) => ({
    secondsUntil: 7200,
    date: new Date(Date.parse(s.fechaReferencia) + 7200000).toISOString(),
  });
  context.window.obtenerTramoLineaViaje = async () => null;
  vm.runInContext(fs.readFileSync("estimacion-viaje.js", "utf8"), context);
  const largo = await DV.estimacion.estimar(trip("127"), {
    fechaSalida: "2026-10-09T08:00:00Z",
  });
  assert.equal(largo.tiempo.disponible, false);
  assert.equal(
    largo.proximaSalida.minutos,
    122,
    "Conservar salida lejana aunque falte el tiempo total",
  );
  console.log(
    "OK: próximas salidas, variantes agrupadas, espera larga, caminata, ETA inválida, respaldo y planificación futura.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
