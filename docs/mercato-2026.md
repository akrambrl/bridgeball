# Audit du mercato d'été 2026 — 22 gros clubs

Vérification demandée le 10 août 2026, fenêtre encore ouverte (elle ferme le
1er septembre). Objet : s'assurer que `src/players.jsx` porte les mouvements de
l'été pour les clubs qui comptent pour le public de l'app.

## Méthode

Les sites de mercato ne servent pas : ils mélangent les rumeurs et les
transferts actés, et leurs pages « saison 2026-2027 » recopient parfois le
tableau de l'année précédente. Pour Barcelone, un agrégateur annonçait sept
recrues dont Olise, Xavi Simons, Jonathan David, Kimmich et Julián Álvarez —
aucune n'était actée.

Source retenue : les pages **« saison 2026-27 »** de Wikipédia (anglais en
priorité, français en repli), qui portent un tableau de transferts **daté** et
**sourcé**. Chaque ligne retenue devait avoir une date en 2026. Les moves les
plus importants ont été recroisés avec une source primaire (site du club,
agence de presse).

Règle appliquée : on n'inscrit que ce qu'une source datée confirme. Un doute
laisse la fiche inchangée — une base muette vaut mieux qu'une base qui affirme
faux, puisque le jeu pose des questions dessus.

## Résultat

**La base était déjà à jour.** Sur les 22 clubs, 71 arrivées permanentes
confirmées ont été relevées ; 55 concernaient un joueur déjà présent dans
`players.jsx`, et **54 y étaient déjà enregistrées**.

Deux manques réels, tous deux parmi les mouvements les plus récents :

