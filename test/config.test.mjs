import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConfig } from "../lib/config.mjs";

test("la démo est le mode par défaut et ignore les unités locales", () => {
  assert.deepEqual(parseConfig({ CONSOLE_SERVICES: "example-web.service" }, "win32"), {
    mode: "demo",
    port: 4178,
    services: [],
  });
});

test("la lecture réelle requiert Linux et des noms d’unités explicites", () => {
  const env = {
    CONSOLE_MODE: "local",
    CONSOLE_PORT: "5123",
    CONSOLE_SERVICES: "example-web.service, example-web.service, worker@one.service",
  };
  assert.deepEqual(parseConfig(env, "linux"), {
    mode: "local",
    port: 5123,
    services: ["example-web.service", "worker@one.service"],
  });
  assert.throws(() => parseConfig(env, "win32"), /Linux/);
});

test("une configuration dangereuse ou ambiguë est refusée au lancement", () => {
  for (const value of ["--help.service", "foo/*.service", "bar;whoami.service", "a.socket"]) {
    assert.throws(() => parseConfig({ CONSOLE_SERVICES: value }), /CONSOLE_SERVICES/);
  }
  const tooMany = Array.from({ length: 9 }, (_, index) => `unit-${index}.service`).join(",");
  assert.throws(() => parseConfig({ CONSOLE_SERVICES: tooMany }), /CONSOLE_SERVICES/);
  for (const value of ["80", "9000.5", "70000", "4e3"]) {
    assert.throws(() => parseConfig({ CONSOLE_PORT: value }), /CONSOLE_PORT/);
  }
  assert.throws(() => parseConfig({ CONSOLE_MODE: "prod" }), /CONSOLE_MODE/);
});
