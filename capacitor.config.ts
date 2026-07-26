import type { CapacitorConfig } from "@capacitor/cli";

// Configuration de la coque native (iOS d'abord). Les assets web sont *empaquetés*
// depuis dist/ (pas un simple lien vers le site) → l'app fonctionne offline et
// se présente comme une vraie app native, ce qui aide à passer la revue Apple.
const config: CapacitorConfig = {
  appId: "fr.goatfc.app",
  appName: "GOAT FC",
  webDir: "dist",
  backgroundColor: "#0A140A",
  ios: {
    backgroundColor: "#0A140A",
    contentInset: "always",
    // Barre de statut en superposition gérée nativement (voir src/lib/native.ts)
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 700,
      backgroundColor: "#0A140A",
      showSpinner: false,
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
