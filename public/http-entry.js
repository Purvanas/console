import { startDashboard } from "./app.js";

startDashboard(async () => {
  const response = await fetch("/api/snapshot", { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error("Lecture indisponible");
  return response.json();
});
