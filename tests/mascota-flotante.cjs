const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync("index.html", "utf8");
const KEY = "donde-viene-mascota-posicion-v1";
function setup(saved, quota = false) {
  const dom = new JSDOM(
    "<main>" +
      html.slice(
        html.indexOf('<details id="mascotaBus"'),
        html.indexOf('<aside class="sponsor-card"'),
      ) +
      '</main><button id="outside">Buscar ruta</button>',
    {
      url: "https://example.test",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window,
    d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  if (saved)
    w.localStorage.setItem(
      KEY,
      typeof saved === "string" ? saved : JSON.stringify(saved),
    );
  if (quota)
    w.Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  w.eval(fs.readFileSync("mascota.js", "utf8"));
  w.eval(fs.readFileSync("mascota-flotante.js", "utf8"));
  const button = d.getElementById("mascotaFlotante"),
    popup = d.getElementById("mascotaPopup");
  function pointer(type, x, y, extra = {}) {
    const e = new w.MouseEvent(type, {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
      button: extra.button || 0,
    });
    Object.defineProperties(e, {
      pointerId: { value: extra.id || 1 },
      pointerType: { value: extra.kind || "touch" },
      isPrimary: { value: extra.primary !== false },
    });
    button.dispatchEvent(e);
  }
  function click(detail = 1) {
    button.dispatchEvent(new w.MouseEvent("click", { bubbles: true, detail }));
  }
  return {
    dom,
    w,
    d,
    button,
    popup,
    pointer,
    click,
    pos: () => ({
      x: parseFloat(button.style.left),
      y: parseFloat(button.style.top),
    }),
    size(width, height) {
      w.innerWidth = width;
      w.innerHeight = height;
      w.dispatchEvent(new w.Event("resize"));
    },
  };
}
(async () => {
  const t = setup();
  try {
    assert.equal(t.popup.open, false, "No abre ni activa el juego al cargar");
    assert.equal(
      t.d.querySelector("main #mascotaBus"),
      null,
      "El menú deja de ocupar el final de la página",
    );
    assert.equal(t.popup.querySelector("#mascotaBus").open, true);
    assert.equal(
      t.button.querySelectorAll("[id]").length,
      0,
      "El icono no duplica identificadores del SVG",
    );
    t.d.documentElement.style.overflow = "auto";
    t.pointer("pointerdown", 200, 200);
    t.pointer("pointermove", 204, 203);
    t.pointer("pointerup", 204, 203);
    t.click();
    assert.equal(
      t.popup.open,
      true,
      "Un toque con pequeño movimiento abre el panel",
    );
    assert.equal(t.button.getAttribute("aria-expanded"), "true");
    assert.equal(t.d.activeElement.id, "cerrarMascotaPopup");
    assert.equal(t.d.documentElement.style.overflow, "hidden");
    t.d.getElementById("cerrarMascotaPopup").click();
    assert.equal(t.popup.open, false);
    assert.equal(t.d.documentElement.style.overflow, "auto");
    assert.equal(t.d.activeElement, t.button, "Cerrar devuelve el foco al bus");
    t.pointer("pointerdown", 200, 200);
    t.pointer("pointermove", -10000, -10000);
    t.pointer("pointerup", -10000, -10000);
    t.click();
    assert.equal(t.popup.open, false, "Arrastrar no abre el pop-up");
    assert.deepEqual(
      t.pos(),
      { x: 12, y: 12 },
      "No se puede perder fuera del borde superior",
    );
    assert.deepEqual(JSON.parse(t.w.localStorage.getItem(KEY)), { x: 0, y: 0 });
    t.pointer("pointerdown", 12, 12);
    t.pointer("pointermove", 10000, 10000);
    t.pointer("pointerup", 10000, 10000);
    t.click();
    assert.deepEqual(
      t.pos(),
      { x: 932, y: 680 },
      "Arrastre limitado al borde inferior",
    );
    t.size(375, 667);
    assert.deepEqual(
      t.pos(),
      { x: 283, y: 579 },
      "Cambio de tamaño mantiene el botón visible",
    );
    t.click(0);
    assert.equal(t.popup.open, true, "También se abre con teclado");
    t.popup.close();
    const before = t.pos();
    t.pointer("pointerdown", 20, 20);
    t.pointer("pointermove", 40, 40, { id: 2 });
    t.pointer("pointercancel", 20, 20);
    t.click();
    assert.deepEqual(t.pos(), before, "Otro dedo no mueve el botón");
    assert.equal(t.popup.open, false, "Cancelar el gesto no abre el pop-up");
    t.click(0);
    t.d.getElementById("mascotaJugar").click();
    t.d.getElementById("mascotaPausar").click();
    assert.equal(t.popup.open, false, "Pausar también cierra el panel");
    t.click(0);
    t.popup.getBoundingClientRect = () => ({
      left: 100,
      top: 100,
      right: 300,
      bottom: 400,
    });
    t.popup.dispatchEvent(
      new t.w.MouseEvent("click", {
        clientX: 150,
        clientY: 150,
        bubbles: true,
      }),
    );
    assert.equal(t.popup.open, true, "Tocar dentro no cierra");
    t.popup.dispatchEvent(
      new t.w.MouseEvent("click", { clientX: 10, clientY: 10, bubbles: true }),
    );
    assert.equal(t.popup.open, false, "Tocar el fondo cierra");
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.dom.window.close();
  }
  for (const saved of [{ x: 0, y: 1 }, "{", { x: Infinity, y: -2 }]) {
    const x = setup(saved);
    try {
      assert(Number.isFinite(x.pos().x));
      assert(x.pos().y >= 12);
      if (saved.x === 0) assert.deepEqual(x.pos(), { x: 12, y: 680 });
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 0));
      x.dom.window.close();
    }
  }
  const q = setup(null, true);
  try {
    q.pointer("pointerdown", 10, 10);
    q.pointer("pointermove", 60, 80);
    q.pointer("pointerup", 60, 80);
    q.click(0);
    assert.equal(q.popup.open, true, "Sin almacenamiento sigue funcionando");
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    q.dom.window.close();
  }
  console.log(
    "Mascota flotante: toque, arrastre, límites, orientación, persistencia, cierre, foco y cuota OK",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
