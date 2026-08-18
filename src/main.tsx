import { inject } from '@vercel/analytics';
inject();
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./lib/native";
import { initPub } from "./lib/pub";
import { chargerDonnees, donneesPretes, origineDonnees } from "./lib/donnees";
import { initDerives } from "./components/LePont.jsx";

initNative();
// Le SDK publicitaire et le consentement. Sans effet hors coque native, et
// volontairement pas attendu : une pub qui met du temps à s'initialiser ne doit
// pas retarder d'une milliseconde l'affichage du jeu.
void initPub();

// ── LA BASE JOUEURS, AVANT LE PREMIER RENDU ────────────────────────────────
//
// Elle n'est plus empaquetée dans le JS mais servie en fichier (voir
// src/lib/donnees.ts), donc il faut l'attendre. Ici et pas dans un composant,
// pour une raison précise : les états de Index sont initialisés au montage et
// certains lisent déjà des données de jeu. Attendre AVANT `createRoot` supprime
// toute question d'ordre — le premier rendu voit une base complète, comme au
// temps où elle était importée en dur.
//
// Le coût est celui d'un fichier local : dans la coque native l'URL relative
// désigne un fichier du paquet, et sur le web c'est une ressource de même
// origine, servie en 163 Ko compressés. Le splash natif couvre déjà ce moment.
//
// `initDerives()` reconstruit les cinq index de LePont — PLAYERS_CLEAN,
// PLAYER_DIFF, ALL_CLUBS_LIST, CLUB_INDEX, PLAYER_BY_NAME — qui étaient calculés
// au chargement du module et le seraient donc sur un tableau vide.
async function demarrer() {
  await chargerDonnees();
  initDerives();

  if (!donneesPretes()) {
    // On affiche quand même. Une app qui ne monte pas est un écran noir sans
    // explication ; une app montée avec une base vide montre au moins son
    // interface, ses réglages et son classement — et le rechargement suivant
    // repartira du fichier du paquet, qui est toujours là.
    console.error("[demarrage] base joueurs indisponible, l'app démarre dégradée");
  } else if (import.meta.env.DEV) {
    console.info("[demarrage] base joueurs : " + origineDonnees());
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void demarrer();
