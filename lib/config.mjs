const VALID_SERVICE = /^[a-zA-Z0-9][a-zA-Z0-9_.@-]{0,87}\.service$/;

export function parseConfig(env, platform = process.platform) {
  const mode = env.CONSOLE_MODE ?? "demo";
  if (mode !== "demo" && mode !== "local") {
    throw new Error("CONSOLE_MODE doit être demo ou local.");
  }
  if (mode === "local" && platform !== "linux") {
    throw new Error("Le mode local nécessite Linux.");
  }

  const rawPort = env.CONSOLE_PORT ?? "4178";
  const port = Number(rawPort);
  if (!/^\d{4,5}$/.test(rawPort) || port < 1024 || port > 65535) {
    throw new Error("CONSOLE_PORT doit être un nombre entier entre 1024 et 65535.");
  }

  const names = (env.CONSOLE_SERVICES ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const services = [...new Set(names)];
  if (services.length > 8 || services.some((name) => !VALID_SERVICE.test(name))) {
    throw new Error("CONSOLE_SERVICES accepte jusqu’à huit noms d’unités .service.");
  }

  return { mode, port, services: mode === "local" ? services : [] };
}
