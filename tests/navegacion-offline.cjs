const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const events = {}, entries = new Map();
const scope = 'https://example.test/donde-viene/';
let offline = false, missing = false, serverError = false, cacheFailure = '';
const cache = {
  async put(key, value) { if (cacheFailure === 'put') throw Error('QuotaExceeded'); entries.set(typeof key === 'string' ? key : key.url, value); },
  async match(key) { if (cacheFailure === 'match') throw Error('Cache bloqueada'); return entries.get(typeof key === 'string' ? key : key.url)?.clone(); }
};
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
  self: {
    addEventListener: (name, callback) => { events[name] = callback; },
    location: {origin: 'https://example.test'},
    registration: {scope}
  },
  URL, Response,
  caches: {open: async () => { if (cacheFailure === 'open') throw Error('Cache bloqueada'); return cache; }},
  fetch: async request => {
    if (offline) throw Error('offline');
    return new Response(new URL(request.url).pathname, {status: missing ? 404 : serverError ? 503 : 200});
  }
});
async function navigate(path) {
  return request(path, 'navigate');
}
async function request(path, mode = 'cors', method = 'GET') {
  let result;
  events.fetch({request: {method, mode, url: new URL(path, scope).href}, respondWith(value) {result = value;}});
  return await result;
}
(async () => {
  await navigate('');
  await navigate('ayuda.html?origen=footer');
  await navigate('privacidad.html');
  assert.equal(await entries.get(scope + 'index.html').clone().text(), '/donde-viene/');
  assert.equal(await entries.get(scope + 'ayuda.html').clone().text(), '/donde-viene/ayuda.html');
  missing = true;
  assert.equal((await navigate('inexistente.html')).status, 404);
  assert(!entries.has(scope + 'inexistente.html'));
  offline = true;
  assert.equal(await (await navigate('')).text(), '/donde-viene/');
  assert.equal(await (await navigate('index.html')).text(), '/donde-viene/');
  assert.equal(await (await navigate('privacidad.html')).text(), '/donde-viene/privacidad.html');
  assert.equal(await (await navigate('ayuda.html?otra=consulta')).text(), '/donde-viene/ayuda.html');
  assert.equal((await navigate('inexistente.html')).type, 'error');
  offline = false; missing = false;
  await request('guia-viaje.js');
  serverError = true;
  assert.equal((await navigate('ayuda.html')).status, 200, 'Un 503 permite abrir la misma página guardada');
  assert.equal((await navigate('no-guardada.html')).status, 503);
  assert.equal((await request('guia-viaje.js')).status, 200);
  serverError = false;
  for (const failure of ['open', 'match', 'put']) {
    cacheFailure = failure;
    assert.equal((await navigate('')).status, 200, failure + ': no perder HTML recibido');
    assert.equal((await request('guia-viaje.js')).status, 200, failure + ': no perder JS recibido');
  }
  offline = true;
  for (const failure of ['open', 'match']) {
    cacheFailure = failure;
    assert.equal((await navigate('')).type, 'error', 'Sin caché ni red falla sin contenido ajeno');
    assert.equal((await request('guia-viaje.js')).type, 'error');
  }
  assert.equal(await request('https://api.example.test/buses.json'), undefined, 'No cachear API externa');
  assert.equal(await request('guia-viaje.js', 'cors', 'POST'), undefined, 'No interceptar escrituras');
  assert.equal(await request('../otro/index.html', 'navigate'), undefined, 'Respetar el alcance de la app');
  console.log('Caché: páginas correctas offline, 404 intacto, 503 recuperable, fallos de lectura/escritura/apertura sin perder la red, sin interceptar API externa o POST.');
})().catch(error => {console.error(error); process.exitCode = 1;});
