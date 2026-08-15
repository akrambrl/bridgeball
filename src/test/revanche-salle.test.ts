import { describe, it, expect } from "vitest";
import { __regles } from "@/components/LePont.jsx";

// En salle, les tirages sont SEMÉS : tous les joueurs doivent voir le même
// joueur de départ et la même file de questions, sans se parler. La graine part
// de l'identifiant de la salle.
//
// « Relancer » garde la même salle — c'est le principe, on ne change ni le code
// ni les joueurs. Même identifiant, donc même graine, donc même partie : la
// revanche rejouait la précédente à l'identique.
//
// Le compteur de manches entre dans la graine. Ces tests tiennent les deux
// exigences en même temps, et elles se contredisent presque : le tirage doit
// être IDENTIQUE entre deux joueurs de la même manche, et DIFFÉRENT d'une manche
// à l'autre. Un correctif qui n'en respecte qu'une casse l'autre en silence.

const { graineSalle, mancheDeSalle } = __regles as any;

describe("revanche en salle — la graine change, l'équité reste", () => {
  it("donne la même graine à deux joueurs de la même manche", () => {
    // C'est ce qui garantit que tout le monde joue la même partie : deux clients
    // qui n'échangent rien recomposent la graine à partir des mêmes valeurs.
    const chezMoi = { id: "salle-42", manche: 3 };
    const chezToi = { id: "salle-42", manche: 3 };
    expect(graineSalle(chezMoi, "_chain")).toBe(graineSalle(chezToi, "_chain"));
  });

  it("change de graine à chaque revanche", () => {
    const salle = "salle-42";
    const graines = [0, 1, 2, 3, 4].map((m) => graineSalle({ id: salle, manche: m }, "_chain"));
    expect(new Set(graines).size).toBe(graines.length);
  });

  it("sépare les tirages d'une même manche", () => {
    // Le joueur de départ du Mercato et la file du Plug partagent la manche :
    // sans suffixe distinct, ils tireraient le même index.
    const d = { id: "salle-42", manche: 1 };
    expect(graineSalle(d, "_chain")).not.toBe(graineSalle(d, "_r0"));
    expect(graineSalle(d, "_r0")).not.toBe(graineSalle(d, "_r1"));
  });

  it("traite une salle sans compteur comme la manche 0", () => {
    // Les salles ouvertes AVANT ce correctif n'ont pas de compteur dans leur
    // JSON. Elles doivent continuer à jouer, pas planter sur un undefined.
    expect(graineSalle({ id: "salle-42" }, "_chain")).toBe(graineSalle({ id: "salle-42", manche: 0 }, "_chain"));
  });

  it("lit le compteur porté par les joueurs, quel qu'en soit le format", () => {
    // `players` arrive tantôt en objet, tantôt en chaîne JSON selon le chemin —
    // c'est déjà le cas partout ailleurs dans le fichier.
    expect(mancheDeSalle({ players: [{ id: "a", manche: 2 }, { id: "b", manche: 2 }] })).toBe(2);
    expect(mancheDeSalle({ players: JSON.stringify([{ id: "a", manche: 5 }]) })).toBe(5);
    expect(mancheDeSalle({ players: [{ id: "a" }] })).toBe(0);
    expect(mancheDeSalle({ players: "pas du json" })).toBe(0);
    expect(mancheDeSalle({})).toBe(0);
  });
});
