#!/usr/bin/env python3
"""Relève le journal des transferts OFFICIELS sur maxifoot.fr.

    python3 scripts/mercato-maxifoot.py                        # écrit maxifoot.json
    node_modules/.bin/vite-node scripts/mercato-maxifoot-diff.mjs

Complément de mercato-effectifs.py, qui ne lit que les effectifs des 30 clubs
des jeux sur fr.wikipedia. Maxifoot couvre tous les championnats et sort le
mouvement le jour même : c'est par lui qu'on a vu Salah signer à Trabzonspor,
invisible pour l'autre méthode.

⚠️ DEUX PIÈGES, tous les deux vécus.

1. La page empile TROIS tableaux : « transferts OFFICIELS », « en cours de
   DISCUSSION », puis « RUMEURS ». Les avaler tous donne le même joueur vers
   trois clubs à la fois — Mohamed Salah à Trabzonspor ET Lucas Chevalier à la
   Juventus ET à Besiktas. bloc_officiel() coupe au premier des deux titres
   suivants et lève une erreur si la structure de la page change.

2. Beaucoup de lignes n'écrivent que « M. Sarr » ou « A. Gomes ». Le diff ne
   résout une initiale que si le club QUITTÉ figure déjà dans la fiche du
   joueur : même personne, même point de départ. Sans ce garde-fou on colle le
   transfert sur son homonyme.

Après relevé, vérifier les candidats un par un : chaque ligne porte le lien de
la brève « (officiel) » qui la confirme, et les retours de prêt (« r. p. »)
n'en ont pas — ceux-là se contrôlent sur fr.wikipedia.
"""

import re, html, json, subprocess, sys

def fetch(url, out):
    subprocess.run(["curl","-s","--max-time","60","-A","goatfc-datacheck/1.0",url,"-o",out],check=True)
    return open(out, encoding="latin-1").read()

LIGNE = re.compile(
    r"<tr>\s*<td>([^<]{0,20})</td>"                    # date
    r"\s*<td[^>]*>(.*?)</td>"                          # joueur
    r"\s*<td[^>]*>(.*?)</td>"                          # club de départ
    r"\s*<td[^>]*>.*?</td>"                            # flèche
    r"\s*<td[^>]*>(.*?)</td>"                          # club d'arrivée
    r"\s*<td[^>]*>(.*?)</td>"                          # type (transf./prêt/f. c.)
    r"\s*<td[^>]*>(.*?)</td>",                         # lien de confirmation
    re.S)

def texte(x):
    x = re.sub(r"<i>\s*\((\w+)\)\s*</i>", r" [\1]", x)
    x = re.sub(r"<[^>]+>", "", x)
    return re.sub(r"\s+", " ", html.unescape(x)).strip()

def nom_complet(cell):
    m = re.search(r'href="/joueur/([a-z0-9\-]+?)-\d+\.htm"', cell)
    if m:
        return " ".join(w.capitalize() for w in m.group(1).split("-"))
    return texte(cell)

SECTION = re.compile(r"<(?:h[1-4]|caption)[^>]*>(.*?)</(?:h[1-4]|caption)>", re.S)

def bloc_officiel(h):
    """La page empile trois tableaux : OFFICIELS, en DISCUSSION, puis RUMEURS.
    Les deux derniers listent le meme joueur vers trois clubs differents — les
    avaler donnerait Mohamed Salah a Trabzonspor. On ne garde que le premier."""
    debut = fin = None
    for m in SECTION.finditer(h):
        titre = re.sub(r"<[^>]+>", "", m.group(1)).upper()
        if debut is None and "OFFICIEL" in titre:
            debut = m.end()
        elif debut is not None and ("DISCUSSION" in titre or "RUMEUR" in titre):
            fin = m.start(); break
    if debut is None:
        raise SystemExit("section OFFICIELS introuvable — la page a change de structure")
    return h[debut:fin]

def parse(h):
    out = []
    for d, j, dep, arr, typ, lien in LIGNE.findall(bloc_officiel(h)):
        nom = nom_complet(j)
        if not nom or len(nom) < 3: continue
        u = re.search(r'href="(https://news\.maxifoot[^"]+)"', lien)
        out.append({"date": texte(d), "joueur": nom, "abrege": texte(j),
                    "de": texte(dep), "vers": texte(arr), "type": texte(typ),
                    "source": u.group(1) if u else None})
    return out

tout = []
for url, f in [("https://www.maxifoot.fr/mercato/", "mf-l1.html"),
               ("https://www.maxifoot.fr/mercato/transfert-etranger.php", "mf-etr.html")]:
    h = fetch(url, f)
    l = parse(h)
    print(f"{url}  →  {len(l)} lignes", file=sys.stderr)
    tout += l
# dédoublonnage
vus, uniq = set(), []
for t in tout:
    k = (t["joueur"], t["vers"])
    if k in vus: continue
    vus.add(k); uniq.append(t)
json.dump(uniq, open("maxifoot.json","w"), ensure_ascii=False, indent=1)
print(len(uniq), "transferts uniques")
for t in uniq[:12]: print("  ", t["date"], "|", t["joueur"], "|", t["de"], "→", t["vers"], "|", t["type"])
