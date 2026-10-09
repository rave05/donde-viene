const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const dom = new JSDOM("", {
    url: "https://example.test/",
    runScripts: "outside-only",
  }),
  w = dom.window;
w.DV = {};
w.AbortController = AbortController;
w.DecompressionStream = DecompressionStream;
w.Response = Response;
const reads = [];
w.fetch = async (url) => {
  reads.push(url);
  assert(String(url).startsWith("./datos/direcciones/"));
  return new Response(fs.readFileSync(String(url).replace("./", "")));
};
const load = () => w.eval(fs.readFileSync("direcciones.js", "utf8"));
load();
(async () => {
  const source = JSON.parse(
    fs.readFileSync("datos/direcciones/cruces-indice.json"),
  );
  assert.equal(source.cantidad, 19264);
  let total = 0;
  const ids = new Set();
  for (let i = 0; i < source.fragmentos; i++)
    for (const p of JSON.parse(
      fs.readFileSync(
        "datos/direcciones/cruces-" + String(i).padStart(2, "0") + ".json",
      ),
    )) {
      assert.equal(p[0] % source.fragmentos, i);
      assert(p[0] < p[1] && p[1] < source.calles.length);
      assert(
        p[2] >= -35.05 && p[2] <= -34.65 && p[3] >= -56.45 && p[3] <= -55.9,
      );
      const k = p.join(":");
      assert(!ids.has(k));
      ids.add(k);
      total++;
    }
  assert.equal(total, source.cantidad);
  const opts = await w.DV.direcciones.sugerir(
    "Luis Batlle Berres y Cno. Tomkinson",
  );
  assert.equal(opts.length, 2);
  assert(
    opts.every(
      (x) =>
        x.categoria === "Cruce oficial · Montevideo" &&
        x.punto.tipo === "intersection",
    ),
  );
  assert(
    opts.some((x) => x.punto.lat === -34.836281 && x.punto.lon === -56.272482),
  );
  const loaded = reads.length;
  const reverse = await w.DV.direcciones.sugerir(
    "Tomkinson esq. Av. Luis Batlle Berres",
  );
  assert.deepEqual(
    Array.from(reverse, (x) => x.valor),
    Array.from(opts, (x) => x.valor),
  );
  assert.equal(reads.length, loaded, "comparte índice y fragmento");
  const chosen = opts[1];
  load();
  const resolved = await w.DV.direcciones.resolver(chosen.valor);
  assert.equal(resolved.lat, chosen.punto.lat);
  assert.equal(resolved.lon, chosen.punto.lon);
  await assert.rejects(
    () => w.DV.direcciones.resolver("Luis Batlle Berres y Tomkinson"),
    /varios accesos/,
  );
  for (const sep of ["y", "esq.", "esquina", "con", "&", "/"])
    assert(
      (await w.DV.direcciones.sugerir("18 de Julio " + sep + " Ejido")).length,
    );
  assert.equal(
    (await w.DV.direcciones.sugerir("18 de Julio y calle inventada")).length,
    0,
  );
  assert.equal(
    (await w.DV.direcciones.sugerir("18 de Julio y Ejido, Canelones")).length,
    0,
  );
  assert.equal(
    (await w.DV.direcciones.sugerir("18 de Julio y 18 de Julio")).length,
    0,
  );
  const door = await w.DV.direcciones.sugerir(
    "Av. 18 de Julio nº 1263, Montevideo",
  );
  assert(door.length && door.every((x) => x.punto.tipo === "house"));
  for (const marker of ["#", "nro.", "número"])
    assert(
      (await w.DV.direcciones.sugerir("18 de Julio " + marker + " 1263"))
        .length,
    );
  // Una Y en el nombre de una calle no convierte una puerta en un cruce.
  assert.equal(w.DV.direcciones.separar("Treinta y Tres 1234").puerta, 1234);
  assert((await w.DV.direcciones.sugerir("18 de Julio y Eji")).length);
  load();
  w.fetch = async () => {
    throw new Error("offline");
  };
  assert.equal(await w.DV.direcciones.resolver("18 de Julio y Ejido"), null);
  dom.window.close();
  console.log(
    "Cruces: fuente oficial completa, orden inverso, abreviaturas/separadores, accesos ambiguos, recarga, caché y números de puerta OK",
  );
})().catch((e) => {
  console.error(e);
  dom.window.close();
  process.exitCode = 1;
});
