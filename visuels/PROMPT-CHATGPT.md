# Prompt à donner à ChatGPT pour les visuels de mode

## Comment s'en servir

1. **Joins les images de référence** (`visuels/reference-charte.png` et le dossier
   `visuels/app/`) au premier message. Une DA se montre, elle ne se décrit pas.
2. **Un mode par message.** Les modèles d'image traitent mal une demande de six
   visuels d'un coup : ils mélangent les sujets. Après le premier, enchaîner avec
   « même style, même cadrage, même palette — maintenant le mode suivant : … ».
3. **Ne demande jamais de texte dans l'image.** Les modèles d'image écrivent de
   travers : lettres inventées, accents baladeurs, mots coupés. Le lettrage
   (« GOAT » + le nom du mode) et le logo se posent APRÈS, avec la vraie police.
   C'est aussi pour ça que le prompt réserve des zones vides.

---

## Le prompt (à copier tel quel)

> Tu es directeur artistique. Je fais **GOAT FC**, une app de quiz football. Je
> veux six illustrations, une par mode de jeu. Voici ma charte graphique et des
> captures de l'app en pièces jointes : respecte-les à la lettre.
>
> **Format** : portrait, ratio 3:4 (l'image finale fait 1086 × 1448 px). Si tu ne
> peux produire que du 2:3, compose le sujet bien au centre en laissant de la
> marge en haut et en bas, je recadrerai.
>
> **AUCUN TEXTE dans l'image.** Ni titre, ni logo, ni lettre, ni chiffre, ni
> onomatopée, ni inscription sur un maillot. J'ajoute le lettrage moi-même.
>
> **Zones à laisser libres** (décor uniquement, pas de sujet) : le **quart
> supérieur**, où viendra le logo, et le **tiers inférieur**, où viendra le titre.
> Le sujet occupe donc la bande centrale.
>
> **Palette — n'utilise QUE ces teintes :**
> - or `#F5C22B` — le fond, l'aplat dominant
> - or sombre `#D9A21A` — la trame de points, les aplats secondaires
> - encre `#081109` — le trait et les ombres (un noir à biais vert, jamais du noir pur)
> - nuit `#12160F` — les panneaux sombres
> - crème `#F2E7CE` — les blancs, les contours sur fond sombre
> - vert `#2A9B4E` et vert clair `#4FD07A` — le positif
> - rouge `#D93A2B` — l'urgence, un camp
> - bleu `#2A6FBF` — l'adversaire, l'autre camp
>
> **Le fond est JAUNE, pas bleu et pas noir.** L'app est un aplat d'or plein
> champ, avec des **lignes de vitesse** d'encre qui convergent vers le centre et
> une **trame sérigraphiée** de points d'or sombre. Le noir sert au trait, aux
> ombres et aux panneaux — pas de fond. Jaune et noir, dans cet ordre
> d'importance.
>
> **Style** : manga de football des années 1980 — trait épais et net, aplats
> francs, contours d'encre, ombres portées DURES et décalées (pas de flou).
> Énergie, poses dynamiques, cadrage en contre-plongée.
>
> **Interdits, sans exception :**
> - aucun dégradé, aucun néon, aucune lueur, aucun effet lumineux
> - aucun rendu 3D, aucun métal chromé, aucune texture photographique
> - aucune ombre floue — les ombres sont des aplats décalés
> - aucun personnage de manga existant, aucun joueur réel reconnaissable
> - aucun écusson ni maillot de club réel — invente des couleurs
> - pas de bleu ni de noir dominant : c'est le jaune qui tient l'image
>
> **Règle de lisibilité qui compte** : sur le jaune, seule l'encre se lit. Un
> élément clair (crème, blanc) posé directement sur l'or disparaît — il doit être
> à l'intérieur d'une forme cerclée d'encre. Vérifie ça sur chaque élément clair.
>
> **Premier mode — THE PLUG** : deux joueurs face à face, chacun d'un camp
> (l'un en vert, l'autre en bleu), et entre eux un lien qui les relie — l'idée est
> « quel joueur a joué dans ces deux clubs ». Le lien doit être le point de
> convergence des lignes de vitesse.

---

## Les cinq autres sujets

À enchaîner un par un, en rappelant « même style, même cadrage, même palette ».

| Mode | Le sujet à demander |
|---|---|
| **THE MERCATO** | Une chaîne de transferts sans fin : un joueur passe le ballon à un autre, qui passe à un autre, en enfilade. Idée de suite qui ne s'arrête pas. Accent or. |
| **GOAT BATTLE** | Un duel 1 contre 1, chronomètre de 90 secondes. Deux joueurs qui se percutent, l'un en rouge, l'autre en bleu, séparés par une fente d'énergie. Le mode le plus violent des six. |
| **GOAT GRID** | Une grille 3 × 3 vue en perspective, des cases remplies et d'autres vides, un joueur qui place un jeton dans une case. Idée de stratégie. |
| **GOAT REVEAL** | Un joueur mystère en silhouette d'encre, entouré de six indices en petits panneaux (maillots, drapeaux, chronologie). Idée de déduction. Accent bleu. |
| **GOAT GUESS** | Un devin : une silhouette encapuchonnée devant une boule où apparaît un footballeur. Idée « je lis dans tes pensées ». Accent vert clair. |

---

## Quand tu as les six

Envoie-les-moi : je recadre en 1086 × 1448, je pose le lettrage avec la vraie
police (Anton, comme le logo), et je branche les six fichiers dans l'app — ils
sont référencés à sept endroits dans le code, autant que ce soit fait d'un coup.

Si un visuel ressort bleuté ou avec un fond noir, c'est le signe que la palette
n'a pas pris : renvoie la planche `reference-charte.png` dans le fil et redemande
« refais-le avec le fond OR dominant ».
