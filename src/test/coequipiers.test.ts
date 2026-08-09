// Un joueur ne doit jamais s'entendre dire « j'ai joué avec X » si la base ne
// prouve pas qu'ils se sont croisés.
//
// Le défaut à l'origine de ces tests : dans Trouve le joueur, l'indice de
// coéquipier retombait sur une heuristique — même club, naissances à ±4 ans —
// quand le joueur n'était pas couvert par CLUB_SPELLS. Openda (né en 2000) et
// Konaté (1999) partagent DEUX clubs, Lens et RB Leipzig, ce qui les plaçait en
// tête de cette liste ; or Konaté avait quitté les deux avant qu'Openda
// n'arrive. Le jeu affirmait donc une chose fausse, sur un ton d'indice.
//
// La seule source qui autorise cette affirmation est CLUB_SPELLS, qui porte les
// années. Ces tests verrouillent sa propriété fondamentale.
import { describe, it, expect } from "vitest";
import { CLUB_SPELLS, wereTeammates, hasSpells } from "../lib/clubSpells";

const NOMS = Object.keys(CLUB_SPELLS);

describe("wereTeammates n'affirme que ce que les dates prouvent", () => {
  it("chaque paire déclarée coéquipière partage un club à des années qui se chevauchent", () => {
    const fautives: string[] = [];
    for (let i = 0; i < NOMS.length; i++) {
      for (let j = i + 1; j < NOMS.length; j++) {
        if (!wereTeammates(NOMS[i], NOMS[j])) continue;
        const a = CLUB_SPELLS[NOMS[i]], b = CLUB_SPELLS[NOMS[j]];
        const prouve = a.some((s1) =>
          b.some((s2) => s1.club === s2.club && s1.from < s2.to && s2.from < s1.to));
        if (!prouve) fautives.push(NOMS[i] + " / " + NOMS[j]);
      }
    }
    expect(fautives).toEqual([]);
  });

  it("un club commun ne suffit pas : il faut que les périodes se recoupent", () => {
    // Paire construite à la main sur le modèle du défaut signalé.
    const table = {
      "Parti tôt": [{ club: "RB Leipzig", from: 2017, to: 2021 }],
      "Arrivé tard": [{ club: "RB Leipzig", from: 2023, to: 2025 }],
    };
    const seCroisent = (a: keyof typeof table, b: keyof typeof table) =>
      table[a].some((s1) => table[b].some(
        (s2) => s1.club === s2.club && s1.from < s2.to && s2.from < s1.to));
    expect(seCroisent("Parti tôt", "Arrivé tard")).toBe(false);
  });

  it("refuse de se prononcer quand un des deux joueurs n'est pas daté", () => {
    // C'est exactement le cas Openda / Konaté : aucun des deux n'est dans la
    // table. wereTeammates doit répondre non, et l'appelant se rabattre sur une
    // formulation qui n'affirme pas le contact.
    expect(hasSpells("Lois Openda")).toBe(false);
    expect(hasSpells("Ibrahima Konate")).toBe(false);
    expect(wereTeammates("Lois Openda", "Ibrahima Konate")).toBe(false);
  });
});
