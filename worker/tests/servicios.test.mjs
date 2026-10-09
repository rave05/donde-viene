import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { createECDH, randomBytes } from "node:crypto";
import webpush from "web-push";
import worker from "../index.js";
import {
  recursoCacheable,
  withSharedTransitCache,
} from "../transport-cache.js";
import { validarSuscripcion, recordatorioActual } from "../validacion.js";
import { procesarAvisos } from "../push.js";
function base() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8"),
  );
  function prepare(sql) {
    let values = [];
    return {
      bind(...v) {
        values = v;
        return this;
      },
      async first() {
        return sqlite.prepare(sql).get(...values) || null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...values) };
      },
      async run() {
        const r = sqlite.prepare(sql).run(...values);
        return { meta: { changes: r.changes } };
      },
    };
  }
  return {
    DB: {
      prepare,
      async batch(statements) {
        return Promise.all(statements.map((s) => s.run()));
      },
    },
    sqlite,
  };
}
function subscription() {
  const ec = createECDH("prime256v1");
  ec.generateKeys();
  return {
    endpoint: "https://web.push.apple.com/test",
    keys: {
      p256dh: ec.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
}
const origin = "https://rave05.github.io";
const ctx = { waitUntil() {} };
function req(path, body, extra = {}) {
  return new Request("https://services.example" + path, {
    method: body ? "POST" : "GET",
    headers: { Origin: origin, "Content-Type": "application/json", ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("Caché: claves canónicas, consultas simultáneas, errores y datos privados excluidos", async () => {
  assert.equal(recursoCacheable(req("/buses?lat=-34.9&lon=-56.1")), null);
  assert.equal(
    recursoCacheable(req("/stops", null, { Authorization: "Bearer private" })),
    null,
  );
  assert.equal(
    recursoCacheable(
      req("/stops/123/upcomingbuses?lineVariantIds=2&lineVariantIds=1"),
    ),
    null,
  );
  const a = req("/stops/123/upcomingbuses?lineVariantIds=2,1&amountperline=3"),
    b = req("/stops/123/upcomingbuses?amountperline=3&lineVariantIds=1,2");
  assert.equal(recursoCacheable(a).key.url, recursoCacheable(b).key.url);
  const saved = new Map(),
    cache = {
      async match(r) {
        return saved.get(r.url)?.clone();
      },
      async put(r, v) {
        saved.set(r.url, v);
      },
    };
  let calls = 0;
  const original = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 10));
    return Response.json([{ seconds: 180 }]);
  };
  const result = await Promise.all([
    withSharedTransitCache(a, {}, ctx, original, cache),
    withSharedTransitCache(b, {}, ctx, original, cache),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(await result[0].json(), await result[1].json());
  assert.equal(result[0].headers.get("Cache-Control"), "no-store");
  await withSharedTransitCache(a, {}, ctx, original, cache);
  assert.equal(calls, 1);
  const fail = req("/buses");
  for (let i = 0; i < 2; i++)
    await withSharedTransitCache(
      fail,
      {},
      ctx,
      async () => {
        calls++;
        return Response.json({}, { status: 429 });
      },
      cache,
    );
  assert.equal(calls, 3);
  assert(!saved.has(fail.url));
  await withSharedTransitCache(
    fail,
    {},
    ctx,
    async () => Response.json({}, { headers: { "Cache-Control": "private" } }),
    cache,
  );
  assert(!saved.has(fail.url));
});
test("Caché pública explícita: no-store solo en rutas públicas; nunca datos privados", async () => {
  const saved = new Map();
  const cache = {
    async match(r) {
      return saved.get(r.url)?.clone();
    },
    async put(r, v) {
      saved.set(r.url, v);
    },
  };
  const request = req("/stops/546/lines");
  let calls = 0;
  const original = async () => {
    calls++;
    return Response.json([{ line: "144" }], {
      headers: { "Cache-Control": "no-store" },
    });
  };
  await withSharedTransitCache(request, {}, ctx, original, cache);
  assert.equal(saved.size, 0);
  const env = { CACHE_PUBLIC_TRANSIT: "true" };
  const first = await withSharedTransitCache(
    request,
    env,
    ctx,
    original,
    cache,
  );
  const second = await withSharedTransitCache(
    request,
    env,
    ctx,
    original,
    cache,
  );
  assert.equal(calls, 2);
  assert.equal(
    second.headers.get("X-DV-Observed-At"),
    first.headers.get("X-DV-Observed-At"),
  );
  assert.equal(second.headers.get("Cache-Control"), "no-store");
  for (const headers of [
    { "Cache-Control": "private, no-store" },
    { "Set-Cookie": "session=private" },
    { Vary: "Authorization" },
    { Vary: "Cookie" },
    { Vary: "*" },
  ]) {
    saved.clear();
    await withSharedTransitCache(
      request,
      env,
      ctx,
      async () => Response.json({}, { headers }),
      cache,
    );
    assert.equal(saved.size, 0);
  }
  for (const request of [
    req("/reports"),
    req("/buses", null, { Authorization: "Bearer private" }),
  ]) {
    await withSharedTransitCache(request, env, ctx, original, cache);
    assert.equal(saved.size, 0);
  }
});
test("Reportes: confirmación real, texto limitado, acceso administrativo y límite de consultas", async () => {
  const { DB, sqlite } = base(),
    env = {
      DB,
      APP_ORIGIN: origin,
      PUBLIC_LIMIT: { limit: async () => ({ success: true }) },
      ADMIN_TOKEN: "test-only",
    };
  assert.equal(
    (await worker.fetch(req("/config"), { APP_ORIGIN: origin }, ctx)).status,
    200,
  );
  assert.equal(
    (
      await (
        await worker.fetch(req("/config"), { APP_ORIGIN: origin }, ctx)
      ).json()
    ).push,
    false,
  );
  const r = await worker.fetch(
    req("/reports", { categoria: "Horario o llegada", texto: "Mi reporte" }),
    env,
    ctx,
  );
  assert.equal(r.status, 201);
  assert((await r.json()).id);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM reports").get().n, 1);
  assert.equal(
    (await worker.fetch(req("/admin/reports"), env, ctx)).status,
    401,
  );
  assert.equal(
    (
      await worker.fetch(
        req("/admin/reports", null, { Authorization: "Bearer test-only" }),
        env,
        ctx,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await worker.fetch(
        req("/reports", {
          categoria: "Horario o llegada",
          texto: "a".repeat(3001),
        }),
        env,
        ctx,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await worker.fetch(
        req(
          "/reports",
          { categoria: "Horario o llegada", texto: "x" },
          { Origin: "https://evil.example" },
        ),
        env,
        ctx,
      )
    ).status,
    403,
  );
  env.PUBLIC_LIMIT.limit = async () => ({ success: false });
  const blocked = await worker.fetch(
    req("/reports", { categoria: "Horario o llegada", texto: "x" }),
    env,
    ctx,
  );
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("Retry-After"), "60");
  sqlite.close();
});
test("Push: proveedores admitidos, preferencias privadas, consentimiento y eliminación", async () => {
  const { DB, sqlite } = base(),
    keys = webpush.generateVAPIDKeys(),
    env = {
      DB,
      APP_ORIGIN: origin,
      PUBLIC_LIMIT: { limit: async () => ({ success: true }) },
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
    };
  const sub = subscription();
  assert.throws(() =>
    validarSuscripcion({ ...sub, endpoint: "https://example.com/api" }),
  );
  assert.throws(() =>
    validarSuscripcion({
      ...sub,
      endpoint: "https://push.apple.com.evil.example/",
    }),
  );
  const body = {
    subscription: sub,
    lineas: ["127"],
    recordatorio: { dias: [1, 2, 3, 4, 5], hora: "07:30" },
  };
  const r = await worker.fetch(req("/subscriptions", body), env, ctx);
  assert.equal(r.status, 201);
  const { token } = await r.json();
  assert.equal(token.length, 64);
  assert.equal(
    (
      await worker.fetch(
        req("/subscriptions", { ...body, lineas: ["185"] }),
        env,
        ctx,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await worker.fetch(
        req("/subscriptions", { ...body, token, lineas: ["185"] }),
        env,
        ctx,
      )
    ).status,
    201,
  );
  assert(
    !sqlite
      .prepare("SELECT * FROM subscriptions")
      .get()
      .subscription.includes("ubicacion"),
  );
  assert.equal(
    (await worker.fetch(req("/unsubscribe", { token }), env, ctx)).status,
    200,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) n FROM subscriptions").get().n,
    0,
  );
  sqlite.close();
});
test("Recordatorios en Montevideo, avisos vigentes, envío cifrado y deduplicación", async () => {
  assert(
    recordatorioActual(
      { dias: [1], hora: "23:59" },
      new Date("2026-10-06T02:59:00Z"),
    ),
  );
  assert.equal(
    recordatorioActual(
      { dias: [1], hora: "23:59" },
      new Date("2026-10-06T03:01:00Z"),
    ),
    null,
  );
  const { DB, sqlite } = base(),
    keys = webpush.generateVAPIDKeys(),
    sub = subscription(),
    env = {
      DB,
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      VAPID_SUBJECT: "mailto:test@example.com",
      AVISOS_URL: "https://official.example/avisos",
    };
  await DB.prepare(
    "INSERT INTO subscriptions(id,token,subscription,lineas,actualizado) VALUES(?,?,?,?,?)",
  )
    .bind(
      "1",
      "token",
      JSON.stringify(sub),
      '["127"]',
      Date.parse("2026-10-09T12:00:00Z"),
    )
    .run();
  let sends = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (url === env.AVISOS_URL)
      return Response.json({
        avisos: [
          {
            id: "1",
            desde: "2026-10-08",
            hasta: "2026-10-10",
            lineas: [{ linea: "127" }],
          },
          {
            id: "2",
            desde: "2026-10-01",
            hasta: "2026-10-02",
            lineas: [{ linea: "127" }],
          },
        ],
      });
    sends++;
    assert(options.body.length > 40);
    assert(options.headers.Authorization || options.headers.authorization);
    assert.equal(options.redirect, "error");
    return new Response("", { status: 201 });
  };
  try {
    await procesarAvisos(env, new Date("2026-10-09T12:00:00Z"));
    await procesarAvisos(env, new Date("2026-10-09T12:05:00Z"));
    assert.equal(sends, 1);
    assert.equal(
      sqlite.prepare("SELECT estado FROM deliveries").get().estado,
      1,
    );
  } finally {
    globalThis.fetch = real;
    sqlite.close();
  }
});

test('12:12: envío 12:15, reintento fuera de ventana y sin duplicados',async()=>{
 const {DB,sqlite}=base(),keys=webpush.generateVAPIDKeys(),env={DB,VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,VAPID_SUBJECT:'mailto:test@example.com',AVISOS_URL:'https://official.example/avisos'};
 await DB.prepare('INSERT INTO subscriptions(id,token,subscription,lineas,recordatorio,actualizado) VALUES(?,?,?,?,?,?)').bind('sub','token',JSON.stringify(subscription()),'[]',JSON.stringify({dias:[5],hora:'12:12'}),Date.parse('2026-10-09T15:02:00Z')).run();
 let sends=0;const real=globalThis.fetch;globalThis.fetch=async(url)=>url===env.AVISOS_URL?Response.json({avisos:[]}):new Response('',{status:++sends===1?503:201});
 try {
  await procesarAvisos(env,new Date('2026-10-09T15:15:00Z'));assert.equal(sends,1);assert.equal(sqlite.prepare("SELECT estado FROM deliveries WHERE subscription_id='sub'").get().estado,-503);
  await procesarAvisos(env,new Date('2026-10-09T15:20:00Z'));assert.equal(sends,1);
  await procesarAvisos(env,new Date('2026-10-09T15:25:00Z'));assert.equal(sends,2);
  await procesarAvisos(env,new Date('2026-10-09T15:30:00Z'));assert.equal(sends,2);
  assert(sqlite.prepare("SELECT creado FROM deliveries WHERE subscription_id='__cron__'").get());
  sqlite.prepare("UPDATE deliveries SET estado=-503,creado=? WHERE subscription_id='sub'").run(Date.parse('2026-10-09T16:05:00Z'));
  await procesarAvisos(env,new Date('2026-10-09T16:15:00Z'));assert.equal(sends,2,'caduca tras una hora');
 }finally{globalThis.fetch=real;sqlite.close();}
});
test('Prueba push propia y diagnóstico protegido sin claves',async()=>{
 const {DB,sqlite}=base(),keys=webpush.generateVAPIDKeys(),env={DB,ADMIN_TOKEN:'admin-test',APP_ORIGIN:origin,PUBLIC_LIMIT:{limit:async()=>({success:true})},VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,VAPID_SUBJECT:'mailto:test@example.com'};
 const token='a'.repeat(64);await DB.prepare('INSERT INTO subscriptions(id,token,subscription,lineas,actualizado) VALUES(?,?,?,?,?)').bind('sub',token,JSON.stringify(subscription()),'[]',Date.now()).run();
 let sends=0,status=201;const real=globalThis.fetch;globalThis.fetch=async()=>{sends++;return new Response('',{status});};
 try {
  assert.equal((await worker.fetch(req('/admin/push'),env,ctx)).status,401);
  const admin=await worker.fetch(req('/admin/push',null,{Authorization:'Bearer admin-test'}),env,ctx);const text=await admin.text();assert(!text.includes('p256dh')&&!text.includes('endpoint')&&!text.includes(token));
  assert.equal((await worker.fetch(req('/test-push',{token:'b'.repeat(64)}),env,ctx)).status,404);assert.equal(sends,0);
  assert.equal((await worker.fetch(req('/test-push',{token}),env,ctx)).status,202);assert.equal(sends,1);
  status=401;const failure=await worker.fetch(req('/test-push',{token}),env,ctx);assert.equal(failure.status,502);assert.equal((await failure.json()).proveedorStatus,401);
 }finally{globalThis.fetch=real;sqlite.close();}
});
