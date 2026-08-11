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
import { readFileSync } from "node:fs";
import { CLUB_SPELLS, wereTeammates, hasSpells } from "../lib/clubSpells";
import { PLAYERS } from "@/players.jsx";

const NOMS = Object.keys(CLUB_SPELLS);
const JOUEURS = PLAYERS as any[];
const NOMS_BASE = new Set(JOUEURS.map((p) => p.name));
const CLUBS_BASE = new Set(JOUEURS.flatMap((p) => p.clubs ?? []));

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

  // L'en-tête de clubSpells.ts pose la règle « les noms de joueurs et de clubs
  // doivent matcher EXACTEMENT ceux de players.jsx », mais rien ne la vérifiait.
  // 7 joueurs et 18 clubs y contrevenaient : « Andres Iniesta » sans accent,
  // « Roma » quand la base écrit « AS Roma », « Lazio » pour « SS Lazio »… Chaque
  // écart rend une carrière datée MUETTE — hasSpells répond non, ou le club commun
  // n'est jamais reconnu — sans qu'aucune erreur ne se produise. Le défaut ne se
  // voit pas : la fonctionnalité est simplement plus faible qu'elle en a l'air.
  it("chaque joueur daté existe dans players.jsx, sous la même orthographe", () => {
    expect(NOMS.filter((n) => !NOMS_BASE.has(n))).toEqual([]);
  });

  // Une clé répétée dans un littéral d'objet ne lève aucune erreur : la dernière
  // écrase la première, en silence. C'est arrivé en réalignant « Alisson » sur
  // « Alisson Becker », qui existait déjà plus bas avec une carrière plus complète.
  it("aucune carrière n'est déclarée deux fois", () => {
    // Chemin depuis la racine : sous vitest, import.meta.url n'est pas une URL
    // de fichier, et readFileSync la refuse.
    const source = readFileSync("src/lib/clubSpells.ts", "utf8");
    const table = source.slice(source.indexOf("CLUB_SPELLS"), source.indexOf("\n};"));
    const cles = [...table.matchAll(/^  "([^"]+)": \[/gm)].map((m) => m[1]);
    const doublons = cles.filter((c, i) => cles.indexOf(c) !== i);
    expect(doublons).toEqual([]);
    expect(cles.length).toBe(NOMS.length);
  });

  it("chaque club daté existe dans players.jsx, sous la même orthographe", () => {
    const orphelins = new Set<string>();
    for (const n of NOMS) for (const s of CLUB_SPELLS[n]) if (!CLUBS_BASE.has(s.club)) orphelins.add(s.club);
    expect([...orphelins]).toEqual([]);
  });

  // Idrissa Gueye est revenu à Everton en 2022 : clubSpells le savait, players.jsx
  // s'arrêtait au PSG. riddleClues() publie « Dernier maillot » d'après le DERNIER
  // élément de players.jsx — l'indice a donc désigné le mauvais club pendant quatre
  // ans, sans qu'aucun test ne bronche. clubSpells est volontairement partiel (il
  // ne porte que les passages utiles à la logique de coéquipiers, pas les fins de
  // carrière en second rideau), donc on ne peut pas exiger que ses deux dernières
  // lignes concordent partout. Mais un passage ENCORE OUVERT, si : si la table dit
  // qu'un joueur est actuellement dans un club, ce club est forcément le dernier
  // de sa liste dans players.jsx.
  it("un passage encore ouvert est le dernier club de players.jsx", () => {
    const parNom = new Map(JOUEURS.map((p) => [p.name, p]));
    const fautifs: string[] = [];
    for (const n of NOMS) {
      const ouvert = CLUB_SPELLS[n].filter((s) => s.to >= 2027);
      if (ouvert.length === 0) continue;
      const clubs = parNom.get(n)?.clubs ?? [];
      const dernier = clubs[clubs.length - 1];
      for (const s of ouvert) {
        if (s.club !== dernier) fautifs.push(n + " : " + s.club + " ouvert, mais players.jsx finit sur " + dernier);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("une arrivée en 2026 se croise bien avec un joueur arrivé avant", () => {
    // Convention du fichier : une arrivée en 2026 se note { from: 2026, to: 2027 }.
    // Digne rejoint le PSG en 2026 ; il doit être coéquipier de quelqu'un qui y
    // était déjà et dont le séjour est daté au-delà de 2026.
    const digne = CLUB_SPELLS["Lucas Digne"];
    expect(digne).toBeDefined();
    const psg = digne.filter((s) => s.club === "PSG");
    expect(psg).toHaveLength(2);                 // 2013-2015 puis 2026
    expect(psg[1]).toEqual({ club: "PSG", from: 2026, to: 2027 });
    // Le prêt à Rome coupe le premier séjour parisien : pas un bloc 2013-2016.
    expect(digne.find((s) => s.club === "AS Roma")).toEqual({ club: "AS Roma", from: 2015, to: 2016 });
    expect(psg[0].to).toBe(2015);
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
