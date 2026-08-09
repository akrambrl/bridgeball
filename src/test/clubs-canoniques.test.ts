import { describe, it, expect } from "vitest";
import { PLAYERS } from "@/players.jsx";

// Les critères de jeu comparent les noms de clubs par égalité de chaîne stricte
// (`clubs.includes(valeur)`). Une fiche qui écrit « Mainz 05 » quand le reste de
// la base écrit « Mainz » rend son joueur invisible sur ce club — c'est
// exactement le bug qui faisait échouer Platini sur « A joué en L1 », son
// Saint-Étienne étant accentué là où la base ne l'est pas.
//
// Ce test n'impose pas une orthographe : il refuse qu'une même écriture existe
// en deux versions. Le premier réflexe en cas d'échec est de rallier la graphie
// déjà majoritaire dans la base, pas d'inventer une troisième.

const clubs = new Map<string, number>();
for (const p of PLAYERS as any[]) {
  for (const c of p.clubs ?? []) clubs.set(c, (clubs.get(c) ?? 0) + 1);
}

// Homographes assumés : même squelette de lettres, clubs bel et bien distincts.
const DISTINCTS_ASSUMES = new Set(["dnipro|dnipro"]);

const squelette = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

describe("orthographe des clubs", () => {
  it("n'écrit jamais le même club de deux façons", () => {
    const parSquelette = new Map<string, string[]>();
    for (const c of clubs.keys()) {
      const k = squelette(c);
      parSquelette.set(k, [...(parSquelette.get(k) ?? []), c]);
    }
    const doublons = [...parSquelette.values()]
      .filter((l) => l.length > 1)
      .filter((l) => !DISTINCTS_ASSUMES.has(l.map(squelette).join("|")))
      .map((l) => l.map((c) => `${c} (${clubs.get(c)})`).join(" / "));
    expect(doublons).toEqual([]);
  });

  it("ne laisse aucun club en double consécutif dans une même fiche", () => {
    // Un passage en deux fois se note bien deux fois (Möller à Francfort), mais
    // deux occurrences côte à côte trahissent une fusion de graphies ratée.
    const fautifs: string[] = [];
    for (const p of PLAYERS as any[]) {
      const c: string[] = p.clubs ?? [];
      for (let i = 1; i < c.length; i++) if (c[i] === c[i - 1]) fautifs.push(`${p.name} : ${c.join(", ")}`);
    }
    expect(fautifs).toEqual([]);
  });
});
