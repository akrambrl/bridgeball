# Audit du tirage des questions — Plug, Mercato, Reveal, Battle

Question posée le 10 août 2026 : *« est-ce que ce ne sont pas toujours les mêmes
questions qui sortent ? »*

Réponse courte : **trois modes sur quatre allaient bien, un allait mal.**
GOAT Battle reposait deux fois la même question dans 30 % des parties — dans la
**même** partie de 90 secondes. Et « Trouve le joueur » avait la bonne protection,
mais la jetait à chaque ouverture du mode. Les deux sont corrigés.

Les deux arbitrages de contenu que l'audit avait laissés en suspens — le vivier
étroit du facile dans Le Plug, et les 20 clubs de Battle — sont tranchés eux aussi,
[plus bas](#les-deux-arbitrages-tranchés).

## Méthode

La variété ne se lit pas dans le code. Un tirage parfaitement aléatoire répète
tout le temps s'il tire dans un vivier de trente questions : ce qui décide, c'est
la **taille du vivier** — une propriété des données — et la **mémoire** de ce qui
a déjà été posé.

`scripts/audit-tirage.mjs` simule donc des parties et compte. Il n'écrit rien et
ne touche pas à la production.

```
node scripts/audit-tirage.mjs            # 2000 parties par mode
PARTIES=5000 node scripts/audit-tirage.mjs
```

Deux choix de méthode qui comptent :

- **Le script n'implémente pas le tirage, il l'exécute.** `buildPontDB`,
  `DUEL_CLUBS`, `duelRollPair` et les listes de clubs vivent dans
  `LePont.jsx`, un composant React que Node ne peut pas importer. Plutôt que de
  les recopier — ce qui auditerait la copie, et afficherait encore les vieux
  chiffres le jour où le vivier change — le script lit le source et en découpe
  les déclarations. Les règles anti-répétition, elles, ont été sorties dans
  `src/lib/tirage.js` : le script les importe pour de vrai.
- **Le nombre de questions par partie vient de la production, pas d'une
  estimation.** Sur `bb_scores`, la médiane de `pont / facile` est de 315 points ;
  une bonne réponse en facile vaut 10 + 5 si rapide + 0/10/20/30 de combo, soit
  ~25 en moyenne sur une série → **13 questions** par partie de 90 s. GOAT Battle
  n'écrit rien dans `bb_scores`, donc là le chiffre est calculé : 90 s, ~7 s par
  manche tirage compris → 12 manches.

Trois mesures par mode :

| Mesure | Ce qu'elle dit |
|---|---|
| **vivier** | combien de questions distinctes le mode peut poser |
| **reprise** | part des questions d'une partie déjà vues dans la précédente — ce que le joueur ressent |
| **médiane avant répétition** | au bout de combien de parties on revoit une question |

## Résultats

### 1. The Plug — sain

| Difficulté | Vivier | Reprise | Médiane avant répétition |
|---|---|---|---|
| facile | 579 paires (259 avant l'arbitrage) | 0,0 % | 5 parties |
| moyen | 4 302 paires | 0,0 % | 9 parties |
| expert (Crescendo) | 1 337 paires | — | — |

Total : **6 218 paires de clubs**. La reprise à 0 % vient d'un garde-fou qui
existait déjà : `endRound()` mémorise les 30 premières paires de la queue dans
`goatfc_recent_pairs_<diff>`, plafond 60, et `startRound()` les repousse en fin de
queue. Deux parties consécutives ne se recoupent donc jamais.

**Le point faible était le facile : 259 paires tirées de 32 clubs seulement.**
À 13 questions par partie, un joueur régulier faisait le tour du vivier en une
vingtaine de parties, après quoi tout était du recyclage. Ce n'était pas un bug du
tirage mais le filtre `POPULAR_CLUBS_FACILE`, qui n'admet une paire en facile que
si **les deux** clubs y figurent. Tranché plus bas.

### 2. The Mercato — le plus sain des quatre

Un seul tirage par partie : le joueur de départ. Tout le reste découle de ses
clubs et des réponses données.

| Difficulté | Joueurs éligibles | dont actifs (tirés 80 % du temps) | Médiane avant répétition |
|---|---|---|---|
| facile | 202 | 114 | 21 parties |
| moyen | 1 870 | 1 521 | 59 parties |
| expert | idem facile (Crescendo démarre en facile) | 114 | — |

Rien à corriger. La seule réserve : en facile, 80 % des tirages viennent d'un
vivier de 114 joueurs actifs, ce qui explique la médiane de 21 parties.

### 3. Trouve le joueur — la protection existait, elle était jetée

| | Joueurs distincts sur 5 000 parties | Médiane avant répétition |
|---|---|---|
| **avant** — mémoire neuve à chaque ouverture | 973 (79 % du vivier) | **19 parties** |
| **après** — mémoire persistée | 1 229 (99,9 % du vivier) | **190 parties** |

`randomPlayer()` refuse déjà de reproposer un joueur avant d'avoir épuisé son
pool. Mais la liste des vus vivait dans un `useRef(new Set())`, donc elle repartait
**vide à chaque montage du composant** — c'est-à-dire à chaque ouverture du mode.
La protection ne servait qu'au joueur qui enchaînait les manches sans fermer.

**Corrigé** : la liste est persistée dans `bb_reveal_vus`. Un facteur 10 sur le
délai avant répétition, sans toucher au vivier ni au hasard.

Deux détails d'implémentation :

- `useState(chargerVus)` et non `useRef(chargerVus())` : l'argument d'un `useRef`
  est évalué à **chaque** rendu même s'il est ignoré — on relirait le
  `localStorage` à chaque frappe au clavier. L'initialiseur d'un `useState` ne
  tourne qu'une fois.
- La liste est filtrée au chargement contre les noms encore présents dans la
  base. Sans ça, une fiche renommée ou retirée resterait mémorisée pour toujours
  et rognerait le vivier sans qu'aucun cycle ne puisse l'en sortir.

### 4. GOAT Battle — le vrai problème

| | Vivier | Parties posant **deux fois** la même question | Médiane avant répétition |
|---|---|---|---|
| **avant** | 189 paires (20 clubs) | **29,8 %** | **2 parties** |
| **après** | 544 paires (37 clubs) | **0,0 %** | **8 parties** |

`duelRollPair()` tirait deux clubs au hasard parmi 20, refusait la paire sans
joueur commun, et **n'avait aucune mémoire** : ni des manches déjà jouées dans la
partie en cours, ni des parties précédentes. C'était le seul des quatre modes sans
garde-fou — Le Plug en a un (60 paires), Le Mercato aussi (5 starters).

Sur 20 clubs il n'existe que **189 paires jouables**. À 12 manches par partie, une
partie sur trois posait donc deux fois la même question, à quelques dizaines de
secondes d'intervalle. C'est la répétition la plus visible des quatre modes, parce
que c'est la seule qu'un joueur ne peut pas ne pas remarquer.

**Corrigé** : `duelRollPair()` mémorise ses 60 dernières paires dans
`goatfc_recent_battle_pairs` et les écarte. Trois choix :

- **La mémoire vit dans le tireur, pas chez l'appelant.** Cinq sites tirent une
  paire (solo, partie rapide, manche suivante solo, lancement 1v1, manche suivante
  1v1) ; en la mettant dans `duelRollPair`, aucun ne peut oublier de l'appliquer.
  En 1v1 seul l'hôte tire — l'invité lit `club_c1`/`club_c2` dans la ligne du
  salon — donc une mémoire locale suffit.
- **Les paires retenues sont énumérées une fois**, au chargement. La forme
  d'origine (« deux clubs au hasard, on recommence si ça ne va pas ») ne permet
  pas d'exclure : sur un vivier rétréci elle épuise ses 80 essais et retombe sur
  le repli — qui était `Real Madrid / Barcelona`, donc la paire la plus vue.
- **Le sens d'affichage reste tiré.** Sinon une même paire se présenterait
  toujours dans le même ordre sur les rouleaux de la machine à sous.

60 mémorisées sur 544 : il reste toujours au moins 484 candidates, le tirage ne
peut pas se retrouver coincé. Et si un jour quelqu'un réduit `DUEL_CLUBS` sans
baisser le plafond, `tirerEnEvitant` rouvre tout plutôt que de ne rien rendre —
mieux vaut une répétition qu'un mode qui ne démarre pas.

## Les deux arbitrages, tranchés

L'audit avait laissé deux décisions de contenu de côté. Elles sont prises, et le
raisonnement a tenu au même critère dans les deux cas.

### Le critère : « replaçable », pas « élite »

Les deux listes de clubs — `POPULAR_CLUBS_FACILE` pour Le Plug, `DUEL_CLUBS` pour
Battle — encodent la même question, et elle avait été mal posée. Ce qui rend une
question difficile, ce n'est pas le palmarès du club : c'est de ne pas reconnaître
son nom. Et pour Le Plug, le second facteur — connaître un joueur qui relie les
deux clubs — est **déjà garanti ailleurs** : une paire ne tombe en facile que si
au moins un joueur de difficulté facile la relie (`buildPontDB`). La liste ne
décide donc que de la reconnaissance du nom.

L'Everton n'a rien gagné depuis trente ans et reste immédiatement identifiable.
Le retenir n'expose personne. C'est ce qui a débloqué les deux arbitrages.

Le script vérifie désormais la cohérence des deux listes : **les 37 clubs de Battle
sont tous dans les 59 clubs jugés reconnaissables.** Battle ne peut plus poser un
club que Le Plug juge trop obscur pour son niveau facile.

### Le Plug facile : 32 → 59 clubs, 259 → 579 paires

Ajoutés, tous replaçables par un spectateur occasionnel : Everton, West Ham, Aston
Villa, Leicester ; Sevilla, Valence, Villarreal, Bilbao, Betis ; Lazio, Fiorentina,
Atalanta ; Leverkusen, Leipzig, Francfort, Schalke ; Lille, Nice, Lens, Rennes ;
PSV, Feyenoord ; Besiktas ; Flamengo, Boca, River, Santos.

Les quatre clubs de Ligue 1 méritent un mot : le public de l'app est d'abord
francophone, et ces noms lui sont aussi familiers que le haut de la Premier League.

**Effet** : le tour complet du vivier passe de 20 à **45 parties**. Le moyen perd
320 paires (4 622 → 4 302) puisqu'elles montent en facile — négligeable sur
4 300. Le facile reste une rampe d'accès et non un domicile, mais 20 parties,
c'était trop court pour une rampe.

### GOAT Battle : 20 → 37 clubs, **et** une barre de qualité

Élargir seul aurait été une erreur, et c'est la mesure qui l'a montré : sur les
20 clubs d'origine, **47 paires sur 189 n'avaient aucune réponse célèbre** — dont
`Real Madrid / AS Roma`, 10 réponses et pas une connue. À 37 clubs sans barre, les
manches sans réponse trouvable seraient passées de 6 à **105**.

La barre, dans `duelPaireRetenue` : une paire est retenue si elle a **au moins une
réponse célèbre, ou au moins trois réponses**. Les deux branches sont nécessaires.

- Sans la première, `Atletico / Dortmund` passe avec son unique joueur commun
  inconnu : dix secondes pour une réponse que personne ne trouve, c'est une manche
  morte.
- Sans la seconde, on jetterait `Sevilla / Manchester City` et ses 8 réponses dont
  aucune « facile ». Ce n'est pas une manche morte, c'est une bonne question pour
  qui suit le foot.

**Effet** : 189 → **544 paires** (×2,9), et 105 manches mortes écartées au passage.
Les deux axes progressent en même temps — plus de variété *et* des questions plus
justes. Vérifié à la main sur les paires réellement tirées : `Lyon / Newcastle`
donne 6 réponses (Ben Arfa, Loïc Rémy…), `Fiorentina / Monaco` en donne 3
exactement — la barre — dont Jovetić.

Restent dehors des clubs anglais de milieu de tableau très fournis en base
(Sunderland, Fulham, Nottingham Forest, Leeds, Southampton, Crystal Palace) :
leurs croisements avec l'élite sont trop minces pour passer la barre, et les
retenir ferait entrer surtout des manches mortes.

## Ce que cet audit ne couvre pas

GOAT Grid, GOAT Guess et la Devinette du jour n'ont pas été audités — la question
ne portait pas sur eux. La Devinette du jour est de toute façon un cas à part :
elle tourne sur une liste mélangée avec une graine fixe, donc chaque joueur passe
une fois avant qu'un cycle recommence, par construction.

## Vérifications

- **Tests** : `src/test/tirage.test.ts`, 19 tests sur les règles pures. Deux
  comptent : l'un rejoue 200 parties de 12 manches sur un vivier de 189 et exige
  12 paires distinctes à chaque fois — la régression exacte que l'audit a trouvée ;
  l'autre vérifie les deux branches de la barre de Battle.
- **Bout en bout** : `node scripts/apercu.mjs battle-manches` joue réellement une
  partie de GOAT Battle dans un navigateur et relève la paire posée à chaque
  manche. 14 manches, 14 paires distinctes, et les clubs ajoutés sortent bien
  (Aston Villa, Sporting, Lyon, Newcastle, Everton, Fiorentina, Monaco, West Ham…).
  Les tests couvrent la règle, l'audit la simule ; seul celui-là prouve que le vrai
  écran enchaîne des questions différentes.
- **Cohérence des listes** : contrôlée par le script à chaque exécution.
- Suite complète au vert (155 tests), `tsc --noEmit` propre, build OK.
