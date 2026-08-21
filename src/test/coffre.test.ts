// LE COFFRE NE DOIT JAMAIS CASSER L'APP
//
// La sauvegarde invisible du code de récupération repose sur du natif — Trousseau
// iCloud, Block Store — qu'aucun test JS ne peut exercer. Ce qu'on PEUT et DOIT
// tenir ici, c'est l'invariant de la façade : hors coque native, ou quand le
// greffon n'est pas là, tout retombe en silence sur « rien », et l'app se
// comporte exactement comme avant ce fichier. C'est ce qui garantit que le
// coffre ne peut qu'ajouter une récupération, jamais en retirer une — et que le
// build de sortie ne peut pas être mis en danger par une erreur côté greffon.
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── POURQUOI ON RÉIMPORTE LE MODULE À CHAQUE FOIS ─────────────────────────
//
// src/test/setup.ts charge l'app, donc LePont, donc coffre.ts — AVANT tout mock.
// Le module est alors mis en cache avec le vrai @capacitor/core, et un simple
// vi.mock + import rendrait cette copie déjà évaluée : `registerPlugin("Coffre")`
// aurait tourné sur le vrai Capacitor, et le mock n'y changerait rien. C'est le
// piège qui a fait échouer la première version de ce test.
//
// D'où `vi.resetModules()` puis `vi.doMock()` puis un `import()` FRAIS dans
// chaque helper : le coffre est reconstruit sur le mock à chaque cas.
async function charger(opts: { natif: boolean; reponse?: unknown; leve?: boolean }) {
  const appels: string[] = [];
  vi.resetModules();
  vi.doMock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => opts.natif },
    registerPlugin: () =>
      new Proxy({}, {
        get(_t, methode: string) {
          return () => {
            appels.push(methode);
            if (opts.leve) return Promise.reject(new Error(methode + " not implemented"));
            if (methode === "lire") return Promise.resolve({ code: opts.reponse });
            return Promise.resolve();
          };
        },
      }),
  }));
  const mod = await import("../lib/coffre");
  return { mod, appels };
}

beforeEach(() => { vi.resetModules(); });

describe("le coffre, sans implémentation native", () => {
  it("sur le web, ne touche même pas au greffon", async () => {
    const { mod, appels } = await charger({ natif: false });
    await mod.coffreSauver("GOATFC-ABCD-1234");
    expect(await mod.coffreLire()).toBeNull();
    await mod.coffreEffacer();
    // Aucune méthode du greffon n'a été appelée : on court-circuite avant.
    expect(appels).toEqual([]);
  });

  it("dans la coque, un greffon absent est rattrapé et ne lève pas", async () => {
    const { mod, appels } = await charger({ natif: true, leve: true });
    // Le mandataire lève ; la façade doit avaler et rendre des valeurs sûres.
    await expect(mod.coffreSauver("GOATFC-ABCD-1234")).resolves.toBeUndefined();
    await expect(mod.coffreLire()).resolves.toBeNull();
    await expect(mod.coffreEffacer()).resolves.toBeUndefined();
    // On a BIEN tenté le natif cette fois — c'est la différence avec le web.
    expect(appels).toContain("sauver");
    expect(appels).toContain("lire");
    expect(appels).toContain("effacer");
  });

  it("ne sauve pas un code vide", async () => {
    const { mod, appels } = await charger({ natif: true });
    await mod.coffreSauver("");
    expect(appels).not.toContain("sauver");
  });
});

describe("le coffre valide la forme avant de rendre un code", () => {
  // Un coffre corrompu ou d'une autre version ne doit pas partir en récupération.
  const lire = async (valeur: unknown) =>
    (await charger({ natif: true, reponse: valeur })).mod.coffreLire();

  it("accepte un code bien formé", async () => {
    expect(await lire("GOATFC-ABCD-1234")).toBe("GOATFC-ABCD-1234");
  });

  it("normalise la casse et les espaces", async () => {
    expect(await lire("  goatfc-abcd-1234  ")).toBe("GOATFC-ABCD-1234");
  });

  it("rejette une valeur mal formée", async () => {
    expect(await lire("bonjour")).toBeNull();
    expect(await lire("")).toBeNull();
    expect(await lire(null)).toBeNull();
    expect(await lire(42)).toBeNull();
    // Un préfixe seul, sans les deux groupes : la forme complète est exigée.
    expect(await lire("GOATFC-ABCD")).toBeNull();
  });
});
