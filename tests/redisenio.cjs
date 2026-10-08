const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
  url: "https://example.test/",
  runScripts: "outside-only",
});
const w = dom.window,
  d = w.document;
let cambiar;
const media = {
  matches: true,
  addEventListener: (_, fn) => {
    cambiar = fn;
  },
};
w.matchMedia = () => media;
w.requestAnimationFrame = (fn) => fn();
w.DondeVieneApp = { ajustarMapa() {} };
for (const name of ["app-util", "viaje", "mapa-layout", "redisenio"])
  w.eval(fs.readFileSync(name + ".js", "utf8"));
const result = d.getElementById("resultadoRuta");
const sheet = d.querySelector(".journey-sheet");
assert.ok(result.closest(".map-column"));
const c = {
  line: "127",
  origen: { busstopId: 1, name: "Parada <A>", distanciaRuta: 200 },
  destino: { busstopId: 2, distanciaRuta: 100 },
  proximaSalida: {
    disponible: true,
    minutos: 5,
    fuente: "estimado",
    fecha: "2026-10-08T23:46:00Z",
  },
};
const ctx = { origen: "Paso de la Arena", destino: "Tres Cruces" };
const html = w.crearResumenViaje(c, ctx);
assert.match(html, /Llegada estimada/);
assert.match(html, /20:46/);
assert.ok(
  !w
    .crearResumenViaje({ ...c, proximaSalida: undefined }, ctx)
    .includes("departure-card"),
);
assert.ok(
  !w
    .crearResumenViaje(c, { ...ctx, fechaSalida: "2026-10-09T15:00:00Z" })
    .includes("departure-card"),
);
assert.match(
  w.crearResumenViaje(
    { ...c, proximaSalida: { ...c.proximaSalida, fuente: "programado" } },
    ctx,
  ),
  /No es una llegada en vivo/,
);
assert.ok(
  !w
    .crearResumenViaje(
      { ...c, proximaSalida: { ...c.proximaSalida, fecha: "inválida" } },
      ctx,
    )
    .includes("departure-card"),
);
const flush = () => new Promise((r) => setTimeout(r, 0));
(async () => {
  result.innerHTML = html;
  await flush();
  assert.equal(sheet.open, false);
  assert.match(d.querySelector(".journey-sheet-title").textContent, /127/);
  assert.match(
    d.querySelector(".journey-sheet-hint").textContent,
    /20:46.*Llegada estimada/,
  );
  const summary = d.querySelector(".journey-sheet-handle");
  summary.click();
  assert.equal(sheet.open, true);
  let clicks = 0;
  d.getElementById("btnEmpezarViaje").addEventListener("click", () => clicks++);
  media.matches = false;
  cambiar();
  assert.equal(sheet.open, true);
  assert.equal(result.closest(".map-column"), null);
  d.getElementById("btnEmpezarViaje").click();
  assert.equal(clicks, 1);
  media.matches = true;
  cambiar();
  assert.equal(sheet.open, false);
  assert.ok(result.closest(".map-column"));
  for (const [from, to, abierto] of [
    [100, 50, true],
    [50, 100, false],
  ]) {
    const down = new w.MouseEvent("pointerdown", { clientY: from });
    Object.defineProperty(down, "isPrimary", { value: true });
    summary.dispatchEvent(down);
    summary.dispatchEvent(new w.MouseEvent("pointerup", { clientY: to }));
    summary.click();
    assert.equal(sheet.open, abierto);
  }
  result.innerHTML = '<div class="route-empty">No encontramos ruta</div>';
  await flush();
  assert.equal(sheet.open, true);
  d.getElementById("proximos").innerHTML =
    '<div class="bus"><div class="bus-eta">Sin ETA</div></div><div class="bus">Otro</div>';
  await flush();
  assert.equal(d.querySelectorAll(".is-featured-bus").length, 1);
  assert.match(d.getElementById("proximos").textContent, /Sin ETA/);
  dom.window.close();
  console.log(
    "OK: panel móvil/escritorio, toque y arrastre, listeners conservados, datos estimados/programados/offline y sin ETA inventada.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  dom.window.close();
});
