import { describe, it, expect } from "vitest";
import { PLAYERS, GG_WC_WINNERS, GG_CL_WINNERS } from "@/players.jsx";

// Les 29 signalements « gg_missed » de bb_reports disaient tous la même chose :
// « ce joueur devrait passer sur cette case de la grille ». Après vérification
// une par une sur fr.wikipedia, 12 étaient fondés. Ce test les fige : ils
// tombaient tous sur un trou de données (palmarès borné à l'an 2000, poste
// erroné, club manquant), pas sur la logique de la grille.
//
// Les revendications INFONDÉES sont volontairement figées elles aussi, en
// négatif : re-remplir GG_CL_WINNERS avec un coup de filet trop large les
// ferait passer, et on repartirait dans l'autre sens (Kompany n'a jamais gagné
// la C1, Luis Enrique l'a gagnée comme entraîneur, pas comme joueur).

const parNom = new Map<string, any>((PLAYERS as any[]).map((p) => [p.name, p]));
const j = (nom: string) => {
  const p = parNom.get(nom);
  if (!p) throw new Error("absent de la base : " + nom);
  return p;
};

describe("signalements fondés sur la grille (bb_reports)", () => {
  it("Vainqueur LDC ne s'arrête plus à l'an 2000", () => {
    // OM 1993 (#50, #51, #53) et Bayern 1974-76 (#40)
    for (const n of ["Didier Deschamps", "Marcel Desailly", "Basile Boli", "Franz Beckenbauer"]) {
      expect(GG_CL_WINNERS.has(n), n).toBe(true);
    }
  });

  it("Vainqueur LDC couvre la finale 2026", () => {
    // Le set était découpé finale par finale et s'arrêtait à PSG 2025.
    for (const n of ["Lucas Chevalier", "Renato Marin", "Ibrahim Mbaye"]) {
      expect(GG_CL_WINNERS.has(n), n).toBe(true);
    }
  });

  it("Vainqueur CDM couvre les sacres d'avant 1994", () => {
    // #35 Baresi (Italie 82), #55 Pires (France 98, oublié de la liste 98)
    for (const n of ["Franco Baresi", "Robert Pires", "Gerd Müller", "Pelé", "Geoff Hurst"]) {
      expect(GG_WC_WINNERS.has(n), n).toBe(true);
    }
  });

  it("corrige les postes signalés", () => {
    expect(j("Roy Keane").positions).toContain("milieu");           // #52
    expect(j("Demetrio Albertini").positions).toContain("milieu");  // #57
    expect(j("Alejandro Garnacho").positions).toContain("attaquant"); // #58
  });

  it("corrige les clubs signalés sur THE MERCATO", () => {
    expect(j("Abdallah Sima").clubs).toContain("Brest");     // #56, prêt 2024-25
    expect(j("Djibril Sidibé").clubs).toContain("Toulouse"); // #47, depuis 2024
    // Bordeaux figurait dans sa fiche alors qu'il n'y a jamais joué.
    expect(j("Djibril Sidibé").clubs).not.toContain("Bordeaux");
  });
});

describe("signalements infondés (à ne pas satisfaire)", () => {
  it("ne fait pas de gagnants de LDC ceux qui ne l'ont pas gagnée", () => {
    for (const n of ["Vincent Kompany", "Luis Enrique", "Randal Kolo Muani"]) {
      expect(GG_CL_WINNERS.has(n), n).toBe(false);
    }
  });

  it("n'ajoute pas les clubs revendiqués à tort", () => {
    expect(j("Uwe Seeler").clubs).not.toContain("Manchester City");
    expect(j("Thomas Lemar").clubs).not.toContain("Manchester United");
    expect(j("Just Fontaine").clubs).not.toContain("Real Madrid");
    expect(j("Samuele Birindelli").clubs).not.toContain("Juventus FC");
    expect(j("Andreas Möller").clubs).not.toContain("AC Milan");
  });

  it("garde les postes et nationalités réels", () => {
    expect(j("Fran García").positions).toEqual(["defenseur"]);
    expect(j("Roque Santa Cruz").nationalities).not.toContain("Brésil");
    expect(j("André Gomes").nationalities).not.toContain("Brésil");
  });
});

