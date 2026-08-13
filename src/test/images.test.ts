// Le poids de l'app se joue dans public/ : c'est ce que Capacitor empaquette.
//
// Mesuré avant correction : 24 Mo, dont 15,55 Mo de PNG — 65 % du poids pour des
// illustrations à aplats. Converties en WebP q86, elles tombent à 2,4 Mo pour un
// SSIM jamais inférieur à 0,97. Sans ce test, la prochaine illustration déposée
// en PNG ramènerait le problème sans que personne ne le voie : un fichier lourd
// ne casse rien, il ralentit seulement l'installation.
import { describe, it, expect } from "vitest";
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const PUBLIC = join(process.cwd(), "public");

// Parcours RÉCURSIF, et pas seulement la racine de public/. La première version
// listait le premier niveau : un PNG déposé dans public/cards/ — 58 fichiers y
// vivent — serait passé sous le radar, et le contrôle serait resté vert en
// laissant grossir l'app.
function tousLesFichiers(dossier: string): { chemin: string; nom: string; octets: number }[] {
  const out: { chemin: string; nom: string; octets: number }[] = [];
  for (const entree of readdirSync(dossier)) {
    const p = join(dossier, entree);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...tousLesFichiers(p));
    else out.push({ chemin: relative(PUBLIC, p), nom: entree, octets: st.size });
  }
  return out;
}

// Les seuls PNG légitimes, et la raison de chacun. Voir scripts/images-webp.mjs.
const PNG_AUTORISES = new Set([
  "apple-touch-icon.png",     // Apple exige du PNG pour l'icône
  "favicon.png",
  "icon-192.png",             // manifeste PWA + badge des notifications
  "icon-512.png",
  "icon-maskable-512.png",
  "og-image.png",             // aperçus sociaux : WebP mal supporté
  "logo.png",                 // cité dans le JSON-LD de index.html
]);

describe("le poids embarqué dans l'app", () => {
  const fichiers = tousLesFichiers(PUBLIC);
  const noms = fichiers.map((f) => f.nom);

  it("aucun PNG de contenu ne réapparaît dans public/", () => {
    const intrus = fichiers
      .filter((f) => f.nom.endsWith(".png") && !PNG_AUTORISES.has(f.nom))
      .map((f) => f.chemin);
    expect(intrus).toEqual([]);
  });

  it("les icônes indispensables sont toujours là", () => {
    // Le pendant du test précédent : à force d'interdire le PNG, on finirait par
    // convertir une icône, et l'app perdrait la sienne sur l'écran d'accueil.
    for (const nom of ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "og-image.png"]) {
      expect(noms).toContain(nom);
    }
  });

  it("aucun fichier de public/ ne dépasse 1 Mo", () => {
    // Un seul fichier lourd suffit à faire basculer l'app dans une catégorie de
    // téléchargement plus lente. Les vidéos de but sont sous ce plafond.
    const lourds = fichiers
      .filter((f) => f.octets > 1024 * 1024)
      .map((f) => f.chemin + " (" + Math.round(f.octets / 1024) + " ko)");
    expect(lourds).toEqual([]);
  });

  it("public/ tient sous 12 Mo", () => {
    // Marge volontaire : le seuil doit gêner AVANT que le poids ne devienne un
    // sujet, pas après. Mesuré à ~8 Mo après conversion.
    const total = fichiers.reduce((s, f) => s + f.octets, 0);
    expect(Math.round(total / 1048576)).toBeLessThan(12);
  });
});

// ── LE MANIFESTE POINTE-T-IL SUR DES FICHIERS QUI EXISTENT ? ──────────────
//
// `capacitor-assets generate`, lancé pour fabriquer les icônes natives, a réécrit
// public/manifest.json de sa propre initiative. Ce qu'il y a mis :
//
//     { "src": "../icons/icon-48.webp", "type": "image/png", "sizes": "48x48" }
//
// Trois défauts d'un coup — un chemin RELATIF avec « .. » qui, depuis
// /manifest.json, sort de la racine du site ; un `type` image/png annoncé sur des
// fichiers WebP ; et la disparition de icon-maskable-512.png, qui était là
// exprès. Le tout pointant vers un dossier `icons/` créé à la racine du dépôt et
// supprimé aussitôt, puisque les icônes du manifeste doivent RESTER en PNG (des
// agents lisent ce fichier sans gérer le WebP).
//
// Rien ne l'aurait signalé : l'installation PWA aurait simplement cessé de
// trouver son icône, et le badge des notifications aussi.
describe("manifest.json", () => {
  const manifeste = JSON.parse(
    readFileSync(join(PUBLIC, "manifest.json"), "utf8")) as {
      icons: { src: string; type: string; sizes: string }[];
      background_color: string; theme_color: string;
    };

  it("chaque icône déclarée existe vraiment dans public/", () => {
    const manquantes = manifeste.icons
      .map((i) => i.src.split("?")[0])
      .filter((src) => !existsSync(join(PUBLIC, src.replace(/^\//, ""))));
    expect(manquantes).toEqual([]);
  });

  it("aucun chemin d'icône ne sort de la racine du site", () => {
    // Un « ../ » dans un manifeste servi à la racine ne résout nulle part.
    const hors = manifeste.icons.map((i) => i.src).filter((s) => !s.startsWith("/"));
    expect(hors).toEqual([]);
  });

  it("le type déclaré correspond à l'extension du fichier", () => {
    const TYPES: Record<string, string> = { ".png": "image/png", ".webp": "image/webp",
      ".svg": "image/svg+xml", ".ico": "image/x-icon" };
    const menteuses = manifeste.icons
      .filter((i) => {
        const ext = (i.src.split("?")[0].match(/\.\w+$/) || [""])[0];
        return TYPES[ext] && TYPES[ext] !== i.type;
      })
      .map((i) => i.src + " annoncé " + i.type);
    expect(menteuses).toEqual([]);
  });

  it("la couleur de fond reste celle de la charte", () => {
    // C'est la couleur du premier écran peint, à l'installation comme au
    // lancement. La coque native la reprend (cf. scripts/coque-native.mjs).
    expect(manifeste.background_color.toUpperCase()).toBe("#F5C22B");
    expect(manifeste.theme_color.toUpperCase()).toBe("#F5C22B");
  });
});
