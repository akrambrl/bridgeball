import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // Sur GitHub Pages le site est servi depuis /bridgeball/ ; ailleurs (Vercel,
  // Lovable, dev) il reste à la racine.
  base: process.env.GITHUB_PAGES === "true" ? "/bridgeball/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
