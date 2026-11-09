const GIB = 1024 ** 3;

export function demoSnapshot() {
  return {
    mode: "demo",
    sampledAt: new Date().toISOString(),
    cpu: 24,
    memory: { used: 3.2 * GIB, total: 8 * GIB },
    storage: { used: 46 * GIB, total: 120 * GIB },
    uptime: 4 * 86400 + 6 * 3600 + 18 * 60,
    services: [
      { name: "example-web.service", status: "active" },
      { name: "example-worker.service", status: "failed" },
      { name: "example-backup.service", status: "inactive" },
    ],
  };
}
