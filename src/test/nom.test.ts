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

  // ── L'ARBITRAGE, TRANCHÉ ────────────────────────────────────────────────
  //
  // La version précédente de ce test FIXAIT la limite au lieu de la corriger :
  // « Kane » était accepté pour « Kanté », et le commentaire disait que
  // resserrer le seuil ferait perdre les vraies fautes de frappe — « un
  // arbitrage à trancher ».
  //
  // Il a été tranché par une mesure, provoquée par un signalement de joueur
  // (« pepe » sur FC Porto). Sur les 5 622 joueurs de la base, le seuil d'une
  // faute pour les noms de moins de six lettres confondait huit paires de
  // joueurs RÉELLEMENT DIFFÉRENTS : Gavi ↔ Xavi, Bento ↔ Beto, Zico ↔ Zizo,
  // Kaká ↔ Kaku, Zico ↔ Pico, Isi ↔ Pizzi, Jonny ↔ Doni, Pizzi ↔ Pirri.
  //
  // Accepter Xavi quand la réponse est Gavi n'est pas de l'indulgence envers
  // une faute de frappe : c'est une mauvaise réponse comptée juste, donc un
  // score faussé, donc un classement faussé. Le seuil passe à zéro sous six
  // lettres, et les huit paires disparaissent.
  //
  // Ce que ça NE coûTE PAS : la tolérance sur les noms longs, qui est là où les
  // fautes de frappe arrivent vraiment — les deux cas ci-dessus le vérifient.
  it("ne confond plus deux joueurs dont le nom court diffère d'une lettre", () => {
    expect(fuzzyNom("Kane", "Kanté")).toBe(false);
    expect(fuzzyNom("Gavi", "Xavi")).toBe(false);
    expect(fuzzyNom("pepe", "Pelé")).toBe(false);
    // Et un nom court reste évidemment accepté quand il est juste.
    expect(fuzzyNom("Pedri", "Pedri")).toBe(true);
    expect(fuzzyNom("pedri", "Pedri")).toBe(true);
  });

  // ── CE QUI RESTE, ET QUI N'EST PAS RÉGLÉ ────────────────────────────────
  //
  // Le seuil reste de deux fautes entre six et onze lettres, et de trois
  // au-delà. Sur la base entière, 268 paires de joueurs distincts se rejoignent
  // encore — dont Jude Bellingham ↔ Jobe Bellingham, Nico González ↔ Nicolás
  // González, Diogo Costa ↔ Diego Costa, Lionel Messi ↔ Lionel Mpasi.
  //
  // Aucun seuil proportionnel à la longueur ne peut les séparer : les deux
  // Bellingham diffèrent de deux caractères sur quatorze. Il faudrait comparer
  // PRÉNOM et NOM séparément, avec le seuil appliqué à chaque partie — les
  // frères se sépareraient alors sur « jude » contre « jobe », quatre lettres,
  // seuil zéro.
  //
  // Ce test fixe la limite en attendant cette refonte, pour qu'elle ne se
  // redécouvre pas par un signalement de joueur.
  it("limite connue : deux noms complets proches se rejoignent encore", () => {
    expect(fuzzyNom("Jude Bellingham", "Jobe Bellingham")).toBe(true);
    expect(fuzzyNom("Lionel Messi", "Lionel Mpasi")).toBe(true);
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
