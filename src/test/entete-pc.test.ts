// SUR ORDINATEUR, LE PROFIL S'AFFICHAIT SANS QU'ON PUISSE L'OUVRIR
//
// L'en-tête de la landing montrait un bloc « pseudo + grade » en haut à droite.
// Trois choses n'allaient pas, et les trois étaient invisibles pour qui lit le
// code sans cliquer :
//
//   1. CE N'ÉTAIT PAS UN BOUTON. Un <div> sans gestionnaire de clic, sans
//      curseur, sans focus clavier. La collection de cartes — vingt-neuf
//      paliers, toute la récompense de la progression — n'était donc atteignable
//      par AUCUN chemin sur ordinateur.
//
//   2. « LVL 1 » ÉTAIT ÉCRIT EN DUR. GOAT FC n'a pas de numéro de niveau : le
//      grade est la CARTE atteinte (`levelCard(xp)`), et c'est ce que montrent
//      le mobile, le classement et l'écran de duel. Un joueur à 61 000 XP lisait
//      « LVL 1 ». Une valeur fausse pour tout le monde, tout le temps.
//
//   3. LA PHOTO ÉTAIT UNE INITIALE. La carte de niveau EST la photo de profil
//      partout ailleurs. Le rond avec une lettre était le repli d'avant les
//      cartes, resté seul sur le chemin desktop.
//
// Le premier point a un corollaire qui vaut son propre contrôle : `profile` est
// un écran de LePont, or LePont ne rend l'accueil que sous 768 px. Ouvrir le
// profil depuis la landing sans l'inscrire dans l'effet « rendre la main à la
// landing » laissait, à la fermeture, l'accueil MOBILE étalé sur un écran
// d'ordinateur. Le dépôt connaît déjà ce défaut, pour la feuille « Choisis ton
// mode » — le commentaire de LePont.jsx le raconte.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { levelCard, hasArt, cardName, CARDS } from "../lib/collection";

const RACINE = process.cwd();
const entete = readFileSync(join(RACINE, "src/components/landing/LobbyHeader.tsx"), "utf8");
/** Le code sans ses commentaires. Le fichier RACONTE le défaut corrigé, donc une
 *  recherche naïve de « LVL 1 » se trouve elle-même dans la documentation —
 *  c'est arrivé à l'écriture de ce test, et c'est le même piège qu'à
 *  lien-invitation.test.ts. */
const enteteCode = entete
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join("\n");
const home = readFileSync(join(RACINE, "src/pages/Home.tsx"), "utf8");
const lePont = readFileSync(join(RACINE, "src/components/LePont.jsx"), "utf8");

