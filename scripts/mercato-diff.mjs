// Compare l'effectif relevé par mercato-effectifs.py à src/players.jsx.
// Voir l'en-tête de mercato-effectifs.py pour le mode d'emploi.
import { PLAYERS } from "../src/players.jsx";
import fs from "fs";
const D = "./";   // effectifs.json produit par mercato-effectifs.py
const eff = JSON.parse(fs.readFileSync(D+"effectifs.json","utf8"));
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()
  .replace(/\s*\(.*\)$/,"").replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim();
const base = new Map();
for (const p of PLAYERS) { const k=norm(p.name); if(!base.has(k)) base.set(k,p); }

const vrais = [], homonymes = [], sansDate = [];
for (const [club, joueurs] of Object.entries(eff)) {
  for (const j of joueurs) {
    const p = base.get(norm(j.nom));
    if (!p || (p.clubs||[]).includes(club)) continue;
    const row = {club, nom:p.name, wikiAn:j.an, baseAn:p.birthYear, pret:j.pret, clubs:p.clubs, diff:p.diff};
    if (j.an == null || p.birthYear == null) sansDate.push(row);
    else if (Math.abs(j.an - p.birthYear) <= 1) vrais.push(row);
    else homonymes.push(row);
  }
}
const show = (t, l) => { console.log(`\n=== ${t} : ${l.length}`);
  for (const r of l) console.log(`  ${r.club.padEnd(18)} ${r.nom.padEnd(26)} ${String(r.wikiAn).padEnd(5)}/${String(r.baseAn).padEnd(5)} ${r.pret?"prêt ":"     "}[${r.diff}] ${r.clubs.join(", ")}`); };
show("TRANSFERTS À AJOUTER (même joueur, année confirmée)", vrais);
show("HOMONYMES — ne pas toucher", homonymes);
show("ANNÉE INCONNUE — à vérifier à la main", sansDate);
