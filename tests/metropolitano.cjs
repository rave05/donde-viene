const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, ".."),
  src = (p) => fs.readFileSync(path.join(root, p), "utf8");
const dom = new JSDOM('<main id="resultadoRuta"></main>', {
    url: "https://example.test/donde-viene/",
    runScripts: "outside-only",
  }),
  w = dom.window;
const fetches = [];
w.fetch = async (url) => {
  fetches.push(String(url));
  return {
    ok: true,
    json: async () => JSON.parse(src(String(url).replace(/^\.\//, ""))),
  };
};
w.eval(src("app-util.js"));
w.eval(src("recorridos.js"));
w.eval(src("horarios.js"));
w.eval(src("viaje.js"));
w.eval(src("metropolitano.js"));
const d = JSON.parse(src("metropolitano/corredor.json")),
  metro = w.DV.metro;
const f = new Date("2026-10-09T12:00:00-03:00");
const a = d.stops["24204"],
  b = d.stops["24001"];
(async () => {
  const direct = metro.directas(d, a, b, f);
  assert(direct.some((x) => x.p.line === "230"));
  assert(
    direct.every(
      (x) =>
        x.p.stops.indexOf(x.subida.id.replace("mtop:", "")) <
        x.p.stops.indexOf(x.bajada.id.replace("mtop:", "")),
    ),
  );
  assert(direct.some((x) => x.horario && x.horario.salida >= f.getTime()));
  assert(metro.directas(d, b, a, f).length, "ida y vuelta");
  assert.equal(
    metro.directas(d, a, b, new Date("2027-01-15T12:00:00-03:00")).length,
    0,
    "calendario vencido",
  );
  const p = {
    trips: [{ id: "night", service: "1", times: [25 * 3600, null, 26 * 3600] }],
  };
  const next = metro.proximo(d, p, 0, 2, new Date("2026-10-10T00:30:00-03:00"));
  assert.equal(
    next.salida,
    new Date("2026-10-10T01:00:00-03:00").getTime(),
    "GTFS >24h conserva día de servicio",
  );
  assert.equal(
    metro.proximo(d, p, 1, 2, f),
    null,
    "no interpola parada sin hora",
  );
  assert.equal(
    metro.proximo(d, p, 0, 1, f).llegada,
    null,
    "bajada sin hora permanece nula",
  );
  assert(metro.activo(d, "2", new Date("2026-10-10T00:00:00-03:00")), "sábado");
  assert(
    !metro.activo(d, "1", new Date("2026-10-10T00:00:00-03:00")),
    "laborable no se aplica sábado",
  );
  assert.equal(
    await metro.intentar(
      { lat: -34.9, lon: -56.19 },
      { lat: -34.91, lon: -56.17 },
      {},
    ),
    null,
    "no reemplaza viajes urbanos",
  );
  const h = await metro.intentar(a, b, {
    fechaSalida: f.toISOString(),
    fechaLlegadaLimite: f.toISOString(),
  });
  assert(h.html.includes("no son llegadas en vivo"));
  assert(h.includes("no están verificadas para ese límite"));
  assert(h.includes("Elegir este viaje"));
  const shape = await metro.tramoMetro(direct.find(c=>c.p.line==="230"));
  assert(shape.length > 20, "geometría oficial con curvas, no unión de paradas");
  const reverseShape = await metro.tramoMetro(metro.directas(d,b,a,f).find(c=>c.p.line==="230"));
  assert(reverseShape.length > 20, "geometría en sentido inverso");
  const layers=[];
  const layer=(coords,options={})=>({coords,options,addTo(){layers.push(this);return this;},getLatLngs(){return (coords||[]).map(p=>({lat:p[0],lng:p[1]}));}});
  w.L={polyline:layer,marker:(coords,options)=>{const m=layer(coords,options);delete m.getLatLngs;return m;},divIcon:o=>o,latLngBounds:p=>({points:p,extend(){}})};
  w.mapa={removeLayer:l=>{const i=layers.indexOf(l);if(i>=0)layers.splice(i,1);},fitBounds(){},invalidateSize(){}};
  const c=h.candidatos.find(c=>c.line==="230"), ctx={origen:"Las Piedras",destino:"Montevideo",puntoOrigen:{lat:a.lat+.002,lon:a.lon},puntoDestino:{lat:b.lat-.002,lon:b.lon},fechaLlegadaLimite:f.toISOString()};
  const summary=w.crearResumenViaje(c,ctx);
  assert(summary.includes('class="trip-summary"') && summary.includes('id="btnEmpezarViaje"'));
  assert(summary.includes('data-bajada-lat') && summary.includes('no son llegadas en vivo'));
  assert(!summary.includes("Estimación con margen"),"no promete hora límite metropolitana");
  w.document.getElementById("resultadoRuta").innerHTML=summary;
  await metro.seleccionar(c,ctx);
  assert(layers.some(l=>l.options.color==="#1769e0" && l.options.weight===7));
  assert(layers.some(l=>l.options.color==="#ffffff" && l.options.weight===11));
  assert(layers.some(l=>l.options.icon?.html.includes("SUBIR")));
  assert(layers.some(l=>l.options.icon?.html.includes("BAJAR")));
  assert(layers.some(l=>l.options.icon?.html.includes("🚶")));
  assert(layers.filter(l=>l.options.dashArray).length===2,"caminatas origen y destino");
  assert(w.obtenerGeometriaViajeActual().length===1,"copia guardada incluye shape oficial");
  w.limpiarRecorridoSeleccionado();
  assert.equal(layers.length,0,"limpieza del viaje urbano también limpia metropolitano");
  const index=src("index.html"), from=index.indexOf("    function mostrarSelectorRuta("), until=index.indexOf("    btnCerrarSelectorRuta.addEventListener",from);
  assert(from>=0 && until>from);
  w.document.body.insertAdjacentHTML("beforeend",'<div id="testSelector"></div><button id="testCambiar"></button>');
  const harness=[
    '(()=>{let alternativasRutaActuales, indiceRutaSeleccionada, candidatoViajeActivo, versionViajeElegido=0, seleccionLlegadasActiva; const contextoViajeActivo='+JSON.stringify(ctx)+';',
    'const selectorRutaContenido=document.getElementById("testSelector"), selectorRutaResumen=document.createElement("p"),btnCambiarRuta=document.getElementById("testCambiar"),',
    'resultadoRuta=document.getElementById("resultadoRuta"), origenRuta={value:"Las Piedras"},destinoRuta={value:"Montevideo"},listaLineas=document.createElement("div"),proximos=document.createElement("div");',
    'const marcarRutaSeleccionada=()=>{},cerrarSelectorRuta=()=>{window.testModalOpen=false;},abrirSelectorRuta=()=>{window.testModalOpen=true;},scrollSuaveA=()=>{},cancelarActualizacionProximos=()=>{};',
    'const abrirOpcionRuta=()=>{throw Error("No enviar parada MTOP a API urbana");},abrirOpcionCombinacion=abrirOpcionRuta;',
    index.slice(from,until),
    'window.testMostrar=mostrarSelectorRuta;})();'
  ].join('\n');
  w.eval(harness);
  w.testMostrar("metropolitano",h.candidatos,h.html);
  assert(w.testModalOpen);
  w.document.querySelector("#testSelector [data-route-index]").click();
  await new Promise(r=>setTimeout(r,30));
  assert(!w.testModalOpen && w.document.querySelector(".trip-summary"));
  assert(w.document.querySelector("#btnAlternativasViaje"),"mismo botón Cambiar ruta");
  w.document.querySelector("#btnAlternativasViaje").click();
  assert(w.testModalOpen,"reabre mismo pop up");
  // Red urbana real: comprobamos continuidad geométrica, no una conexión horaria inventada.
  const red = JSON.parse(src("recorridos/red.json"));
  w.todasLasParadas = Object.entries(red.coords).map(([id, coords]) => ({
    busstopId: id,
    location: { coordinates: [coords[1], coords[0]] },
  }));
  const destino = { lat: -34.8938334, lon: -56.1665762 };
  const combinado = await metro.intentar(a, destino, {
    fechaSalida: f.toISOString(),
  });
  assert(
    combinado.html.includes("1 transbordo"),
    "Las Piedras a Tres Cruces conecta red urbana",
  );
  assert(combinado.includes("conexión horaria sin confirmar"));
  const vuelta = await metro.intentar(destino, a, {
    fechaSalida: f.toISOString(),
  });
  assert(vuelta.html.includes("1 transbordo"), "Tres Cruces a Las Piedras");
  const co=combinado.candidatos.find(c=>c.line1 && c.line2), cv=vuelta.candidatos.find(c=>c.line1 && c.line2);
  assert(co.origen.busstopId.startsWith("mtop:") && !co.destino.busstopId.startsWith("mtop:"));
  assert(!cv.origen.busstopId.startsWith("mtop:") && cv.destino.busstopId.startsWith("mtop:"));
  assert(!cv.proximaSalida,"horario MTOP de segundo tramo no se presenta como salida del primer urbano");
  const saved=w.obtenerTramoLineaViaje, calls=[];
  w.obtenerTramoLineaViaje=async(line,destination,subida,bajada)=>{
    calls.push([subida.busstopId,bajada.busstopId]);
    return [w.DV.coord(subida),w.DV.coord(bajada)].map(p=>[p.lat,p.lon]);
  };
  await metro.seleccionar(co,{puntoOrigen:a,puntoDestino:destino});
  assert(layers.some(l=>l.options.color==="#7c3aed"));
  assert(layers.some(l=>l.options.icon?.html.includes("COMBINAR")));
  assert(layers.some(l=>l.options.icon?.html.includes("2° BUS")));
  await metro.seleccionar(cv,{puntoOrigen:destino,puntoDestino:a});
  assert(calls.every(ids=>ids.every(id=>!String(id).startsWith("mtop:"))),"solo shape urbano consulta IDs urbanos");
  w.obtenerTramoLineaViaje=saved;
  assert(
    fetches.every((u) => u.startsWith("./")),
    "no consulta MTOP IDs en API urbana",
  );
  const vm = require("node:vm");
  for (const s of new JSDOM(src("index.html")).window.document.querySelectorAll(
    "script:not([src])",
  ))
    new vm.Script(s.textContent);
  console.log(
    "Metropolitano: fuente real, sentidos, fechas, madrugada, huecos horarios, combinación en ambos sentidos y aislamiento de IDs OK",
  );
  dom.window.close();
})().catch((e) => {
  console.error(e);
  dom.window.close();
  process.exitCode = 1;
});
