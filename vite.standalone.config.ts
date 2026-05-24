import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Build dédié à un fichier HTML 100% autonome (ouvrable en file://) :
// tout est inliné, assets en base64, un seul bundle JS et un seul CSS.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-standalone",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: path.resolve(__dirname, "standalone.html"),
      output: {
        inlineDynamicImports: true,
        entryFileNames: "app.js",
        assetFileNames: "app.[ext]",
      },
    },
  },
});
