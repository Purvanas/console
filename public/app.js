const byId = (id) => document.getElementById(id);
const refresh = byId("refresh");
const rows = byId("service-rows");
const filter = byId("service-filter");
const formatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const clock = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" });
const statuses = new Map([
  ["active", "Actif"],
  ["inactive", "Inactif"],
  ["failed", "En échec"],
  ["activating", "Démarrage"],
  ["deactivating", "Arrêt"],
  ["reloading", "Rechargement"],
  ["unknown", "Indisponible"],
]);
let dashboard;
let renderedRows;
let timer;
let loading = false;

function metric(id, percent, note) {
  const bar = byId(`${id}-progress`);
  if (Number.isFinite(percent)) {
    bar.value = percent;
    byId(`${id}-value`).textContent = `${formatter.format(percent)} %`;
  } else {
    bar.removeAttribute("value");
    byId(`${id}-value`).textContent = "—";
  }
  if (note !== undefined) byId(`${id}-note`).textContent = note;
}

function capacity(id, value) {
  const gib = (bytes) => `${formatter.format(bytes / 1024 ** 3)} Gio`;
  if (!value || value.total <= 0) {
    metric(id, null, "Indisponible");
    return;
  }
  metric(id, 100 * value.used / value.total, `${gib(value.used)} / ${gib(value.total)}`);
}

function showServices() {
  if (!dashboard) return;
  const { services } = dashboard;
  const active = services.filter((service) => service.status === "active").length;
  byId("service-summary").textContent = services.length
    ? `${active} actif${active === 1 ? "" : "s"} sur ${services.length}`
    : "Aucune unité systemd déclarée.";

  const filtered = services.filter(({ status }) => filter.value === "all" ||
    (filter.value === "active" ? status === "active" : status !== "active"));
  const signature = JSON.stringify(filtered);
  if (signature === renderedRows) return;
  renderedRows = signature;

  rows.replaceChildren(...filtered.map(({ name, status }) => {
    const row = document.createElement("tr");
    row.insertCell().textContent = name;

    const badge = document.createElement("span");
    const state = statuses.has(status) ? status : "unknown";
    badge.className = `state state-${state}`;
    badge.textContent = statuses.get(state);
    row.insertCell().append(badge);

    return row;
  }));
  const empty = byId("service-empty");
  empty.hidden = filtered.length > 0;
  empty.textContent = services.length ? "Aucun service pour ce filtre." : "Ajoutez des unités à la configuration pour les suivre ici.";
}

function render(data) {
  dashboard = data;
  metric("cpu", data.cpu);
  capacity("memory", data.memory);
  capacity("storage", data.storage);
  const days = Math.floor(data.uptime / 86400);
  const hours = Math.floor(data.uptime / 3600) % 24;
  const minutes = Math.floor(data.uptime / 60) % 60;
  byId("uptime-value").textContent = days ? `${days} j ${hours} h` : `${hours} h ${minutes} min`;
  byId("last-sample").textContent = `Dernière lecture · ${clock.format(new Date(data.sampledAt))}`;
  showServices();
}

async function readDashboard() {
  if (loading) return;
  clearTimeout(timer);
  loading = true;
  refresh.disabled = true;
  const error = byId("network-state");
  try {
    const response = await fetch("/api/snapshot", { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error("Lecture indisponible");
    render(await response.json());
    error.hidden = true;
  } catch {
    error.textContent = dashboard
      ? "Actualisation impossible. Les dernières données reçues restent affichées."
      : "Impossible de charger le tableau de bord. Réessayez avec Actualiser.";
    error.hidden = false;
  } finally {
    loading = false;
    refresh.disabled = false;
    if (!document.hidden) timer = setTimeout(readDashboard, 15_000);
  }
}

refresh.addEventListener("click", readDashboard);
filter.addEventListener("change", showServices);
document.addEventListener("visibilitychange", () => {
  clearTimeout(timer);
  if (!document.hidden) readDashboard();
});
readDashboard();
