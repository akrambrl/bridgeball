// La mise à jour obligatoire ne doit JAMAIS bloquer par erreur : un build inconnu, des seuils
// absents ou illisibles laissent jouer.
import { describe, it, expect } from "vitest";
import { etatVersion, seuilsDe, entierOuZero } from "../lib/version";

describe("etatVersion", () => {
  const seuils = { obligatoire: 30, conseillee: 40 };
  it("bloque sous le seuil obligatoire", () => {
    expect(etatVersion(29, seuils)).toBe("obligatoire");
    expect(etatVersion(1, seuils)).toBe("obligatoire");
  });
  it("conseille entre les deux seuils", () => {
    expect(etatVersion(30, seuils)).toBe("conseillee");
    expect(etatVersion(39, seuils)).toBe("conseillee");
  });
  it("laisse jouer à partir du seuil conseillé", () => {
    expect(etatVersion(40, seuils)).toBe("ok");
    expect(etatVersion(500, seuils)).toBe("ok");
  });
  it("sans seuil (0), rien n'est jamais demandé", () => {
    expect(etatVersion(1, { obligatoire: 0, conseillee: 0 })).toBe("ok");
  });
  it("un build inconnu ou nul ne bloque jamais", () => {
    expect(etatVersion(0, seuils)).toBe("ok");
    expect(etatVersion(NaN, seuils)).toBe("ok");
  });
  it("le seuil obligatoire l'emporte sur le conseillé", () => {
    expect(etatVersion(10, { obligatoire: 20, conseillee: 50 })).toBe("obligatoire");
  });
});

describe("seuilsDe", () => {
  const cfg = { ios: { obligatoire: 12, conseillee: "15" }, android: { obligatoire: 7 } };
  it("lit les seuils de la bonne plateforme", () => {
    expect(seuilsDe(cfg, "ios")).toEqual({ obligatoire: 12, conseillee: 15 });
    expect(seuilsDe(cfg, "android")).toEqual({ obligatoire: 7, conseillee: 0 });
  });
  it("vaut 0 pour une plateforme, une valeur ou une configuration absentes ou illisibles", () => {
    expect(seuilsDe(cfg, "web")).toEqual({ obligatoire: 0, conseillee: 0 });
    expect(seuilsDe(null, "ios")).toEqual({ obligatoire: 0, conseillee: 0 });
    expect(seuilsDe("n'importe quoi", "ios")).toEqual({ obligatoire: 0, conseillee: 0 });
    expect(seuilsDe({ ios: { obligatoire: "abc", conseillee: -3 } }, "ios")).toEqual({ obligatoire: 0, conseillee: 0 });
  });
  it("entierOuZero", () => {
    expect(entierOuZero("42")).toBe(42);
    expect(entierOuZero(7.9)).toBe(7);
    expect(entierOuZero(undefined)).toBe(0);
    expect(entierOuZero(-1)).toBe(0);
  });
});
