import { describe, it, expect } from "vitest";
import { __regles } from "@/components/LePont.jsx";
import { PLAYERS } from "@/players.jsx";

// GOAT MERCATO sert le joueur suivant LUI-MÊME : le joueur nomme un club, et
// l'app choisit dans ce club qui posera la question d'après. C'est donc elle qui
// décide si on reconnaît le nom affiché — et un signalement de joueur (« y'a
// souvent des joueurs pas très connus ») ne dit pas où ça se joue.
//
// Ça se joue dans `easyChainPool`, et dans un seul nombre : le vivier de faciles
// doit atteindre CHAIN_EASY_MIN, sinon on élargit aux « moyens » d'office. À 6,
// le seuil n'était atteint que par 50 clubs sur 1 549 — l'élargissement était la
// règle et non l'exception, et sur un club à 3 faciles pour 57 élargis, la chance
// de tomber sur une vedette tombait à 5 %.
//
// Ces tests tiennent les deux bouts : que le seuil reste atteignable, et que
// l'élargissement, quand il a lieu, n'aille pas chercher n'importe qui.

const { easyChainPool, famousClubCount, getPlayersForClub, CHAIN_EASY_MIN } = __regles as any;
const FICHES = PLAYERS as any[];
const parNom = new Map(FICHES.map((p) => [p.name, p]));

// Les clubs les plus fournis de la base : ceux qu'un joueur nomme vraiment. Un
// seuil peut très bien être atteignable sur les 1 549 clubs pris ensemble et
// inatteignable sur ceux qui sortent en jeu.
const clubsLesPlusFournis = (n: number) => {
  const compte = new Map<string, number>();
  for (const p of FICHES) for (const c of p.clubs ?? []) compte.set(c, (compte.get(c) ?? 0) + 1);
  return [...compte.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([c]) => c);
};

describe("GOAT MERCATO — la notoriété du joueur servi", () => {
  it("laisse le seuil atteignable sur les clubs qu'on nomme vraiment", () => {
    // Le contrôle qui aurait attrapé le réglage à 6. Il ne fige pas une valeur :
    // il exige que le seuil serve à quelque chose sur le terrain réel.
    const clubs = clubsLesPlusFournis(80);
    const atteignent = clubs.filter((c) => {
      const faciles = getPlayersForClub(c).filter((n: string) => parNom.get(n)?.diff === "facile");
      return faciles.length >= CHAIN_EASY_MIN;
    });
    expect(atteignent.length).toBeGreaterThanOrEqual(60);
  });

  it("ne sert QUE des faciles quand le club en a assez", () => {
    const clubs = clubsLesPlusFournis(80);
    const fautifs: string[] = [];
    for (const c of clubs) {
      const noms = getPlayersForClub(c);
      const faciles = noms.filter((n: string) => parNom.get(n)?.diff === "facile");
      if (faciles.length < CHAIN_EASY_MIN) continue;
      for (const n of easyChainPool(noms)) {
        if (parNom.get(n)?.diff !== "facile") fautifs.push(c + " → " + n);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("n'élargit qu'à des joueurs qui ont au moins deux clubs connus", () => {
    // L'élargissement reste nécessaire — sans lui, un club à un seul facile le
    // resservirait à chaque partie. Mais il a un plancher : deux clubs connus.
    // C'est ce qui met Dalglish, Zoff ou Tim Howard dans le vivier et en écarte
    // les joueurs qu'on ne replace pas.
    const fautifs: string[] = [];
    for (const c of clubsLesPlusFournis(120)) {
      const noms = getPlayersForClub(c);
      for (const n of easyChainPool(noms)) {
        const p = parNom.get(n);
        if (!p || p.diff === "facile") continue;
        if (p.diff !== "moyen" || famousClubCount(p) < 2) fautifs.push(c + " → " + n + " [" + p.diff + "]");
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("ne rend jamais un vivier vide sur un club fourni", () => {
    // Un vivier vide fait sauter la chaîne sur un joueur tout neuf : jouable,
    // mais déroutant. Sur les clubs fournis, ça ne doit pas arriver.
    const vides = clubsLesPlusFournis(60).filter((c) => easyChainPool(getPlayersForClub(c)).length === 0);
    expect(vides).toEqual([]);
  });
});
