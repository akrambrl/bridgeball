import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";

// Le numéro de build affiché par l'app, lu là où il vit DÉJÀ : le CACHE_NAME du
// service worker, bumpé à chaque déploiement. Une constante de plus à tenir à jour
// à la main aurait divergé au premier oubli, et un numéro faux est pire que pas de
// numéro — c'est justement pour lever un doute qu'il existe.
//
// Pourquoi il existe : à plusieurs reprises un écran corrigé et déployé a été
// signalé comme « encore à l'ancien style », et il n'y avait AUCUN moyen, depuis
// l'app, de savoir quelle version tournait. Les vérifications se faisaient en
// comparant des captures d'écran.
const VERSION = (() => {
  try {
    const sw = readFileSync(path.resolve(__dirname, "public/sw.js"), "utf8");
    return (sw.match(/const CACHE_NAME = "goatfc-(v[\d]+)/) || [])[1] || "dev";
  } catch { return "dev"; }
})();

export default defineConfig({
  define: { __BUILD__: JSON.stringify(VERSION) },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
