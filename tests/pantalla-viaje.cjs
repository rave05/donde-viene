const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function preparar(supported = true) {
  const dom = new JSDOM('<section class="trip-summary"><button id="btnEmpezarViaje">Empezar viaje</button><ol class="trip-steps"><li><strong>🚌 Tomá el 494</strong><span>Hasta Tres Cruces</span></li></ol></section>', {url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window, d = w.document;
  let hidden = false, requests = 0, next;
  Object.defineProperty(d, 'hidden', {get: () => hidden});
  if (supported) Object.defineProperty(w.navigator, 'wakeLock', {value: {request: async type => {
    assert.equal(type, 'screen');
    requests++;
    return next ? next() : sentinel();
  }}});
  function sentinel() {
    const s = new w.EventTarget();
    s.released = false;
    s.releases = 0;
    s.release = async () => {
      s.releases++;
      s.released = true;
      s.dispatchEvent(new w.Event('release'));
    };
    return s;
  }
  w.eval(fs.readFileSync('guia-viaje.js', 'utf8'));
  return {dom,w,d,sentinel,requests:()=>requests,setNext(fn){next=fn;},click:id=>d.getElementById(id).click(),visible(value){hidden=!value;d.dispatchEvent(new w.Event('visibilitychange'));}};
}
(async () => {
  const t = preparar();
  try {
    const button = t.d.getElementById('btnPantallaViaje');
    t.click('btnEmpezarViaje');
    assert.equal(t.requests(), 0, 'Empezar el viaje no pide pantalla encendida');
    const first = t.sentinel();
    t.setNext(() => first);
    t.click('btnPantallaViaje'); await tick();
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    t.click('btnSalirGuiaViaje');
    assert.equal(first.releases, 0, 'Minimizar la guía conserva la opción elegida');
    t.click('btnVolverGuiaViaje');
    assert.equal(t.requests(), 1);
    t.visible(false); await tick();
    assert.equal(first.releases, 1);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    const second = t.sentinel();
    t.setNext(() => second);
    t.visible(true); await tick();
    assert.equal(t.requests(), 2, 'Volver a primer plano reintenta solo una opción elegida');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    t.click('btnPantallaViaje'); await tick();
    assert.equal(second.releases, 1);
    t.visible(false); t.visible(true); await tick();
    assert.equal(t.requests(), 2, 'Desactivar no vuelve a activar en primer plano');
    t.setNext(() => { throw Error('Ahorro de batería'); });
    t.click('btnPantallaViaje'); await tick();
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.match(t.d.getElementById('estadoPantallaViaje').textContent, /No pudimos/);
    assert(t.w.guiaViaje.estado(), 'Un rechazo no cancela el viaje');
    const third = t.sentinel();
    t.setNext(() => third);
    t.click('btnPantallaViaje'); await tick();
    await third.release();
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.match(t.d.getElementById('estadoPantallaViaje').textContent, /teléfono liberó/);
    const fourth = t.sentinel();
    t.setNext(() => fourth);
    t.click('btnPantallaViaje'); await tick();
    t.click('btnTerminarGuiaViaje'); await tick();
    assert.equal(fourth.releases, 1, 'Finalizar libera el recurso');
    t.click('btnEmpezarViaje');
    assert.equal(button.getAttribute('aria-pressed'), 'false', 'Otro viaje no hereda pantalla encendida');
    const change = t.sentinel();
    t.setNext(() => change);
    t.click('btnPantallaViaje'); await tick();
    t.w.dispatchEvent(new t.w.Event('donde-viene:viaje-cambio')); await tick();
    assert.equal(change.releases, 1, 'Cambiar de ruta libera la pantalla');
    t.click('btnEmpezarViaje');
    let resolve;
    const delayed = t.sentinel();
    t.setNext(() => new Promise(r => {resolve=r;}));
    t.click('btnPantallaViaje');
    t.click('btnPantallaViaje');
    resolve(delayed); await tick();
    assert.equal(delayed.releases, 1, 'Cancelar mientras se solicita libera la concesión tardía');
    const leaving = t.sentinel();
    t.setNext(() => new Promise(r => {resolve=r;}));
    t.click('btnPantallaViaje');
    t.w.dispatchEvent(new t.w.Event('pagehide'));
    resolve(leaving); await tick();
    assert.equal(leaving.releases, 1, 'Salir mientras se solicita no deja un recurso activo');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
  } finally {t.dom.window.close();}
  const unsupported = preparar(false);
  try {
    unsupported.click('btnEmpezarViaje');
    assert(unsupported.d.getElementById('btnPantallaViaje').hidden);
    assert(unsupported.w.guiaViaje.estado(), 'El viaje funciona sin Wake Lock');
  } finally {unsupported.dom.window.close();}
  console.log('Pantalla encendida: activación explícita, minimizar, segundo plano, reintento, apagado, rechazo, liberación del sistema, fin y concesiones tardías OK.');
})().catch(error => {console.error(error);process.exitCode=1;});
