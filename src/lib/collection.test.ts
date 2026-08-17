import { describe, it, expect } from "vitest";
import {
  CARDS, RARITIES, cardById, isUnlocked, newlyUnlocked,
  nextCard, progressToNext, rarityMeta, unlockedCards, levelCard,
} from "./collection";

describe("catalogue", () => {
  it("a des identifiants et des visuels uniques", () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    const visuels = CARDS.map((c) => c.img).filter(Boolean);
    expect(new Set(visuels).size).toBe(visuels.length); // pas de doublon
    expect(CARDS.length).toBeGreaterThanOrEqual(20);
  });

  it("est trié par palier strictement croissant", () => {
    // L'ordre du tableau EST l'ordre de déblocage : nextCard() renvoie la
    // première carte non possédée, ce qui n'a de sens que trié.
    for (let i = 1; i < CARDS.length; i++) {
      expect(CARDS[i].xp).toBeGreaterThan(CARDS[i - 1].xp);
    }
  });

  it("compte 1 carte de départ puis 7 par catégorie", () => {
    const parRarete = RARITIES.map((r) => CARDS.filter((c) => c.rarity === r.key).length);
    expect(parRarete).toEqual([1, 7, 7, 7, 7]); // départ, bronze, argent, or, diamant
    expect(CARDS.filter((c) => c.rarity === "depart")[0].xp).toBe(0); // tout le monde l'a
  });

  it("donne un cadre à chaque catégorie, et un reflet au diamant seul", () => {
    for (const r of RARITIES) expect(r.frame).toContain("gradient");
    expect(RARITIES.filter((r) => r.cls).map((r) => r.key)).toEqual(["diamant"]);
  });

  it("ne mélange pas les raretés : chaque bande suit la précédente", () => {
    const order = RARITIES.map((r) => r.key);
    let seen = -1;
    for (const c of CARDS) {
      const rank = order.indexOf(c.rarity);
      expect(rank).toBeGreaterThanOrEqual(0);
      expect(rank).toBeGreaterThanOrEqual(seen); // jamais de retour en arrière
      seen = rank;
    }
    expect(seen).toBe(order.length - 1); // toutes les raretés sont représentées
  });

  it("démarre à 0 XP pour qu'un nouveau joueur ait déjà une carte", () => {
    expect(CARDS[0].xp).toBe(0);
    expect(unlockedCards(0)).toHaveLength(1);
  });

  it("garde 12 cartes sous 5 000 XP (p95 des comptes réels)", () => {
    expect(CARDS.filter((c) => c.xp <= 5000).length).toBeGreaterThanOrEqual(12);
  });

  it("garde le haut de l'échelle hors de portée d'une semaine de jeu", () => {
    // L'XP est la somme des scores : ~425 XP par partie pour un bon joueur, et
    // le meilleur compte a fait 56 875 XP en 134 parties. Un plafond bas se
    // bouclait en une semaine — ce test empêche d'y revenir sans le vouloir.
    const XP_PAR_PARTIE = 425;
    const derniere = CARDS[CARDS.length - 1];
    expect(derniere.xp / XP_PAR_PARTIE).toBeGreaterThan(400); // > 400 parties
    // Et le compte le plus avancé observé (56 875 XP) ne doit pas tout avoir.
    expect(unlockedCards(56875).length).toBeLessThan(CARDS.length);
  });

  it("espace les paliers de plus en plus (progression géométrique en haut)", () => {
    // Le plancher était à 1,3 quand le haut comptait 10 cartes. Il est passé à
    // 14 : densifier une échelle sans en bouger les bornes resserre
    // mécaniquement chaque rapport, ce n'est pas une régression. Aucune valeur
    // insérable entre 5 000 et 8 000 ne tient 1,3 des deux côtés.
    const hauts = CARDS.filter((c) => c.rarity === "or" || c.rarity === "diamant");
    for (let i = 1; i < hauts.length; i++) {
      expect(hauts[i].xp / hauts[i - 1].xp).toBeGreaterThanOrEqual(1.15);
    }
    // Ce que le plancher ne dit plus, la portée totale le dit : le haut de
    // l'échelle multiplie encore le palier d'entrée par 50.
    expect(hauts[hauts.length - 1].xp / hauts[0].xp).toBeGreaterThanOrEqual(50);
  });

  it("expose un visuel et une vignette cohérents, ou aucun des deux", () => {
    for (const c of CARDS) {
      if (c.img === null) { expect(c.thumb).toBeNull(); continue; } // « à venir »
      expect(c.img.startsWith("/")).toBe(true);
      expect(c.thumb!.startsWith("/")).toBe(true);
    }
    expect(CARDS.filter((c) => c.img).length).toBe(CARDS.length); // toutes illustrées
  });

  it("nomme chaque visuel d'après sa carte", () => {
    // Cette règle était l'inverse tant que les visuels représentaient des
    // footballeurs réels : le fichier portait le nom du joueur, parce qu'un
    // fichier nommé d'après la carte aurait menti au premier reclassement.
    //
    // Les visuels montrent maintenant un personnage unique dont chaque étape de
    // carrière EST une carte. Il n'y a donc plus de nom de joueur à porter, et
    // un décalage entre `id` et fichier ne serait plus qu'une occasion de se
    // tromper — sur `ballon-or` et `phenomene`, dont le nom affiché ne
    // correspond déjà plus à l'id, c'est la seule chose qui raccroche.
    for (const c of CARDS) {
      expect(c.img).toBe(`/cards/${c.id}.webp`);
      expect(c.thumb).toBe(`/cards/${c.id}-64.webp`);
    }
  });

  it("donne une vignette dédiée aux cartes illustrées (badge léger)", () => {
    // Les cartes livrées vivent dans /cards/ et ont une vignette distincte du
    // visuel plein format : le classement en charge une par joueur.
    const livrees = CARDS.filter((c) => c.img && c.img.startsWith("/cards/"));
    expect(livrees.length).toBeGreaterThanOrEqual(12);
    for (const c of livrees) {
      expect(c.thumb).toBe(c.img!.replace(".webp", "-64.webp"));
      expect(c.thumb).not.toBe(c.img);
    }
  });
});

