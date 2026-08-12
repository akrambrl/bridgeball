import { describe, it, expect } from "vitest";

// La numérotation des saisons existe MAINTENANT EN DEUX ENDROITS : dans l'app
// (getCurrentSeason, pour afficher « Saison 5 ») et dans scripts/cloture-saison.mjs,
// qui doit enregistrer la saison écoulée sous le numéro que l'app reconnaîtra.
//
// C'est exactement la configuration qui divergeait déjà pour le joueur du jour :
// deux copies d'un même calcul, et un jour l'une bouge. Si elles se désaccordent
// ici, le Hall of Fame enregistre « saison 7 » quand l'app en est à la 6 — et le
// palmarès n'affiche plus rien, sans erreur nulle part.
//
// Ce test rejoue les deux formules côte à côte sur cinq ans de mois.

const SEASON_START_APP = new Date("2026-04-01T00:00:00Z"); // avril 2026 = saison 1

/** La formule de l'app, recopiée telle quelle depuis getCurrentSeason. */
function numeroApp(annee: number, mois1a12: number): number {
  const paris = new Date(annee, mois1a12 - 1, 15);
  const startParis = new Date(SEASON_START_APP.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const num = (paris.getFullYear() - startParis.getFullYear()) * 12
            + (paris.getMonth() - startParis.getMonth());
  return num + 1;
}

/** La formule du script de clôture, recopiée telle quelle. */
const SEASON_START_SCRIPT = new Date(2026, 3, 1);
function numeroScript(mois: string): number {
  const [a, m] = mois.split("-").map(Number);
  return (a - SEASON_START_SCRIPT.getFullYear()) * 12
       + (m - 1 - SEASON_START_SCRIPT.getMonth()) + 1;
}

describe("numérotation des saisons", () => {
  it("l'app et le script de clôture donnent le même numéro, sur cinq ans", () => {
    const ecarts: string[] = [];
    for (let a = 2026; a <= 2031; a++) {
      for (let m = 1; m <= 12; m++) {
        const cle = a + "-" + String(m).padStart(2, "0");
        const app = numeroApp(a, m), script = numeroScript(cle);
        if (app !== script) ecarts.push(cle + " : app " + app + " ≠ script " + script);
      }
    }
    expect(ecarts).toEqual([]);
  });

  it("avril 2026 est la saison 1", () => {
    expect(numeroApp(2026, 4)).toBe(1);
    expect(numeroScript("2026-04")).toBe(1);
  });

  it("compte les mois, pas les jours", () => {
    expect(numeroScript("2026-05")).toBe(2);
    expect(numeroScript("2027-04")).toBe(13);
  });

  // Les mois AVANT le début donnent un numéro nul ou négatif : le script doit
  // s'arrêter plutôt que d'écrire une saison 0. C'est ce que fait son garde
  // `if (numero < 2)`, et c'est aussi ce qui protège la saison 1 elle-même —
  // il n'y a rien avant elle à clôturer.
  it("rend un numéro inférieur à 2 avant mai 2026", () => {
    expect(numeroScript("2026-04")).toBeLessThan(2);
    expect(numeroScript("2026-03")).toBeLessThan(2);
    expect(numeroScript("2025-12")).toBeLessThan(2);
  });
});
