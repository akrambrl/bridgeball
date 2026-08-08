import { describe, it, expect } from "vitest";
import { cadenceSalon, requetesParMinute } from "@/lib/cadence";

describe("cadenceSalon", () => {
  it("garde 800 ms pendant la manche : c'est là qu'on court après l'adversaire", () => {
    expect(cadenceSalon("playing", true)).toBe(800);
  });

  it("lève le pied dans le salon et sur les résultats", () => {
    expect(cadenceSalon("lobby", true)).toBe(2000);
    expect(cadenceSalon("finished", true)).toBe(2000);
  });

  // Le point qui compte : l'hôte fait avancer les phases depuis SON sondage.
  // Le suspendre quand l'onglet passe en arrière-plan figerait le duel pour
  // les deux joueurs. On ralentit, on ne s'arrête jamais.
  it("ralentit mais ne s'arrête pas quand l'onglet est caché", () => {
    for (const ecran of ["lobby", "playing", "finished"]) {
      const d = cadenceSalon(ecran, false);
      expect(d).toBeGreaterThan(0);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThan(cadenceSalon(ecran, true) - 1);
    }
  });

  it("réduit bien la charge là où elle était inutile", () => {
    expect(requetesParMinute(cadenceSalon("playing", true))).toBe(75);
    expect(requetesParMinute(cadenceSalon("lobby", true))).toBe(30);
    expect(requetesParMinute(cadenceSalon("lobby", false))).toBe(24);
  });
});
