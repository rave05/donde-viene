const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
async function main() {
  const counts = new Map(); let fail = true;
  const c = vm.createContext({window: {}, console, fetch: async url => {
    counts.set(url, (counts.get(url) || 0) + 1);
    await new Promise(resolve => setImmediate(resolve));
    if (url.endsWith('/paradas.json')) {
      if (fail) return {ok: false, status: 503};
      return {ok: true, json: async () => ({1: [{line: '127'}]})};
    }
    const data = url.endsWith('aliases.json') ? {} : url.endsWith('manifest.json') ? {lines: {'127': '127.json'}} : {patterns: [JSON.parse(fs.readFileSync('tests/fixtures/127-aduana.json','utf8'))]};
    return {ok: true, json: async () => data};
  }});
  vm.runInContext(fs.readFileSync('horarios.js','utf8'), c);
  c.console = {warn() {}};
  await Promise.all(Array.from({length: 20}, () => c.window.obtenerLineasProgramadas(1)));
  assert.equal(counts.get('./horarios/paradas.json'), 1);
  fail = false;
  const lines = await c.window.obtenerLineasProgramadas(1);
  assert.equal(lines[0].line, '127');
  assert.equal(counts.get('./horarios/paradas.json'), 2, 'Permite reintentar tras un fallo');
  vm.runInContext(fs.readFileSync('recorridos.js','utf8'), c);
  const fixture = JSON.parse(fs.readFileSync('tests/fixtures/127-aduana.json','utf8'));
  const pattern = fixture;
  await Promise.all(Array.from({length: 24}, () => c.window.obtenerPatronesParaParada('127', pattern.destination, pattern.stops[0])));
  for (const file of ['aliases.json','manifest.json','127.json']) assert.equal(counts.get('./recorridos/'+file), 1, file+' se descarga una vez');
  vm.runInContext(fs.readFileSync('actualizacion-buses.js','utf8'), c);
  const ritmo = c.window.crearRitmoBuses();
  assert.equal(ritmo.intervalo(), 20000);
  ritmo.fallo(500); assert.equal(ritmo.intervalo(), 40000);
  ritmo.fallo(429, '90'); assert.equal(ritmo.intervalo(), 90000);
  ritmo.fallo(500); assert.equal(ritmo.intervalo(), 120000);
  ritmo.exito(); assert.equal(ritmo.intervalo(), 20000);
  const index = fs.readFileSync('index.html','utf8');
  const body = index.slice(index.indexOf('    function programarActualizacionProximos('), index.indexOf('    async function cargarProximos('));
  let timer = null, calls = 0;
  Object.assign(c, {document: {hidden: false}, sesionProximos: 2, temporizadorProximos: null, proximaConsultaPermitida: 0, ritmoBuses: ritmo,
    setTimeout: (fn, ms) => {timer = {fn, ms}; return 1;}, clearTimeout() {}, cargarProximos: async () => {calls++;}});
  vm.runInContext(body, c);
  c.programarActualizacionProximos({sesionId: 2});
  assert.equal(timer.ms, 20000);
  c.document.hidden = true;
  await timer.fn();
  assert.equal(calls, 0, 'No consulta al estar en segundo plano');
  c.document.hidden = false;
  c.programarActualizacionProximos({sesionId: 2}, true);
  await timer.fn();
  assert.equal(calls, 1);
  await timer.fn();
  assert.equal(calls, 2);
  c.sesionProximos = 3;
  await timer.fn();
  assert.equal(calls, 2, 'No revive sesiones anteriores');
  console.log('OK: descargas compartidas, reintento, ritmo 20s, backoff y pausa en segundo plano.');
}
main().catch(e => {console.error(e);process.exitCode=1;});
