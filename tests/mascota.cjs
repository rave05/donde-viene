const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const KEY = "donde-viene-mascota-v1";
const html = fs.readFileSync("index.html", "utf8");
function setup(saved, failure = false) {
  const dom = new JSDOM(
    html.slice(
      html.indexOf('<details id="mascotaBus"'),
      html.indexOf('<aside class="sponsor-card"'),
    ),
    { url: "https://example.test/", runScripts: "outside-only" },
  );
  const w = dom.window,
    d = w.document;
  let now = "2026-10-10T02:59:00Z";
  const NativeDate = w.Date;
  w.Date = class extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
  };
  if (saved)
    w.localStorage.setItem(
      KEY,
      typeof saved === "string" ? saved : JSON.stringify(saved),
    );
  if (failure)
    w.Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  w.eval(fs.readFileSync("mascota.js", "utf8"));
  return {
    dom,
    w,
    d,
    click: (id) => d.getElementById(id).click(),
    state: () => JSON.parse(w.localStorage.getItem(KEY)),
    date(value) {
      now = value;
      w.dispatchEvent(new w.Event("focus"));
    },
  };
}
const t = setup();
try {
  assert.equal(t.state(), null, "No se guarda ni activa nada por abrir la app");
  assert.equal(t.d.getElementById("mascotaBus").open, false);
  t.click("mascotaJugar");
  assert.equal(
    t.state().lastDay,
    "2026-10-09",
    "Antes de las 03 UTC sigue siendo ayer en Uruguay",
  );
  assert.equal(t.state().streak, 1);
  for (let i = 0; i < 10; i++) t.click("mascotaCuidar");
  assert.equal(t.state().total, 1, "No duplica cuidado por repetir el botón");
  t.date("2026-10-10T03:00:00Z");
  t.click("mascotaCuidar");
  assert.equal(
    t.state().streak,
    2,
    "Medianoche en Uruguay inicia un nuevo día",
  );
  t.date("2026-10-11T03:00:00Z");
  t.click("mascotaCuidar");
  const celeste = t.d.querySelector('[data-mascota-color="celeste"]');
  assert.equal(celeste.disabled, false);
  celeste.click();
  assert.equal(t.state().color, "celeste");
  t.date("2026-10-14T03:00:00Z");
  assert.equal(t.d.getElementById("mascotaRacha").textContent, "0");
  t.click("mascotaCuidar");
  assert.equal(t.state().streak, 1);
  assert.equal(t.state().best, 3);
  assert.equal(t.state().total, 4);
  assert.equal(
    t.state().color,
    "celeste",
    "Los premios sobreviven a una racha cortada",
  );
  const snapshot = t.state();
  t.date("2026-10-12T03:00:00Z");
  t.click("mascotaCuidar");
  assert.deepEqual(
    t.state(),
    snapshot,
    "Retroceder el reloj no genera más días",
  );
  assert.match(
    t.d.getElementById("mascotaMensaje").textContent,
    /Revisá el reloj/,
  );
  t.date("2026-10-15T03:00:00Z");
  t.click("mascotaPausar");
  assert.equal(t.state().active, false);
  assert.equal(t.state().color, "celeste");
  assert.equal(t.d.getElementById("mascotaCuidar").hidden, true);
  t.click("mascotaJugar");
  assert.equal(t.state().total, 5);
  t.click("mascotaBorrar");
  t.click("mascotaCancelarBorrar");
  assert.equal(t.state().total, 5, "Cancelar borrar no pierde el progreso");
  t.click("mascotaBorrar");
  t.click("mascotaConfirmarBorrar");
  assert.equal(t.state().total, 0);
  assert.equal(t.state().active, false);
  assert.equal(t.state().color, "amarillo");
  const other = {
    v: 1,
    active: true,
    lastDay: "2026-10-15",
    streak: 7,
    best: 7,
    total: 7,
    color: "coral",
  };
  t.w.localStorage.setItem(KEY, JSON.stringify(other));
  t.w.dispatchEvent(new t.w.StorageEvent("storage", { key: KEY }));
  assert.equal(t.d.getElementById("mascotaTotal").textContent, "7");
  t.click("mascotaCuidar");
  assert.equal(
    t.state().total,
    7,
    "Otra pestaña tampoco permite duplicar el día",
  );
} finally {
  t.dom.window.close();
}
for (const invalid of [
  "{",
  {
    v: 1,
    active: true,
    lastDay: "2026-02-30",
    streak: 1,
    best: 1,
    total: 1,
    color: "amarillo",
  },
  {
    v: 1,
    active: true,
    lastDay: "2026-10-09",
    streak: 1,
    best: 1,
    total: 1,
    color: "coral",
  },
  {
    v: 1,
    active: true,
    lastDay: "2026-10-09",
    streak: -1,
    best: 1,
    total: 1,
    color: "amarillo",
  },
]) {
  const x = setup(invalid);
  try {
    assert.equal(x.d.getElementById("mascotaTotal").textContent, "0");
    x.click("mascotaJugar");
    assert.equal(x.state().total, 1);
  } finally {
    x.dom.window.close();
  }
}
const quota = setup(null, true);
try {
  quota.click("mascotaJugar");
  quota.click("mascotaCuidar");
  assert.equal(quota.d.getElementById("mascotaTotal").textContent, "1");
  assert.match(
    quota.d.getElementById("mascotaMensaje").textContent,
    /no pudo guardar/,
  );
} finally {
  quota.dom.window.close();
}
assert.match(fs.readFileSync("mascota.css", "utf8"), /prefers-reduced-motion/);
assert.match(fs.readFileSync("sw.js", "utf8"), /"mascota.js"/);
console.log(
  "Mascota: fecha de Uruguay, cuidado único, premios, pausa, borrado, pestañas y cuota OK",
);
