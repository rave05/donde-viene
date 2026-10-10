const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const events = {}, entries = new Map();
const scope = 'https://example.test/donde-viene/';
let offline = false, missing = false;
const cache = {
  async put(key, value) { entries.set(String(key), value); },
  async match(key) { return entries.get(String(key))?.clone(); }
};
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
  self: {
    addEventListener: (name, callback) => { events[name] = callback; },
    location: {origin: 'https://example.test'},
    registration: {scope}
  },
  URL, Response,
  caches: {open: async () => cache},
  fetch: async request => {
    if (offline) throw Error('offline');
    return new Response(new URL(request.url).pathname, {status: missing ? 404 : 200});
  }
});
async function navigate(path) {
  let result;
  events.fetch({request: {method: 'GET', mode: 'navigate', url: new URL(path, scope).href}, respondWith(value) {result = value;}});
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
  console.log('Navegación offline: ayuda y privacidad conservan su página sin reemplazar la app; 404 y páginas no guardadas no reciben contenido ajeno.');
})().catch(error => {console.error(error); process.exitCode = 1;});
