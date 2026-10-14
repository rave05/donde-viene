const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM('<div id="paradas"></div><div id="lineas"></div><div id="proximos"></div>', {runScripts:'dangerously', url:'https://example.test/'});
const w=dom.window, d=w.document;
const payload='<img src="invalid" onerror="window.securityFailure=true">';
function source(start,end) { const i=html.indexOf(start),j=html.indexOf(end,i+start.length); assert(i>=0&&j>i); return html.slice(i,j); }
const popups=[];
w.L={marker(){return {addTo(){return this},bindPopup(content){popups.push(content);return this},on(){return this}}}};
w.selected=[];
w.seleccionarParadaPorId=id=>w.selected.push(id);
w.eval(`const listaParadas=document.getElementById('paradas'), listaLineas=document.getElementById('lineas'), proximos=document.getElementById('proximos');
 const seccionParadas={},mapa={removeLayer(){}},iconoParada={},iconoBusVivo={};
 let marcadoresParadas=[],marcadoresBusesVivos=[],destinoRutaActivo=null;
 const vistaBusesMapa={iniciar(){},actualizar(){},seguir(){},encuadrar(){}};
 function limpiarMarcadoresBusesVivos(){} function setSeccionColapsada(){} function seleccionarParada(){}
 function formatearETA(){return '3 min'} function formatearDistancia(){return '100 m'}
 `+source('    function escaparHTML(', '    function nombreParadaRuta(')
 +source('    function mostrarParadas(', '    function mostrarMarcadores(')
 +source('    function mostrarMarcadores(', '    window.seleccionarParadaPorId =')
 +source('    function mostrarLineas(', '    const vistaBusesMapa =')
 +source('    function mostrarMarcadoresBusesVivos(', '    async function seleccionarLinea(')
 +source('    function mostrarProximos(', '    function obtenerUbicacion('));
w.mostrarParadas([{street1:payload,street2:'Calle & esquina',busstopId:123,distancia:10}]);
w.mostrarLineas([{line:payload,destination:payload,lineVariantId:1}]);
const bus={eta:180,line:payload,companyName:payload,origin:payload,destination:payload,subline:payload,access:payload,thermalConfort:payload,busId:payload,location:{coordinates:[-56.2,-34.9]}};
w.mostrarProximos([bus],payload,payload);
w.mostrarMarcadores([{street1:payload,busstopId:'123);window.securityFailure=true;//',location:bus.location}]);
w.mostrarMarcadoresBusesVivos([bus],{linea:payload,destination:payload});
assert.equal(d.querySelector('img[onerror],script'),null);
assert(d.getElementById('paradas').textContent.includes(payload));
assert(d.getElementById('lineas').textContent.includes(payload));
assert(d.getElementById('proximos').textContent.includes(payload));
for(const content of popups) {
 const el=d.createElement('div'); if(typeof content==='string')el.innerHTML=content;else el.append(content);
 assert.equal(el.querySelector('img[onerror],script,[onclick]'),null);
 el.querySelector('button')?.click();
}
assert.deepEqual(w.selected,['123);window.securityFailure=true;//']);
assert.equal(w.securityFailure,undefined);
// También prueba la tarjeta programada real con una salida externa adversa.
w.eval(`let sesionProximos=1; async function obtenerProximoProgramado(){return {found:true,time:${JSON.stringify(payload)},destination:${JSON.stringify(payload)},minutesUntil:3}}; function formatearEsperaProgramada(){return '3 min'};`
 +fs.readFileSync('horarios.js','utf8').split('\n').slice(1,3).join('\n')
 +fs.readFileSync('horarios.js','utf8').slice(fs.readFileSync('horarios.js','utf8').indexOf('  window.agregarProximoProgramado ='),fs.readFileSync('horarios.js','utf8').lastIndexOf('})();')));
(async()=>{try{
 await w.agregarProximoProgramado({sesionId:1});
 assert.equal(d.querySelector('img[onerror],script'),null);
 assert(d.querySelector('.horario-programado').textContent.includes(payload));
 console.log('Seguridad HTML: paradas, líneas, buses, popups, IDs y horarios externos se muestran como texto; controles conservados.');
}finally{w.close();}})().catch(e=>{console.error(e);process.exitCode=1});
