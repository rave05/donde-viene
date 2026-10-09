const assert = require('node:assert/strict'), fs = require('node:fs');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<div id="resultadoRuta"></div>', {url:'https://example.test',runScripts:'outside-only'});
const w = dom.window, d = w.document;
w.setInterval = () => 1;
w.eval(fs.readFileSync('app-util.js','utf8'));
w.eval(fs.readFileSync('viaje.js','utf8'));
w.eval(fs.readFileSync('abordaje.js','utf8'));
let mapa;
w.DondeVieneApp = {enfocar: p => {mapa = p;}};
const ahora = Date.now();
const llegada = segundos => ({disponible:true,fuente:'estimado',fecha:new Date(ahora + segundos * 1000).toISOString(),consultadoEn:new Date(ahora).toISOString()});
const c = {line1:'127',destination1:'Aduana',lineVariantId1:7,line2:'185',destination2:'Pocitos',origen:{busstopId:1,street1:'CALLE <A>',street2:'CALLE B',distanciaRuta:150,location:{coordinates:[-56.2,-34.8]}},destino:{busstopId:2,distanciaRuta:0},combinacion:{busstopId:3},caminos:[{id:'origen',metros:150,tipo:'calles'}],proximaSalida:llegada(420)};
const evaluar = w.DV.abordaje.evaluar;
assert.equal(evaluar(c,llegada(420),ahora).tipo,'margen');
assert.equal(evaluar(c,llegada(160),ahora).tipo,'justo');
assert.equal(evaluar(c,llegada(60),ahora).tipo,'tarde');
assert.equal(evaluar(c,{...llegada(420),fuente:'programado'},ahora).tipo,'incierto');
assert.equal(evaluar(c,llegada(420),ahora+91000).tipo,'incierto');
assert.equal(evaluar({...c,caminos:[{id:'origen',metros:150,tipo:'recta'}]},llegada(420),ahora).tipo,'incierto');
assert.equal(evaluar({...c,coincidenciaAproximada:true},llegada(420),ahora).tipo,'incierto');
assert.equal(evaluar(c,llegada(420),ahora,true).tipo,'incierto');
function mostrar(nombre='donde-viene:viaje-elegido') {
  d.getElementById('resultadoRuta').innerHTML=w.crearResumenViaje(c,{origen:'Terminal',destino:'Shopping'});
  w.dispatchEvent(new w.CustomEvent(nombre,{detail:{candidato:c}}));
}
mostrar();
assert(d.querySelector('.boarding-direction').textContent.includes('127 → Aduana'));
assert(d.querySelector('.boarding-transfer').textContent.includes('185 → Pocitos'));
assert(d.querySelector('.boarding-stop').textContent.includes('CALLE <A>'));
assert.equal(d.querySelectorAll('.boarding-card').length,1);
d.querySelector('.boarding-map').click(); assert.equal(mapa.lat,-34.8);
function actualizar(stopId,variantId,buses) {
  w.dispatchEvent(new w.CustomEvent('donde-viene:llegadas-recibidas',{detail:{stopId,variantId,buses,timestamp:Date.now()}}));
}
actualizar(99,7,[{eta:10}]); assert.equal(d.querySelector('.boarding-card').dataset.estado,'margen');
actualizar(1,99,[{eta:10}]); assert.equal(d.querySelector('.boarding-card').dataset.estado,'margen');
actualizar(1,7,[{eta:10,lineVariantId:99},{eta:160,lineVariantId:7}]); assert.equal(d.querySelector('.boarding-card').dataset.estado,'justo');
actualizar(1,7,[{eta:60,lineVariantId:7}]); assert.equal(d.querySelector('.boarding-card').dataset.estado,'tarde');
actualizar(1,7,[{eta:null},{eta:-1}]); assert.equal(d.querySelector('.boarding-card').dataset.estado,'incierto');
mostrar('donde-viene:viaje-restaurado'); assert.equal(d.querySelector('.boarding-card').dataset.estado,'incierto');
actualizar(1,7,[{eta:500}]); assert.equal(d.querySelector('.boarding-card').dataset.estado,'incierto');
w.dispatchEvent(new w.Event('donde-viene:viaje-cambio')); assert.equal(d.querySelector('.boarding-card'),null);
dom.window.close();
console.log('OK: margen/justo/tarde, fuentes/edad/caminata, variante/parada, actualización y copia guardada.');
