// LE LIEN D'INVITATION NE MENAIT PAS À LA SALLE
//
// Le bouton « Inviter des joueurs » partage `https://www.goatfc.fr/?room=CODE`.
// C'est le seul mécanisme de bouche-à-oreille de l'app, et il était cassé de
// quatre façons différentes, toutes muettes :
//
//   1. SUR ORDINATEUR ET IPAD, personne ne lisait le paramètre. Index rend
//      <Home /> au-dessus de 768 px, et Home ne montait LePont que pour `play`,
//      `friends` et `duels`. `room` manquait à la liste : le destinataire
//      atterrissait sur la page d'accueil, sans un mot.
//
//   2. UN CODE SUR TROIS TABLES. Le bouton « Rejoindre » de l'accueil interroge
//      `bb_duel_rooms`, puis `bb_gg_rooms`, puis `bb_rooms`. L'auto-join, lui,
//      appelait `joinRoom()` directement — la troisième seulement. Un code de
//      GOAT DUEL ou de GOAT BATTLE reçu par lien répondait « Salle introuvable »
//      alors que le même code tapé à la main dans le champ juste à côté
//      marchait. Logique dupliquée, une seule copie complète.
//
//   3. LE NOUVEAU JOUEUR — c'est-à-dire le destinataire normal d'une invitation
//      — voyait « crée ton pseudo pour rejoindre automatiquement » sans aucun
//      moyen de le faire : l'effet de lancement force `bb_welcome_seen` et
//      `bb_tutorial_done` (donc pas de tutoriel) et lève
//      `launchedFromLandingRef`, qui masque le bouton de profil — le seul chemin
//      vers l'écran de pseudo depuis l'accueil. Une consigne sans porte.
//
//   4. L'ÉCHEC ÉTAIT MUET. « Partie déjà lancée », le cas le plus fréquent d'un
//      lien ouvert trop tard, s'affichait sous la carte « Joue avec tes potes »,
//      tout en bas de l'accueil — là où regarde quelqu'un qui vient de taper un
//      code, pas quelqu'un qui vient de cliquer sur un lien.
//
// Ces défauts vivent dans le routage et le JSX, pas dans une fonction qu'on
// pourrait appeler. On éprouve donc la SOURCE. C'est moins fort qu'un test de
// comportement, et c'est assumé : chacune des quatre assertions ci-dessous
// serait devenue rouge sur le défaut qu'elle décrit.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const lePont = readFileSync(join(RACINE, "src/components/LePont.jsx"), "utf8");
const home = readFileSync(join(RACINE, "src/pages/Home.tsx"), "utf8");

