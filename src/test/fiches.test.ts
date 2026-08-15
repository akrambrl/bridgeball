import { describe, it, expect } from "vitest";
import { PLAYERS } from "@/players.jsx";
import { CLUB_SPELLS } from "@/lib/clubSpells";

// Ce que scripts/audit-fiches.mjs a trouvé une fois, ce test l'empêche de
// revenir. L'audit explore et propose ; ici on fige ce qui a été tranché.
//
// La règle de partage : ce fichier ne teste QUE ce qui se prouve sans sortir du
// dépôt. « Le parcours est-il complet ? » ne s'y prouve pas — aucune source
// n'est exhaustive, pas même Wikidata, dont la fiche Pogba ignore son premier
// passage à United. La complétude reste un travail de lecture, outillé par
// l'audit. La PRÉSENCE d'un champ, elle, se prouve, et un désaccord entre deux
// tables du dépôt aussi.

type Fiche = { name: string; clubs: string[]; diff: string; nationalities?: string[]; positions?: string[]; birthYear?: number };
const FICHES = PLAYERS as unknown as Fiche[];
const nom = (l: Fiche[]) => l.map((p) => p.name);

describe("fiches joueurs — les champs sans lesquels une fiche n'est pas jouable", () => {
  it("donne au moins un club à chaque joueur", () => {
    expect(nom(FICHES.filter((p) => !p.clubs?.length))).toEqual([]);
  });

  it("donne au moins une nationalité et un poste", () => {
    // Sans nationalité, GOAT GRID ne peut pas poser de critère de pays sur ce
    // joueur ; sans poste, il disparaît des grilles par poste.
    expect(nom(FICHES.filter((p) => !p.nationalities?.length))).toEqual([]);
    expect(nom(FICHES.filter((p) => !p.positions?.length))).toEqual([]);
  });

  it("date la naissance de tous les joueurs faciles et moyens", () => {
    // FindPlayer écarte des mystères tout joueur sans année (il ne saurait pas
    // quel indice d'âge donner). Un « facile » sans date sort donc du tirage
    // grand public sans que rien ne le signale — d'où ce test.
    // Les 167 fiches encore sans date sont toutes en « expert », donc déjà
    // hors tirage : le trou est connu et sans effet visible.
    const trous = FICHES.filter((p) => p.diff !== "expert" && p.birthYear == null);
    expect(nom(trous)).toEqual([]);
  });

  it("garde les années de naissance dans des bornes humaines", () => {
    // Zamora est né en 1901 : la borne basse attrape une faute de frappe,
    // elle ne juge pas les anciens.
    const AN = new Date().getFullYear();
    const hors = FICHES.filter((p) => p.birthYear != null && (p.birthYear < 1890 || p.birthYear > AN - 15));
    expect(hors.map((p) => `${p.name} ${p.birthYear}`)).toEqual([]);
  });

  it("n'écrit jamais deux fois de suite le même club", () => {
    // Répété plus loin, c'est un vrai retour (Ronaldo à United) et c'est légitime.
    // Répété À LA SUITE, c'est une ligne saisie deux fois.
    const doubles: string[] = [];
    for (const p of FICHES)
      for (let i = 1; i < p.clubs.length; i++)
        if (p.clubs[i] === p.clubs[i - 1]) doubles.push(`${p.name} — ${p.clubs[i]}`);
    expect(doubles).toEqual([]);
  });
});

describe("fiches joueurs — l'ordre des clubs face à la table de dates", () => {
  // CLUB_SPELLS date les passages de 341 joueurs, à la main. players.jsx les
  // ordonne sans dates. Quand les deux se contredisent, l'une des deux se trompe
  // — et le jeu affiche l'une pendant que l'autre répond aux questions de
  // coéquipiers. Ces deux tests ont trouvé 11 inversions et 14 clubs manquants.
  const premiere = (a: string[]) => a.filter((c, i) => a.indexOf(c) === i);
  const parNom = new Map(FICHES.map((p) => [p.name, p]));

  it("range les clubs dans le même ordre que leurs dates", () => {
    const desaccords: string[] = [];
    for (const [n, spells] of Object.entries(CLUB_SPELLS)) {
      const p = parNom.get(n);
      if (!p) continue;
      const dates = premiere([...spells].sort((a, b) => a.from - b.from).map((s) => s.club));
      // On compare à la PREMIÈRE occurrence : sinon tout joueur revenu dans un
      // club (Buffon, Rooney, Ibrahimović) sortirait comme désordonné.
      const communs = new Set(dates.filter((c) => p.clubs.includes(c)));
      const fiche = premiere(p.clubs).filter((c) => communs.has(c));
      const attendu = dates.filter((c) => communs.has(c));
      if (fiche.join("|") !== attendu.join("|"))
        desaccords.push(`${n} : fiche ${fiche.join(">")} / dates ${attendu.join(">")}`);
    }
    expect(desaccords).toEqual([]);
  });

  it("ne date aucun passage que la fiche du joueur ignore", () => {
    // Un club daté et absent de la fiche, c'est soit un trou de parcours
    // (Cavani sans Palerme), soit une graphie qui ne colle pas à players.jsx
    // (« Tigres » pour « Tigres UANL ») — les deux sont des défauts.
    const manquants: string[] = [];
    for (const [n, spells] of Object.entries(CLUB_SPELLS)) {
      const p = parNom.get(n);
      if (!p) { manquants.push(`${n} : absent de players.jsx`); continue; }
      for (const c of new Set(spells.map((s) => s.club)))
        if (!p.clubs.includes(c)) manquants.push(`${n} : ${c}`);
    }
    expect(manquants).toEqual([]);
  });
});
