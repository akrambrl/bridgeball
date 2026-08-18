// LE PASSAGE EN PRODUCTION D'ADMOB TIENT DANS QUATRE FICHIERS, ET C'EST LÀ LE
// PROBLÈME : n'en modifier que trois ne casse rien, ne prévient personne, et
// coûte de l'argent.
//
// Les quatre endroits, et ce que chacun porte :
//
//   src/lib/pub.ts                          ID_REEL_RECOMPENSE — le BLOC (avec /)
//   ios/App/App/Info.plist                  GADApplicationIdentifier — l'APP (avec ~)
//   android/…/AndroidManifest.xml           APPLICATION_ID — l'APP (avec ~)
//   public/app-ads.txt                      l'identifiant d'ÉDITEUR (pub-…)
//
// Les trois façons de se rater, toutes silencieuses :
//
//  1. INTERVERTIR bloc et app. Le `/` et le `~` ne sont pas décoratifs : ils
//     distinguent deux objets différents. Mettre un ID d'app là où on attend un
//     bloc fait planter l'app au lancement, sur tous les téléphones.
//
//  2. OUBLIER app-ads.txt, ou y mettre un autre éditeur. Google explore
//     https://goatfc.fr/app-ads.txt et compare l'éditeur qu'il y lit à celui de
//     l'app. S'ils diffèrent — ou si le fichier manque — l'inventaire passe en
//     « non autorisé » : les pubs continuent de s'afficher, les enchérisseurs
//     premium disparaissent, et le revenu s'effondre sans message d'erreur.
//
//  3. N'EN FAIRE QUE LA MOITIÉ. Un ID d'app réel avec un bloc de test sert de
//     vraies pubs de test ; un bloc réel avec un ID d'app de test ne sert rien.
//     D'où la règle de ce fichier : les quatre sont en test, ou les quatre sont
//     en production. Jamais entre les deux.
//
// Rien ici n'exige de passer en production : tant que tout est en test, tout est
// vert. Ce test ne réclame que la COHÉRENCE.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const R = process.cwd();
const lire = (...p: string[]) => readFileSync(join(R, ...p), "utf8");

// L'identifiant d'éditeur de Google dans ses identifiants de test publics. Sa
// présence est la marque du mode test, et c'est la seule chose qui le dit.
const EDITEUR_DE_TEST = "3940256099942544";

const APP_ADS = join(R, "public", "app-ads.txt");

/** ca-app-pub-<16 chiffres>~<chiffres> — un identifiant d'APPLICATION. */
const FORME_APP = /^ca-app-pub-(\d{16})~\d+$/;
/** ca-app-pub-<16 chiffres>/<chiffres> — un identifiant de BLOC d'annonces. */
const FORME_BLOC = /^ca-app-pub-(\d{16})\/\d+$/;

function idAppIos(): string {
  const s = lire("ios", "App", "App", "Info.plist");
  const m = s.match(/<key>GADApplicationIdentifier<\/key>\s*<string>([^<]*)<\/string>/);
  expect(m, "GADApplicationIdentifier absent d'Info.plist — l'app planterait au lancement").toBeTruthy();
  return m![1].trim();
}

