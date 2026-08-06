import { describe, it, expect } from "vitest";
import { parisDayOf, parisLastDays } from "./days";

describe("parisDayOf", () => {
  it("rattache la soirée au bon jour parisien (et non au jour UTC)", () => {
    // 22 h 30 UTC en été = 00 h 30 le lendemain à Paris (UTC+2)
    expect(parisDayOf("2026-08-05T22:30:00Z")).toBe("2026-08-06");
    // en hiver (UTC+1), il faut passer 23 h UTC pour changer de jour
    expect(parisDayOf("2026-01-05T22:30:00Z")).toBe("2026-01-05");
    expect(parisDayOf("2026-01-05T23:30:00Z")).toBe("2026-01-06");
  });

  it("garde le même jour en pleine journée", () => {
    expect(parisDayOf("2026-08-06T12:09:02.881037+00:00")).toBe("2026-08-06");
    expect(parisDayOf("2026-08-06T00:00:00+02:00")).toBe("2026-08-06");
    expect(parisDayOf("2026-08-06T23:59:59+02:00")).toBe("2026-08-06");
  });

  it("renvoie null sur une date illisible plutôt qu'une clé bidon", () => {
    // Une clé invalide se comparerait à n'importe quelle autre (">=") et
    // ferait entrer la ligne dans toutes les fenêtres.
    for (const bad of [undefined, null, "", "pas-une-date"]) {
      expect(parisDayOf(bad as unknown as string)).toBeNull();
    }
  });
});

describe("parisLastDays", () => {
  it("part du jour parisien de l'instant donné", () => {
    expect(parisLastDays(3, "2026-08-05T22:30:00Z")).toEqual([
      "2026-08-06", "2026-08-05", "2026-08-04",
    ]);
  });

  it("donne n jours consécutifs, distincts, du plus récent au plus ancien", () => {
    const days = parisLastDays(14, "2026-08-06T12:00:00Z");
    expect(days).toHaveLength(14);
    expect(new Set(days).size).toBe(14);
    expect(days[0]).toBe("2026-08-06");
    expect(days[13]).toBe("2026-07-24");
    for (let i = 1; i < days.length; i++) expect(days[i] < days[i - 1]).toBe(true);
  });

  it("ne saute ni ne double un jour au changement d'heure", () => {
    // Passage à l'heure d'hiver : nuit du 24 au 25 octobre 2026 (26 h locales)
    expect(parisLastDays(4, "2026-10-26T09:00:00Z")).toEqual([
      "2026-10-26", "2026-10-25", "2026-10-24", "2026-10-23",
    ]);
    // Passage à l'heure d'été : nuit du 27 au 28 mars 2027 (23 h locales)
    expect(parisLastDays(4, "2027-03-29T09:00:00Z")).toEqual([
      "2027-03-29", "2027-03-28", "2027-03-27", "2027-03-26",
    ]);
    // Et sur 14 jours à cheval sur le changement : aucun doublon ni trou
    const spring = parisLastDays(14, "2027-04-02T12:00:00Z");
    expect(new Set(spring).size).toBe(14);
    expect(spring[13]).toBe("2027-03-20");
  });

  it("franchit un changement de mois et d'année", () => {
    expect(parisLastDays(3, "2027-01-01T10:00:00Z")).toEqual([
      "2027-01-01", "2026-12-31", "2026-12-30",
    ]);
  });
});
