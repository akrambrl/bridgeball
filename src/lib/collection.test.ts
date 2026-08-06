import { describe, it, expect } from "vitest";
import {
  CARDS, RARITIES, badgeToShow, cardById, isUnlocked, newlyUnlocked,
  nextCard, progressToNext, rarityMeta, unlockedCards,
} from "./collection";

describe("catalogue", () => {
  it("a des identifiants et des visuels uniques", () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    expect(new Set(CARDS.map((c) => c.img)).size).toBe(CARDS.length);
    expect(CARDS.length).toBeGreaterThanOrEqual(20);
  });

  it("est trié par palier strictement croissant", () => {
    // L'ordre du tableau EST l'ordre de déblocage : nextCard() renvoie la
    // première carte non possédée, ce qui n'a de sens que trié.
    for (let i = 1; i < CARDS.length; i++) {
      expect(CARDS[i].xp).toBeGreaterThan(CARDS[i - 1].xp);
    }
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

  it("expose un visuel et une vignette commençant par / pour chaque carte", () => {
    for (const c of CARDS) {
      expect(c.img.startsWith("/")).toBe(true);
      expect(c.thumb.startsWith("/")).toBe(true);
    }
  });

  it("donne une vignette dédiée aux cartes illustrées (badge léger)", () => {
    // Les cartes livrées vivent dans /cards/ et ont une vignette distincte du
    // visuel plein format : le classement en charge une par joueur.
    const livrees = CARDS.filter((c) => c.img.startsWith("/cards/"));
    expect(livrees.length).toBeGreaterThanOrEqual(12);
    for (const c of livrees) {
      expect(c.thumb).toBe(c.img.replace(".webp", "-64.webp"));
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
    expect(newlyUnlocked(40, 160).map((c) => c.xp)).toEqual([50, 150]);
  });

  it("ne renvoie rien sans franchissement", () => {
    expect(newlyUnlocked(60, 149)).toEqual([]);
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

describe("badgeToShow", () => {
  it("refuse un badge dont la carte n'est pas débloquée", () => {
    // Défense contre une valeur périmée en base (XP corrigée à la baisse) ou
    // bricolée à la main : on n'affiche jamais une carte non méritée.
    expect(badgeToShow("goat", 100)).toBeNull();
    expect(badgeToShow("recrue", 0)!.id).toBe("recrue");
  });

  it("ignore un identifiant inconnu ou vide", () => {
    expect(badgeToShow("carte-supprimee", 999999)).toBeNull();
    expect(badgeToShow(null, 999999)).toBeNull();
    expect(badgeToShow("", 0)).toBeNull();
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
