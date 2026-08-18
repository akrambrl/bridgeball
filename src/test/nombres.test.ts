// LES GRANDS NOMBRES DU CLASSEMENT, ET POURQUOI ILS SE TESTENT
//
// « 33798 pts » était un mur de chiffres, sur le seul chiffre qui dise qui gagne
// le mois. Mais le formatage qui existait ailleurs était pire qu'absent, parce
// qu'il était incohérent de trois façons :
//
//   • `toLocaleString()` SANS argument suit la langue du NAVIGATEUR, pas celle
//     choisie dans l'app : un téléphone en anglais affichait « 120,000 XP » au
//     milieu d'une interface française. Constaté sur capture d'écran ;
//   • `toLocaleString("fr-FR")` forcé mettait des espaces à la française dans
//     les six langues, y compris en anglais où la virgule est la règle ;
//   • le bandeau de l'accueil formatait par langue, mais en `pt-BR` — qui groupe
//     avec un point — alors que le drapeau du sélecteur est 🇵🇹.
//
// Ce test fige les six séparateurs. Il n'est pas décoratif : le jour où
// quelqu'un ajoute une langue ou « simplifie » en repassant à un seul locale,
// c'est ici que ça se voit, et pas sur le téléphone d'un joueur allemand.
import { describe, it, expect } from "vitest";
import { formatNombre } from "../lib/lang";

describe("formatNombre", () => {
  it("groupe avec le séparateur de chaque langue", () => {
    // Les séparateurs sont comparés par leur POINT DE CODE, jamais par un
    // littéral : trois des six sont des espaces invisibles et indiscernables
    // dans un fichier source (U+202F, U+00A0, U+0020). Une assertion écrite en
    // littéral serait donc illisible, et un copier-coller qui remplace l'une par
    // l'autre passerait sans que personne ne le voie.
    //
    // Les valeurs sont MESURÉES sur l'ICU de Node, pas recopiées de mémoire.
    const ATTENDU: Record<string, number> = {
      fr: 0x202f, // NARROW NO-BREAK SPACE  → 33 798
      en: 0x002c, // VIRGULE                → 33,798
      de: 0x002e, // POINT                  → 33.798
      it: 0x002e, // POINT                  → 33.798
      pt: 0x00a0, // NO-BREAK SPACE         → 33 798
      es: 0x002e, // POINT                  → 33.798
    };
    for (const [langue, point] of Object.entries(ATTENDU)) {
      const rendu = formatNombre(33798, langue as never);
      // Un seul séparateur, et le bon : on isole ce qui n'est pas un chiffre.
      const sep = rendu.replace(/\d/g, "");
      expect(sep, langue + " : « " + rendu + " »").toHaveLength(1);
      expect(sep.codePointAt(0), langue + " : « " + rendu + " »").toBe(point);
      // Et les chiffres, eux, sont intacts dans l'ordre.
      expect(rendu.replace(/\D/g, "")).toBe("33798");
    }
  });

  it("le séparateur français est INSÉCABLE", () => {
    // C'est ce qui garantit que « 33 798 pts » ne se coupe jamais en fin de
    // ligne. Une espace ordinaire (U+0020) le permettrait, et sur une ligne de
    // classement étroite le nombre se retrouverait à cheval sur deux lignes.
    //
    // Comparé au POINT DE CODE et non au caractère : U+202F et une espace
    // ordinaire sont indiscernables dans un fichier source, donc une assertion
    // écrite en littéral serait illisible — et un copier-coller qui remplace
    // l'une par l'autre passerait le test sans que personne ne le voie.
    const sep = formatNombre(1000, "fr").replace(/\d/g, "");
    expect(sep).toHaveLength(1);
    expect(sep.codePointAt(0)).toBe(0x202f); // NARROW NO-BREAK SPACE
    expect(sep.codePointAt(0)).not.toBe(0x0020); // pas l'espace ordinaire
  });

  it("le portugais suit pt-PT et non pt-BR", () => {
    // pt-BR grouperait avec un point : « 33.798 ». Le drapeau du sélecteur de
    // langue est 🇵🇹, donc c'est le Portugal, et ce test empêche la dérive.
    expect(formatNombre(33798, "pt")).not.toBe("33.798"); // ce que pt-BR rendrait
    expect(formatNombre(33798, "pt").codePointAt(2)).toBe(0x00a0); // NO-BREAK SPACE
  });

  it("l'anglais met une virgule, jamais une espace", () => {
    // La demande d'origine était « une espace, comme 33 000 ». Elle vaut pour le
    // français ; l'appliquer à l'anglais serait une faute. Ce test dit que le
    // choix est délibéré et non un oubli.
    expect(formatNombre(33000, "en")).toBe("33,000");
    // Ni espace fine, ni espace ordinaire : uniquement chiffres et virgule.
    expect(formatNombre(33000, "en")).toMatch(/^\d+,\d+$/);
  });

  it("italien, portugais et espagnol ne groupent pas à quatre chiffres", () => {
    // Ce n'est pas un défaut mais leur typographie : Intl applique
    // `minimumGroupingDigits: 2` pour ces langues. Les aligner sur le français
    // serait une faute d'orthographe dans trois langues sur six. Le test le dit,
    // pour que personne ne « corrige » ce qui est juste.
    for (const l of ["it", "pt", "es"] as const) {
      expect(formatNombre(1000, l)).toBe("1000");
      // Le groupement apparaît bien à partir de cinq chiffres.
      expect(formatNombre(10000, l)).not.toBe("10000");
    }
    // Le français et l'anglais, eux, groupent dès quatre chiffres.
    expect(formatNombre(1000, "fr").replace(/\s|\u202f/g, "_")).toBe("1_000");
    expect(formatNombre(1000, "en")).toBe("1,000");
  });

  it("les petits nombres restent nus", () => {
    // Un score de partie est souvent à trois chiffres : il ne doit rien gagner.
    for (const l of ["fr", "en", "de", "it", "pt", "es"] as const) {
      expect(formatNombre(0, l)).toBe("0");
      expect(formatNombre(950, l)).toBe("950");
    }
  });

  it("ne rend jamais NaN ni Infinity à l'écran", () => {
    // Un score absent arrive en base comme null, et `Number(null)` vaut 0 — mais
    // une division ratée en amont produirait NaN, et « NaN pts » sur une ligne de
    // classement est le genre de détail qui fait douter de tout le reste.
    expect(formatNombre(NaN, "fr")).toBe("0");
    expect(formatNombre(Infinity, "fr")).toBe("0");
    expect(formatNombre(-Infinity, "en")).toBe("0");
  });

  it("les nombres négatifs gardent leur signe", () => {
    // Le barème accepte des scores négatifs (pénalités de pass) : ils valent 0
    // point au classement, mais un record affiché ne doit pas perdre son signe.
    expect(formatNombre(-450, "fr")).toBe("-450");
  });

  it("une langue inconnue retombe sur l'anglais plutôt que de lever", () => {
    // Un `bb_lang` corrompu dans localStorage ne doit pas casser l'écran.
    expect(formatNombre(33798, "xx" as never)).toBe("33,798");
  });
});
