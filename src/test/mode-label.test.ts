// Le bandeau d'activité de l'accueil ("X vient de scorer Y pts sur <mode>")
// affichait la clé BRUTE de bb_scores.mode dès qu'elle manquait à MODE_LABEL
// — repéré par un joueur qui a vu "findscore" au lieu de "Trouve le joueur".
// Ce test verrouille les QUATRE valeurs réelles que bb_scores.mode peut
// prendre (voir MODE_DU_SCORE dans lib/tracking.js — seuls ces modes-là
// classent un score) contre le même défaut, plutôt que de ne fixer que le
// cas signalé.
import { describe, it, expect } from "vitest";
import { labelDuMode, MODE_LABEL } from "../pages/Home";

describe("labelDuMode", () => {
  it("traduit chaque mode RÉEL de bb_scores.mode, jamais la clé brute", () => {
    for (const mode of ["pont", "chaine", "findscore", "devinette"]) {
      expect(labelDuMode(mode), `"${mode}" n'a pas de nom affiché — un joueur verrait la clé brute`)
        .not.toBe(mode);
    }
  });

  it("rend un nom de mode lisible pour findscore", () => {
    // Le cas précis signalé : "findscore" est le nom de colonne interne du
    // mode "Trouve le joueur", jamais un nom à montrer à un joueur.
    expect(labelDuMode("findscore")).toBe("Trouve le joueur");
    expect(labelDuMode("findscore")).not.toContain("find");
  });

  it("retombe sur la clé telle quelle pour un mode inconnu", () => {
    // Comportement voulu, pas un oubli : un mode qui n'existe pas encore dans
    // MODE_LABEL doit rester visible (donc repérable), pas disparaître.
    expect(labelDuMode("un_mode_qui_n_existe_pas")).toBe("un_mode_qui_n_existe_pas");
  });

  it("MODE_LABEL couvre bien les quatre valeurs de MODE_DU_SCORE", () => {
    for (const mode of ["pont", "chaine", "findscore", "devinette"]) {
      expect(MODE_LABEL[mode], `MODE_LABEL ne connaît pas "${mode}"`).toBeTruthy();
    }
  });
});
