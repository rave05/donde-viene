const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const src=name=>fs.readFileSync(name,'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const c=vm.createContext({window:{},AbortController,setTimeout,clearTimeout,Date,console});
 vm.runInContext(src('red.js'),c);
 const red=c.window.DVRed;
 let aborted=false;
 c.fetch=(_,opts)=>{opts.signal.addEventListener('abort',()=>aborted=true);return new Promise(()=>{});};
 await assert.rejects(red.json('/stalled',{},20),e=>e.name==='TimeoutError');assert(aborted);
 c.fetch=async()=>({ok:true,json:()=>new Promise(()=>{})});
 await assert.rejects(red.json('/stalled-body',{},20),e=>e.name==='TimeoutError');
 const run=red.iniciar(35),began=Date.now();await run.esperar(sleep(20));
 await assert.rejects(run.esperar(new Promise(()=>{})),e=>e.name==='TimeoutError');run.finalizar();
 assert(Date.now()-began<200,'El presupuesto no se reinicia por etapa');
 vm.runInContext(src('lineas-parada.js'),c);
 const cache=new Map(),calls=[];
 c.window.obtenerLineasProgramadas=async()=>[{line:'494',destination:'Buceo'}];
 c.fetch=async(url)=>{calls.push(url);if(url.includes('/buses'))return new Promise(()=>{});return {ok:true,json:async()=>[{line:'494',destination:'Buceo',lineVariantId:883}]};};
 const fast=c.window.obtenerLineasParadaRapido;
 const lines=await fast(1,'https://api.test',cache,60000,{lineas:20,buses:20,horarios:20});
 assert.equal(lines.length,1);assert.equal(lines[0].lineVariantId,883);
 await fast(1,'https://api.test',cache,60000,{lineas:20,buses:20,horarios:20});assert.equal(calls.length,2,'Cache evita volver a pedir líneas y buses');
 cache.clear();c.fetch=()=>new Promise(()=>{});
 const fallback=await fast(2,'https://api.test',cache,60000,{lineas:20,buses:20,horarios:20});
 assert.equal(fallback[0].line,'494');assert.equal(fallback[0].source,'gtfs');assert.equal(fallback[0].lineVariantId,null);
 const compact={patterns:[{l:'494',d:'Buceo',s:['1','2','3']}],byStop:{'1':[[0,0]],'2':[[0,1]],'3':[[0,2]]},coords:{'1':[-34.9,-56.2],'2':[-34.91,-56.21],'3':[-34.92,-56.22]}};
 const downloaded=[];
 c.fetch=async url=>{downloaded.push(url);return {ok:true,json:async()=>url.endsWith('red.json')?compact:{}};};
 vm.runInContext(src('recorridos.js'),c);
 const stop={busstopId:'1',location:{coordinates:[-56.2,-34.9]}};
 assert.equal(await c.window.lineaLlegaADestinoRuta('494','Buceo',stop,{lat:-34.92,lon:-56.22},50),true);
 assert.equal(await c.window.lineaLlegaADestinoRuta('494','Centro',stop,{lat:-34.92,lon:-56.22},50),false);
 assert.equal(await c.window.lineaLlegaADestinoRuta('494','Buceo',{busstopId:'3',location:{coordinates:[-56.22,-34.92]}},{lat:-34.9,lon:-56.2},50),false);
 assert(!downloaded.some(url=>url.includes('494.json')),'Confirma secuencia y sentido sin descargar geometrías por línea');

 // Ejecuta el buscador real: datos básicos rápidos y estimaciones que nunca responden.
 const dom=new JSDOM('<button id="buscar"></button><select id="preferenciaViaje"><option value="transbordos">Menos transbordos</option></select><div id="resultado"></div><div id="overlay"></div><div id="contenido"></div>',{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;
 w.eval(src('red.js'));const iniciar=w.DVRed.iniciar;w.DVRed.iniciar=()=>iniciar(70);
 const html=src('index.html'),begin=html.indexOf('    async function buscarRutaSimple()'),end=html.indexOf('    function obtenerParadasCercanas(',begin);
 w.eval(`let versionViajeElegido=0,candidatoViajeActivo,destinoRutaActivo,contextoViajeActivo,alternativasRutaActuales,indiceRutaSeleccionada,suprimirScrollAutomatico,capaMetropolitana;
 const origenRuta={value:'Origen'},destinoRuta={value:'Destino'},ultimaUbicacionUsuario=null;
 const btnBuscarRuta=document.getElementById('buscar'),btnCambiarRuta={},resultadoRuta=document.getElementById('resultado'),selectorRutaOverlay=document.getElementById('overlay'),selectorRutaContenido=document.getElementById('contenido'),selectorRutaResumen={textContent:''};
 const todasLasParadas=[{busstopId:1,distanciaRuta:10}];
 function cancelarActualizacionProximos(){} function cerrarSelectorRuta(){selectorRutaOverlay.classList.remove('is-open');}
 async function geocodificarRuta(){return {lat:-34.9,lon:-56.2,geocodificacionLocal:true}}
 function mostrarPuntosRuta(){} function esUbicacionAmplia(){return false}
 function obtenerParadasRutaCercanas(){return todasLasParadas} function obtenerParadasRutaMasCercanas(){return todasLasParadas}
 async function obtenerLineasProgramadas(){return [{line:'494',destination:'Buceo'}]}
 async function lineaLlegaADestinoRuta(){return true} async function buscarDirectasPorRed(){return []}
 function escaparHTML(x){return String(x)}
 window.shows=[];function mostrarSelectorRuta(tipo,candidatos,html){window.shows.push(candidatos);selectorRutaContenido.innerHTML=html;selectorRutaOverlay.classList.add('is-open');}
 window.DV={estimacion:{enriquecer(){return new Promise(()=>{})}}};
 window.ordenarOpcionesViaje=x=>x;window.agruparOpcionesViaje=x=>x;window.crearSelectorViajesAgrupados=x=>({candidatos:x,html:'Opciones'});
 window.choose=()=>{versionViajeElegido++;resultadoRuta.innerHTML='Viaje elegido';window.dispatchEvent(new Event('donde-viene:viaje-elegido'));};
 `+html.slice(begin,end)+`;window.buscarPrueba=buscarRutaSimple;`);
 try{
  const searching=w.buscarPrueba();await sleep(15);
  assert.equal(w.shows.length,1,'Opciones visibles antes de las estimaciones');
  assert(w.document.getElementById('overlay').classList.contains('is-open'));
  w.choose();await searching;assert.equal(w.document.getElementById('resultado').textContent,'Viaje elegido');
  assert.equal(w.document.getElementById('buscar').disabled,false,'Elegir termina la espera opcional');
  assert.equal(w.shows.length,1,'No reabre ni reemplaza la selección');
  w.console.error=()=>{};
  const stalled=w.buscarPrueba();await sleep(15);
  assert.equal(w.shows.length,2);
  w.document.getElementById('overlay').classList.remove('is-open');
  await stalled;
  assert.equal(w.document.getElementById('buscar').disabled,false);
  assert(!w.document.getElementById('overlay').classList.contains('is-open'),'La espera no reabre un selector cerrado');
  assert.match(w.document.getElementById('contenido').textContent,/sin confirmar/);
 }finally{w.close();}
 console.log('Rapidez: red y JSON colgados, presupuesto único, líneas paralelas/cache/GTFS y selección temprana sin respuestas obsoletas OK.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
