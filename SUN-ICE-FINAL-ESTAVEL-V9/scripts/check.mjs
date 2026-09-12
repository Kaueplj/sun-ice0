import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const required = ["index.html","painel.html","qrs.html","404.html","css/style.css","js/app.js","js/painel.js","shared/catalog.mjs","netlify/functions/orders.mjs"];
for (const file of required) await access(resolve(root, file));
const html = await readFile(resolve(root, "index.html"), "utf8");
if (!html.includes('id="catalog-grid"') || !html.includes('js/app.js')) throw new Error("index.html incompleto");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const entry of ["index.html","painel.html","qrs.html","404.html","css","js","shared","manifest.webmanifest","sw.js","_redirects"]) {
  await cp(resolve(root, entry), resolve(dist, entry), { recursive: true });
}
await mkdir(resolve(dist, "images"), { recursive: true });
for (const image of ["agua-mineral-small.webp","pix-qrcode-small.png","sun-and-ice-logo-small.webp","sun-and-ice-share.jpg","brownie.svg","popsicle-white.svg","popsicle-brown.svg"]) {
  await cp(resolve(root, "images", image), resolve(dist, "images", image));
}
console.log("Sun & Ice: validação concluída e dist/ gerada.");
