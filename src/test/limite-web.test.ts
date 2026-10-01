// Le site offre 3 parties par jour dans les modes en illimité ; l'app native n'a pas de limite.
import { describe, it, expect } from "vitest";
import { LIMITE_PARTIES_WEB, jourParis, cleCompteur, lireParties, lancerPartieWeb } from "../lib/limite-web.js";

function faux(init: Record<string, string> = {}) {
  const m = { ...init };
  return {
    getItem: (k: string) => (k in m ? m[k] : null),
    setItem: (k: string, v: string) => { m[k] = v; },
    _m: m,
  } as any;
}
const JOUR = "2026-10-05";

describe("lancerPartieWeb", () => {
  it("la limite est de trois parties par jour", () => {
    expect(LIMITE_PARTIES_WEB).toBe(3);
  });
  it("autorise les trois premières, refuse la quatrième", () => {
    const s = faux();
    const r = [1, 2, 3, 4].map(() => lancerPartieWeb({ natif: false, storage: s, jour: JOUR }));
    expect(r.map((x) => x.autorise)).toEqual([true, true, true, false]);
    expect(r.map((x) => x.restantes)).toEqual([2, 1, 0, 0]);
  });
  it("un refus ne compte pas : le compteur reste à trois", () => {
    const s = faux();
    for (let i = 0; i < 6; i++) lancerPartieWeb({ natif: false, storage: s, jour: JOUR });
    expect(lireParties(s, JOUR)).toBe(3);
  });
  it("le lendemain, le compteur repart de zéro", () => {
    const s = faux();
    for (let i = 0; i < 3; i++) lancerPartieWeb({ natif: false, storage: s, jour: JOUR });
    expect(lancerPartieWeb({ natif: false, storage: s, jour: "2026-10-06" }).autorise).toBe(true);
  });
  it("l'app native n'est jamais limitée ni comptée", () => {
    const s = faux();
    for (let i = 0; i < 20; i++) expect(lancerPartieWeb({ natif: true, storage: s, jour: JOUR }).autorise).toBe(true);
    expect(lireParties(s, JOUR)).toBe(0);
  });
  it("sans stockage, on laisse jouer plutôt que de bloquer sans pouvoir compter", () => {
    const casse = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } } as any;
    expect(lancerPartieWeb({ natif: false, storage: casse, jour: JOUR }).autorise).toBe(true);
    expect(lancerPartieWeb({ natif: false, storage: null, jour: JOUR }).autorise).toBe(true);
  });
  it("une valeur illisible vaut zéro", () => {
    expect(lireParties(faux({ [cleCompteur(JOUR)]: "abc" }), JOUR)).toBe(0);
    expect(lireParties(faux({ [cleCompteur(JOUR)]: "-4" }), JOUR)).toBe(0);
  });
  it("la limite peut être changée", () => {
    const s = faux();
    const r = [1, 2].map(() => lancerPartieWeb({ natif: false, storage: s, jour: JOUR, limite: 1 }));
    expect(r.map((x) => x.autorise)).toEqual([true, false]);
  });
});

describe("jourParis", () => {
  it("compte le jour à Paris, pas en UTC", () => {
    // 22h30 UTC le 5 octobre = 00h30 le 6 octobre à Paris (heure d'été).
    expect(jourParis("2026-10-05T22:30:00Z")).toBe("2026-10-06");
    expect(jourParis("2026-10-05T10:00:00Z")).toBe("2026-10-05");
  });
});
