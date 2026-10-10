const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const source = fs.readFileSync("analitica.js", "utf8");
const KEY = "donde-viene-estadisticas-v1",
  ID = "G-N6QV8RK6JC";
function setup(choice, blocked = false, ready = true) {
  const dom = new JSDOM("<footer><nav></nav></footer>", {
    url: "https://rave05.github.io/donde-viene/?origen=Casa%20secreta&destino=-34.90#gps",
    referrer: "https://www.tiktok.com/usuario-privado?direccion=Casa",
    runScripts: "outside-only",
  });
  const w = dom.window,
    d = w.document;
  d.title = "Casa secreta hacia -34.90";
  if (choice) w.localStorage.setItem(KEY, choice);
  if (blocked)
    w.Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  w.eval(
    source.replace(
      /const MEDICION_MEJORADA_DESACTIVADA = (?:true|false);/,
      `const MEDICION_MEJORADA_DESACTIVADA = ${ready};`,
    ),
  );
  return {
    dom,
    w,
    d,
    click: (id) => d.getElementById(id).click(),
    commands: () => Array.from(w.dataLayer || [], (a) => Array.from(a)),
    events: () =>
      Array.from(w.dataLayer || [], (a) => Array.from(a)).filter(
        (a) => a[0] === "event",
      ),
    fire: (name) =>
      w.dispatchEvent(
        new w.CustomEvent(name, {
          detail: { origen: "Casa secreta", gps: -34.9 },
        }),
      ),
    load: () =>
      d
        .getElementById("etiquetaEstadisticas")
        .dispatchEvent(new w.Event("load")),
  };
}
const t = setup();
try {
  assert.equal(
    t.d.querySelector("script"),
    null,
    "No conecta con Google antes de aceptar",
  );
  assert.equal(t.w.dataLayer, undefined);
  t.fire("donde-viene:busqueda-iniciada");
  t.click("rechazarEstadisticas");
  assert.equal(
    t.d.querySelector("script"),
    null,
    "Rechazar mantiene la etiqueta sin cargar",
  );
  assert.equal(t.w.localStorage.getItem(KEY), "no");
  t.click("abrirEstadisticas");
  t.click("aceptarEstadisticas");
  const script = t.d.getElementById("etiquetaEstadisticas");
  assert.equal(script.src, `https://www.googletagmanager.com/gtag/js?id=${ID}`);
  assert.equal(script.referrerPolicy, "no-referrer");
  assert.equal(
    t.commands()[0][0],
    "consent",
    "El consentimiento precede a config",
  );
  const config = t.commands().find((a) => a[0] === "config")[2];
  assert.equal(config.page_location, "https://rave05.github.io/donde-viene/");
  assert.equal(config.page_referrer, "https://www.tiktok.com/");
  assert.equal(config.page_title, "DondeViene");
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.cookie_expires, 90 * 86400);
  assert.equal(t.events().length, 0, "No se reproducen acciones previas");
  t.load();
  assert.deepEqual(
    t.events().map((a) => a[1]),
    ["page_view"],
  );
  for (const name of [
    "busqueda-iniciada",
    "viaje-iniciado",
    "mascota-abierta",
    "mascota-cuidada",
  ])
    t.fire("donde-viene:" + name);
  assert.deepEqual(
    t.events().map((a) => a[1]),
    ["page_view", "buscar_ruta", "iniciar_viaje", "abrir_ruti", "cuidar_ruti"],
  );
  assert(!JSON.stringify(t.commands()).includes("Casa secreta"));
  assert(!JSON.stringify(t.commands()).includes("-34.9"));
  assert(!JSON.stringify(t.commands()).includes("usuario-privado"));
  const before = t.events().length;
  t.click("abrirEstadisticas");
  t.click("aceptarEstadisticas");
  t.load();
  assert.equal(t.d.querySelectorAll("#etiquetaEstadisticas").length, 1);
  assert.equal(
    t.events().length,
    before,
    "No duplica page_view al volver a aceptar",
  );
  t.d.cookie = "dv_ga=123; Path=/donde-viene/; Secure";
  t.click("abrirEstadisticas");
  t.click("rechazarEstadisticas");
  assert.equal(t.w[`ga-disable-${ID}`], true);
  assert(!t.d.cookie.includes("dv_ga="), "Retirar elimina cookies propias");
  t.fire("donde-viene:mascota-cuidada");
  assert.equal(t.events().length, before);
  t.w.localStorage.setItem(KEY, "si");
  t.w.dispatchEvent(new t.w.StorageEvent("storage", { key: KEY }));
  assert.equal(t.w[`ga-disable-${ID}`], false);
  t.w.localStorage.removeItem(KEY);
  t.w.dispatchEvent(new t.w.StorageEvent("storage", { key: KEY }));
  assert.equal(t.w[`ga-disable-${ID}`], true);
} finally {
  t.dom.window.close();
}
const race = setup();
try {
  race.click("aceptarEstadisticas");
  race.click("abrirEstadisticas");
  race.click("rechazarEstadisticas");
  race.load();
  assert.equal(
    race.events().length,
    0,
    "Carga tardía no envía tras retirar aceptación",
  );
} finally {
  race.dom.window.close();
}
const yes = setup("si");
try {
  assert(yes.d.querySelector("#etiquetaEstadisticas"));
  yes.load();
  assert.equal(yes.events().length, 1);
} finally {
  yes.dom.window.close();
}
const no = setup("no");
try {
  assert.equal(no.d.querySelector("script"), null);
  assert(no.d.querySelector(".dv-stats-notice").hidden);
} finally {
  no.dom.window.close();
}
const quota = setup(null, true);
try {
  quota.click("rechazarEstadisticas");
  assert.match(
    quota.d.querySelector('[role="status"]').textContent,
    /No pudimos guardar/,
  );
  assert.equal(quota.d.querySelector("script"), null);
} finally {
  quota.dom.window.close();
}
const pending = setup(null, false, false);
try {
  assert.equal(pending.d.querySelector("script"), null);
  assert.equal(
    pending.d.querySelector("#aceptarEstadisticas"),
    null,
    "No activa antes de confirmar ajustes del flujo",
  );
} finally {
  pending.dom.window.close();
}
console.log(
  "Analítica: consentimiento, URLs limpias, eventos sin contexto privado, retirada, pestañas, carga tardía y activación pendiente OK",
);
