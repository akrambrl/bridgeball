import type { CapacitorConfig } from "@capacitor/cli";

// Configuration de la coque native. Les assets web sont *empaquetés* depuis
// dist/ (pas un simple lien vers le site) → l'app fonctionne offline et se
// présente comme une vraie app native, ce qui aide à passer la revue Apple.
//
// ── LA COULEUR EST CELLE DU MANIFESTE, ET C'ÉTAIT UN DÉFAUT ────────────────
//
// Ces trois `backgroundColor` étaient restés à #0A140A, le vert sombre d'avant
// le passage de l'app à l'or. Le manifeste PWA a été corrigé (background_color
// et theme_color à #F5C22B) mais pas la coque : l'app native se serait donc
// ouverte sur un fondu vert sombre avant d'afficher un écran or. Sur un
// téléphone, ce clignotement est ce qu'on voit AVANT tout le reste, à chaque
// lancement — c'est la première impression, et elle aurait été fausse.
//
// #F5C22B est `G.or` de src/lib/charte.jsx, la teinte du fond de page. La
// couleur de la coque doit être celle du premier écran peint, pas une autre.
//
// ── ANDROID : LE NIVEAU D'API EST UNE CONDITION DE PUBLICATION ─────────────
//
// À partir du 31 août 2026, Google Play refuse toute NOUVELLE application qui
// ne cible pas l'API 36 (Android 16). Le lancement visé étant le 1er octobre,
// la contrainte s'applique. Capacitor 8 cible 36 par défaut (compileSdk et
// targetSdk, minSdk 24), donc rien à forcer ici — c'est la raison de la
// migration depuis Capacitor 6, qui ciblait 34 et se ferait refuser.
// Le contrôle vit dans scripts/coque-native.mjs, pour que ça ne se redécouvre
// pas la veille du dépôt.
const config: CapacitorConfig = {
  appId: "fr.goatfc.app",
  appName: "GOAT FC",
  webDir: "dist",
  backgroundColor: "#F5C22B",
  ios: {
    backgroundColor: "#F5C22B",
    contentInset: "always",
    // Barre de statut en superposition gérée nativement (voir src/lib/native.ts)
  },
  android: {
    backgroundColor: "#F5C22B",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 700,
      backgroundColor: "#F5C22B",
      showSpinner: false,
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
