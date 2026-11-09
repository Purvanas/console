const byId = (id) => document.getElementById(id);
const refresh = byId("refresh");
const rows = byId("service-rows");
const filter = byId("service-filter");
const feedback = byId("demo-feedback");
const simulation = new Map();
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
  const demo = dashboard.mode === "demo";
  const services = dashboard.services.map(({ name, status }) => ({
    name,
    status: (demo ? simulation.get(name) : undefined) ?? status,
  }));
  const active = services.filter((service) => service.status === "active").length;
  byId("service-summary").textContent = services.length
    ? `${active} actif${active === 1 ? "" : "s"} sur ${services.length}`
    : "Aucune unité systemd déclarée.";

  const filtered = services.filter(({ status }) => filter.value === "all" ||
    (filter.value === "active" ? status === "active" : status !== "active"));
  const signature = JSON.stringify([demo, filtered]);
  if (signature === renderedRows) return;
  renderedRows = signature;

  const focusedService = document.activeElement?.dataset.service;
  byId("action-heading").hidden = !demo;
  rows.replaceChildren(...filtered.map(({ name, status }) => {
    const row = document.createElement("tr");
    row.insertCell().textContent = name;

    const badge = document.createElement("span");
    const state = statuses.has(status) ? status : "unknown";
    badge.className = `state state-${state}`;
    badge.textContent = statuses.get(state);
    row.insertCell().append(badge);

    if (demo) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button row-action";
      button.dataset.service = name;
      button.disabled = state === "activating";
      button.textContent = button.disabled ? "Simulation…" : "Simuler";
      button.setAttribute("aria-label", `Simuler la relance de ${name}`);
      row.insertCell().append(button);
    }
    return row;
  }));
  if (focusedService) {
    const button = Array.from(rows.querySelectorAll("button")).find(
      (candidate) => candidate.dataset.service === focusedService,
    );
    (button && !button.disabled ? button : filter).focus();
  }
  const empty = byId("service-empty");
  empty.hidden = filtered.length > 0;
  empty.textContent = services.length ? "Aucun service pour ce filtre." : "Ajoutez des unités à la configuration pour les suivre ici.";
}

function render(data) {
  dashboard = data;
  const demo = data.mode === "demo";
  byId("mode-badge").textContent = demo ? "Démonstration" : "Lecture seule";
  byId("mode-title").textContent = demo ? "Serveur fictif" : "Observation locale";
  byId("mode-description").textContent = demo
    ? "Les ressources et les services sont des exemples. Les actions restent dans ce navigateur."
    : "Les données proviennent de cette machine. Cette interface permet de consulter son état.";
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

async function readDashboard(loadSnapshot) {
  if (loading) return;
  clearTimeout(timer);
  loading = true;
  refresh.disabled = true;
  const error = byId("network-state");
  try {
    render(await loadSnapshot());
    error.hidden = true;
  } catch {
    error.textContent = dashboard
      ? "Actualisation impossible. Les dernières données reçues restent affichées."
      : "Impossible de charger le tableau de bord. Réessayez avec Actualiser.";
    error.hidden = false;
  } finally {
    loading = false;
    refresh.disabled = false;
    if (!document.hidden) timer = setTimeout(() => readDashboard(loadSnapshot), 15_000);
  }
}

export function startDashboard(loadSnapshot) {
  const read = () => readDashboard(loadSnapshot);
  refresh.addEventListener("click", read);
  filter.addEventListener("change", showServices);
  document.addEventListener("visibilitychange", () => {
    clearTimeout(timer);
    if (!document.hidden) read();
  });
  rows.addEventListener("click", (event) => {
    const name = event.target.closest("button[data-service]")?.dataset.service;
    if (!name || dashboard?.mode !== "demo" || simulation.get(name) === "activating") return;

    simulation.set(name, "activating");
    feedback.textContent = `Simulation en cours pour ${name}…`;
    showServices();
    setTimeout(() => {
      simulation.set(name, "active");
      feedback.textContent = `Relance simulée terminée. ${name} est actif dans la démo.`;
      showServices();
    }, 650);
  });
  read();
}
