import { describe, it, expect } from "vitest";
import {
  moisDeLaSaison, saisonDuMois, lotAReclamer, emailPlausible,
  normaliserCode, codeValide, plateformeValide, manques,
  tirerCode, ALPHABET_CODE, MOTIF_CODE,
} from "../lib/reclamation";

describe("moisDeLaSaison", () => {
  it("la saison 1 est avril 2026", () => {
    expect(moisDeLaSaison(1)).toBe("2026-04");
  });

  // Le point qui compte pour le concours : septembre 2026 doit être la saison 6,
  // parce que c'est ce numéro qui est inscrit dans bb_lots. Une erreur d'un
  // rang ici, et le gagnant de septembre ne verrait jamais son bouton.
  it("septembre 2026 est la saison 6", () => {
    expect(moisDeLaSaison(6)).toBe("2026-09");
    expect(saisonDuMois("2026-09")).toBe(6);
  });

  it("passe l'année sans se décaler", () => {
    expect(moisDeLaSaison(9)).toBe("2026-12");
    expect(moisDeLaSaison(10)).toBe("2027-01");
    expect(moisDeLaSaison(22)).toBe("2028-01");
  });

  it("aller-retour sur trois ans", () => {
    for (let n = 1; n <= 36; n++) expect(saisonDuMois(moisDeLaSaison(n)!)).toBe(n);
  });

  it("refuse ce qui n'est pas une saison", () => {
    expect(moisDeLaSaison(0)).toBeNull();
    expect(moisDeLaSaison(-3)).toBeNull();
    expect(moisDeLaSaison(1.5)).toBeNull();
    expect(saisonDuMois("bidon")).toBeNull();
    expect(saisonDuMois("2026-3")).toBeNull();
  });
});

describe("lotAReclamer", () => {
  const saisons = [
    { season_number: 6, champion_id: "p1", champion_name: "akram2", champion_score: 4200 },
    { season_number: 5, champion_id: "p2", champion_name: "badbr2", champion_score: 3900 },
  ];
  const lots = [{ season_number: 6, intitule: "EA SPORTS FC 27" }];

  it("le champion du mois doté a un lot", () => {
    const r = lotAReclamer("p1", saisons, lots);
    expect(r).toMatchObject({ saison: 6, mois: "2026-09", intitule: "EA SPORTS FC 27" });
  });

  // LE contrôle qui évite le pire travers : sans lui, dès la deuxième saison
  // tous les anciens champions verraient un bouton « réclamer » qui ne mène
  // nulle part — et on ne peut pas retirer une promesse déjà affichée.
  it("le champion d'un mois SANS lot n'a rien à réclamer", () => {
    expect(lotAReclamer("p2", saisons, lots)).toBeNull();
  });

  it("un joueur qui n'a rien gagné n'a rien à réclamer", () => {
    expect(lotAReclamer("p9", saisons, lots)).toBeNull();
  });

  it("si deux mois ont porté un lot, c'est le plus récent qui est proposé", () => {
    const s = [
      { season_number: 6, champion_id: "p1", champion_name: "a" },
      { season_number: 3, champion_id: "p1", champion_name: "a" },
    ];
    const l = [{ season_number: 6, intitule: "FC 27" }, { season_number: 3, intitule: "un maillot" }];
    expect(lotAReclamer("p1", s, l)!.saison).toBe(6);
  });

  it("ne casse pas sur des entrées absentes", () => {
    expect(lotAReclamer("", saisons, lots)).toBeNull();
    expect(lotAReclamer("p1", null as any, lots)).toBeNull();
    expect(lotAReclamer("p1", saisons, null as any)).toBeNull();
    expect(lotAReclamer("p1", [null as any, undefined as any], lots)).toBeNull();
  });
});

describe("emailPlausible", () => {
  it("accepte ce qui peut recevoir un message", () => {
    for (const v of ["a@b.fr", "akram.bourhila@projectxparis.fr", "x+tag@sous.domaine.co.uk"])
      expect(emailPlausible(v)).toBe(true);
  });

  // Une adresse collée depuis un mail arrive presque toujours avec une espace
  // au bout. C'est ce cas précis qui a fait échouer la première version de la
  // fonction SQL, qui validait avant de nettoyer.
  it("tolère les espaces autour", () => {
    expect(emailPlausible("  akram@exemple.fr ")).toBe(true);
  });

  it("écarte ce qui ne peut manifestement pas aboutir", () => {
    for (const v of ["", "pas-une-adresse", "a@b", "a@@b.fr", "a b@c.fr", "@b.fr", "a@.fr",
                     "a@b..fr", "a@b.", "a@b.f"])
      expect(emailPlausible(v)).toBe(false);
  });

  it("écarte les longueurs absurdes", () => {
    expect(emailPlausible("a".repeat(65) + "@b.fr")).toBe(false);
    expect(emailPlausible("a@" + "b".repeat(300) + ".fr")).toBe(false);
  });
});

describe("le code", () => {
  it("normalise ce qui est tapé à la main", () => {
    expect(normaliserCode("  goatfc-aaaa-bbbb ")).toBe("GOATFC-AAAA-BBBB");
    expect(normaliserCode("goatfc-aaaa-bbbb")).toBe("GOATFC-AAAA-BBBB");
  });
  it("reconnaît le format, et lui seul", () => {
    expect(codeValide("goatfc-a2c4-9xyz")).toBe(true);
    expect(codeValide("GOATFC-AAAA")).toBe(false);
    expect(codeValide("AAAA-BBBB")).toBe(false);
    expect(codeValide("")).toBe(false);
  });
});

