# Complétion des carrières depuis Wikidata

Passe menée le 9 août 2026 sur les 1931 joueurs `facile` et `moyen` — ceux que
les jeux citent le plus, et donc ceux dont une fiche trouée se voit.

Le déclencheur : la fiche de Seko Fofana ne contenait que Lens et Porto, alors
qu'il est aussi passé par Manchester City, Fulham, Bastia, Udinese et Al-Nassr.

## Résultat

**461 fiches complétées, 848 clubs ajoutés.** Le journal détaillé (avant/après
pour chaque joueur) est dans `docs/completion-carrieres.json`.

## Méthode

1. **Wikidata P54** donne la carrière, avec l'année de début en qualificatif.
   Choisi plutôt qu'un article : les clubs y sont des identifiants, pas des
   chaînes de caractères, donc pas d'ambiguïté sur *quel* Liverpool.
2. **Contrôle d'identité par l'année de naissance.** Un nom d'article ne
   désigne pas une personne : 431 joueurs ont été écartés parce que l'année de
   Wikidata ne collait pas à celle de la base à un an près.
3. **Traduction identifiant → écriture de la base**, nom par nom, le libellé
   primant sur l'alias. C'est ce qui empêche l'alias « Rangers » de Queens Park
   Rangers de capturer le Rangers FC de Glasgow, ou l'alias « Liverpool » du
   Liverpool de Montevideo de capturer celui d'Angleterre.
4. **Double source obligatoire.** Chaque ajout doit être confirmé par un lien
   interne vers l'article du club dans l'article Wikipédia du joueur. 447
   candidats sont tombés là — dont des vrais (Harry Kane à Leyton Orient), mais
   perdre du vrai coûte moins cher qu'écrire du faux.
5. **Insertion chronologique**, jamais en fin de liste : `clubs[0]` sert de
   « formé à » dans la devinette et donne les couleurs de l'avatar, le dernier
   sert de « club actuel ». 18 fiches ont été laissées telles quelles faute de
   repère — aucun de leurs clubs existants n'a de date chez Wikidata, donc
   toute insertion aurait inventé l'ordre. Seko Fofana en fait partie : c'est
   la première version de ce script qui avait expédié son Manchester City
   après son passage à Rennes.

## Effet de bord assumé

Les clubs formateurs entrent dans les fiches : Messi commence maintenant par
Newell's Old Boys puis Barcelone B. C'est plus juste, et c'est déjà la
convention de la base (Roy Keane commençait déjà par Cobh Ramblers), mais ça
déplace le club affiché en premier pour les joueurs concernés.

## Ce que la passe ne garantit pas

Elle importe ce sur quoi Wikidata et Wikipédia s'accordent — pas la vérité.
Quand les deux sources répètent la même erreur, elle passe : c'est le cas du
Sporting CP inscrit à Hernán Barcos, présent à la fois dans sa carrière
Wikidata et dans les catégories de son article.

Elle est aussi **incomplète par construction** : un club dont l'écriture n'a pas
pu être rattachée à un identifiant Wikidata n'est jamais ajouté (761 des 1647
écritures de la base sont dans ce cas), et 442 joueurs n'ont aucune carrière
renseignée chez Wikidata.

## Nettoyage préalable

Les jeux comparent les noms de clubs à l'identique. Avant de compléter, il a
fallu rallier **84 groupes d'écritures** qui désignaient le même club — repérés
en constatant que deux écritures pointaient le même identifiant Wikidata, puis
triés à la main. Cinq groupes ont été écartés après vérification joueur par
joueur : « FC Eindhoven » n'est pas le PSV, « Sarmiento » n'est pas Olimpo,
« AEL » n'est pas AEL Limassol, et « FCM » désignait Midtjylland, pas Metz.

Une seconde vague a été trouvée autrement : deux écritures présentes dans la
**même carrière** dont l'une est le nom tronqué de l'autre (« Malmö » et
« Malmö FF », « Deportivo » et « Deportivo La Coruna »). Les paires équipe
première / équipe réserve — Barcelone et Barcelone B — sont exclues de cette
règle : la base les distingue exprès.

## Rejouer

```
python3 scripts/mercato-effectifs.py      # effectifs Wikipédia (mercato)
python3 scripts/mercato-maxifoot.py       # journal des transferts (mercato)
```

La passe de complétion elle-même n'est pas scriptée dans le dépôt : elle a
demandé plusieurs milliers de requêtes et un tri manuel des groupes
d'écritures, ce qui se refait mieux à la main qu'en aveugle.
