// Fabrique public/splash-desktop.webp — l'écran de lancement en paysage.
//
//     node scripts/splash-desktop.mjs
//
// Pourquoi ce fichier existe : la CSS de l'écran de lancement prévoit depuis le
// début un visuel 16/9 (`.bbSplashWide`, media query min-aspect-ratio:1/1), mais
// l'image n'avait jamais été produite. Le repli fonctionnait — image portrait
// entière sur fond flouté — donc rien ne signalait le manque : sur ordinateur on
// voyait un 9:16 au milieu de l'écran, ce qui est exactement ce qui a été
// remonté.
//
// L'artwork portrait ne peut pas être simplement recadre : son ecusson est pose
// sur une trame de points et des lignes de vitesse, donc un rognage rectangulaire
// laisserait une couture visible. Et aucun asset ne porte l'ecusson detoure —
// logo.png et icon-512.png sont opaques, seul logo-mot.webp a de la
// transparence, mais il n'a que le lettrage.
//
// On recompose donc la scene : une arene aux valeurs de la charte (memes que
// areneCharte dans src/lib/charte.jsx, recopiees ici parce que ce script tourne
// hors du bundle — si l'arene change la-bas, relancer ce script), et le lockup
// carre pose au centre, bords fondus au masque.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const LARGEUR = 1920, HAUTEUR = 1080;

// logo.png porte le lockup COMPLET — écusson, couronne, ballon et lettrage — sur
// le même fond or, mêmes lignes de vitesse, même trame que l'artwork portrait.
// C'est donc lui le sujet, et non le logotype lettre seul : le splash portrait
// montre l'écusson, l'enlever changerait la marque au lancement.
//
// Il est carré et opaque, donc ses bords se verraient comme un carré posé sur le
// fond. On les fond avec un masque radial : les deux fonds étant le même or, la
// couture disparaît. Les rayons, eux, se prolongent naturellement — ceux du
// dessin et ceux de l'arène partent du même centre.
const logo = "data:image/png;base64," +
  readFileSync(join(racine, "public", "logo.png")).toString("base64");

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${LARGEUR}px;height:${HAUTEUR}px;overflow:hidden}
  .scene{position:relative;width:${LARGEUR}px;height:${HAUTEUR}px;overflow:hidden;
    background:radial-gradient(120% 80% at 50% 44%, rgba(245,194,43,.96) 0 34%, rgba(217,162,26,.55) 100%),#F5C22B}
  /* Lignes de vitesse : un dégradé conique répété dessine des coins qui rayonnent
     depuis un point. Le calque déborde de 25 % pour que les rayons ne s'arrêtent
     pas net sur les bords.
     DEUX couches et non une : l'arène de l'app est discrète parce qu'elle passe
     sous du contenu, alors qu'ici elle EST l'image. Le premier essai avec la
     seule couche de l'app donnait des rayons filiformes, sans rapport avec les
     traits épais de l'artwork. Une couche large et sombre porte le dessin, une
     fine le hachure. */
  .lignes{position:absolute;inset:-25%;
    background:repeating-conic-gradient(from 0deg at 50% 44%,
      rgba(8,17,9,.72) 0deg 1.5deg, rgba(8,17,9,0) 1.5deg 5.2deg)}
  .lignes2{position:absolute;inset:-25%;
    background:repeating-conic-gradient(from 1.1deg at 50% 44%,
      rgba(8,17,9,.38) 0deg .5deg, rgba(8,17,9,0) .5deg 2.1deg)}
  /* Le cœur reste dégagé : sans ça les rayons se rejoignent en une tache noire
     au milieu, derrière le logotype. */
  .coeur{position:absolute;inset:0;
    background:radial-gradient(circle at 50% 44%, #F5C22B 0 17%, rgba(245,194,43,.92) 30%, rgba(245,194,43,0) 60%)}
  /* Trame sérigraphiée en or sombre : une trame noire grise le fond au lieu de
     le texturer. */
  .trame{position:absolute;inset:0;opacity:.5;
    background-image:radial-gradient(circle,#D9A21A 1.4px,transparent 1.7px);background-size:7px 7px}
  /* Vignette d'encre : l'artwork portrait a des coins sombres, c'est ce qui lui
     donne sa profondeur. En paysage, les rayons seuls ne suffisent pas. */
  .vignette{position:absolute;inset:0;
    background:radial-gradient(120% 88% at 50% 44%, rgba(8,17,9,0) 0 40%, rgba(8,17,9,.72) 100%)}
  /* Le lockup à 96 % de la hauteur, masque radial pour dissoudre les bords du
     carre. closest-side cale le degrade sur le demi-cote, donc le fondu
     commence au même endroit sur les quatre bords. */
  .logo{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);
    height:${Math.round(HAUTEUR * 0.96)}px;width:auto;display:block;
    -webkit-mask-image:radial-gradient(closest-side, #000 0 62%, rgba(0,0,0,.55) 84%, transparent 100%);
    mask-image:radial-gradient(closest-side, #000 0 62%, rgba(0,0,0,.55) 84%, transparent 100%)}
  /* La barre de chargement est dessinée par l'app par-dessus, à 55 px du bas :
     on garde ce bandeau vide pour ne rien mettre dessous. */
</style></head><body>
  <div class="scene">
    <div class="lignes"></div>
    <div class="lignes2"></div>
    <div class="coeur"></div>
    <div class="trame"></div>
    <div class="vignette"></div>
    <img class="logo" src="${logo}" alt="">
  </div>
</body></html>`;

const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const page = await navigateur.newPage({ viewport: { width: LARGEUR, height: HAUTEUR } });
await page.setContent(PAGE, { waitUntil: "load" });
await page.waitForFunction(() => {
  const i = document.querySelector(".logo");
  return i && i.complete && i.naturalWidth > 0;
});

// WebP et non PNG : l'écran de lancement est la PREMIÈRE requête d'image de
// l'app, elle bloque l'affichage. Le portrait pèse 312 Ko en WebP contre
// 1,76 Mo en PNG — on tient la même règle ici.
const png = await page.screenshot({ type: "png" });
const b64 = await page.evaluate(async (uri) => {
  const img = new Image();
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = uri; });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext("2d").drawImage(img, 0, 0);
  return c.toDataURL("image/webp", 0.9).split(",")[1];
}, "data:image/png;base64," + png.toString("base64"));

const cible = join(racine, "public", "splash-desktop.webp");
const octets = Buffer.from(b64, "base64");
writeFileSync(cible, octets);
console.log("écrit public/splash-desktop.webp ·", LARGEUR + "×" + HAUTEUR + " ·",
  Math.round(octets.length / 1024) + " Ko");
await navigateur.close();
