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
