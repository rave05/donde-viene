const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div class="map-card"><div id="mapa"></div><div class="map-pick-controls"></div></div><div id="outside"></div>',{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document,container=d.getElementById('mapa');
Object.defineProperties(container,{clientWidth:{value:640},clientHeight:{value:420},offsetWidth:{value:640},offsetHeight:{value:420}});
container.getBoundingClientRect=()=>({left:0,top:0,right:640,bottom:420,width:640,height:420});
w.SVGSVGElement.prototype.createSVGRect=()=>({});
w.eval(fs.readFileSync('vendor/leaflet-1.9.4.js','utf8'));
w.eval(fs.readFileSync('vendor/leaflet-rotate-0.3.0.js','utf8'));
const L=w.L;
const map=L.map(container,{rotate:true,touchRotate:true,dragRotate:true,shiftKeyRotate:true,rotateControl:false,preventPageGestures:false,zoomAnimation:false,fadeAnimation:false}).setView([-34.9,-56.2],15);
map.touchGestures._ROTATION_THRESHOLD=12*Math.PI/180;
map.touchGestures._ROT_INERTIA=false;
w.DondeVieneApp={puedeRotarMapa:()=>true,orientacionMapa:()=>map.getBearing(),rotarMapa:angle=>{map.touchGestures._stopRotateInertia();map.setBearing(angle)},alRotarMapa:fn=>{map.on('rotate',fn);return()=>map.off('rotate',fn)}};
w.eval(fs.readFileSync('mapa-rotacion.js','utf8'));
const button=d.getElementById('mapaVolverNorte');
function near(a,b,epsilon=1){assert(Math.abs(a-b)<=epsilon,`${a} vs ${b}`)}
function touch(type,points){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:points.map(([x,y])=>({clientX:x,clientY:y,target:container}))});container.dispatchEvent(e);return e;}
(async()=>{try{
 const marker=L.marker([-34.901,-56.198],{icon:L.divIcon({html:'SUBIR',className:'test-marker'})}).addTo(map);
 const route=L.polyline([[-34.9,-56.2],[-34.901,-56.198]]).addTo(map);
 const original=JSON.stringify(route.getLatLngs());
 const center=map.getCenter();
 const baseline=map.containerPointToLatLng(map.latLngToContainerPoint(marker.getLatLng()));
 for(const angle of [45,90,180,270,0]){
  map.setBearing(angle);
  const p=map.latLngToContainerPoint(marker.getLatLng()),back=map.containerPointToLatLng(p);
  near(back.lat,baseline.lat,0.000000001);near(back.lng,baseline.lng,0.000000001);
  const pos=L.DomUtil.getPosition(marker._icon).add(map._getMapPanePos());
  near(pos.x,p.x);near(pos.y,p.y);
  assert.equal(JSON.stringify(route.getLatLngs()),original);
  near(map.getCenter().lat,center.lat,0.00001);
  assert.equal(map.getZoom(),15);
 }
 map.setBearing(60);map.panBy([40,20],{animate:false});map.setZoom(16,{animate:false});
 const p=map.latLngToContainerPoint(marker.getLatLng()),pos=L.DomUtil.getPosition(marker._icon).add(map._getMapPanePos());near(pos.x,p.x);near(pos.y,p.y);
 assert.equal(map.getBearing(),60,'Mover/zoom conserva el ángulo');
 button.click();assert.equal(map.getBearing(),0);
 button.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(map.getBearing(),15);
 button.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));assert.equal(map.getBearing(),0);
 map.setView([-34.9,-56.2],15,{animate:false});
 touch('touchstart',[[220,210],[420,210]]);
 assert.equal(map.dragging.enabled(),false);
 const points=angle=>{const r=angle*Math.PI/180;return [[320-100*Math.cos(r),210-100*Math.sin(r)],[320+100*Math.cos(r),210+100*Math.sin(r)]];};
 touch('touchmove',points(20));touch('touchmove',points(55));
 await new Promise(resolve=>setTimeout(resolve,25));
 assert(map.getBearing()>20,'Gesto real de dos dedos gira');
 touch('touchend',[]);assert(map.dragging.enabled(),'Arrastrar vuelve a funcionar al terminar');
 const bearing=map.getBearing();await new Promise(resolve=>setTimeout(resolve,40));assert.equal(map.getBearing(),bearing,'Sin giro inercial posterior');
 const inside=new w.Event('gesturestart',{bubbles:true,cancelable:true});container.dispatchEvent(inside);assert(inside.defaultPrevented);
 const outside=new w.Event('gesturestart',{bubbles:true,cancelable:true});d.getElementById('outside').dispatchEvent(outside);assert(!outside.defaultPrevented,'No bloquea zoom de página fuera del mapa');
 button.click();assert.equal(map.getBearing(),0);
 console.log('Rotación: Leaflet real, coordenadas/marcadores/ruta, pan/zoom, dos dedos, recuperación de arrastre, brújula/teclado y gestos fuera del mapa OK.');
}finally{map.remove();w.close();}})().catch(e=>{console.error(e);process.exitCode=1});
