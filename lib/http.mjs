import { readFile } from "node:fs";
import { createServer } from "node:http";
import { demoSnapshot } from "../public/demo-data.js";
import { localSnapshot } from "./observatory.mjs";

const ASSETS = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/http-entry.js", ["http-entry.js", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/favicon.svg", ["favicon.svg", "image/svg+xml"]],
]);

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function send(req, res, status, type, body, headers = {}) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(req.method === "HEAD" ? undefined : body);
}

function fail(req, res, status, message, headers) {
  send(req, res, status, "text/plain; charset=utf-8", message, headers);
}

export function createConsoleServer({ mode = "demo", services = [], collect } = {}) {
  const snapshot = collect ?? (mode === "local" ? () => localSnapshot(services) : demoSnapshot);
  let lastSample;
  let sampledAt = 0;
  let sampling;

  function currentSnapshot() {
    if (lastSample && Date.now() - sampledAt < 2000) return lastSample;
    if (!sampling) {
      sampling = Promise.resolve().then(snapshot).then((result) => {
        lastSample = result;
        sampledAt = Date.now();
        return result;
      }).finally(() => { sampling = undefined; });
    }
    return sampling;
  }

  const server = createServer({ requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 8192 }, (req, res) => {
    const address = server.address();
    const host = `127.0.0.1:${address?.port}`;
    const site = req.headers["sec-fetch-site"];

    if (req.socket.remoteAddress !== "127.0.0.1" || req.headers.host !== host) {
      fail(req, res, 403, "Adresse d’accès refusée.");
      return;
    }
    if ((site && !["same-origin", "none"].includes(site)) ||
        (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`)) {
      fail(req, res, 403, "Origine refusée.");
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      fail(req, res, 405, "Méthode non autorisée.", { Allow: "GET, HEAD" });
      return;
    }

    if (req.url === "/api/snapshot") {
      Promise.resolve(currentSnapshot())
        .then((data) => send(req, res, 200, "application/json; charset=utf-8", JSON.stringify(data)))
        .catch(() => fail(req, res, 503, "Les données sont temporairement indisponibles."));
      return;
    }

    const asset = ASSETS.get(req.url);
    if (!asset) {
      fail(req, res, 404, "Page introuvable.");
      return;
    }

    const [filename, mime] = asset;
    readFile(new URL(`../public/${filename}`, import.meta.url), (error, body) => {
      if (error) {
        fail(req, res, 503, "La ressource est temporairement indisponible.");
        return;
      }
      send(req, res, 200, mime, body);
    });
  });

  return server;
}
