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

// Inline le JS en script CLASSIQUE (pas type="module") : type="module" est
// refusé depuis file:// par Safari, et un module externe l'est par Chrome.
// Le bundle minifié contient des séquences (`<script`, `<!--`, `</script`) qui
// cassent l'analyseur HTML si on l'écrit en clair dans un <script>. On l'encode
// donc en base64 (aucun `<`) et un mini-loader le décode (UTF-8) puis l'exécute.
// Placé en fin de <body> pour que #root existe au moment de l'exécution.
let loader = "";
html = html.replace(/<script[^>]*\ssrc="([^"]+)"[^>]*><\/script>/g, (_m, src) => {
  const b64 = readFileSync(resolve(src)).toString("base64");
  loader =
    "<script>(function(){var b=atob(\"" + b64 + "\");" +
    "var a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);" +
    "(0,eval)(new TextDecoder(\"utf-8\").decode(a));})();<\/script>";
  return "";
});
html = html.replace(/<\/body>/, `${loader}</body>`);

writeFileSync("bridgeball-flotte.html", html);
console.log(`bridgeball-flotte.html écrit (${(html.length / 1024).toFixed(0)} Ko)`);
