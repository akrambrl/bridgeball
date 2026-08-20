// « LES CARTES NE SONT PAS BIEN CENTRÉES »
//
// Le signalement était juste, et le diagnostic n'était pas celui qu'on croyait :
// chaque bloc de la modale « nouvelle carte » était PARFAITEMENT centré. Mesuré
// au navigateur sur 393, 375 et 360 px de large — écart au centre de l'écran :
// zéro, pour le titre, la carte et la rangée de boutons.
//
// Ce qui n'allait pas, c'est que les deux blocs principaux n'avaient pas la même
// LARGEUR :
//
//     la carte           min(74vw, 260px)  → 263 px sur les trois formats,
//                                            son plafond étant atteint partout
//     les boutons        width:100%, maxWidth:330  → 330, 330, 320
//
// Soit 33 px de débordement de chaque côté. Deux blocs centrés mais de largeurs
// différentes, sans conteneur visible pour les relier : l'œil lit un décentrage
// là où il n'y a qu'une colonne qui n'existe pas.
//
// D'où ce test : il n'éprouve pas un centrage — il éprouve que la carte et les
// boutons TIRENT LEUR LARGEUR DE LA MÊME SOURCE. C'est la seule formulation qui
// ne se périme pas si la valeur change.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "src/components/LePont.jsx"), "utf8");

/** Le corps de la modale « nouvelle carte », de sa déclaration à sa fermeture. */
const modale = (() => {
  const i = src.indexOf("const cardUnlockModal = cardPopup ?");
  expect(i, "la modale « nouvelle carte » a changé de nom").toBeGreaterThan(-1);
  return src.slice(i, src.indexOf("const feedbackBar", i));
})();

describe("la modale « nouvelle carte »", () => {
  it("définit UNE largeur de colonne, et une seule", () => {
    const decl = modale.match(/const largeurColonne = "([^"]+)"/);
    expect(decl, "la largeur partagée a disparu — les deux blocs vont redivergеr").toBeTruthy();
    // Une expression, pas un nombre nu : la colonne doit se resserrer sur un
    // petit écran, sinon elle déborde là où le plafond ne s'applique pas.
    expect(decl![1], "la largeur doit rester relative à l'écran").toMatch(/vw/);
  });

  it("la carte et les boutons s'y réfèrent tous les deux", () => {
    // La carte : `width:largeurColonne` avec son format 3/4.
    expect(
      modale,
      "la carte n'utilise plus la largeur partagée",
    ).toMatch(/width:largeurColonne,aspectRatio:"3 \/ 4"/);
    // La rangée de boutons : même variable, et surtout PLUS de maxWidth propre.
    const rangee = modale.slice(modale.indexOf("gap:10,marginTop:22"));
    expect(rangee.slice(0, 200), "la rangée de boutons n'utilise plus la largeur partagée")
      .toContain("width:largeurColonne");
    expect(
      rangee.slice(0, 200),
      "un maxWidth propre à la rangée ramènerait exactement le défaut d'origine",
    ).not.toMatch(/maxWidth/);
  });

  it("aucune largeur en dur ne subsiste dans la modale", () => {
    // Le garde-fou qui compte sur la durée : ni `min(74vw, 260px)` ni
    // `maxWidth:330` ne doivent revenir, sous aucune forme.
    const codeSeul = modale
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    const durs = [...codeSeul.matchAll(/(?:width|maxWidth):\s*("min\([^"]*\)"|\d{3,})/g)]
      .map((m) => m[0])
      // La carte et les boutons passent par la variable ; ce qui reste ici est
      // décoratif (les rayons en 180vmax, les halos en px) et n'a pas à
      // s'aligner sur la colonne.
      .filter((t) => !/180vmax/.test(t));
    expect(
      durs,
      "ces largeurs en dur dans la modale ne suivront pas la colonne partagée",
    ).toEqual([]);
  });
});
