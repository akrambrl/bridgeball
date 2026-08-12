import { describe, it, expect, afterEach } from "vitest";
import { CARDS, RARITIES, cardName, rarityLabel } from "@/lib/collection";
import { LANGS } from "@/lib/lang";

// La collection était le dernier endroit à ne parler que deux langues : sous une
// interface allemande, les raretés et les noms de cartes restaient en anglais.
// Ces tests exigent une entrée par langue et refusent qu'une carte ajoutée plus
// tard retombe silencieusement sur l'anglais.

const AUTRES = LANGS.map((l) => l.code).filter((c) => c !== "fr" && c !== "en");

function sousLangue<T>(code: string, f: () => T): T {
  localStorage.setItem("bb_lang", code);
  return f();
}

afterEach(() => localStorage.removeItem("bb_lang"));

describe("collection en six langues", () => {
  it("nomme chaque carte dans chacune des six langues", () => {
    for (const code of LANGS.map((l) => l.code)) {
      const muettes = sousLangue(code, () =>
        CARDS.filter((c) => {
          const nom = cardName(c);
          if (!nom) return true;
          // « Hall of Fame » et « GOAT » sont les mêmes mots partout : on ne les
          // compte pas comme non traduits.
          if (/hall of fame|goat/i.test(c.nameEn)) return false;
          return code !== "en" && code !== "fr" && nom === c.nameEn;
        }).map((c) => c.id)
      );
      expect(muettes, "langue " + code).toEqual([]);
    }
  });

  it("nomme chaque rareté dans chacune des six langues", () => {
    for (const code of AUTRES) {
      const muettes = sousLangue(code, () =>
        RARITIES.filter((r) => {
          const nom = rarityLabel(r);
          // Bronze, Gold, Diamant : plusieurs langues partagent le mot.
          return !nom || (nom === r.labelEn && nom === r.label);
        }).filter((r) => !["bronze", "or", "diamant"].includes(r.key)).map((r) => r.key)
      );
      expect(muettes, "langue " + code).toEqual([]);
    }
  });

  it("retombe sur le français en français et l'anglais en anglais", () => {
    const recrue = CARDS.find((c) => c.id === "recrue")!;
    expect(sousLangue("fr", () => cardName(recrue))).toBe("La Recrue");
    expect(sousLangue("en", () => cardName(recrue))).toBe("The Rookie");
    expect(sousLangue("de", () => cardName(recrue))).toBe("Der Neuzugang");
  });
});
