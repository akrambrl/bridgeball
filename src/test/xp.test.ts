// Le total d'XP cumulé ne doit jamais reculer.
//
// Cas signalé : « Comment ça se fait que Thibaut a que 5000 points ? Il était le
// hall of fame de juillet, il avait au moins 10 fois plus ». bb_seasons portait
// champion_score 33 700, bb_pseudos portait xp 5 065.
import { describe, it, expect } from "vitest";
import { prochainsTotauxXp } from "../lib/xp";

const MOIS = "2026-08";

describe("prochainsTotauxXp", () => {
  it("n'écrase jamais le total serveur par un état local à zéro", () => {
    // Exactement le cas Thibault : appareil qui n'a pas chargé son XP.
    const r = prochainsTotauxXp({
      localXp: 0, localXpSeason: 0,
      serverXp: 33700, serverXpSeason: 33700, serverMonth: "2026-07",
      currentMonth: MOIS, gain: 5065,
    });
    expect(r.xp).toBe(33700 + 5065);
    expect(r.xp).toBeGreaterThan(33700);
  });

  it("le cumul écrit est toujours ≥ celui déjà stocké, quel que soit l'état local", () => {
    const locaux = [0, 1, 500, 33699, 33700, 99999];
    for (const localXp of locaux) {
      const r = prochainsTotauxXp({
        localXp, localXpSeason: 0,
        serverXp: 33700, serverXpSeason: 0, serverMonth: MOIS,
        currentMonth: MOIS, gain: 10,
      });
      expect(r.xp).toBeGreaterThanOrEqual(33700);
      expect(r.xp).toBe(Math.max(localXp, 33700) + 10);
    }
  });

  it("suit l'état local quand il devance le serveur (parties enchaînées)", () => {
    const r = prochainsTotauxXp({
      localXp: 1200, localXpSeason: 300,
      serverXp: 1000, serverXpSeason: 100, serverMonth: MOIS,
      currentMonth: MOIS, gain: 50,
    });
    expect(r.xp).toBe(1250);
    expect(r.xpSeason).toBe(350);
  });

  it("remet l'XP de saison à zéro quand la ligne porte le mois précédent", () => {
    const r = prochainsTotauxXp({
      localXp: 33700, localXpSeason: 33700,
      serverXp: 33700, serverXpSeason: 33700, serverMonth: "2026-07",
      currentMonth: MOIS, gain: 40,
    });
    expect(r.xpSeason).toBe(40);   // nouveau mois
    expect(r.xp).toBe(33740);      // le cumul, lui, ne repart pas
  });

  it("ignore les valeurs absentes, négatives ou non numériques", () => {
    const r = prochainsTotauxXp({
      localXp: undefined as unknown as number, localXpSeason: -5,
      serverXp: NaN as unknown as number, serverXpSeason: null as unknown as number,
      serverMonth: null, currentMonth: MOIS, gain: 30,
    });
    expect(r.xp).toBe(30);
    expect(r.xpSeason).toBe(30);
  });

  it("un gain nul laisse les totaux intacts", () => {
    const r = prochainsTotauxXp({
      localXp: 800, localXpSeason: 200,
      serverXp: 900, serverXpSeason: 250, serverMonth: MOIS,
      currentMonth: MOIS, gain: 0,
    });
    expect(r.xp).toBe(900);
    expect(r.xpSeason).toBe(250);
  });
});
