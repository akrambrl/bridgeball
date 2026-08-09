#!/usr/bin/env python3
"""Relève les effectifs actuels des grands clubs sur fr.wikipedia.

À lancer à chaque fin de mercato (fin août, fin janvier) :

    python3 scripts/mercato-effectifs.py            # écrit effectifs.json
    node_modules/.bin/vite-node scripts/mercato-diff.mjs

Le second script compare l'effectif relevé à src/players.jsx et sort trois
listes : les transferts à ajouter, les homonymes à ignorer, et les fiches sans
année de naissance (impossible à trancher automatiquement).

Pourquoi fr.wikipedia et pas Wikidata : Wikidata retarde de plusieurs semaines
sur les transferts récents — testé le 9 août 2026, un seul mouvement du PSG
enregistré contre dix sur l'article de la saison. Le modèle {{Feff joueur}} des
articles de club, lui, est tenu à jour et donne le nom ET la date de naissance,
qui est le seul moyen fiable de séparer deux homonymes (Ederson gardien de Man
City et Ederson milieu de l'Atalanta, João Mário de Porto et celui du Sporting).

La couverture est volontairement limitée aux clubs que les jeux utilisent. Un
joueur parti dans un club absent de cette liste ne sera pas détecté.
"""

import json, urllib.parse, subprocess, re, sys, time

# nom dans notre base → titre de l'article fr.wikipedia du club
CLUBS = {
 "Real Madrid":"Real Madrid Club de Fútbol",
 "Barcelona":"FC Barcelone",
 "Atletico Madrid":"Club Atlético de Madrid",
 "Manchester United":"Manchester United Football Club",
 "Manchester City":"Manchester City Football Club",
 "Liverpool":"Liverpool Football Club",
 "Chelsea":"Chelsea Football Club",
 "Arsenal":"Arsenal Football Club",
 "Tottenham":"Tottenham Hotspur Football Club",
 "Newcastle":"Newcastle United Football Club",
 "Aston Villa":"Aston Villa Football Club",
 "Bayern Munich":"Bayern Munich",
 "Borussia Dortmund":"Borussia Dortmund",
 "Bayer Leverkusen":"Bayer 04 Leverkusen",
 "Juventus FC":"Juventus Football Club",
 "Inter Milan":"FC Internazionale Milano",
 "AC Milan":"Associazione Calcio Milan",
 "SSC Napoli":"Società Sportiva Calcio Napoli",
 "AS Roma":"Associazione Sportiva Roma",
 "Atalanta BC":"Atalanta Bergame",
 "PSG":"Paris Saint-Germain Football Club",
 "Marseille":"Olympique de Marseille",
 "Lyon":"Olympique lyonnais",
 "Monaco":"Association sportive de Monaco Football Club",
 "Lille":"LOSC Lille",
 "Nice":"Olympique Gymnaste Club de Nice",
 "Lens":"Racing Club de Lens",
 "Benfica":"Benfica Lisbonne",
 "Porto":"FC Porto",
 "Ajax Amsterdam":"Ajax Amsterdam",
 # Galatasaray, Fenerbahçe, les clubs saoudiens : leur article fr.wikipedia
 # n'a pas de section « Effectif professionnel actuel » au format {{Feff joueur}},
 # donc rien à relever. Les y remettre ne sert qu'à faire du bruit.
}

def get(u):
    for k in range(4):
        r = subprocess.run(["curl","-s","--max-time","30",u],capture_output=True,text=True).stdout
        if r.strip():
            try: return json.loads(r)
            except Exception: pass
        time.sleep(1+k)
    return None

def wikitext(t):
    d = get("https://fr.wikipedia.org/w/rest.php/v1/page/" + urllib.parse.quote(t.replace(" ","_")))
    return (d or {}).get("source","")

RX = re.compile(r"\{\{Feff joueur\s*\|(.*?)\n?\}\}", re.S)
def effectif(w):
    out = []
    for bloc in RX.findall(w):
        champs = {}
        for part in bloc.split("|"):
            if "=" in part:
                k, v = part.split("=", 1)
                champs[k.strip()] = v.strip()
        prenom, nom = champs.get("prénom",""), champs.get("nom","")
        plein = (prenom + " " + nom).strip()
        an = champs.get("an","")
        if plein: out.append({"nom": plein, "an": int(an) if an.isdigit() else None, "pret": "{{prêt}}" in bloc})
    return out

res = {}
for base, titre in CLUBS.items():
    w = wikitext(titre)
    if not w:
        print("!! fetch KO", base, titre, file=sys.stderr); continue
    e = effectif(w)
    res[base] = e
    print(f"{base:20s} {len(e):3d} joueurs", file=sys.stderr)
json.dump(res, open("effectifs.json","w"), ensure_ascii=False, indent=1)
print("ok", sum(len(v) for v in res.values()), "lignes")
