import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConfig } from "../lib/config.mjs";

test("le démarrage utilise la machine Linux sans service configuré par défaut", () => {
  assert.deepEqual(parseConfig({}, "linux"), {
    port: 4178,
    services: [],
  });
  assert.throws(() => parseConfig({}, "win32"), /Linux/);
});

test("la lecture réelle requiert Linux et des noms d’unités explicites", () => {
  const env = {
    CONSOLE_MODE: "local",
    CONSOLE_PORT: "5123",
    CONSOLE_SERVICES: "example-web.service, example-web.service, worker@one.service",
  };
  assert.deepEqual(parseConfig(env, "linux"), {
    port: 5123,
    services: ["example-web.service", "worker@one.service"],
  });
  assert.throws(() => parseConfig(env, "win32"), /Linux/);
});

test("une configuration dangereuse ou ambiguë est refusée au lancement", () => {
  for (const value of ["--help.service", "foo/*.service", "bar;whoami.service", "a.socket"]) {
    assert.throws(() => parseConfig({ CONSOLE_SERVICES: value }, "linux"), /CONSOLE_SERVICES/);
  }
  const tooMany = Array.from({ length: 9 }, (_, index) => `unit-${index}.service`).join(",");
  assert.throws(() => parseConfig({ CONSOLE_SERVICES: tooMany }, "linux"), /CONSOLE_SERVICES/);
  for (const value of ["80", "9000.5", "70000", "4e3"]) {
    assert.throws(() => parseConfig({ CONSOLE_PORT: value }, "linux"), /CONSOLE_PORT/);
  }
  assert.throws(() => parseConfig({ CONSOLE_MODE: "demo" }, "linux"), /CONSOLE_MODE/);
});