// ── Passe du 30 septembre 2026 : bb_reports #215 à #256 ──────────────────────
// 42 signalements, 8 fondés. Chaque fait a été recoupé sur le web à la date du
// jour (transferts d'été 2026 compris) : voir docs/reports-journal.md.
describe("signalements #215-#256 fondés", () => {
  it("Vainqueur LDC : Di Stéfano (#216) et Danilo (#219)", () => {
    expect(GG_CL_WINNERS.has("Alfredo Di Stéfano")).toBe(true);
    expect(GG_CL_WINNERS.has("Danilo Luiz")).toBe(true);
  });

  it("Danilo (né en 1991) existe, distinct de l'attaquant de 2001 (#219)", () => {
    const d = j("Danilo Luiz");
    expect(d.clubs).toContain("Real Madrid");
    expect(d.clubs).toContain("Manchester City");
    expect(d.birthYear).toBe(1991);
    expect(j("Danilo").clubs).not.toContain("Real Madrid");
  });

  it("transferts de l'été 2026 : Savinho (#221, #256), Mendy (#234), Amoura (#236)", () => {
    expect(j("Savinho").clubs).toContain("Tottenham");
    expect(j("Nampalys Mendy").clubs).toContain("Metz");
    expect(j("Mohamed Amoura").clubs).toContain("Nice");
  });

  it("le club le plus récent reste en dernier (colonne CLUB de GOAT Reveal)", () => {
    expect(j("Savinho").clubs.at(-1)).toBe("Tottenham");
    expect(j("Nampalys Mendy").clubs.at(-1)).toBe("Metz");
    expect(j("Mohamed Amoura").clubs.at(-1)).toBe("Nice");
    expect(j("Benjamin Pavard").clubs.at(-1)).toBe("Inter Milan");
  });
});

describe("signalements #215-#256 infondés (à ne pas satisfaire)", () => {
  it("ne fait pas champions du monde ceux qui ne le sont pas (#215, #226, #227, #248, #255)", () => {
    for (const n of ["Dimitri Payet", "Mattéo Guendouzi", "Kingsley Coman", "Cristiano Ronaldo", "Paolo Maldini"]) {
      expect(GG_WC_WINNERS.has(n), n).toBe(false);
    }
  });

  it("ne fait pas vainqueurs de LDC Asencio (#217) ni Griezmann (#229)", () => {
    // Asencio : premier match pro en novembre 2024, la LDC 2024 n'est pas la sienne.
    for (const n of ["Raúl Asencio", "Antoine Griezmann"]) {
      expect(GG_CL_WINNERS.has(n), n).toBe(false);
    }
  });

  it("n'ajoute pas les clubs revendiqués à tort (#218, #220, #243, #247)", () => {
    expect(j("Jesús Navas").clubs).not.toContain("Real Madrid");
    expect(j("Matías Dituro").clubs).not.toContain("Inter Milan");
    expect(j("Jens Odgaard").clubs).not.toContain("Arsenal"); // confondu avec Ødegaard
    expect(j("Nicolás Tagliafico").clubs).not.toContain("Chelsea");
  });

  it("Marseille × Nottingham Forest (#238) : les quatre joueurs y sont bien passés", () => {
    for (const n of ["Nuno Tavares", "Renan Lodi", "Brice Samba", "André Ayew"]) {
      const c = j(n).clubs;
      expect(c, n).toContain("Marseille");
      expect(c, n).toContain("Nottingham Forest");
    }
  });

  it("garde les postes et nationalités réels (#222, #223, #232, #239, #244)", () => {
    expect(j("Ismael Saibari").positions).toEqual(["milieu"]);
    expect(j("Kingsley Coman").positions).toEqual(["attaquant"]);
    expect(j("Brahim Díaz").positions).toEqual(["milieu"]);
    expect(j("Samuel Chukwueze").nationalities).not.toContain("Angleterre");
    expect(j("Sergiño Dest").nationalities).not.toContain("Pays-Bas");
  });
});
