// LA BANNIÈRE PROMETTAIT UNE PORTE QUI N'EXISTAIT PAS
//
// Le formulaire de consentement RGPD rendu par Google dit au joueur, en toutes
// lettres : « Look for a link or button in the app menu to manage or withdraw
// consent in privacy and cookie settings. » L'écran de publication de la console
// AdMob le rappelle d'ailleurs à chaque message : « n'oubliez pas d'ajouter le
// lien de révocation ».
//
// Il n'existait pas. Le seul `revoke` du dépôt était un `URL.revokeObjectURL`
// sans rapport. Un consentement doit pouvoir être retiré aussi facilement qu'il a
// été donné — ce n'est pas une lecture extensive du RGPD, c'est ce que la
// bannière elle-même annonce à l'utilisateur.
//
// CE QUE CES TESTS TIENNENT. Pas le comportement du SDK — il n'existe que dans la
// coque native, et aucun harnais de test ne le porte. Ils tiennent les trois
// choses qui, si elles disparaissaient, rendraient la promesse fausse à nouveau :
// l'entrée existe, elle est CONDITIONNÉE au bon endroit, et son échec se dit.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { confidentialiteReprenable, ouvrirConfidentialite } from "@/lib/pub";

const pub = readFileSync(join(process.cwd(), "src/lib/pub.ts"), "utf8");
const lePont = readFileSync(join(process.cwd(), "src/components/LePont.jsx"), "utf8");

describe("le retrait du consentement publicitaire", () => {
  it("passe par l'écran du SDK, pas par un écran maison", () => {
    // `showPrivacyOptionsForm()` est rendu depuis la MÊME configuration RGPD que
    // la bannière du premier lancement. Redessiner cet écran nous-mêmes, c'est
    // garantir qu'il divergera un jour de ce que le joueur a réellement accepté.
    expect(pub).toContain("AdMob.showPrivacyOptionsForm()");
  });

  it("ne se propose que là où il y a un consentement à reprendre", () => {
    // Hors EEE le statut est NOT_REQUIRED : le SDK n'a aucune option à montrer,
    // et une ligne qui ouvre un écran vide est pire qu'une ligne absente.
    expect(pub).toMatch(/optionsDispo\s*=\s*infos\.status === AdmobConsentStatus\.REQUIRED/);
    expect(pub).toContain("AdmobConsentStatus.OBTAINED");
    expect(pub).toMatch(/confidentialiteReprenable = \(\): boolean => natif\(\) && optionsDispo/);
  });

  it("hors coque native, ne promet rien", () => {
    // Le harnais de test n'est pas une coque native : les deux fonctions doivent
    // donc répondre « non » sans lever. C'est aussi l'état du site web, où la
    // bannière AdMob ne s'affiche jamais.
    expect(confidentialiteReprenable()).toBe(false);
    return expect(ouvrirConfidentialite()).resolves.toBe(false);
  });

  it("l'entrée est dans l'écran Compte, et son échec se dit", () => {
    // Un bouton qui ne fait rien est le défaut qu'on vient de corriger deux fois
    // ailleurs dans ce dépôt (l'en-tête PC, le lien d'invitation). On ne le
    // réintroduit pas ici : si le formulaire ne s'ouvre pas, le joueur l'apprend.
    const i = lePont.indexOf("confidentialiteReprenable()");
    expect(i, "l'entrée a disparu de l'écran Compte").toBeGreaterThan(-1);
    const bloc = lePont.slice(i, i + 1400);
    expect(bloc).toContain("ouvrirConfidentialite()");
    expect(bloc, "l'échec doit être dit au joueur").toMatch(/if \(!ok\) setPseudoMsg\(/);
    // Et elle est traduite dans les six langues de l'app, comme tout le reste.
    const libelle = bloc.match(/tr\("Confidentialité et publicité"[^)]*\)/);
    expect(libelle, "libellé introuvable").toBeTruthy();
    expect(libelle![0].split('","').length, "six langues attendues").toBe(6);
  });
});
