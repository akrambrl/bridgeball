# Dates par club — ce que la collecte a retenu, et ce qu'elle a refusé

Généré par `node scripts/spells-wikidata.mjs`, qui alimente `src/lib/clubSpells.ts`.
La table datée est la SEULE source autorisée à faire dire au jeu « j'ai joué avec X ».

## Bilan

- Cibles : **104** joueurs de difficulté `facile` non encore datés
- Retenus : **28**
- Refusés : **76**

Le taux de refus est élevé, et c'est le comportement voulu : mieux vaut aucun
indice qu'un indice faux. Les trois règles sont documentées en tête de la
section ajoutée dans `clubSpells.ts`.

## Refus par cause

### Clubs sans dates (56)

Un club de `players.jsx` que Wikidata ne date pas. **Deux causes très différentes** se cachent ici :

- un transfert trop récent pour Wikidata (Openda à la Juventus et à Lyon) ;
- **un club qui n'a rien à faire dans la fiche.** C'est ainsi qu'a été trouvée
  l'erreur Konaté : la base lui donnait *Lens*, or il vient de *Sochaux*.
  Corrigé. Les autres lignes de cette liste méritent le même examen.

- Salvatore Schillaci — Messina
- João Cancelo — Benfica B, Benfica
- Michy Batshuayi — Marseille
- Raphaël Varane — Lens
- Joselu — Hoffenheim
- Timothy Weah — Marseille
- Geoffrey Kondogbia — Lens, Atletico Madrid, Marseille
- Gerónimo Rulli — Manchester City, Marseille
- Diego Carlos — Estoril, Porto B
- Emerson Palmieri — Marseille
- Mario Lemina — Marseille, Wolverhampton
- Ángel Di Maria — Benfica
- Heung-min Son — Hamburg, LAFC
- Gabriel Jesus — Palmeiras
- Olivier Giroud — LAFC
- Diogo Jota — Wolverhampton
- Fábio Coentrão — Benfica
- Ruud van Nistelrooy — Hamburg
- Fabio Cannavaro — Shabab Al Ahli
- Endrick — Palmeiras
- Ederson — São Paulo, Ribeirão, Benfica, Galatasaray
- Ibrahima Konate — Lens
- Claude Makelele — Marseille
- Lothar Matthaus — NY MetroStars
- Ricardo Quaresma — Al Ahli, Shabab Al Ahli
- Romário — Vasco da Gama, Flamengo
- Peter Schmeichel — Brondby
- Johan Cruyff — LA Aztecs
- Ruud Gullit — Haarlem, Sampdoria
- Christian Karembeu — Sampdoria
- Marco Asensio — Real Mallorca
- Fabien Barthez — Marseille
- Malik Tillman — Greuther Fürth, Bayern Munich
- Emiliano Martínez — Independiente, Wolverhampton
- Julián Álvarez — River Plate
- Cristian Romero — Belgrano
- Alphonse Areola — Lens
- Jesé Rodríguez — Ankaragücü
- Willian Pacho — Antwerp
- Nathan Aké — Feyenoord
- Lois Openda — Lens, Juventus FC, Lyon
- Amine Gouiri — Rennes, Marseille
- Eric Cantona — Marseille, Bordeaux
- David Seaman — QPR
- Bixente Lizarazu — Bordeaux, Marseille
- David Trezeguet — River Plate
- Djibril Sidibé — Troyes
- David Ginola — Toulon, Racing Paris
- Jean-Pierre Papin — Marseille, Bordeaux, Guingamp
- James Rodríguez — Banfield
- Gianluca Vialli — Sampdoria
- Jorginho — Flamengo
- Édouard Mendy — Le Havre, Marseille, Reims
- Jérémie Boga — Atalanta BC, Nice, Juventus FC
- Aymeric Laporte — Bilbao Athletic
- Jack Wilshere — AGF Aarhus

### Périodes contradictoires (16)

Deux clubs différents sur des années qui se chevauchent : une des deux lignes
de Wikidata est fausse, et on ne sait pas laquelle. Joueur refusé en entier.
Concerne aussi les prêts, que Wikidata note parfois en double avec le club
propriétaire.

- Bernd Schuster — Atletico Madrid 1996-1997 ET Pumas UNAM 1996-1997
- Carlos Valderrama — Deportivo Cali 1996-1997 ET Tampa Bay Mutiny 1996-1997
- Marcel Sabitzer — Borussia Dortmund 2023-2026 ET Manchester United 2023-2024
- Zlatan Ibrahimović — Malmö FF 1999-2001 ET Ajax Amsterdam 2000-2004
- André Schürrle — Borussia Dortmund 2016-2020 ET Fulham 2018-2019
- Donny van de Beek — Manchester United 2020-2024 ET Everton 2022-2023
- Andrés Iniesta — Barcelona 2001-2003 ET Barcelona B 2002-2018
- Divock Origi — Lille 2014-2015 ET Liverpool 2014-2022
- Gerard Piqué — Manchester United 2004-2008 ET Real Zaragoza 2006-2007
- Fabián Ruiz — Real Betis 2014-2018 ET Elche 2017-2018
- Dani Ceballos — Real Madrid 2017-2026 ET Arsenal 2019-2021
- Alessandro Bastoni — Atalanta BC 2017-2018 ET Inter Milan 2017-2026
- Samuel Umtiti — Barcelona 2016-2023 ET Lecce 2022-2023
- Ademola Lookman — Everton 2017-2019 ET RB Leipzig 2018-2022
- Ian Wright — Celtic 1999-2000 ET Nottingham Forest 1999-2000
- Marcos Alonso — Bolton 2010-2013 ET Real Madrid Castilla 2010-2011

### Autres (4)

- René Higuita — Real Valladolid (pas de date de debut)
- Calvin Bassey — Fulham (pas de date de debut)
- Michael Owen — aucun QID ne colle a l'annee 1979
- Pepe (Portugal) — aucun QID

## Joueurs ajoutés

- Alan Shearer
- Alisson Becker
- Andreas Brehme
- Bryan Robson
- Cody Gakpo
- Dennis Bergkamp
- Diego Maradona
- Désiré Doué
- Franco Baresi
- Gheorghe Hagi
- Lamine Yamal
- Luis Figo
- Lúcio
- Marco van Basten
- Michael Ballack
- Michel Platini
- Moussa Diaby
- Oliver Kahn
- Paul Breitner
- Paul Gascoigne
- Pelé
- Phil Foden
- Rivaldo
- Roberto Baggio
- Roger Milla
- Ronaldo Nazário
- Roy Keane
- Stefan de Vrij
