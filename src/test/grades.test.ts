import { describe, it, expect } from "vitest";
import { GRADES, getGrade } from "@/lib/leaderboard";
import { CARDS } from "@/lib/collection";

// Les grades et les cartes sont deux barèmes séparés qui décrivent la même
// progression. Ils avaient divergé au point d'être absurdes : on était « GOAT »
// dès 10 000 XP quand la carte « Le GOAT » en demandait 250 000. Ces tests
// épinglent l'alignement pour qu'un futur changement d'un côté ne le défasse
// pas en silence de l'autre.

/** XP du premier palier d'une rareté donnée. */
function debutRarete(rarete: string): number {
  const xps = CARDS.filter(c => c.rarity === rarete).map(c => c.xp);
  return Math.min(...xps);
}

function seuil(label: string): number {
  const g = GRADES.find(g => g.label === label);
  if (!g) throw new Error("grade introuvable : " + label);
  return g.min;
}

describe("les grades sont calés sur les paliers de la collection", () => {
  it("chaque grade commence là où commence un palier de rareté", () => {
    expect(seuil("Amateur")).toBe(0);
    expect(seuil("Espoir")).toBe(debutRarete("argent"));
    expect(seuil("Titulaire")).toBe(debutRarete("or"));
    expect(seuil("Légende")).toBe(debutRarete("diamant"));
  });

  it("le grade GOAT tombe exactement sur la carte qui porte son nom", () => {
    const carteGoat = CARDS.find(c => c.id === "goat");
    expect(carteGoat).toBeDefined();
    expect(seuil("GOAT")).toBe(carteGoat!.xp);
  });

  it("les seuils sont strictement décroissants — getGrade lit la liste dans l'ordre", () => {
    // getGrade fait un `find(xp >= min)` : un ordre cassé rendrait un grade
    // inatteignable au lieu de lever une erreur.
    for (let i = 1; i < GRADES.length; i++) {
      expect(GRADES[i].min, GRADES[i].label).toBeLessThan(GRADES[i - 1].min);
    }
    expect(GRADES[GRADES.length - 1].min).toBe(0);
  });
});

describe("getGrade", () => {
  it("rend le bon grade de part et d'autre de chaque seuil", () => {
    // On compare les `min`, pas les libellés : getGrade renvoie le libellé
    // TRADUIT dans la langue courante, qui n'est pas le champ `label` brut.
    for (const g of GRADES) {
      expect(getGrade(g.min).min, "à " + g.min).toBe(g.min);
      if (g.min > 0) {
        // Juste en dessous : on doit être dans le grade précédent, pas celui-ci.
        expect(getGrade(g.min - 1).min, "à " + (g.min - 1)).toBeLessThan(g.min);
      }
    }
  });

  it("ne laisse aucune XP sans grade, même énorme ou négative", () => {
    for (const xp of [-100, 0, 1, 999999999]) {
      expect(getGrade(xp).label, "xp=" + xp).toBeTruthy();
    }
  });
});
