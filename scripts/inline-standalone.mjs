// Prend la sortie de `vite build --config vite.standalone.config.ts` et fond
// le JS + le CSS dans un unique fichier HTML autonome (bridgeball-flotte.html).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = "dist-standalone";
const resolve = (href) => path.join(dir, href.replace(/^\.?\//, ""));

let html = readFileSync(path.join(dir, "standalone.html"), "utf8");

// Les preloads de modules pointent vers des fichiers qu'on va inliner : inutiles.
html = html.replace(/<link[^>]*rel="modulepreload"[^>]*>\s*/g, "");

// Inline le CSS.
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_m, href) => {
  const css = readFileSync(resolve(href), "utf8");
  return `<style>${css}</style>`;
});

// Inline le JS (on neutralise tout </script> littéral présent dans le bundle).
html = html.replace(/<script([^>]*)\ssrc="([^"]+)"([^>]*)><\/script>/g, (_m, pre, src, post) => {
  const js = readFileSync(resolve(src), "utf8").replace(/<\/script>/gi, "<\\/script>");
  const type = /type="module"/.test(pre + post) ? ' type="module"' : "";
  return `<script${type}>${js}</script>`;
});

writeFileSync("bridgeball-flotte.html", html);
console.log(`bridgeball-flotte.html écrit (${(html.length / 1024).toFixed(0)} Ko)`);
