import { parseConfig } from "./lib/config.mjs";
import { createConsoleServer } from "./lib/http.mjs";

let config;
try {
  config = parseConfig(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const server = createConsoleServer(config);
server.on("error", (error) => {
  console.error(`Impossible de lancer Console (${error.code ?? "erreur inconnue"}).`);
  process.exitCode = 1;
});
server.listen(config.port, "127.0.0.1", () => {
  console.log(`Console · lecture seule · http://127.0.0.1:${config.port}`);
});