describe("le lien d'invitation ?room=CODE", () => {
  it("monte LePont sur ordinateur et iPad", () => {
    // Au-dessus de 768 px c'est <Home /> qui rend, et LePont n'est monté que si
    // Home le décide. Le test cherche `room` dans la même condition que
    // `friends` et `duels`, dont le traitement est identique : LePont lit le
    // paramètre lui-même, il suffit qu'il existe.
    const condition = home.match(/if\s*\(.*p\.get\("friends"\).*\)\s*setPlaying\(true\)/);
    expect(condition, "la branche qui monte LePont pour friends/duels a changé de forme").toBeTruthy();
    expect(
      condition![0],
      "`room` manque à la condition : sur ordinateur et iPad le lien d'invitation tombe sur l'accueil",
    ).toContain('p.get("room")');
  });

  it("interroge les trois tables, par un seul chemin", () => {
    // `joinRoom()` ne regarde que `bb_rooms`. Il ne doit donc être appelé que
    // depuis l'aiguilleur, qui a essayé les deux autres avant. Un appel direct
    // ailleurs recréerait exactement le défaut : un lien qui ne marche que pour
    // un mode sur trois.
    // On compte sur le code SEUL : les commentaires de ce dépôt citent les noms
    // de fonctions, et la première version de ce test s'est comptée elle-même.
    const codeSeul = lePont
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n");
    const declarations = [...codeSeul.matchAll(/function joinRoom\(/g)].length;
    expect(declarations, "il y a deux joinRoom : celui du multi local (module) et celui des salles Supabase").toBe(2);
    const appels = [...codeSeul.matchAll(/(?<![\w.])joinRoom\(/g)].length - declarations;
    expect(
      appels,
      "joinRoom() doit être appelé UNIQUEMENT depuis rejoindreParCode, qui a déjà essayé bb_duel_rooms et bb_gg_rooms",
    ).toBe(1);

    // Et l'aiguilleur les essaie bien toutes les trois, dans cet ordre.
    const aiguilleur = lePont.slice(
      lePont.indexOf("async function rejoindreParCode"),
      lePont.indexOf("function makeRoomCode"),
    );
    expect(aiguilleur.length).toBeGreaterThan(200);
    for (const table of ["bb_duel_rooms?code=eq.", "bb_gg_rooms?code=eq."]) {
      expect(aiguilleur, "rejoindreParCode n'interroge plus " + table).toContain(table);
    }
    expect(aiguilleur).toContain("joinRoom(clean)");
  });

  it("l'auto-join passe par l'aiguilleur, pas par joinRoom", () => {
    const effet = lePont.slice(
      lePont.indexOf("AUTO-JOIN DEPUIS UN LIEN D'INVITATION"),
      lePont.indexOf("comboRef.current=combo"),
    );
    expect(effet.length).toBeGreaterThan(100);
    expect(
      effet,
      "l'auto-join doit appeler rejoindreParCode : joinRoom seul ignore GOAT DUEL et GOAT BATTLE",
    ).toContain("rejoindreParCode(pendingRoomCode)");
  });

  it("ouvre l'écran de pseudo au lieu d'attendre un geste impossible", () => {
    // Sans ça, le destinataire d'une invitation qui n'a pas encore de compte —
    // le cas normal — lit une consigne qu'aucun bouton ne permet de suivre.
    const effet = lePont.slice(
      lePont.indexOf("AUTO-JOIN DEPUIS UN LIEN D'INVITATION"),
      lePont.indexOf("comboRef.current=combo"),
    );
    expect(effet).toMatch(/if\s*\(\s*!pseudoConfirmed\s*\)\s*\{\s*setPseudoScreen\(true\)/);
    // Et le code survit à l'ouverture de l'écran : c'est lui qui déclenchera le
    // rejoint quand le pseudo sera confirmé.
    expect(effet).toMatch(/setPseudoScreen\(true\);\s*return;/);
  });

  it("dit à l'arrivant que ça a échoué", () => {
    // Le bandeau d'échec est en haut de l'accueil, dans la même pile que le
    // bandeau « salle en attente ». `roomMsg` seul, en bas de page, ne se voit
    // pas quand on n'a rien tapé.
    expect(lePont).toContain("roomDepuisLienRef");
    expect(
      lePont,
      "l'échec d'un lien doit s'afficher en haut de l'accueil, pas seulement sous le champ de code",
    ).toMatch(/roomDepuisLienRef\.current\s*&&\s*!pendingRoomCode\s*&&\s*roomMsg/);
  });

  it("partage le domaine canonique, sans redirection", () => {
    // `goatfc.fr?room=…` marchait au prix d'un 307 vers `www.goatfc.fr/?room=…`.
    // Mesuré : la chaîne de requête survit à la redirection, donc ce n'était pas
    // LA cause du défaut — mais c'est un aller-retour réseau gratuit sur un lien
    // ouvert au doigt, et une occasion de plus de la perdre.
    expect(lePont).toContain('"https://www.goatfc.fr/?room="+room.code');
    expect(lePont, "le lien repasse par une redirection").not.toContain('"https://goatfc.fr?room="');
  });
});
