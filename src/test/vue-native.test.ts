// La webview qui repasse SOUS la barre d'état (en-tête coupé, bouton retour intouchable) se
// reconnaît à sa hauteur : elle rejoint celle de l'écran.
import { describe, it, expect } from "vitest";
import { vueDecalee } from "../lib/native";

describe("vueDecalee", () => {
  it("détecte une webview qui occupe tout l'écran (sous la barre d'état)", () => {
    expect(vueDecalee(844, 844)).toBe(true);
    expect(vueDecalee(843, 844)).toBe(true);
  });
  it("laisse tranquille une webview posée sous la barre d'état (plus basse d'une barre)", () => {
    expect(vueDecalee(797, 844)).toBe(false);
    expect(vueDecalee(750, 844)).toBe(false);
  });
  it("ne déclenche rien sans valeurs exploitables", () => {
    expect(vueDecalee(0, 844)).toBe(false);
    expect(vueDecalee(844, 0)).toBe(false);
    expect(vueDecalee(NaN as any, 844)).toBe(false);
  });
});
