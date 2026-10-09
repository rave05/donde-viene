const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
function preparar() {
  const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  let success,failure,options,calls=0,searches=0,applied,point,fecha='future';
  Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:(s,f,o)=>{success=s;failure=f;options=o;calls++;}}});
  w.DV={planificador:{aplicar:f=>{fecha=f;}}};
  w.DondeVieneApp={leerBusqueda:()=>({preferencia:'caminar'}),aplicarBusqueda:r=>{applied=r;},centrarUbicacionMapa:p=>{point=p;},buscar:async()=>{searches++;}};
  w.eval(fs.readFileSync('alternativas-ahora.js','utf8'));
  d.getElementById('resultadoRuta').innerHTML='<section class="trip-summary"><button id="btnEmpezarViaje">Empezar</button></section>';
  w.dispatchEvent(new w.CustomEvent('donde-viene:viaje-elegido',{detail:{contexto:{origen:'Terminal Paso de la Arena',destino:'Montevideo Shopping',preferencia:'proximos'}}}));
  return {w,d,dom,get:()=>({success,failure,options,calls,searches,applied,point,fecha}),abrir:()=>d.querySelector('.alternatives-trigger').click()};
}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
  let t=preparar();t.abrir();t.d.getElementById('alternativasMismoOrigen').click();await tick();
  assert.equal(t.get().searches,1);assert.equal(t.get().calls,0);assert.equal(t.get().applied.destino,'Montevideo Shopping');assert.equal(t.get().applied.preferencia,'proximos');assert.equal(t.get().fecha,null);
  t.abrir();t.d.getElementById('alternativasMismoOrigen').click();await tick();assert.equal(t.get().searches,1,'Respeta espera entre reconsultas');t.dom.window.close();
  t=preparar();t.abrir();t.d.getElementById('alternativasDesdeAqui').click();t.d.getElementById('alternativasDesdeAqui').click();assert.equal(t.get().calls,1);assert.equal(t.get().options.maximumAge,0);
  t.get().failure({code:1});await tick();assert.equal(t.get().searches,0);assert.equal(t.get().point,undefined);assert(t.d.querySelector('.trip-summary'));assert(t.d.getElementById('estadoAlternativasAhora').textContent.includes('permiso'));
  t.d.getElementById('alternativasDesdeAqui').click();t.get().success({coords:{latitude:-34.8,longitude:-56.2,accuracy:900},timestamp:Date.now()});await tick();assert.equal(t.get().searches,0);
  t.d.getElementById('alternativasDesdeAqui').click();t.get().success({coords:{latitude:-34.8,longitude:-56.2,accuracy:20},timestamp:Date.now()-60000});await tick();assert.equal(t.get().searches,0);
  t.d.getElementById('alternativasDesdeAqui').click();t.d.getElementById('cerrarAlternativasAhora').click();t.get().success({coords:{latitude:-34.8,longitude:-56.2,accuracy:20},timestamp:Date.now()});await tick();assert.equal(t.get().searches,0,'Ignora GPS recibido después de cancelar');
  t.abrir();t.d.getElementById('alternativasDesdeAqui').click();t.get().success({coords:{latitude:-34.8,longitude:-56.2,accuracy:20},timestamp:Date.now()});await tick();assert.equal(t.get().searches,1);assert.equal(t.get().applied.origen,'Mi ubicación');assert.equal(t.get().applied.destino,'Montevideo Shopping');assert.equal(t.get().point.lat,-34.8);t.dom.window.close();
  t=preparar();Object.defineProperty(t.w.navigator,'onLine',{value:false});t.abrir();t.d.getElementById('alternativasMismoOrigen').click();await tick();assert.equal(t.get().searches,0);assert.equal(t.get().applied,undefined);t.dom.window.close();
  console.log('OK: destino/preferencia, salida ahora, GPS preciso/reciente, permiso, cancelación, offline y consultas únicas.');
})().catch(e=>{console.error(e);process.exitCode=1;});
