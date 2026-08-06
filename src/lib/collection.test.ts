import { describe, it, expect } from "vitest";
import {
  CARDS, RARITIES, badgeToShow, cardById, isUnlocked, newlyUnlocked,
  nextCard, progressToNext, rarityMeta, unlockedCards, levelCard, avatarCard,
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
    const hauts = CARDS.filter((c) => c.rarity === "epique" || c.rarity === "legendaire");
    for (let i = 1; i < hauts.length; i++) {
      expect(hauts[i].xp / hauts[i - 1].xp).toBeGreaterThanOrEqual(1.3);
    }
  });

  it("expose un visuel et une vignette cohérents, ou aucun des deux", () => {
    for (const c of CARDS) {
      if (c.img === null) { expect(c.thumb).toBeNull(); continue; } // « à venir »
      expect(c.img.startsWith("/")).toBe(true);
      expect(c.thumb!.startsWith("/")).toBe(true);
    }
    expect(CARDS.filter((c) => c.img).length).toBe(12); // les 12 cartes fournies
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

describe("levelCard / avatarCard", () => {
  it("donne la MEILLEURE carte possédée, jamais la première", () => {
    expect(levelCard(0).id).toBe(CARDS[0].id);
    expect(levelCard(149).xp).toBe(50);
    expect(levelCard(150).xp).toBe(150);
    // Au-delà des 12 cartes illustrées, la photo de profil reste la dernière
    // carte QUI A un visuel : jamais un cadre vide.
    expect(levelCard(17400).id).toBe("international");
    expect(levelCard(999999).id).toBe("international");
  });

  it("ne renvoie jamais rien, même à 0 ou sans XP", () => {
    // C'est la photo de profil par défaut de TOUT le monde : elle doit exister.
    for (const xp of [0, undefined as unknown as number, null as unknown as number, -5]) {
      expect(avatarCard(null, xp)).toBeTruthy();
      expect(levelCard(xp)).toBeTruthy();
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

  it("laisse le badge choisi primer sur la carte du niveau", () => {
    expect(avatarCard("recrue", 17400).id).toBe("recrue");   // choix volontaire
    expect(avatarCard(null, 17400).id).toBe(levelCard(17400).id);
  });

  it("retombe sur le niveau si le badge n'est plus mérité", () => {
    // Cas réel : les paliers ont été relevés, le badge stocké n'est plus acquis.
    expect(avatarCard("goat", 5000).id).toBe(levelCard(5000).id);
  });
});