| Joueur | Mouvement | Date | Source |
|---|---|---|---|
| Santiago Castro | Bologna → AS Roma (35 M€, échange avec Dovbyk) | 30 juillet 2026 | [asroma.com](https://www.asroma.com/en/news/75704/santiago-castro-signs-for-roma) |
| André Silva | Elche → Porto (libre, 2e passage) | 12 juin 2026 | [maxifoot](https://m.maxifoot.fr/porto/andre-silva-est-de-retour-officiel-foot-457616.htm) |

Plus, corrigé juste avant dans la même série : **Lucas Digne** (Aston Villa →
PSG, 9 août 2026), dont il manquait aussi le **premier** passage parisien
(2013-2015) et le prêt à Rome (2015-2016).

La base est donc à jour jusqu'à fin juillet ; ce qui manquait tenait aux dix
derniers jours.

## État par club

| Club | Tableau exploitable | Arrivées permanentes 2026 | Manque dans la base |
|---|---|---|---|
| Real Madrid | oui | 6 (Cucurella, Konaté, B. Silva, Dumfries, Espí, Diomande) | — |
| Barcelone | oui | 3 (Gordon, Adeyemi, Bisiwu) | — |
| Atlético | oui | 3 (Grimaldo, Hjulmand, Lee Kang-in) | — |
| Liverpool | oui | 3 (Jacquet, V. Muñoz, Ndukwe) | — |
| Arsenal | oui | 4 (Hincapié, Meslier, Tzolis, B. Guimarães) | — |
| PSG | oui | 3 (Akliouche, Digne, Longoni) | Digne, corrigé |
| Man. United | oui | 6 (A. Santos, Darlow, Tielemans, Thompson, Margetson, Orozco) | — |
| Man. City | oui | 4 (Charles, Monga, E. Anderson, Detourbet) | — |
| Bayern | oui | 4 (Saibari, N. Brown, Marić, Srb) | — |
| Dortmund | oui | 6 (Gadou, Lerma, Karetsas, Prates, Ramaj, Campbell) | — |
| Inter | oui | 4 (Akanji, Stanković, Provedel, Stones) | — |
| AC Milan | oui | 3 (G. Ramos, Gila, Diawara) | — |
| AS Roma | oui | 4 (Ghilardi, Malen, Castro, Koulierakis) | **Castro** |
| Juventus | oui | 6 (Ekhator, Çelik, Alajbegović, Kolo Muani, Boga, Openda) | — |
| Chelsea | oui | 8 (Palestra, Emegha, Quenda, Rogers, Lacroix, Welbeck, Barco, Henderson) | — |
| Lyon | oui | 6 (Duranville, Bidstrup, Boudache, Kamara, Ouédraogo, Bacher) | — |
| Porto | oui | 4 (J. Afonso, A. Silva, Granaas, Hwang In-beom) | **André Silva** |
| Marseille | tableau VIDE | 0 permanente au 9 août ; Medina et Weah passés de prêt à définitif, déjà en base | — |
| Lille | tableau VIDE | 0 | — |
| Sporting CP | tableau VIDE (0 €) | 0 | — |
| Strasbourg | pas de source fiable | del Blanco, Brantlind, Diogo Sousa, Jørgensen (prêt ?) — aucun en base | non tranché |
| Bayer Leverkusen | pas de page saison | Luca Erlein (Hoffenheim, 25 juillet) — pas en base | non tranché |

## Arrivées concernant des joueurs ABSENTS de la base

Seize noms, presque tous des jeunes ou des joueurs de rotation : Carlos Espí,
Jesse Bisiwu, Ifeanyi Ndukwe, Alessandro Longoni, Tynan Thompson, Kit
Margetson, Cristian Orozco, Emmanuel Emegha, Matteo Marić, Matouš Srb, Justin
Lerma, Kauã Prates, Cole Campbell, Aleksandar Stanković, Sankhoun Diawara,
Kaïl Boudache.

Les ajouter n'est pas une correction de données, c'est un choix de couverture :
chaque fiche demande une difficulté, une nationalité, un poste et une année de
naissance, et un joueur inconnu du public rend une devinette injouable. À
trancher au cas par cas — Emegha (Strasbourg → Chelsea, 22 M£) et Stanković
sont les plus défendables.

## L'ORDRE compte : le dernier club est publié

`riddleClues()` dans `FindPlayer.tsx` publie « 🏁 Dernier maillot : X » à partir
du **dernier élément** de `clubs`. Ajouter un club ne suffit donc pas : il doit
être ajouté **à la fin**, et un joueur qui revient dans un club y figure deux
fois. Sans ça, l'énigme partagée annonce un maillot que le joueur ne porte plus.

Contrôle passé sur les 55 joueurs concernés : trois fiches ne finissaient pas
par leur club de 2026, et une seule était fausse.

- **Randal Kolo Muani** finissait par Tottenham. Il est à la Juventus depuis le
  2 août (38 M€ + 12 de bonus,
  [annonce du PSG](https://www.psg.fr/en/content/randal-kolo-muani-completes-move-to-juventus-psg-2026)) —
  et comme il y était déjà en prêt en 2025, la Juve apparaît deux fois. Corrigé.
- **Loïs Openda** finit par Lyon : c'est juste. La Juve l'a acheté à Leipzig
  puis prêté à Lyon le 28 juillet.
- **Mathys Detourbet** finit par Monaco : c'est juste aussi. City l'a acheté à
  Troyes puis prêté à Monaco immédiatement.

Les deux derniers cas disent la règle : quand un club achète pour prêter aussitôt,
c'est le club de prêt qui va en dernier, parce que c'est là que le joueur joue.

## Signalements ponctuels après l'audit

| Signalé | Vérification | Décision |
|---|---|---|
| Trevoh Chalobah → Côme | Officialisé le 9 août, 30 M€ + 6, contrat de 5 ans, annoncé par le club ([ESPN](https://www.espn.com/soccer/story/_/id/49568762/como-announce-signing-trevoh-chalobah-chelsea)) | **écrit** — club « Como » dans la base, pas « Côme » |
| Darwin Núñez → Trabzonspor | **Pas signé.** Accord de principe pour un PRÊT depuis Al-Hilal, vice-président en route pour l'Arabie saoudite, ni visite médicale ni annonce | **non écrit** — à reprendre quand c'est officiel |

Le second cas est exactement celui pour lequel la règle existe : la presse titre
« accord trouvé », ce qui n'est pas « transfert acté ». Sur un jeu qui pose des
questions, écrire un transfert qui ne se fait pas revient à inventer une réponse.

## Passe du 11 août

| Mouvement | Vérification | Décision |
|---|---|---|
| **Ronald Araújo**, Barcelona → Liverpool | Officiel : prêt payant avec option d'achat à 55 M€, annoncé par les deux clubs, le joueur s'entraîne déjà à Kirkby | **écrit** — Liverpool ajouté en fin de liste |
| **Idrissa Gueye** → Al Diriyah (libre) | Officiel : annonce du club saoudien le 9 août, en fin de contrat à Everton | **écrit** |
| **Facundo Medina**, Marseille → Bayer Leverkusen | Accord seulement (kicker parle d'une « Einigung » : 20 M€ + bonus, contrat jusqu'en 2031), aucune annonce de club | **non écrit** |
| **Darwin Núñez** → Trabzonspor | Toujours pas signé au 11 août : « 99 % », signatures annoncées « dans quelques jours », aucun dépôt KAP | **non écrit** |

Vérifier Gueye a fait remonter **trois erreurs de données** qui n'avaient rien à
voir avec son transfert, et qui étaient toutes plus graves que lui :

1. `players.jsx` s'arrêtait au **PSG** alors que `clubSpells.ts` portait déjà son
   retour à Everton en 2022. L'énigme publiait donc « Dernier maillot : PSG »
   depuis quatre ans.
2. Il figurait dans `RETIRED_PLAYERS` alors qu'il venait de signer. Ce drapeau
   n'est pas décoratif : il pilote la pondération 80/20 des joueurs actifs dans
   The Plug et The Mercato, et `dailyPool()` exclut les retraités de la devinette
   du jour — un actif marqué retraité disparaît de la rotation quotidienne.
3. Son poste était `attaquant` au lieu de `milieu`. GOAT GRID croise les postes
   comme critères de grille : un poste faux rend une case du jeu fausse.

La première est verrouillée par un test (`src/test/coequipiers.test.ts`) : **un
passage encore ouvert dans `clubSpells` doit être le dernier club de
`players.jsx`**. L'invariant plus large — « le dernier club des deux fichiers
concorde » — a été mesuré puis **rejeté** : il échoue pour 144 des 341 joueurs
datés, parce que `clubSpells` est volontairement partiel (Iniesta y finit à
Barcelone, la base le suit jusqu'à Emirates Club). Seule la version étroite est
vraie, et c'est exactement la règle qui avait lâché.

Au passage, **Filip Jørgensen → Strasbourg** est confirmé comme un **prêt**
(Chelsea le prête pour la saison), ce qui tranche une ligne laissée « non
tranché » par l'audit initial. Rien à écrire pour autant : le joueur n'est pas
dans `players.jsx`, l'y mettre reste un choix de couverture.

## Passe du 12 août

Demandée à partir d'un signalement : « Rulli à Manchester City ».

| Mouvement | Vérification | Décision |
|---|---|---|
| **Gerónimo Rulli**, Marseille → Man. City | Officiel : permanent, 3,6 M€, contrat de 2 ans, doublure de Donnarumma après le départ de Trafford à Leeds ([beIN](https://www.beinsports.com/en-us/soccer/premier-league/articles/rulli-joins-manchester-city-to-strengthen-goalkeeping-options-2026-08-07)) | **écrit** — City ajouté une **2ᵉ** fois |
| **Romelu Lukaku**, Napoli → Fenerbahce | Officiel : permanent, 6 M€ + bonus ([ESPN](https://www.espn.com/soccer/story/_/id/49591252/fenerbahce-sign-romelu-lukaku-napoli)) | **écrit** |
| **Nahuel Molina**, Atlético → AS Roma | Officiel : permanent, ~18 M€, contrat jusqu'en 2029 ([RomaPress](https://romapress.net/official-nahuel-molina-joins-roma)) | **écrit** |
| **Franjo Ivanović**, Benfica → Lens | Officiel : prêt jusqu'en fin de saison 2026-27, sans option d'achat, annoncé par Benfica ([slbenfica.pt](https://www.slbenfica.pt/en-us/agora/noticias/2026/08/12/futebol-benfica-ivanovic-emprestimo-lens)) | **écrit** |
| **Mohamed Salah**, Liverpool → Trabzonspor | Officiel depuis le 6 août, libre, 2 ans ([Al Jazeera](https://www.aljazeera.com/sports/2026/8/6/mohamed-salah-signs-two-year-deal-with-trabzonspor-after-liverpool-exit)) | **déjà en base** |
| **Darwin Núñez** → Trabzonspor | Toujours pas signé au 12 août : « attendu en Turquie pour la visite médicale et la signature ». Troisième passage où la presse titre l'accord | **non écrit** |
| **Cristian Romero** → Atlético | Simple piste, citée comme la raison du départ de Molina | **non écrit** |

Vérifiés au passage et **déjà à jour** : Guessand → Crystal Palace et Posch →
Mainz, tous deux officialisés le 12 août ; Tonali, Senesi, Mateus Fernandes, van
Hecke → Tottenham ; Rogers → Chelsea ; van Dijk, toujours à Liverpool (contrat
prolongé jusqu'en 2027).

**Deux angles morts de l'audit initial, confirmés par cette passe.** Les 22 clubs
étaient balayés sur leurs *arrivées* : un départ vers un club hors liste
n'apparaissait jamais. Salah → Trabzonspor était donc invisible pour la méthode —
il n'était en base que par chance. Et **Tottenham ne figurait pas dans les 22**,
alors qu'ils ont recruté pour plus de 260 M€ cet été.

Deux noms de ce marché restent **absents** de `players.jsx` : **Andy Robertson**
(Liverpool 2018-2026 → Tottenham, libre) et **Martin Dubravka**. Le premier est le
plus défendable de tous les manques relevés jusqu'ici — neuf saisons à Liverpool,
capitaine de l'Écosse. C'est un choix de couverture, pas une erreur de données.

### `clubs.length` n'était pas un nombre de clubs

Écrire Rulli a fait apparaître un défaut qui n'avait rien à voir avec lui, et qui
touchait **80 joueurs**.

La liste `clubs` est ordonnée et son dernier élément est publié comme « 🏁 Dernier
maillot » : un joueur qui revient dans un club y figure donc deux fois. Mais
`clubs.length` était utilisé comme un nombre de clubs à trois endroits.

- **L'éligibilité à la devinette du jour** exige 3 à 9 clubs. Comptées avec les
  répétitions, les 10 entrées de **Zlatan Ibrahimović** (9 clubs) dépassaient le
  plafond : il ne sortait **jamais** en devinette du jour. Même cas pour
  **Lukaku**, **Nani** et **Valderrama**. À l'inverse, Trubin, Vítor Baía et
  Robbie Fowler y entraient avec **2** clubs réels, ce que le plancher de 3 existe
  précisément pour empêcher.
- **L'accroche de la notification** annonçait « 8 clubs » pour Rulli, qui en a
  porté 7.
- **L'indice « J'ai porté les couleurs de N clubs DIFFÉRENTS »** comptait les
  répétitions, ce que le mot « différents » démentait.
- Deux comptes de **clubs communs** dans le retour de partie : un joueur revenu
  dans un club valait deux clubs partagés, ce qui faisait passer la pastille au
  vert sur un seul maillot commun.

Les comptes passent désormais par `nbClubs()`. **La liste, elle, garde ses
doublons** — c'est le piège de cette correction : `new Set` conserve la *première*
occurrence, donc dédoublonner la liste ferait repasser Rulli pour un joueur de
Marseille. Un test fixe les deux moitiés de la règle.

Au passage, `LePont.jsx` définissait **deux fois** la clef `Deportivo La Coruna`
dans la table des couleurs de clubs, avec deux bleus différents. En JS la seconde
gagne : la première n'avait jamais eu d'effet. Retirée, l'avertissement de build
disparaît et aucune couleur ne change.

## À FAIRE APRÈS CHAQUE PASSE DE MERCATO

```bash
npm run devinette:rotation
```

Toucher à `players.jsx` peut faire entrer ou sortir un joueur du vivier de la
devinette du jour. Le calendrier étant désormais **écrit** dans
`src/lib/devinette-rotation.js`, il ne se réordonne plus tout seul — mais il faut
l'étendre pour que les nouveaux entrants finissent par passer. La commande n'ajoute
qu'à la fin de la liste et refuse d'écrire si elle détecte une répétition à moins
de douze jours.

Pourquoi ça compte : avant cette correction, chaque modification de `players.jsx`
réordonnait **tout** le calendrier, passé compris. En corrigeant le comptage des
clubs, le vivier est passé de 96 à 97 joueurs et les douze jours examinés ont tous
changé de joueur — la devinette a resservi quelqu'un qui venait de passer, et ça a
été signalé. Cinq modifications de `players.jsx` dans la même semaine, donc cinq
réordonnancements.

## Ce que cet audit ne couvre pas

- **Les prêts.** Plusieurs mouvements de l'été sont des prêts ou des retours de
  prêt (Openda prêté à Lyon, Kolo Muani revenu de Tottenham, Pavard revenu de
  Marseille). La base les enregistre comme des clubs à part entière, mais les
  relever demande une passe distincte, avec le même niveau de vérification.
- **Les départs vers des clubs hors de cette liste de 22.** Ils n'apparaissent
  que si le club d'arrivée était lui-même audité — l'échange Castro/Dovbyk n'a
  été vu que parce que Dovbyk partait à Bologne, déjà en base.
- **La fin de la fenêtre.** Elle ferme le 1er septembre 2026 : tout ce qui
  bouge en août reste à ajouter.
