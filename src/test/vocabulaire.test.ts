import { describe, it, expect } from "vitest";
import { PLAYERS, RETIRED_PLAYERS } from "@/players.jsx";
import { nomPays, nomPoste, nomPosteLong, nomLigue, nomTrophee, paysConnus, MOT_ENTRAINEUR, choisir } from "@/lib/vocabulaire";

// L'app se joue en six langues, la base n'est écrite qu'en une : française.
// Une nationalité ou un poste affiché tel quel donne une interface allemande
// qui annonce « PAYS-BAS » et « MILIEU » — c'est exactement ce qui se voyait
// dans GOAT GRID. Ces tests interdisent que ça revienne par une fiche ajoutée
// avec un pays que le module ne connaît pas.

const LANGUES = ["fr", "en", "de", "it", "pt", "es"] as const;

const nationalites = new Set<string>();
for (const p of [...(PLAYERS as any[]), ...(RETIRED_PLAYERS as any[])]) {
  for (const n of p.nationalities ?? []) nationalites.add(n);
}

describe("vocabulaire foot en six langues", () => {
  it("connaît toutes les nationalités de la base", () => {
    const connus = new Set(paysConnus());
    const inconnues = [...nationalites].filter((n) => !connus.has(n)).sort();
    expect(inconnues).toEqual([]);
  });

  it("traduit vraiment les pays, il ne recopie pas le français", () => {
    // Un contre-exemple par langue suffit à prouver que la table ICU répond ;
    // si `Intl.DisplayNames` manquait, tout retomberait sur le français.
    expect(nomPays("Pays-Bas", "de")).toBe("Niederlande");
    expect(nomPays("Pays-Bas", "en")).toBe("Netherlands");
    expect(nomPays("Allemagne", "it")).toBe("Germania");
    expect(nomPays("États-Unis", "pt")).toBe("Estados Unidos");
    expect(nomPays("Espagne", "es")).toBe("España");
    expect(nomPays("Pays-Bas", "fr")).toBe("Pays-Bas");
  });

  it("écrit les nations britanniques, qui n'ont pas de code ISO", () => {
    expect(nomPays("Angleterre", "de")).toBe("England");
    expect(nomPays("Écosse", "it")).toBe("Scozia");
    expect(nomPays("Pays de Galles", "es")).toBe("Gales");
    expect(nomPays("Irlande du Nord", "pt")).toBe("Irlanda do Norte");
  });

  it("ne colle jamais d'espaces autour du tiret (Congo - Kinshasa)", () => {
    for (const l of LANGUES) expect(nomPays("RD Congo", l)).not.toMatch(/\s-\s/);
  });

  it("rend quelque chose de lisible pour un pays inconnu", () => {
    expect(nomPays("Sylvanie", "de")).toBe("Sylvanie");
    expect(nomPays("", "de")).toBe("");
  });

  it("traduit les quatre postes de la base dans les six langues", () => {
    for (const poste of ["gardien", "defenseur", "milieu", "attaquant"]) {
      for (const l of LANGUES) {
        expect(nomPoste(poste, l).length).toBeGreaterThan(2);
        expect(nomPosteLong(poste, l).length).toBeGreaterThan(2);
      }
      // Aucun poste ne doit ressortir sous sa forme de clé, en minuscules.
      expect(nomPoste(poste, "de")).not.toBe(poste);
    }
    expect(nomPoste("Défenseur", "de")).toBe("Verteidiger"); // accentué, capitale
  });

  it("couvre les postes de la base, quelle que soit leur graphie", () => {
    const postes = new Set<string>();
    for (const p of [...(PLAYERS as any[]), ...(RETIRED_PLAYERS as any[])]) {
      for (const q of p.positions ?? []) postes.add(q);
    }
    const muets = [...postes].filter((q) => nomPoste(q, "de") === q).sort();
    expect(muets).toEqual([]);
  });

  it("traduit les critères de ligne et de colonne de GOAT GRID", () => {
    for (const l of ["ligue1", "premier_league", "liga", "serie_a", "bundesliga"]) {
      for (const langue of LANGUES) expect(nomLigue(l, langue).length).toBeGreaterThan(3);
      expect(nomLigue(l, "de")).not.toBe(nomLigue(l, "fr"));
    }
    for (const t of ["world_cup", "champions_league"]) {
      expect(nomTrophee(t, "de")).not.toBe(nomTrophee(t, "fr"));
    }
    expect(choisir(MOT_ENTRAINEUR, "de")).toBe("Wurde Trainer");
  });

  it("retombe sur l'anglais pour une langue non prévue, jamais sur du vide", () => {
    expect(nomPoste("milieu", "nl" as any)).toBe("Midfielder");
    expect(nomLigue("liga", "nl" as any)).toBe("Played in Liga");
  });
});
