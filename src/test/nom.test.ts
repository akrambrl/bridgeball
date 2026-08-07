import { describe, it, expect } from "vitest";
import { normNom, fuzzyNom, chercheJoueurs } from "@/lib/nom";

// Ces tests fixent le comportement qui avait cassé : trois copies du
// normaliseur avaient divergé, et celles des jeux ne dépliaient que les
// accents combinants.
describe("normNom", () => {
  it("déplie les lettres que NFD ne décompose pas", () => {
    // Le cœur du bug : ø, æ, ð, ł, ß et ı sont des lettres, pas des lettres
    // accentuées — `normalize(\"NFD\")` seul les laisse intactes.
    expect(normNom("Højbjerg")).toBe("hojbjerg");
    expect(normNom("Ødegaard")).toBe("odegaard");
    expect(normNom("Højlund")).toBe("hojlund");
    expect(normNom("Æbeltoft")).toBe("aebeltoft");
    expect(normNom("Sigurðsson")).toBe("sigurdsson");
    expect(normNom("Błaszczykowski")).toBe("blaszczykowski");
  });

  it("déplie aussi les accents ordinaires et retire la ponctuation", () => {
    expect(normNom("Pierre-Emile Højbjerg")).toBe("pierreemile hojbjerg");
    expect(normNom("Kylian Mbappé")).toBe("kylian mbappe");
    expect(normNom("N'Golo Kanté")).toBe("ngolo kante");
  });
});

describe("fuzzyNom", () => {
  it("tolère une faute sur un nom de famille", () => {
    expect(fuzzyNom("Hojberg", "Højbjerg")).toBe(true);
    expect(fuzzyNom("Bentancour", "Bentancur")).toBe(true);
  });

  it("ne confond pas deux noms réellement différents", () => {
    expect(fuzzyNom("Messi", "Mbappe")).toBe(false);
    expect(fuzzyNom("Ronaldo", "Modric")).toBe(false);
    expect(fuzzyNom("Zidane", "Ribery")).toBe(false);
  });

  // Limite connue, antérieure à l'extraction du helper : le seuil tolère une
  // faute dès qu'un mot fait moins de six lettres, donc deux noms courts qui ne
  // diffèrent que d'un caractère se rejoignent. « Kane » est accepté pour
  // « Kanté ». Le test la fixe plutôt que de la taire — resserrer le seuil
  // ferait perdre les vraies fautes de frappe sur les noms courts, c'est un
  // arbitrage à trancher, pas un oubli.
  it("confond encore des noms proches d'une ou deux lettres", () => {
    expect(fuzzyNom("Kane", "Kanté")).toBe(true);
    expect(fuzzyNom("Haaland", "Holland")).toBe(true);
  });
});

describe("chercheJoueurs", () => {
  const base = [
    { name: "Pierre-Emile Højbjerg" },
    { name: "Martin Ødegaard" },
    { name: "Kylian Mbappé" },
  ];

  it("trouve un nom scandinave tapé sans le ø", () => {
    expect(chercheJoueurs("hojbjerg", base).map(j => j.name)).toEqual(["Pierre-Emile Højbjerg"]);
    expect(chercheJoueurs("odegaard", base).map(j => j.name)).toEqual(["Martin Ødegaard"]);
  });

  it("retombe sur la tolérance aux fautes quand la sous-chaîne ne donne rien", () => {
    // « Hojberg » n'est pas une sous-chaîne de « hojbjerg » : sans ce repli,
    // la validation acceptait la réponse que la liste ne proposait jamais.
    expect(chercheJoueurs("Hojberg", base).map(j => j.name)).toEqual(["Pierre-Emile Højbjerg"]);
  });

  it("respecte l'exclusion des joueurs déjà proposés", () => {
    const dejaVu = new Set(["Martin Ødegaard"]);
    expect(chercheJoueurs("odegaard", base, j => dejaVu.has(j.name))).toEqual([]);
  });

  it("ne déclenche pas le fuzzy sur une saisie trop courte", () => {
    expect(chercheJoueurs("xyz", base)).toEqual([]);
  });
});
