// Fabrique scripts/social/polices.css : les deux polices de l'app embarquées
// en data URI.
//
//     node scripts/social/polices.mjs
//
// Pourquoi ne pas simplement garder l'@import Google dans visuels.html ?
// Parce que le Chromium qui fait le rendu n'a pas d'accès réseau ici, et
// qu'aucune des deux familles n'est installée sur la machine (`fc-list` ne
// renvoie ni Anton ni Bebas Neue). L'@import échouait donc en silence : les
// titres repliaient sur Impact et le reste sur le sans-serif générique. Les
// visuels sortaient dans deux polices que l'app ne charge nulle part — le
// défaut signalé, et il ne se voyait pas dans le HTML, seulement dans le PNG.
//
// En les embarquant, le rendu ne dépend plus du réseau ni de la machine.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));

// Les sous-ensembles latin et latin-ext suffisent : le français tient dans le
// latin (É, À, Ç sont sous U+00FF), latin-ext ne coûte que quelques kilo-octets
// et couvre ce qui dépasserait.
const FACES = [
  { famille: "Anton",      url: "https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm3Kz-C8.woff2" },
  { famille: "Anton",      url: "https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm3K9-C8QSw.woff2" },
  { famille: "Bebas Neue", url: "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2" },
  { famille: "Bebas Neue", url: "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXoo9Wdhyzbi.woff2" },
];

const blocs = [];
for (const f of FACES) {
  const r = await fetch(f.url);
  if (!r.ok) throw new Error(`${f.famille} : ${r.status} sur ${f.url}`);
  const b64 = Buffer.from(await r.arrayBuffer()).toString("base64");
  blocs.push(`@font-face{font-family:'${f.famille}';font-style:normal;font-weight:400;` +
             `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}`);
  console.log(f.famille.padEnd(12), Math.round(b64.length / 1024) + " Ko");
}

writeFileSync(join(ici, "polices.css"),
  "/* Généré par scripts/social/polices.mjs — ne pas modifier à la main. */\n" +
  blocs.join("\n") + "\n");
console.log("écrit polices.css");
