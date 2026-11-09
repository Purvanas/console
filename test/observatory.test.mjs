import assert from "node:assert/strict";
import { test } from "node:test";
import { localSnapshot } from "../lib/observatory.mjs";

test("la collecte Linux renvoie uniquement les métriques prévues et les unités choisies", {
  skip: process.platform !== "linux",
}, async () => {
  const snapshot = await localSnapshot(["example-nonexistent.service"]);
  assert.deepEqual(Object.keys(snapshot), [
    "mode", "sampledAt", "cpu", "memory", "storage", "uptime", "services",
  ]);
  assert.equal(snapshot.mode, "local");
  assert.ok(snapshot.cpu === null || (snapshot.cpu >= 0 && snapshot.cpu <= 100));
  assert.ok(snapshot.memory.used >= 0 && snapshot.memory.used <= snapshot.memory.total);
  assert.ok(snapshot.uptime >= 0);
  assert.deepEqual(snapshot.services, [{ name: "example-nonexistent.service", status: "unknown" }]);
});
