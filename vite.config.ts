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
  build: {
    rollupOptions: {
      output: {
        // Tout le tronc React (react, react-dom, react-router, react-query…) part
        // dans un chunk « vendor » à part. Il change à chaque bump de dépendance,
        // c'est-à-dire presque jamais, là où le code du jeu change à chaque
        // déploiement : les séparer laisse le navigateur GARDER le vendor en cache
        // d'une version à l'autre au lieu de le retélécharger avec l'app. Il se
        // charge aussi EN PARALLÈLE du chunk applicatif au lieu d'être en série
        // dans un seul gros fichier.
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
