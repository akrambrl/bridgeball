import { describe, expect, it } from "vitest";
import { RETIRED_PLAYERS } from "../players.jsx";
import { dailyPool } from "../components/landing/FindPlayer";

// La devinette du jour ne doit proposer que des joueurs EN ACTIVITÉ. La règle
// tient à deux filtres dans un vivier de 195 joueurs dont 89 retraités : elle
// est facile à perdre au prochain ajustement des critères, d'où ce test.
describe("vivier de la devinette du jour", () => {
  const pool = dailyPool();

  it("ne contient aucun joueur de la liste des retraités", () => {
    const retraites = pool.filter(p => RETIRED_PLAYERS.has(p.name)).map(p => p.name);
    expect(retraites).toEqual([]);
  });

  it("ne contient aucun joueur né avant 1975", () => {
    const anciens = pool.filter(p => !p.birthYear || p.birthYear < 1975).map(p => p.name);
    expect(anciens).toEqual([]);
  });

  it("reste assez grand pour ne pas répéter avant deux mois", () => {
    expect(pool.length).toBeGreaterThanOrEqual(60);
  });
});
