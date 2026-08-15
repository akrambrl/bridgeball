import { describe, it, expect } from "vitest";
import {
  moisDeLaSaison, saisonDuMois, saisonDoteeRecente, lotPourRang, rangDans,
  libellePlace, medaille, emailPlausible, normaliserCode, codeValide,
  plateformeValide, enseigneValide, souhaitDuRang, manques,
  instagramValide, normaliserInstagram,
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

describe("le podium", () => {
  // Une saison est réclamable quand elle est CLOSE (ligne dans bb_seasons) ET
  // dotée (lignes dans bb_lots). Les deux, jamais l'une sans l'autre.
  const saisons = [{ season_number: 6 }, { season_number: 5 }];
  const lots = [
    { season_number: 6, rang: 1, intitule: "FC 27 Ultimate" },
    { season_number: 6, rang: 2, intitule: "Carte cadeau 50 €" },
    { season_number: 6, rang: 3, intitule: "Carte cadeau 30 €" },
  ];

  it("trouve la saison close et dotée", () => {
    expect(saisonDoteeRecente(saisons, lots)).toBe(6);
  });

  // LE contrôle qui empêche le pire travers : sans lui, le joueur en tête le
  // 12 septembre verrait « réclamer ton lot » alors que le mois n'est pas fini.
  it("une saison dotée mais PAS close n'est pas réclamable", () => {
    expect(saisonDoteeRecente([{ season_number: 5 }], lots)).toBeNull();
  });

  it("la plus récente quand deux saisons sont dotées", () => {
    const l2 = [...lots, { season_number: 3, rang: 1, intitule: "un maillot" }];
    expect(saisonDoteeRecente([{ season_number: 6 }, { season_number: 3 }], l2)).toBe(6);
  });

  it("les trois places ont un lot, la quatrième non", () => {
    expect(lotPourRang(lots, 6, 1)!.intitule).toBe("FC 27 Ultimate");
    expect(lotPourRang(lots, 6, 2)!.intitule).toBe("Carte cadeau 50 €");
    expect(lotPourRang(lots, 6, 3)!.intitule).toBe("Carte cadeau 30 €");
    expect(lotPourRang(lots, 6, 4)).toBeNull();
  });

  it("le lot porte le mois de sa saison", () => {
    expect(lotPourRang(lots, 6, 1)!.mois).toBe("2026-09");
  });

  it("ne casse pas sur des entrées absentes", () => {
    expect(saisonDoteeRecente(null as any, lots)).toBeNull();
    expect(saisonDoteeRecente(saisons, null as any)).toBeNull();
    expect(saisonDoteeRecente([null as any], lots)).toBeNull();
    expect(lotPourRang(lots, 6, 0)).toBeNull();
    expect(lotPourRang(lots, 6, 1.5)).toBeNull();
    expect(lotPourRang(null as any, 6, 1)).toBeNull();
  });
});

describe("rangDans", () => {
  const classement = [
    { player_id: "b", pseudo: "bea",  points: 900, jours: 10 },
    { player_id: "a", pseudo: "ali",  points: 1200, jours: 12 },
    { player_id: "c", pseudo: "caro", points: 900, jours: 14 },
  ];

  // On REtrie plutôt que de faire confiance à l'ordre reçu : PostgREST peut
  // réordonner une réponse, et un rang lu sur un tableau supposé trié est un
  // rang faux qui a l'air juste.
  it("classe par points, puis par jours, malgré l'ordre reçu", () => {
    expect(rangDans(classement, "a")).toBe(1);
    expect(rangDans(classement, "c")).toBe(2);   // même points que b, plus de jours
    expect(rangDans(classement, "b")).toBe(3);
  });

  it("départage à égalité parfaite par l'ordre alphabétique du pseudo", () => {
    const ex = [
      { player_id: "z", pseudo: "zoe", points: 500, jours: 5 },
      { player_id: "a", pseudo: "ana", points: 500, jours: 5 },
    ];
    expect(rangDans(ex, "a")).toBe(1);
    expect(rangDans(ex, "z")).toBe(2);
  });

  it("rend null pour qui n'est pas classé", () => {
    expect(rangDans(classement, "inconnu")).toBeNull();
    expect(rangDans(null as any, "a")).toBeNull();
    expect(rangDans(classement, "")).toBeNull();
  });
});

describe("libellés du podium", () => {
  it("nomme les trois places dans les six langues", () => {
    expect(libellePlace(1, "fr")).toBe("1ʳᵉ place");
    expect(libellePlace(2, "en")).toBe("2nd place");
    expect(libellePlace(3, "es")).toBe("3er puesto");
  });
  it("ne nomme rien au-delà du podium", () => {
    expect(libellePlace(4, "fr")).toBe("");
    expect(medaille(4)).toBe("");
  });
  it("retombe sur l'anglais pour une langue inconnue", () => {
    expect(libellePlace(1, "nl")).toBe("1st place");
  });
  it("les médailles", () => {
    expect([medaille(1), medaille(2), medaille(3)]).toEqual(["🥇", "🥈", "🥉"]);
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
  const bon = { code: "GOATFC-AAAA-BBBB", email: "a@b.fr", instagram: "toto",
                plateforme: "ps5", autorisation: true };
  it("ne signale rien quand tout est là", () => {
    expect(manques(bon, 1)).toEqual([]);
  });
  // Rendre la LISTE et non un booléen : un écran qui dit « formulaire invalide »
  // sans dire quoi fait recommencer à l'aveugle.
  it("nomme chaque manque", () => {
    expect(manques({ ...bon, code: "x" }, 1)).toEqual(["code"]);
    expect(manques({ ...bon, email: "x" }, 1)).toEqual(["email"]);
    expect(manques({ ...bon, plateforme: "gameboy" }, 1)).toEqual(["plateforme"]);
    expect(manques({ ...bon, autorisation: false }, 1)).toEqual(["autorisation"]);
    expect(manques({ ...bon, instagram: "" }, 1)).toEqual(["instagram"]);
    expect(manques({ code: "", email: "", instagram: "", plateforme: "", autorisation: false }, 1))
      .toEqual(["code", "email", "instagram", "plateforme", "autorisation"]);
  });

  // ── LE CHAMP CHANGE DE NATURE SELON LA PLACE ────────────────────────────
  // Le premier reçoit un JEU : liste fermée de plateformes. Les deuxième et
  // troisième reçoivent une CARTE CADEAU de l'enseigne de leur choix — leur
  // proposer « PlayStation / Xbox / PC » n'aurait aucun sens, et une liste
  // d'enseignes serait forcément incomplète.
  it("le 1er choisit une plateforme, les autres une enseigne", () => {
    expect(souhaitDuRang(1)).toBe("plateforme");
    expect(souhaitDuRang(2)).toBe("enseigne");
    expect(souhaitDuRang(3)).toBe("enseigne");
  });
  it("une enseigne libre est acceptée pour le 2e et le 3e", () => {
    expect(manques({ ...bon, plateforme: "Amazon" }, 2)).toEqual([]);
    expect(manques({ ...bon, plateforme: "Fnac" }, 3)).toEqual([]);
    // …mais pas vide, et pas une seule lettre.
    expect(manques({ ...bon, plateforme: "" }, 2)).toEqual(["enseigne"]);
    expect(manques({ ...bon, plateforme: "A" }, 2)).toEqual(["enseigne"]);
  });
  it("une plateforme du menu ne suffit PAS à valider une enseigne vide", () => {
    expect(enseigneValide("")).toBe(false);
    expect(enseigneValide("  ")).toBe(false);
    expect(enseigneValide("Steam")).toBe(true);
    expect(enseigneValide("x".repeat(61))).toBe(false);
  });
  // ── LE COMPTE INSTAGRAM ─────────────────────────────────────────────────
  // Le règlement conditionne la remise à trois actions sur Instagram, et un
  // compte GOAT FC est anonyme : ce pseudo est le SEUL lien possible entre le
  // gagnant et son abonnement, son commentaire et sa story. Sans lui la
  // condition serait décorative — annoncée, jamais applicable.
  it("le compte Instagram est obligatoire, quel que soit le rang", () => {
    for (const rang of [1, 2, 3]) {
      expect(manques({ ...bon, plateforme: rang === 1 ? "ps5" : "Fnac", instagram: "" }, rang))
        .toContain("instagram");
    }
  });
  it("accepte la forme qu'Instagram s'impose, arobase optionnelle", () => {
    for (const v of ["toto", "@toto", "to.to_99", "a", "x".repeat(30)])
      expect(instagramValide(v)).toBe(true);
    for (const v of ["", "  ", "a b", "toto!", "x".repeat(31), "@@toto"])
      expect(instagramValide(v)).toBe(false);
  });
  it("range le pseudo sans arobase — « @toto » et « toto » sont le même compte", () => {
    expect(normaliserInstagram("  @Toto.99 ")).toBe("Toto.99");
    expect(normaliserInstagram("Toto.99")).toBe("Toto.99");
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
