import { execFile } from "node:child_process";
import { readFile, statfs } from "node:fs/promises";
import { cpus, freemem, totalmem, uptime } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const SYSTEMCTL_ENV = {
  PATH: "/usr/bin:/bin",
  LC_ALL: "C",
  SYSTEMD_PAGER: "cat",
};

function cpuCounters() {
  return cpus().reduce((sum, { times }) => ({
    idle: sum.idle + times.idle,
    total: sum.total + Object.values(times).reduce((total, value) => total + value, 0),
  }), { idle: 0, total: 0 });
}

async function cpuPercent() {
  const before = cpuCounters();
  await sleep(160);
  const after = cpuCounters();
  const total = after.total - before.total;
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, 100 * (1 - (after.idle - before.idle) / total)));
}

async function availableMemory() {
  try {
    const info = await readFile("/proc/meminfo", "utf8");
    const available = /^MemAvailable:\s+(\d+)\s+kB$/m.exec(info);
    if (available) return Number(available[1]) * 1024;
  } catch {
    // Linux can expose the OS counters even when procfs is restricted.
  }
  return freemem();
}

async function serviceState(name) {
  try {
    const { stdout } = await run("/usr/bin/systemctl", [
      "show", "--no-pager", "--property=LoadState,ActiveState", "--", name,
    ], { env: SYSTEMCTL_ENV, timeout: 1500, maxBuffer: 4096 });

    const load = /^LoadState=(.+)$/m.exec(stdout)?.[1];
    const status = /^ActiveState=(.+)$/m.exec(stdout)?.[1];
    if (load === "loaded" &&
        ["active", "activating", "inactive", "failed", "deactivating", "reloading"].includes(status)) {
      return { name, status };
    }
  } catch {
    // An unavailable systemd bus or unit is reported as unknown.
  }
  return { name, status: "unknown" };
}

export async function localSnapshot(services) {
  const [cpu, available, disk, units] = await Promise.all([
    cpuPercent(),
    availableMemory(),
    statfs("/").catch(() => null),
    Promise.all(services.map(serviceState)),
  ]);
  const memoryTotal = totalmem();
  return {
    mode: "local",
    sampledAt: new Date().toISOString(),
    cpu,
    memory: { used: Math.max(0, memoryTotal - available), total: memoryTotal },
    storage: disk && disk.blocks > 0 ? {
      used: (disk.blocks - disk.bfree) * disk.bsize,
      total: disk.blocks * disk.bsize,
    } : null,
    uptime: Math.floor(uptime()),
    services: units,
  };
}