describe("manques", () => {
  const bon = { code: "GOATFC-AAAA-BBBB", email: "a@b.fr", plateforme: "ps5", autorisation: true };
  it("ne signale rien quand tout est là", () => {
    expect(manques(bon)).toEqual([]);
  });
  // Rendre la LISTE et non un booléen : un écran qui dit « formulaire invalide »
  // sans dire quoi fait recommencer à l'aveugle.
  it("nomme chaque manque", () => {
    expect(manques({ ...bon, code: "x" })).toEqual(["code"]);
    expect(manques({ ...bon, email: "x" })).toEqual(["email"]);
    expect(manques({ ...bon, plateforme: "gameboy" })).toEqual(["plateforme"]);
    expect(manques({ ...bon, autorisation: false })).toEqual(["autorisation"]);
    expect(manques({ code: "", email: "", plateforme: "", autorisation: false }))
      .toEqual(["code", "email", "plateforme", "autorisation"]);
  });
  it("la plateforme doit être une de celles proposées", () => {
    expect(plateformeValide("ps5")).toBe(true);
    expect(plateformeValide("autre")).toBe(true);
    expect(plateformeValide("nintendo64")).toBe(false);
  });
});

describe("tirerCode", () => {
  it("rend toujours le format attendu", () => {
    for (let i = 0; i < 200; i++) expect(MOTIF_CODE.test(tirerCode())).toBe(true);
  });

  it("n'emploie que l'alphabet non ambigu", () => {
    const vus = new Set<string>();
    for (let i = 0; i < 500; i++)
      for (const c of tirerCode().replace(/^GOATFC-/, "").replace("-", "")) vus.add(c);
    for (const c of vus) expect(ALPHABET_CODE).toContain(c);
    // Les caractères qu'on se refuse : 0/O et 1/I/L, illisibles recopiés à la main.
    for (const interdit of ["0", "1", "I", "L", "O"]) expect(vus.has(interdit)).toBe(false);
  });

  // ── LE CONTRÔLE QUI JUSTIFIE LE REJET ────────────────────────────────────
  //
  // 256 n'est pas un multiple de 31. Un simple `octet % 31` rendrait les huit
  // premières lettres de l'alphabet plus probables que les autres — 9 chances
  // sur 256 contre 8, soit 12 % de biais, donc autant d'entropie perdue sur un
  // code qui garde un lot.
  //
  // Le rejet écarte les octets ≥ 248 (le plus grand multiple de 31 sous 256).
  // On le vérifie EXACTEMENT, avec une source choisie, plutôt que
  // statistiquement : une première version de ce test injectait une source
  // « parfaitement uniforme » cyclique 0…255 et attendait une sortie plate.
  // Elle ne l'était pas — non par biais du tirage, mais parce qu'une suite
  // cyclique n'est pas de l'aléa : combinée au découpage par lots de 16 octets,
  // elle retombe toujours sur les mêmes résidus. L'instrument mesurait son
  // propre motif. Un contrôle exact ne peut pas se tromper ainsi.
  it("écarte les octets qui biaiseraient le tirage", () => {
    // Les huit premiers octets sont TOUS dans la zone de rejet : s'ils étaient
    // pris modulo 31, ils donneraient les lettres d'indices 248%31=0 … 255%31=7,
    // soit précisément les huit premières. Ils doivent être ignorés, et le code
    // se construire sur les huit suivants.
    const choisie = () => Uint8Array.from([248, 249, 250, 251, 252, 253, 254, 255,
                                           0, 1, 2, 3, 4, 5, 6, 7]);
    const code = tirerCode(choisie);
    const attendu = "GOATFC-" + ALPHABET_CODE.slice(0, 4) + "-" + ALPHABET_CODE.slice(4, 8);
    expect(code).toBe(attendu);
  });

  it("consomme un nouveau lot quand le premier est presque tout rejeté", () => {
    let appel = 0;
    const source = () => {
      appel++;
      // Premier lot : quinze octets rejetés, un seul valide (30 → dernière lettre).
      if (appel === 1) return Uint8Array.from([...Array(15).fill(255), 30]);
      return Uint8Array.from(Array(16).fill(0));
    };
    const code = tirerCode(source);
    expect(appel).toBeGreaterThan(1);
    expect(code).toBe("GOATFC-" + ALPHABET_CODE[30] + "AAA-AAAA");
    expect(MOTIF_CODE.test(code)).toBe(true);
  });

  it("les 31 lettres sortent toutes avec la vraie source", () => {
    const vus = new Set<string>();
    for (let i = 0; i < 3000; i++)
      for (const c of tirerCode().replace(/^GOATFC-/, "").replace("-", "")) vus.add(c);
    expect(vus.size).toBe(ALPHABET_CODE.length);
  });

  it("ne se répète pas", () => {
    const vus = new Set<string>();
    for (let i = 0; i < 1000; i++) vus.add(tirerCode());
    expect(vus.size).toBe(1000);
  });
});
