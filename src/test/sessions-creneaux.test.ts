// Les sessions ont lieu chaque mercredi et samedi à 19 h 30, heure de Paris — été comme hiver.
import { describe, it, expect } from "vitest";
import { creneauxSessions, parisVersUtc } from "../lib/sessions-creneaux.js";

describe("parisVersUtc", () => {
  it("19 h 30 à Paris en été (UTC+2) = 17 h 30 UTC", () => {
    expect(parisVersUtc(2026, 10, 7, 19, 30).toISOString()).toBe("2026-10-07T17:30:00.000Z");
  });
  it("19 h 30 à Paris en hiver (UTC+1) = 18 h 30 UTC", () => {
    expect(parisVersUtc(2026, 11, 4, 19, 30).toISOString()).toBe("2026-11-04T18:30:00.000Z");
  });
});

describe("creneauxSessions", () => {
  it("ne rend que des mercredis et des samedis à 19 h 30 heure de Paris", () => {
    const l = creneauxSessions(new Date("2026-10-01T10:00:00Z"), 14);
    // jeu. 1er oct. : prochains = sam. 3, mer. 7, sam. 10, mer. 14 octobre.
    expect(l).toEqual([
      "2026-10-03T17:30:00.000Z", "2026-10-07T17:30:00.000Z",
      "2026-10-10T17:30:00.000Z", "2026-10-14T17:30:00.000Z",
    ]);
  });
  it("garde 19 h 30 locale au changement d'heure (25 octobre 2026) : 17 h 30 UTC avant, 18 h 30 après", () => {
    const l = creneauxSessions(new Date("2026-10-20T10:00:00Z"), 14);
    expect(l).toContain("2026-10-24T17:30:00.000Z");   // samedi 24, encore l'heure d'été
    expect(l).toContain("2026-10-28T18:30:00.000Z");   // mercredi 28, heure d'hiver
  });
  it("ne rend pas un créneau déjà passé, mais rend celui du soir même s'il n'est pas commencé", () => {
    // mercredi 7 oct. 2026 à 16 h UTC (18 h à Paris) : le créneau de 19 h 30 est dans 1 h 30.
    const l = creneauxSessions(new Date("2026-10-07T16:00:00Z"), 1);
    expect(l).toEqual(["2026-10-07T17:30:00.000Z"]);
    // une minute après le créneau : il n'est plus rendu.
    expect(creneauxSessions(new Date("2026-10-07T17:31:00Z"), 1)).toEqual([]);
  });
  it("ne compte pas un créneau plus loin que l'horizon", () => {
    expect(creneauxSessions(new Date("2026-10-01T10:00:00Z"), 1)).toEqual([]);
  });
  it("tout est en ISO UTC trié, sans doublon", () => {
    const l = creneauxSessions(new Date("2026-10-01T00:00:00Z"), 60);
    expect([...l].sort()).toEqual(l);
    expect(new Set(l).size).toBe(l.length);
    expect(l.length).toBeGreaterThanOrEqual(16);
  });
});
