// Le poids de l'app se joue dans public/ : c'est ce que Capacitor empaquette.
//
// Mesuré avant correction : 24 Mo, dont 15,55 Mo de PNG — 65 % du poids pour des
// illustrations à aplats. Converties en WebP q86, elles tombent à 2,4 Mo pour un
// SSIM jamais inférieur à 0,97. Sans ce test, la prochaine illustration déposée
// en PNG ramènerait le problème sans que personne ne le voie : un fichier lourd
// ne casse rien, il ralentit seulement l'installation.
import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
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
