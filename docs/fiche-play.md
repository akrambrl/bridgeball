# Fiche Play Store — les textes à coller

Comptés, pas estimés : `npm run store` ne vérifie que les images, ces textes
sont mesurés ici. Les limites de Play sont 30 caractères pour le nom, 80 pour la
brève description, 4000 pour la complète.

## Nom de l'application — 7 / 30

```
GOAT FC
```

## Brève description — 77 / 80

C'est elle qui décide du téléchargement : elle dit le MÉCANISME (deviner le
joueur qui relie deux clubs), la VARIÉTÉ (cinq modes) et l'HABITUDE (un défi par
jour). Trois promesses en une ligne.

```
Devine le joueur qui relie deux clubs. 5 modes, un nouveau défi chaque jour.
```

## Description complète — 2411 / 4000

Trois choses volontairement ABSENTES, et il faut savoir pourquoi :

- **aucun superlatif** (« le meilleur », « numéro 1 ») ni classement revendiqué :
  le règlement sur les métadonnées de Play les interdit ;
- **aucune mention du lot FC 27** : une information promotionnelle et datée n'a
  rien à faire dans une description de store, elle vieillit mal et elle sort du
  cadre autorisé. Ça reste un sujet Instagram et TikTok ;
- **pas de « sans publicité »**, alors que c'est vrai aujourd'hui : des pubs sont
  prévues, et une description qu'il faudra démentir dans deux mois vaut moins que
  le mot « gratuit » tout seul.

Les chiffres cités sont RELEVÉS dans src/players.jsx : 5 622 joueurs et 1 549
clubs distincts. Deux affirmations fausses ont été retirées d'une première
version — « sept indices » pour la devinette, qui n'en compose qu'une phrase, et
une description approximative de Trouve le joueur, qui fonctionne en six essais
avec un retour façon Wordle.

```
Deux clubs s'affichent. Un joueur les a portés tous les deux. Lequel ?

GOAT FC est un quiz football pour ceux qui connaissent les effectifs, les transferts et les trajectoires — pas seulement les stars. Plus de 5 600 joueurs et 1 500 clubs, mis à jour à chaque mercato.

CINQ FAÇONS DE JOUER

THE PLUG — Deux clubs, un joueur qui a porté les deux maillots. Enchaîne les bonnes réponses avant la fin du chrono. Trois niveaux, du plus évident au plus tordu.

THE MERCATO — Pars d'un joueur et remonte sa carrière, club par club. Plus la chaîne est longue, plus tu marques.

GOAT GRID — Une grille de neuf cases, des critères croisés en ligne et en colonne. Trouve un joueur qui coche les deux à chaque fois. Trois vies, une nouvelle grille chaque jour.

GOAT GUESS — Pense à un footballeur, actuel ou retraité. Le Devin te pose des questions et le trouve, en général en une vingtaine.

TROUVE LE JOUEUR — Six essais pour identifier un joueur mystère. Chaque proposition dévoile des indices — nationalité, zone, poste, âge, club — avec un retour façon Wordle. Le parcours reste caché : pure déduction.

JOUE CONTRE DE VRAIS JOUEURS

Duel en ligne sans code : on te trouve un adversaire et vous jouez la même série de clubs, chacun de son côté. Ou crée un salon privé et partage le code à tes potes.

GOAT GRID se joue aussi en versus, jusqu'à huit sur la même grille, en deux minutes.

UN CLASSEMENT QUI SE MÉRITE

Ton meilleur score du jour, dans chaque mode, rapporte des points — plafonnés. Rejouer vingt fois le même mode ne rapporte rien de plus : pour monter, il faut jouer plusieurs modes sur plusieurs jours. Le champion du mois entre au Hall of Fame.

LA DEVINETTE DU JOUR

Un joueur mystère par jour, le même pour tout le monde, avec ses clubs et son poste pour seuls indices. Une série à tenir : reviens demain pour le suivant.

UNE COLLECTION À DÉBLOQUER

Ton expérience débloque des grades et des cartes de collection. Choisis ton badge, affiche ton drapeau à côté de ton pseudo.

SANS COMPTE, SANS FORMULAIRE

Tu choisis un pseudo et tu joues. Pas d'adresse e-mail, pas de mot de passe. Un code de récupération te permet de retrouver ta progression sur un autre appareil.

Six langues : français, anglais, allemand, italien, portugais, espagnol.

Une question, un joueur qui manque, une erreur dans un effectif ? contact@goatfc.fr
```
