const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, ".."),
  src = (p) => fs.readFileSync(path.join(root, p), "utf8");
const dom = new JSDOM('<main id="resultadoRuta"></main>', {
    url: "https://example.test/donde-viene/",
    runScripts: "outside-only",
  }),
  w = dom.window;
const fetches = [];
w.fetch = async (url) => {
  fetches.push(String(url));
  return {
    ok: true,
    json: async () => JSON.parse(src(String(url).replace(/^\.\//, ""))),
  };
};
w.eval(src("app-util.js"));
w.eval(src("recorridos.js"));
w.eval(src("horarios.js"));
w.eval(src("metropolitano.js"));
const d = JSON.parse(src("metropolitano/corredor.json")),
  metro = w.DV.metro;
const f = new Date("2026-10-09T12:00:00-03:00");
const a = d.stops["24204"],
  b = d.stops["24001"];
(async () => {
  const direct = metro.directas(d, a, b, f);
  assert(direct.some((x) => x.p.line === "230"));
  assert(
    direct.every(
      (x) =>
        x.p.stops.indexOf(x.subida.id.replace("mtop:", "")) <
        x.p.stops.indexOf(x.bajada.id.replace("mtop:", "")),
    ),
  );
  assert(direct.some((x) => x.horario && x.horario.salida >= f.getTime()));
  assert(metro.directas(d, b, a, f).length, "ida y vuelta");
  assert.equal(
    metro.directas(d, a, b, new Date("2027-01-15T12:00:00-03:00")).length,
    0,
    "calendario vencido",
  );
  const p = {
    trips: [{ id: "night", service: "1", times: [25 * 3600, null, 26 * 3600] }],
  };
  const next = metro.proximo(d, p, 0, 2, new Date("2026-10-10T00:30:00-03:00"));
  assert.equal(
    next.salida,
    new Date("2026-10-10T01:00:00-03:00").getTime(),
    "GTFS >24h conserva día de servicio",
  );
  assert.equal(
    metro.proximo(d, p, 1, 2, f),
    null,
    "no interpola parada sin hora",
  );
  assert.equal(
    metro.proximo(d, p, 0, 1, f).llegada,
    null,
    "bajada sin hora permanece nula",
  );
  assert(metro.activo(d, "2", new Date("2026-10-10T00:00:00-03:00")), "sábado");
  assert(
    !metro.activo(d, "1", new Date("2026-10-10T00:00:00-03:00")),
    "laborable no se aplica sábado",
  );
  assert.equal(
    await metro.intentar(
      { lat: -34.9, lon: -56.19 },
      { lat: -34.91, lon: -56.17 },
      {},
    ),
    null,
    "no reemplaza viajes urbanos",
  );
  const h = await metro.intentar(a, b, {
    fechaSalida: f.toISOString(),
    fechaLlegadaLimite: f.toISOString(),
  });
  assert(h.includes("no son llegadas en vivo"));
  assert(h.includes("no están verificadas para ese límite"));
  assert(h.includes("Elegir este viaje"));
  const shape = await metro.tramoMetro(direct.find(c=>c.p.line==="230"));
  assert(shape.length > 20, "geometría oficial con curvas, no unión de paradas");
  const reverseShape = await metro.tramoMetro(metro.directas(d,b,a,f).find(c=>c.p.line==="230"));
  assert(reverseShape.length > 20, "geometría en sentido inverso");
  let dibujado;
  w.DondeVieneApp = {mostrarParadasMetropolitanas: (points,tramos) => {dibujado={points,tramos};},limpiarMetropolitano:()=>{dibujado=null;}};
  w.document.getElementById("resultadoRuta").innerHTML=h;
  w.document.querySelector("[data-metro-elegir]").click();
  await new Promise(r=>setTimeout(r,20));
  assert(dibujado?.tramos.length===1, "seleccionar dibuja geometría");
  assert(w.document.querySelector("[data-metro-volver]"));
  assert.equal([...w.document.querySelectorAll("[data-metro-opcion]")].filter(el=>!el.hidden).length,1);
  w.document.querySelector("[data-metro-volver]").click();
  assert.equal(dibujado,null);
  assert([...w.document.querySelectorAll("[data-metro-opcion]")].every(el=>!el.hidden));
  // Red urbana real: comprobamos continuidad geométrica, no una conexión horaria inventada.
  const red = JSON.parse(src("recorridos/red.json"));
  w.todasLasParadas = Object.entries(red.coords).map(([id, coords]) => ({
    busstopId: id,
    location: { coordinates: [coords[1], coords[0]] },
  }));
  const destino = { lat: -34.8938334, lon: -56.1665762 };
  const combinado = await metro.intentar(a, destino, {
    fechaSalida: f.toISOString(),
  });
  assert(
    combinado.includes("1 transbordo"),
    "Las Piedras a Tres Cruces conecta red urbana",
  );
  assert(combinado.includes("conexión horaria sin confirmar"));
  const vuelta = await metro.intentar(destino, a, {
    fechaSalida: f.toISOString(),
  });
  assert(vuelta.includes("1 transbordo"), "Tres Cruces a Las Piedras");
  assert(
    fetches.every((u) => u.startsWith("./")),
    "no consulta MTOP IDs en API urbana",
  );
  const vm = require("node:vm");
  for (const s of new JSDOM(src("index.html")).window.document.querySelectorAll(
    "script:not([src])",
  ))
    new vm.Script(s.textContent);
  console.log(
    "Metropolitano: fuente real, sentidos, fechas, madrugada, huecos horarios, combinación en ambos sentidos y aislamiento de IDs OK",
  );
  dom.window.close();
})().catch((e) => {
  console.error(e);
  dom.window.close();
  process.exitCode = 1;
});
