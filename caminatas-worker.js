/* A* sobre la red OSM local. El cálculo se ejecuta fuera del hilo de la interfaz. */
let redPromise, red, ady, grid;
const CELL = 0.002;
function metros(a, b) {
  const r = Math.PI / 180,
    v =
      Math.sin(((b[0] - a[0]) * r) / 2) ** 2 +
      Math.cos(a[0] * r) *
        Math.cos(b[0] * r) *
        Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}
async function cargar() {
  if (redPromise) return redPromise;
  redPromise = (async () => {
    const response = await fetch("./datos/caminatas.json.gz");
    if (!response.ok) throw Error("Sin red de calles");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] === 31 && bytes[1] === 139) {
      const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      red = await new Response(stream).json();
    } else red = JSON.parse(new TextDecoder().decode(bytes));
    ady = Array.from({ length: red.nodes.length }, () => []);
    grid = new Map();
    for (let e = 0; e < red.edges.length; e++) {
      const [a, b] = red.edges[e],
        pa = red.nodes[a],
        pb = red.nodes[b];
      const d = metros(pa, pb);
      ady[a].push([b, d]);
      ady[b].push([a, d]);
      for (
        let y = Math.floor(Math.min(pa[0], pb[0]) / CELL);
        y <= Math.floor(Math.max(pa[0], pb[0]) / CELL);
        y++
      )
        for (
          let x = Math.floor(Math.min(pa[1], pb[1]) / CELL);
          x <= Math.floor(Math.max(pa[1], pb[1]) / CELL);
          x++
        ) {
          const key = y + "|" + x;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(e);
        }
    }
  })();
  return redPromise;
}
function snap(p) {
  const seen = new Set(),
    lat = Math.floor(p[0] / CELL),
    lon = Math.floor(p[1] / CELL),
    cos = Math.cos((p[0] * Math.PI) / 180);
  let best = null;
  for (let y = lat - 1; y <= lat + 1; y++)
    for (let x = lon - 1; x <= lon + 1; x++)
      for (const e of grid.get(y + "|" + x) || []) {
        if (seen.has(e)) continue;
        seen.add(e);
        const [a, b] = red.edges[e],
          pa = red.nodes[a],
          pb = red.nodes[b];
        const dx = (pb[1] - pa[1]) * cos,
          dy = pb[0] - pa[0],
          t = Math.max(
            0,
            Math.min(
              1,
              ((p[1] - pa[1]) * cos * dx + (p[0] - pa[0]) * dy) /
                (dx * dx + dy * dy || 1),
            ),
          );
        const q = [pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1])],
          d = metros(p, q);
        if (!best || d < best.d) best = { a, b, q, d };
      }
  return best && best.d <= 60 ? best : null;
}
class Heap {
  constructor() {
    this.a = [];
  }
  push(v) {
    let i = this.a.push(v) - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p][0] <= v[0]) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = v;
  }
  pop() {
    const first = this.a[0],
      last = this.a.pop();
    if (this.a.length) {
      let i = 0;
      while (2 * i + 1 < this.a.length) {
        let c = 2 * i + 1;
        if (c + 1 < this.a.length && this.a[c + 1][0] < this.a[c][0]) c++;
        if (this.a[c][0] >= last[0]) break;
        this.a[i] = this.a[c];
        i = c;
      }
      this.a[i] = last;
    }
    return first;
  }
}
function ruta(from, to) {
  const a = snap(from),
    b = snap(to);
  if (!a || !b) return null;
  if (a.a === b.a && a.b === b.b) {
    return {
      puntos: [from, a.q, b.q, to],
      metros: a.d + metros(a.q, b.q) + b.d,
    };
  }
  const cost = new Float64Array(red.nodes.length);
  cost.fill(Infinity);
  const prev = new Int32Array(red.nodes.length);
  prev.fill(-1);
  const heap = new Heap();
  for (const id of [a.a, a.b]) {
    cost[id] = a.d + metros(a.q, red.nodes[id]);
    heap.push([cost[id] + metros(red.nodes[id], b.q), id, cost[id]]);
  }
  const goals = new Map([
    [b.a, metros(red.nodes[b.a], b.q) + b.d],
    [b.b, metros(red.nodes[b.b], b.q) + b.d],
  ]);
  let goal = -1,
    total = Infinity,
    visitas = 0;
  while (heap.a.length && visitas++ < 30000) {
    const [f, id, g] = heap.pop();
    if (g !== cost[id]) continue;
    if (f >= total) break;
    if (goals.has(id) && g + goals.get(id) < total) {
      total = g + goals.get(id);
      goal = id;
    }
    for (const [next, d] of ady[id]) {
      const score = g + d;
      if (score >= cost[next] || score > 8000) continue;
      cost[next] = score;
      prev[next] = id;
      heap.push([score + metros(red.nodes[next], b.q), next, score]);
    }
  }
  if (goal < 0 || total > 8000) return null;
  const path = [];
  for (let id = goal; id >= 0; id = prev[id]) path.push(red.nodes[id]);
  path.reverse();
  return { puntos: [from, a.q, ...path, b.q, to], metros: total };
}
self.onmessage = async (event) => {
  const { id, desde, hasta } = event.data;
  try {
    await cargar();
    const result = ruta([desde.lat, desde.lon], [hasta.lat, hasta.lon]);
    self.postMessage({ id, result });
  } catch (_) {
    self.postMessage({ id, result: null });
  }
};
