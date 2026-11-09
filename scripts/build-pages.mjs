import { copyFile, lstat, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = await realpath(new URL("../", import.meta.url));
const source = join(root, "public");
const output = join(root, "dist-pages");
const assets = ["app.js", "demo-entry.js", "demo-data.js", "favicon.svg", "style.css"];
const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'";
const replacements = [
  ['<meta name="robots" content="noindex, nofollow">', `<meta http-equiv="Content-Security-Policy" content="${csp}">\n  <meta name="referrer" content="no-referrer">`],
  ["Console, un tableau de bord local pour observer un serveur Linux.", "Explorez le tableau de bord Console avec un serveur fictif, filtrez ses services et simulez une relance."],
  ["Console · Observatoire système</title>", "Console · Démonstration interactive</title>"],
  ['src="./http-entry.js"', 'src="./demo-entry.js"'],
  ["Accès local</p>", "Démonstration publique</p>"],
];

let html = await readFile(join(source, "index.html"), "utf8");
for (const [before, after] of replacements) {
  if (!html.includes(before)) throw new Error(`Élément manquant dans le modèle HTML: ${before}`);
  html = html.replace(before, after);
}

const existing = await lstat(output).catch((error) => {
  if (error.code !== "ENOENT") throw error;
});
if (existing) {
  if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error("dist-pages doit être un dossier ordinaire");
  await rm(output, { recursive: true });
}
await mkdir(output);
await Promise.all([
  writeFile(join(output, "index.html"), html),
  ...assets.map((name) => copyFile(join(source, name), join(output, name))),
]);