function idAppAndroid(): string {
  const s = lire("android", "app", "src", "main", "AndroidManifest.xml");
  const m = s.match(
    /android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"\s*\n?\s*android:value="([^"]*)"/,
  );
  expect(m, "APPLICATION_ID absent du manifeste Android — l'app planterait au lancement").toBeTruthy();
  return m![1].trim();
}

/**
 * Les identifiants de bloc réels, relus dans la SOURCE et non importés : ce sont
 * des constantes privées de pub.ts, et les lire au texte résiste aussi à une
 * réécriture du module.
 */
function blocsReels(): { android: string; ios: string } {
  const s = lire("src", "lib", "pub.ts");
  const bloc = s.match(/const ID_REEL_RECOMPENSE\s*=\s*\{([\s\S]*?)\}/);
  expect(bloc, "ID_REEL_RECOMPENSE introuvable dans src/lib/pub.ts").toBeTruthy();
  const champ = (nom: string) => {
    const m = bloc![1].match(new RegExp(nom + '\\s*:\\s*"([^"]*)"'));
    expect(m, `champ ${nom} absent de ID_REEL_RECOMPENSE`).toBeTruthy();
    return m![1].trim();
  };
  return { android: champ("android"), ios: champ("ios") };
}

/** L'identifiant d'éditeur (les 16 chiffres) porté par un ID d'app ou de bloc. */
const editeurDe = (id: string): string | null => {
  const m = id.match(FORME_APP) || id.match(FORME_BLOC);
  return m ? m[1] : null;
};

describe("AdMob — les quatre endroits restent cohérents", () => {
  const blocs = blocsReels();
  const apps = { ios: idAppIos(), android: idAppAndroid() };
  const enProduction = Boolean(blocs.ios || blocs.android);

  it("les identifiants d'application ont la forme d'un identifiant d'application", () => {
    // C'est ce test qui attrape l'inversion `~` / `/`, la seule erreur de cette
    // manipulation qui fasse planter l'app avant le premier écran.
    for (const [plateforme, id] of Object.entries(apps)) {
      expect(id, `${plateforme} : « ${id} » n'est pas un ID d'application (il faut un ~)`)
        .toMatch(FORME_APP);
    }
  });

  it("les identifiants de bloc réels, s'ils sont posés, ont la forme d'un bloc", () => {
    for (const [plateforme, id] of Object.entries(blocs)) {
      if (!id) continue;
      expect(id, `${plateforme} : « ${id} » n'est pas un ID de bloc (il faut un /)`)
        .toMatch(FORME_BLOC);
    }
  });

  it("on est soit entièrement en test, soit entièrement en production", () => {
    // Les quatre valeurs, ramenées à une seule question : est-ce l'éditeur de
    // test de Google ? Un mélange signifie qu'une des quatre modifications a été
    // oubliée — et c'est exactement l'état qui ne se voit pas à l'usage.
    const etat = {
      "bloc iOS": blocs.ios ? "production" : "test",
      "bloc Android": blocs.android ? "production" : "test",
      "app iOS": apps.ios.includes(EDITEUR_DE_TEST) ? "test" : "production",
      "app Android": apps.android.includes(EDITEUR_DE_TEST) ? "test" : "production",
      "app-ads.txt": existsSync(APP_ADS) ? "production" : "test",
    };
    const distincts = new Set(Object.values(etat));
    expect(distincts.size, "état mixte : " + JSON.stringify(etat, null, 2)).toBe(1);
  });

  it("app-ads.txt annonce le même éditeur que les identifiants de l'app", () => {
    // L'erreur la plus chère du lot : le fichier existe, il est bien servi, il
    // désigne simplement quelqu'un d'autre. Google le lit, ne reconnaît pas
    // l'éditeur de l'app, et déclasse l'inventaire — sans rien signaler.
    if (!existsSync(APP_ADS)) return;
    const contenu = readFileSync(APP_ADS, "utf8");

    // La ligne canonique d'AdMob. Le dernier champ est l'identifiant Google de
    // l'autorité de certification ; il est le même pour tout le monde.
    const lignes = contenu
      .split("\n")
      .map((l) => l.split("#")[0].trim())
      .filter(Boolean);
    expect(lignes.length, "app-ads.txt est vide — Google le traiterait comme absent")
      .toBeGreaterThan(0);

    const google = lignes.find((l) => l.startsWith("google.com,"));
    expect(google, "aucune ligne google.com dans app-ads.txt").toBeTruthy();
    expect(google, "la ligne google.com d'AdMob doit être « google.com, pub-…, DIRECT, f08c47fec0942fa0 »")
      .toMatch(/^google\.com,\s*pub-\d{16},\s*DIRECT,\s*f08c47fec0942fa0$/);

    const editeurDeclare = google!.match(/pub-(\d{16})/)![1];
    for (const [quoi, id] of Object.entries({ ...apps, "bloc ios": blocs.ios, "bloc android": blocs.android })) {
      if (!id) continue;
      const e = editeurDe(id);
      if (!e) continue;
      expect(e, `${quoi} appartient à l'éditeur ${e}, mais app-ads.txt déclare ${editeurDeclare}`)
        .toBe(editeurDeclare);
    }
  });

  it("en production, plus aucun identifiant de test ne subsiste", () => {
    if (!enProduction) return;
    const partout = [...Object.values(apps), ...Object.values(blocs)].join(" ");
    expect(partout, "un identifiant de test de Google est resté")
      .not.toContain(EDITEUR_DE_TEST);
  });
});

// ── SKADNETWORK ───────────────────────────────────────────────────────────
//
// Voir le commentaire dans Info.plist : sans cette liste, les installations des
// joueurs qui refusent la fenêtre ATT ne sont plus attribuables, les annonceurs
// cessent d'enchérir sur l'inventaire iOS, et le revenu baisse en silence.
//
// Ce test ne vérifie pas QUELS réseaux sont là — la liste de Google bouge — mais
// que le bloc existe, qu'il n'a pas été vidé, et que chaque entrée est bien
// formée. Un identifiant mal orthographié est ignoré par iOS sans un mot.
describe("SKAdNetwork", () => {
  const plist = lire("ios", "App", "App", "Info.plist");

  it("le bloc est présent et non vide", () => {
    expect(plist).toContain("<key>SKAdNetworkItems</key>");
    const ids = plist.match(/<key>SKAdNetworkIdentifier<\/key>\s*<string>([^<]+)<\/string>/g) || [];
    // Google en publiait 50 au moment de la mise en place. Le seuil vise la
    // suppression accidentelle du bloc, pas la mise à jour de la liste.
    expect(ids.length).toBeGreaterThan(30);
  });

  it("chaque identifiant a la forme attendue par iOS", () => {
    const ids = [...plist.matchAll(/<key>SKAdNetworkIdentifier<\/key>\s*<string>([^<]+)<\/string>/g)]
      .map((m) => m[1].trim());
    const malformes = ids.filter((i) => !/^[a-z0-9]{10}\.skadnetwork$/.test(i));
    expect(malformes).toEqual([]);
  });

  it("aucun réseau n'est déclaré deux fois", () => {
    // Google lui-même liste cstr6suwn9 deux fois dans sa documentation. Un
    // doublon n'est pas une erreur fatale, mais il révèle un copier-coller
    // partiel — et c'est ce qu'on veut voir.
    const ids = [...plist.matchAll(/<key>SKAdNetworkIdentifier<\/key>\s*<string>([^<]+)<\/string>/g)]
      .map((m) => m[1].trim());
    const vus = new Set<string>();
    const doublons = ids.filter((i) => (vus.has(i) ? true : (vus.add(i), false)));
    expect(doublons).toEqual([]);
  });
});