describe("déblocage", () => {
  it("débloque à partir du palier atteint, pas avant", () => {
    const c = CARDS.find((x) => x.xp === 500)!;
    expect(isUnlocked(c, 499)).toBe(false);
    expect(isUnlocked(c, 500)).toBe(true);
    expect(isUnlocked(c, 501)).toBe(true);
  });

  it("compte les cartes possédées de façon monotone", () => {
    let prev = 0;
    for (const xp of [0, 100, 800, 5000, 15000, 999999]) {
      const n = unlockedCards(xp).length;
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    expect(prev).toBe(CARDS.length); // tout est atteignable
  });

  it("supporte une XP absente ou nulle", () => {
    expect(unlockedCards(0)).toHaveLength(1);
    expect(unlockedCards(undefined as unknown as number)).toHaveLength(1);
  });
});

describe("nextCard / progressToNext", () => {
  it("pointe la première carte non possédée", () => {
    expect(nextCard(0)!.xp).toBe(50);
    expect(nextCard(700)!.xp).toBe(800);
  });

  it("renvoie null quand la collection est complète", () => {
    const max = CARDS[CARDS.length - 1].xp;
    expect(nextCard(max)).toBeNull();
    expect(progressToNext(max)).toBeNull();
  });

  it("mesure la progression depuis le palier précédent, pas depuis 0", () => {
    // 600 XP : dernière carte obtenue à 500, prochaine à 800 → 1/3 du chemin
    const p = progressToNext(600)!;
    expect(p.card.xp).toBe(800);
    expect(p.missing).toBe(200);
    expect(p.ratio).toBeCloseTo(100 / 300, 5);
  });

  it("garde le ratio entre 0 et 1", () => {
    for (const xp of [0, 1, 49, 50, 4999, 20001, 49999]) {
      const p = progressToNext(xp);
      if (!p) continue;
      expect(p.ratio).toBeGreaterThanOrEqual(0);
      expect(p.ratio).toBeLessThanOrEqual(1);
    }
  });
});

describe("newlyUnlocked", () => {
  it("renvoie les cartes franchies entre deux totaux", () => {
    expect(newlyUnlocked(40, 160).map((c) => c.xp)).toEqual([50, 100, 150]);
  });

  it("ne renvoie rien sans franchissement", () => {
    expect(newlyUnlocked(101, 149)).toEqual([]);
    expect(newlyUnlocked(500, 500)).toEqual([]);
  });

  it("ignore un recul d'XP (correction, désynchro)", () => {
    expect(newlyUnlocked(5000, 100)).toEqual([]);
  });

  it("n'annonce pas deux fois le palier déjà atteint", () => {
    // On vient de passer 150 : repasser de 150 à 200 ne réannonce pas la carte.
    expect(newlyUnlocked(150, 200)).toEqual([]);
  });
});

describe("cardById", () => {
  it("ignore un identifiant inconnu ou vide", () => {
    expect(cardById("carte-supprimee")).toBeNull();
    expect(cardById(null)).toBeNull();
    expect(cardById("")).toBeNull();
    expect(cardById("nawak")).toBeNull();
  });
});

describe("rarityMeta", () => {
  it("donne une couleur pour chaque rareté du catalogue", () => {
    for (const c of CARDS) {
      expect(rarityMeta(c.rarity).color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("levelCard — la photo de profil, et il n'y en a pas d'autre", () => {
  it("donne la MEILLEURE carte possédée, jamais la première", () => {
    expect(levelCard(0).id).toBe(CARDS[0].id);
    expect(levelCard(149).xp).toBe(100);
    expect(levelCard(150).xp).toBe(150);
    // La photo de profil est la dernière carte QUI A un visuel : jamais un cadre
    // vide. Les 29 étant illustrées, c'est simplement la dernière débloquée —
    // le filtre reste en place pour le jour où une carte arrivera sans visuel.
    expect(levelCard(17400).id).toBe("finisseur");
    expect(levelCard(999999).id).toBe("goat");
  });

  it("ne renvoie jamais rien, même à 0 ou sans XP", () => {
    // C'est la photo de profil de TOUT le monde : elle doit exister, y compris
    // pour un compte qui vient d'être créé et n'a pas encore joué.
    for (const xp of [0, undefined as unknown as number, null as unknown as number, -5]) {
      expect(levelCard(xp)).toBeTruthy();
      expect(levelCard(xp).img).toBeTruthy();
    }
  });

  it("progresse quand le joueur monte", () => {
    let prev = 0;
    for (const xp of [0, 50, 800, 5000]) {
      const i = CARDS.findIndex((c) => c.id === levelCard(xp).id);
      expect(i).toBeGreaterThanOrEqual(prev);
      prev = i;
    }
  });

  it("change dès que le palier suivant est franchi", () => {
    // C'est la promesse faite au joueur : passer un palier CHANGE sa tête. Le
    // test vérifie l'XP juste avant et juste après chaque seuil — le seul
    // moment où une erreur de comparaison (> au lieu de >=) se verrait.
    for (const c of CARDS.slice(1)) {
      expect(levelCard(c.xp - 1).id).not.toBe(c.id);
      expect(levelCard(c.xp).id).toBe(c.id);
    }
  });

  it("ne dépend QUE de l'XP", () => {
    // Deux joueurs à la même XP portent la même carte, sans exception. C'est ce
    // qui fait de la carte un grade et non une décoration : elle ne peut plus
    // être choisie, ni figée, ni remplacée par une photo.
    for (const xp of [0, 149, 4000, 55000, 250000]) {
      expect(levelCard(xp).id).toBe(levelCard(xp).id);
      expect(unlockedCards(xp).filter((c) => c.img).at(-1)!.id).toBe(levelCard(xp).id);
    }
  });
});
