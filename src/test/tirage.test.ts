import { describe, it, expect } from "vitest";
import { clePaire, pairesJouables, tirerEnEvitant, memoriser, nettoyerVus } from "../lib/tirage.js";

// Ces tests verrouillent ce que l'audit du tirage a trouvé cassé :
//   • GOAT Battle tirait sans aucune mémoire — 30 % des parties posaient deux
//     fois la même question en 90 secondes ;
//   • « Trouve le joueur » avait une mémoire, mais la jetait à chaque ouverture
//     du mode, ce qui faisait tomber le délai avant répétition de 188 à 20 parties.
// Autrement dit : la variété ne se joue pas sur la qualité du hasard mais sur
// la liste de ce qui a déjà été posé. C'est cette liste qu'on teste.

describe("clePaire", () => {
  it("donne la même clé dans les deux sens", () => {
    expect(clePaire("Arsenal", "Chelsea")).toBe(clePaire("Chelsea", "Arsenal"));
  });

  it("distingue deux paires différentes", () => {
    expect(clePaire("Arsenal", "Chelsea")).not.toBe(clePaire("Arsenal", "Tottenham"));
  });
});

describe("pairesJouables", () => {
  const clubs = ["A", "B", "C"];

  it("ne rend que les paires qui ont un joueur commun", () => {
    // A-B ont un commun, A-C aussi, B-C non.
    const communs = (x: string, y: string) => (x === "B" && y === "C" ? 0 : 1);
    const p = pairesJouables(clubs, communs);
    expect(p).toEqual([["A", "B"], ["A", "C"]]);
  });

  it("ne rend jamais un club face à lui-même", () => {
    const p = pairesJouables(clubs, () => 1);
    for (const [a, b] of p) expect(a).not.toBe(b);
  });

  it("ne rend chaque paire qu'une fois", () => {
    const p = pairesJouables(clubs, () => 1);
    expect(new Set(p.map(([a, b]) => clePaire(a, b))).size).toBe(p.length);
  });
});

describe("tirerEnEvitant", () => {
  const items = ["a", "b", "c", "d"];
  const cle = (x: string) => x;

  it("n'écarte rien quand la mémoire est vide", () => {
    const vus = new Set<string>();
    // alea=0 → premier candidat
    expect(tirerEnEvitant(items, cle, vus, () => 0)).toBe("a");
  });

  it("écarte ce qui est en mémoire", () => {
    const vus = new Set(["a", "b"]);
    expect(tirerEnEvitant(items, cle, vus, () => 0)).toBe("c");
  });

  it("rouvre TOUT plutôt que de ne rien rendre quand la mémoire a tout mangé", () => {
    // Le cas qui arrive le jour où quelqu'un réduit la liste des clubs sans
    // toucher au plafond de mémoire : mieux vaut une répétition qu'un mode qui
    // ne démarre pas.
    const vus = new Set(items);
    expect(tirerEnEvitant(items, cle, vus, () => 0)).toBe("a");
  });

  it("rend null seulement si le vivier est vide", () => {
    expect(tirerEnEvitant([], cle, new Set())).toBeNull();
  });

  it("ne repose jamais la même question dans une partie de 12 manches", () => {
    // La régression exacte : sur 189 paires et 12 manches, l'ancien tirage
    // reposait deux fois la même question dans 30 % des parties.
    const vivier = Array.from({ length: 189 }, (_, i) => "p" + i);
    for (let partie = 0; partie < 200; partie++) {
      let memoire: string[] = [];
      const posees: string[] = [];
      for (let manche = 0; manche < 12; manche++) {
        const tire = tirerEnEvitant(vivier, cle, new Set(memoire));
        expect(tire).not.toBeNull();
        posees.push(tire as string);
        memoire = memoriser(tire as string, memoire, 60);
      }
      expect(new Set(posees).size).toBe(12);
    }
  });
});

describe("memoriser", () => {
  it("met la plus récente en tête", () => {
    expect(memoriser("c", ["a", "b"], 10)).toEqual(["c", "a", "b"]);
  });

  it("ne duplique pas une clé déjà mémorisée, et la remonte en tête", () => {
    expect(memoriser("b", ["a", "b", "c"], 10)).toEqual(["b", "a", "c"]);
  });

  it("coupe la plus ANCIENNE au plafond, pas la plus récente", () => {
    // Une liste qui pousse par la fin et coupe par la fin ne mémorise jamais
    // rien au-delà des premières parties.
    expect(memoriser("d", ["a", "b", "c"], 3)).toEqual(["d", "a", "b"]);
  });

  it("ne modifie pas la liste d'entrée", () => {
    const avant = ["a", "b"];
    memoriser("c", avant, 10);
    expect(avant).toEqual(["a", "b"]);
  });

  it("supporte un plafond de 0 sans planter", () => {
    expect(memoriser("a", [], 0)).toEqual([]);
  });
});

describe("nettoyerVus", () => {
  const connus = new Set(["Zidane", "Pelé"]);

  it("garde les noms encore présents dans la base", () => {
    expect([...nettoyerVus(["Zidane"], connus)]).toEqual(["Zidane"]);
  });

  it("écarte un nom disparu de la base", () => {
    // Sans ça, la mémoire anti-répétition finirait par interdire des joueurs qui
    // n'existent plus, au lieu de faire tourner ceux qui existent.
    expect([...nettoyerVus(["Zidane", "Fantôme"], connus)]).toEqual(["Zidane"]);
  });

  it("survit à un contenu de stockage corrompu", () => {
    // localStorage est écrit par des versions antérieures de l'app : ce qui en
    // sort n'est pas garanti être un tableau de chaînes.
    expect(nettoyerVus(null, connus).size).toBe(0);
    expect(nettoyerVus("Zidane", connus).size).toBe(0);
    expect(nettoyerVus({ 0: "Zidane" }, connus).size).toBe(0);
    expect([...nettoyerVus([42, null, "Pelé"], connus)]).toEqual(["Pelé"]);
  });
});