describe("l'en-tête d'ordinateur", () => {
  it("n'écrit aucun niveau en dur", () => {
    // La forme exacte du défaut. On refuse « LVL » sous toutes ses casses : il
    // n'existe aucun numéro de niveau dans ce jeu, donc aucune raison d'en
    // écrire un.
    expect(
      /LVL\s*\d/i.test(enteteCode),
      "un niveau écrit en dur : le grade se lit avec levelCard(xp), pas avec un nombre fixe",
    ).toBe(false);
  });

  it("ouvre le profil au clic", () => {
    // Le bloc doit être un vrai bouton, avec l'appel qui monte l'écran. Un
    // <div onClick> passerait ce test à moitié — d'où les deux assertions.
    expect(entete, "le bloc de profil doit être un <button>").toMatch(/<button[\s\S]{0,400}onClick=\{onOpenProfile\}/);
    expect(entete, "sans aria-label, le bouton n'annonce rien au clavier").toMatch(/aria-label=\{tr\(\s*"Voir mon profil/);
  });

  it("affiche la carte de niveau, pas une initiale seule", () => {
    // L'initiale reste comme REPLI — un visiteur qui n'a jamais joué n'a pas de
    // carte — mais la carte doit exister comme premier choix.
    expect(entete).toContain("levelCard(");
    expect(entete).toMatch(/carte\s*&&\s*hasArt\(carte\)/);
    // Le cadre de rareté, comme dans la collection et sur l'écran de profil.
    expect(entete).toContain("meta!.frame");
  });

  it("ne montre pas un grade qu'il ne connaît pas encore", () => {
    // L'XP arrive par le réseau. Afficher « La Recrue » en attendant serait
    // pire que de n'afficher rien : un joueur avancé verrait sa carte de départ,
    // donc une information FAUSSE au lieu d'une information absente.
    expect(entete).toMatch(/useState<number \| null>\(null\)/);
    expect(entete).toMatch(/xp === null \? null : levelCard\(xp\)/);
  });
});

describe("le chemin vers le profil, sur ordinateur", () => {
  // Le profil d'ordinateur n'est PLUS l'écran mobile de LePont monté en colonne
  // (« il s'affichait mal »). C'est désormais ProfileView, une vraie page large.
  it("la landing ouvre la page profil d'ordinateur (ProfileView)", () => {
    expect(home, "ProfileView doit être importé").toMatch(/import \{ ProfileView \} from/);
    expect(home, "onOpenProfile doit être passé à l'en-tête").toMatch(/onOpenProfile=\{onOpenProfile\}/);
    expect(home, "le clic profil ouvre ProfileView, pas LePont").toMatch(/onOpenProfile = \(\) => setProfileOpen\(true\)/);
    expect(home, "ProfileView doit être rendu quand profileOpen").toMatch(/profileOpen && <ProfileView/);
    // Et au remontage (l'URL ?profil=1 survit à un rechargement / un lien), on
    // rouvre la page profil d'ordinateur — pas LePont.
    expect(home).toMatch(/p\.get\("profil"\) === "1"\) setProfileOpen\(true\)/);
  });

  it("LePont sert toujours le profil sur mobile", () => {
    // La landing ne passe plus par LePont pour le profil, mais LePont garde son
    // propre écran profil pour le mobile (sous 768 px), inchangé.
    expect(lePont).toMatch(/params\.get\("profil"\)/);
    expect(lePont, "le profil doit exiger un pseudo, comme les autres écrans de compte")
      .toMatch(/requirePseudo\(function\(\)\{ setScreen\("profile"\); \}\)/);
  });

  it("refermer le profil rend la main à la landing", () => {
    // LE PIÈGE. Sans cette ligne, le retour laisse l'accueil mobile de LePont
    // affiché en plein écran d'ordinateur — le même défaut que la feuille
    // « Choisis ton mode », déjà corrigé pour elle et raconté dans le fichier.
    const effet = lePont.slice(
      lePont.indexOf("const wasInGameRef"),
      lePont.indexOf("Lock viewport"),
    );
    expect(effet.length).toBeGreaterThan(200);
    expect(
      effet,
      'screen === "profile" doit compter comme « dans le jeu », sinon la fermeture échoue en silence',
    ).toContain('screen === "profile"');
  });
});

describe("le grade affiché est le vrai", () => {
  // Ces trois-là ne lisent pas la source : ils exercent `levelCard`, la fonction
  // dont l'en-tête se sert désormais. C'est ce qui rend « LVL 1 » indéfendable.
  it("change avec l'XP", () => {
    const debut = levelCard(0);
    const avance = levelCard(61000);
    expect(debut.id).not.toBe(avance.id);
    expect(cardName(debut)).not.toBe(cardName(avance));
  });

  it("renvoie toujours une carte illustrée", () => {
    // L'en-tête n'affiche la vignette que si `hasArt` : si `levelCard` pouvait
    // rendre une carte sans visuel, le repli à l'initiale reviendrait pour les
    // joueurs concernés, sans qu'on comprenne pourquoi.
    for (const xp of [0, 49, 50, 1000, 12500, 61000, 999999]) {
      expect(hasArt(levelCard(xp)), "levelCard(" + xp + ") sans illustration").toBe(true);
      expect(levelCard(xp).thumb, "vignette manquante à " + xp + " XP").toBeTruthy();
    }
  });

  it("couvre bien vingt-neuf paliers", () => {
    // Le chiffre est dans le commentaire de collection.ts et dans celui-ci : si
    // la collection grandit, les deux textes doivent suivre.
    expect(CARDS.length).toBe(29);
  });
});
