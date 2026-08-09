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

// Vrais homonymes : la clé les rapproche, ce sont pourtant des clubs distincts.
// Toute paire listée ici a été vérifiée à la main — ne rien y ajouter sans avoir
// constaté que les deux clubs existent séparément.
const DISTINCTS_ASSUMES = new Set([
  "Dnipro / Dnipro-1",                 // FC Dnipro, dissous en 2019, et SC Dnipro-1
  "Al Ahly / Al Ahli",                 // Le Caire et Djeddah/Dubaï
  "Al Nassr / Al-Nasr",                // Riyad et Dubaï
  "Tigre / Tigres",                    // Atlético Tigre (ARG) et Tigres UANL (MEX)
]);

const squelette = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// Clé plus tolérante : rapproche aussi Olympiakos/Olympiacos, où c'est une
// lettre qui change et non un accent. Le squelette seul les laissait passer.
const cleSouple = (s: string) =>
  squelette(s)
    .replace(/ph/g, "f")
    .replace(/[ky]/g, (c) => (c === "k" ? "c" : "i"))
    .replace(/(.)\1+/g, "$1")
    .replace(/s$/, "");

const groupesEnDouble = (cle: (s: string) => string) => {
  const par = new Map<string, string[]>();
  for (const c of clubs.keys()) par.set(cle(c), [...(par.get(cle(c)) ?? []), c]);
  return [...par.values()].filter((l) => l.length > 1);
};

describe("orthographe des clubs", () => {
  it("n'écrit jamais le même club de deux façons", () => {
    const doublons = groupesEnDouble(squelette)
      .filter((l) => !DISTINCTS_ASSUMES.has(l.join(" / ")))
      .map((l) => l.map((c) => `${c} (${clubs.get(c)})`).join(" / "));
    expect(doublons).toEqual([]);
  });

  it("ne laisse pas passer les variantes d'une lettre (Olympiakos / Olympiacos)", () => {
    const doublons = groupesEnDouble(cleSouple)
      .filter((l) => !DISTINCTS_ASSUMES.has(l.join(" / ")))
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
