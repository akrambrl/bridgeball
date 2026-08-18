import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// ── LA BASE JOUEURS, AVANT TOUT TEST ──────────────────────────────────────
//
// Les données de jeu ne sont plus empaquetées dans le JS : elles sont servies en
// fichier et chargées au démarrage de l'app (src/lib/donnees.ts). En environnement
// de test il n'y a ni `fetch` relatif ni `caches`, donc la base resterait VIDE — et
// tous les tests qui exercent les vraies données passeraient au vert en ne
// vérifiant plus rien, ce qui est le pire état possible.
//
// On lit donc l'ARTEFACT, et pas src/players.jsx : c'est le chemin que l'app
// emprunte réellement, décodage colonnaire compris. Un défaut du générateur ou du
// décodeur se voit ici, alors qu'importer la source le masquerait.
//
// `initDerives()` reconstruit les cinq index de LePont, qui étaient calculés au
// chargement du module et le seraient donc sur un tableau vide.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chargerDepuisTexte } from "../lib/donnees";
import { initDerives } from "../components/LePont.jsx";

const CHEMIN = join(process.cwd(), "public", "donnees", "joueurs.json");
if (!chargerDepuisTexte(readFileSync(CHEMIN, "utf8"))) {
  throw new Error(
    "public/donnees/joueurs.json illisible ou incomplet — lance `npm run donnees`");
}
initDerives();
