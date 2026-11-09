import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { test } from "node:test";
import { createConsoleServer } from "../lib/http.mjs";

const fixture = { mode: "local", uptime: 120, services: [] };

async function start(t, options) {
  const server = createConsoleServer({ collect: () => fixture, ...options });
  t.after(() => server.close());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

function call(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path, ...options }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("l’accueil et les seuls fichiers publics sont servis avec les protections attendues", async (t) => {
  const port = await start(t);
  const home = await call(port, "/");
  assert.equal(home.status, 200);
  assert.match(home.body, /Vue d’ensemble/);
  assert.match(home.body, /Lecture seule/);
  assert.match(home.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.equal(home.headers["x-content-type-options"], "nosniff");
  assert.equal(home.headers["cache-control"], "no-store");

  for (const path of ["/app.js", "/style.css", "/favicon.svg"]) {
    assert.equal((await call(port, path)).status, 200);
  }
  for (const path of ["/.env", "/package.json", "/lib/config.mjs", "/%2e%2e/server.mjs", "//example.org", "/demo-entry.js", "/demo-data.js"]) {
    assert.equal((await call(port, path)).status, 404);
  }
  const head = await call(port, "/", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
});

test("un hôte détourné et les requêtes d’un autre site sont refusés", async (t) => {
  const port = await start(t);
  const cases = [
    { Host: `attacker.example:${port}` },
    { Origin: "https://attacker.example" },
    { "Sec-Fetch-Site": "cross-site" },
    { "Sec-Fetch-Site": "same-site" },
  ];
  for (const headers of cases) {
    const result = await call(port, "/api/snapshot", { headers });
    assert.equal(result.status, 403);
    assert.equal(result.headers["access-control-allow-origin"], undefined);
  }
  const allowed = await call(port, "/api/snapshot", {
    headers: { Origin: `http://127.0.0.1:${port}`, "Sec-Fetch-Site": "same-origin" },
  });
  assert.equal(allowed.status, 200);
});

test("le backend reste en lecture seule et les routes sensibles sont absentes", async (t) => {
  const port = await start(t, process.platform === "linux" ? { collect: undefined } : {});
  const post = await call(port, "/api/snapshot", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, "GET, HEAD");
  assert.equal((await call(port, "/api/terminal")).status, 404);
  assert.equal((await call(port, "/api/files")).status, 404);

  const result = await call(port, "/api/snapshot");
  assert.equal(result.status, 200);
  const data = JSON.parse(result.body);
  assert.equal(data.mode, "local");
  assert.ok(Number.isFinite(data.uptime));
  assert.deepEqual(data.services, []);
});

test("les demandes simultanées partagent une seule collecte", async (t) => {
  let calls = 0;
  const port = await start(t, { collect: () => {
    calls += 1;
    return fixture;
  } });
  const results = await Promise.all(Array.from({ length: 5 }, () => call(port, "/api/snapshot")));
  assert.ok(results.every(({ status }) => status === 200));
  assert.equal(calls, 1);
});

test("une collecte en échec ne divulgue pas l’erreur et peut être relancée", async (t) => {
  let failOnce = true;
  const port = await start(t, { collect: () => {
    if (failOnce) {
      failOnce = false;
      throw new Error("détail interne");
    }
    return fixture;
  } });
  const failed = await call(port, "/api/snapshot");
  assert.equal(failed.status, 503);
  assert.doesNotMatch(failed.body, /détail interne/);
  assert.equal((await call(port, "/api/snapshot")).status, 200);
});
