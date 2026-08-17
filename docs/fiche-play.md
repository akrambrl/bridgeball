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

## Description complète — 2382 / 4000

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

Ton expérience débloque des grades et vingt-neuf cartes de collection. La dernière obtenue devient ta photo de profil. Affiche ton drapeau à côté de ton pseudo.

SANS COMPTE, SANS FORMULAIRE

Tu choisis un pseudo et tu joues. Pas d'adresse e-mail, pas de mot de passe. Un code de récupération te permet de retrouver ta progression sur un autre appareil.

Six langues : français, anglais, allemand, italien, portugais, espagnol.

Une question, un joueur qui manque, une erreur dans un effectif ? contact@goatfc.online
```

---

# Fiche App Store — ce qui CHANGE par rapport à Play

La description complète ci-dessus se recolle telle quelle : Apple plafonne aussi
à 4 000 caractères, et une fiche qui raconte deux histoires différentes selon le
store est une fiche qu'on oublie de mettre à jour d'un côté.

Trois champs n'ont PAS d'équivalent Play, et c'est là qu'il faut travailler.

## Sous-titre — 29 / 30

Propre à iOS, affiché sous le nom, et **indexé** par la recherche : c'est le
champ le plus rentable de la fiche après le nom. Il ne doit donc pas répéter
« GOAT FC », déjà indexé, mais porter le mécanisme et des mots qu'on tape.

```
Quiz foot : 2 clubs, 1 joueur
```

## Mots-clés — 89 / 100

Play n'a pas ce champ (il indexe la description entière), Apple si — et lui seul
compte côté iOS.

Quatre règles, qui expliquent chaque absence :

- **pas d'espace après les virgules** : Apple les compte, et chacun est un
  caractère perdu sur cent ;
- **pas de mot déjà présent dans le nom ou le sous-titre** : « GOAT », « FC »,
  « quiz », « foot », « clubs », « joueur » sont déjà indexés par ces deux
  champs. Les répéter ne double pas leur poids, ça gaspille la ligne — d'où leur
  place ici quand même pour « foot » et « quiz » : ils viennent du sous-titre et
  sont conservés au singulier, Apple ne dérivant pas les pluriels de façon fiable ;
- **le singulier**, pour la même raison ;
- **pas de nom de catégorie** (« jeux », « sport ») : Apple les applique déjà.

```
foot,football,quiz,trivia,mercato,transfert,joueur,club,devinette,grille,duel,championnat
```

## URL d'assistance — obligatoire, et elle n'existait pas

Apple refuse la soumission sans elle, et une revue peut la rejeter si elle ne
mène pas à une vraie aide. Le site n'avait que confidentialité, conditions et
règlement — trois pages juridiques, aucune page de support.

```
https://goatfc.fr/support/
```

`public/support/index.html`, bilingue FR/EN comme ses voisines : contact,
signalement d'une fiche fausse, code de récupération, fonctionnement du
classement et du concours, suppression de compte, pourquoi des publicités, et
les trois pannes les plus probables.

Elle sert aussi à Play, dont le champ d'assistance accepte une URL en plus de
l'email.

## Catégories

```
Principale : Jeux  →  sous-catégories : Quiz  puis  Sport
Secondaire : Sport
```

Apple demande DEUX sous-catégories pour un jeu, et ce sont elles qui décident des
classements où l'app apparaît. « Quiz » d'abord parce que c'est le mécanisme ;
« Sport » ensuite parce que c'est le sujet. L'inverse mettrait l'app en
concurrence directe avec les simulateurs de football, où elle n'a rien à faire.

## Droits relatifs au contenu

```
Réponse : NON — l'app ne contient aucun contenu de tiers
```

Ce n'est pas une réponse de facilité, c'est un état de fait vérifié : l'app
n'affiche **aucun blason de club** ni logo de compétition (les clubs sont
représentés par leur nom sur les couleurs du maillot, redessinées), et les
vingt-neuf cartes de collection sont un personnage **original**, refait
précisément pour cette raison. Les noms de joueurs et de clubs sont des faits,
cités pour poser une question factuelle.

Répondre OUI obligerait à attester détenir des droits qu'on n'a pas : ce serait
la mauvaise réponse, et la plus risquée des deux.

## Classification d'âge

Répondre au questionnaire honnêtement ; les deux points qui ne sont pas
évidents :

- **concours** : l'app en organise un, mensuel, avec un lot. À déclarer.
  Ce n'est PAS du jeu d'argent — aucune mise, participation gratuite ;
- **interaction entre utilisateurs** : oui. Pseudos visibles, duels, défis
  ouverts. Il n'y a en revanche **aucune messagerie** dans l'app, et donc aucun
  texte libre échangé entre joueurs — seul le pseudo est choisi, et il passe par
  un filtre (`src/lib/pseudo.ts`).

## Tarification

```
Gratuit · tous les territoires
```

L'app est en six langues ; la restreindre à la France priverait de joueurs sans
rien simplifier. Le concours, lui, a ses propres conditions d'éligibilité — dans
le règlement, pas dans la disponibilité de l'app.

## Notes pour le vérificateur Apple

À coller dans « Informations de vérification de l'app ». Sans elles, un
vérificateur peut refuser parce qu'il croit qu'un compte est nécessaire.

```
Aucun compte n'est nécessaire : il suffit de choisir un pseudo à l'ouverture,
sans email ni mot de passe. Tout le contenu est accessible immédiatement.

L'app propose un concours mensuel gratuit récompensant la première place du
classement. Le règlement complet est accessible depuis le pied de page de
l'accueil et sur https://goatfc.fr/reglement/ — il précise que le concours
n'est ni organisé, ni parrainé, ni administré par Apple.

Les publicités sont récompensées et facultatives : le joueur les lance lui-même
en échange d'un bonus. Aucune publicité n'est imposée. L'autorisation de suivi
(ATT) est demandée au premier lancement ; la refuser ne bloque aucune fonction.

La suppression du compte est disponible dans l'app : Profil → Mon compte →
Supprimer mon compte.
```
