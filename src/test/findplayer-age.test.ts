import { describe, it, expect } from "vitest";
import { dailyPool } from "@/components/landing/FindPlayer";

// Le plancher d'année de naissance a déjà menti une fois : il valait 1975 avec
// le commentaire « a joué après 2000 », alors qu'un joueur né en 1975 débute
// vers 1994. Ce test vérifie la promesse elle-même — pas la valeur de la
// constante, qui peut bouger — pour qu'elle ne puisse plus se désaligner.
const DEBUT_ESTIME = 19;   // même hypothèse que l'indice « j'ai percé dans les années »

describe("le vivier de la devinette du jour", () => {
  const pool = dailyPool() as any[];

  it("n'est pas vide", () => {
    expect(pool.length).toBeGreaterThan(50);
  });

  it("ne contient aucun joueur dont la carrière commence avant 2000", () => {
    const trop = pool.filter(p => (p.birthYear as number) + DEBUT_ESTIME < 2000);
    expect(trop.map(p => p.name + " (" + p.birthYear + ")")).toEqual([]);
  });

  it("donne une année de naissance à tout le monde — les indices en dépendent", () => {
    // L'indice « génération » est le seul disponible pour les 81 % de joueurs
    // sans palmarès : sans année de naissance, ils n'auraient aucun indice.
    expect(pool.filter(p => !p.birthYear)).toEqual([]);
  });
});
