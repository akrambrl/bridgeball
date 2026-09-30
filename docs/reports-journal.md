# Journal de triage des signalements

Un bloc par passe. Le high-water mark vit dans `docs/reports-state.json` ; ce
fichier dit *pourquoi* chaque signalement a été fermé, ce que le simple compteur
ne dit pas. Utile surtout pour les **rejets** : sans trace, la même
revendication revient et on refait la vérification à zéro.

---

## Passe du 30 septembre 2026 — signalements 215 → 256 (42 lignes)

Répartition : 33 `gg_missed`, 4 `reveal_bug`, 4 `chain_missed`, 1
`wrong_player_club`. Vérification sur le web à la date du jour (transferts d'été
2026 compris) : la base + deux lots d'agents de recherche, puis recoupement
personnel des cas qui renversaient une décision passée. Transfermarkt n'était
pas consultable depuis l'environnement : clubs et dates viennent de Wikipedia,
des sites officiels des clubs et de la presse.

### Corrigés (10)

| id | Revendication | Correction |
|----|---------------|-----------|
| 216 | Di Stéfano × Real Madrid, Vainqueur LDC (GOAT Grid) | cinq Coupes des clubs champions de suite (1956-60) ; ajouté à `GG_CL_WINNERS`, le set n'avait pas de source avant 2000 |
| 219 | « Danilo » × Real Madrid, A joué en PL (GOAT Grid) | fiche manquante : seul l'attaquant de 2001 existait. Créé « Danilo Luiz » (né en 1991 : América Mineiro, Santos, Porto, Real Madrid, Man City, Juventus, Flamengo), aussi ajouté à `GG_CL_WINNERS` (2016, 2017) |
| 221, 256 | Savinho × Tottenham (GOAT Grid) | transfert officiel le **25 août 2026**, 75 M£ + 10 M£ de bonus (tottenhamhotspur.com). **La passe du 17 septembre l'avait retiré à tort** ; Tottenham est remis en dernier club |
| 234 | Nampalys Mendy × Metz (Mercato) | signé à Metz en 2026 (libre, après Watford) ; ajouté en dernier club |
| 236 | Mohamed Amoura × Nice (Mercato) | prêt de Wolfsburg à Nice, début septembre 2026 ; ajouté en dernier club |
| 241 | van Bronckhorst × Arsenal, Devenu entraîneur (GOAT Grid) | a entraîné Feyenoord, Guangzhou R&F, les Rangers, Beşiktaş ; ajouté à `GG_COACHES` |
| 245, 246 | Arbeloa × Real Madrid, Devenu entraîneur (GOAT Grid) | entraîneur du Real Madrid de janvier à juin 2026 ; ajouté à `GG_COACHES` |
| 228 | Pavard, « il est de nouveau à l'Inter » (Reveal) | fin de prêt à l'OM, option de 15 M€ non levée ; Inter Milan remis en dernier club (PR #905). Marseille reste dans sa carrière |

### Rejetés (32)

Aucune modification. Verdicts figés en négatif dans
`src/test/goatgrid-signalements.test.ts`.

| id | Revendication | Pourquoi non |
|----|---------------|--------------|
| 215 | Payet × Vainqueur CDM | n'a jamais été champion du monde |
| 217 | Asencio × Vainqueur LDC | premier match pro en novembre 2024 ; le Real n'a gagné ni la LDC 2024-25 ni la 2025-26 (PSG) |
| 218 | Jesús Navas × Real Madrid | Séville et Man City, jamais le Real |
| 220 | Dituro × Inter | aucun lien avec l'Inter ni la Premier League |
| 222 | Saibari × attaquant | milieu offensif (numéro 10) pour le Bayern et la Bundesliga |
| 223 | Coman × milieu | ailier |
| 224 | Daniel James × Chelsea | jamais à Chelsea |
| 225 | Figo × Espagne | portugais |
| 226, 227 | Guendouzi, Coman × Vainqueur CDM | ni l'un ni l'autre n'est champion du monde |
| 229 | Griezmann × Vainqueur LDC | jamais gagné la LDC |
| 230 | Juan Gabriel Rodríguez × Arsenal | Talleres, puis Atlético Tucumán ; aucun lien avec Arsenal |
| 231 | Nkunku × défenseur | attaquant |
| 232 | Brahim Díaz × attaquant | milieu offensif |
| 233 | Weah « pas attaquant » | ailier / piston, rangé « attaquant » (la base n'a que quatre postes) |
| 235 | Tielemans × Bundesliga | Anderlecht, Monaco, Leicester, Villa, Man United : jamais en Allemagne |
| 237 | Ander Herrera × Barcelone | jamais à Barcelone (et espagnol) |
| 238 | Marseille × Nottingham Forest (Nuno Tavares) | **fondé** : les quatre joueurs listés y sont passés (Tavares, Lodi, Samba, Ayew) ; Samba n'a joué qu'un match pro à l'OM (2014) mais compte |
| 239 | Chukwueze × Angleterre | nigérian |
| 240 | Juninho Paulista × Marseille | jamais à Marseille |
| 242 | Ignacio Fernández « sta » | aucun club en « Sta » ; saisie tronquée |
| 243 | Jens Odgaard × Arsenal | confondu avec Martin Ødegaard ; Odgaard est à Bologne |
| 244 | Dest × Pays-Bas | sélection des États-Unis |
| 247 | Tagliafico × Chelsea | Ajax puis Lyon, jamais Chelsea |
| 248, 255 | Ronaldo, Maldini × Vainqueur CDM | ni l'un ni l'autre n'a gagné la Coupe du monde |
| 249 | Weah × Fenerbahçe (Mercato) | PSG, Celtic, Lille, Juventus, Marseille |
| 250 | Arthur × Juventus, Brésil | Arthur **Melo** est déjà valide (Juventus, brésilien) : le joueur a choisi l'homonyme « Arthur » |
| 251 | Bernardo Silva × PSG, Brésil | portugais, jamais au PSG |
| 252 | Valentín Barco × Vainqueur LDC | a signé à Chelsea (août 2026) mais n'a pas gagné la LDC |
| 253 | Lucas Vázquez « MC, pas attaquant » | arrière droit / ailier, pas milieu central |
| 254 | Pépé, croix jaune sur les anciens clubs | demande de fonctionnalité, pas une erreur de données |

### Enseignements

- **Deuxième erreur du même genre** après Pavard : Savinho→Tottenham avait été
  jugé « jamais joué » le 17 septembre, alors que le transfert est officiel
  depuis le 25 août. `docs/REPORT-TRIAGE.md` le disait déjà : ne jamais se fier à
  une connaissance interne pour un transfert de la dernière saison.
- **Les homonymes produisent la moitié des faux signalements** (Arthur / Arthur
  Melo, Odgaard / Ødegaard, Sávio / Savinho, les deux Danilo). Piste : afficher
  l'année de naissance ou le club dans la liste de suggestions de GOAT Grid.

## Passe du 17 septembre 2026 — signalements 174 → 214 (41 lignes)

Répartition : 22 `gg_missed`, 13 `chain_missed`, 4 `wrong_player_club`,
2 `reveal_bug`. Vérification croisée Transfermarkt/Wikipedia (5 lots en
parallèle par type de signalement).

### Corrigés (6)

| id | Revendication | Correction |
|----|---------------|-----------|
| 175 | Christopher Operi × Le Havre (Mercato) | club manquant, ajouté entre Auxerre et Istanbul Başakşehir (2022-2025) |
| 182, 183 | Azor Matusiwa × Rennes (Mercato) | club manquant, ajouté entre Reims et Ipswich Town (transfert 22/01/2024) |
| 177 | Jens Odgaard × Inter Milan (pont) | club en trop — seulement en jeunes/Primavera, 0 match pro ; retiré |
| 206 | Christos Tzolis × Arsenal, attaquant (GOAT Grid) | fiché milieu, c'est un ailier/attaquant ; poste corrigé |
| 192, 193 | Manchester United × A joué en Serie A, Varane (GOAT Grid) | pas une fiche fausse : Como (Serie A depuis 2024-25) manquait à `GG_LIGUE_MAP.serie_a` dans LePont.jsx |

Trouvé au passage (hors périmètre du signalement, mais fiche fausse confirmée) :
Savinho listait à tort "Tottenham", où il n'a jamais joué — retiré.

### Rejetés (35)

Aucune modification. Motifs principaux :
- **Confusions entre joueurs similaires/homonymes** : Damien Delaney × Sevilla
  (c'est Thomas Delaney qui y a joué, id 195) ; Jorginho × Lyon (c'est Lloris,
  id 202) ; Samu Castillejo × Porto (c'est Samuel Omorodion dit "Samu", id 214) ;
  Sávio (fiche 1974) × Man City (c'est Savinho, déjà fiché séparément, id 212) ;
  Khephren Thuram × Inter Milan (c'est son frère Marcus, id 210) ; Carlos Bacca ×
  Torino (confusion avec Immobile/Rodríguez, id 199).
- **Transferts jamais conclus, seulement des rumeurs** : Tevez → AC Milan
  (négociations avortées 2012, jamais signé, id 191).
- **Nationalité sportive confondue avec l'origine du nom** : Jaminton Campaz est
  colombien, pas argentin (id 201) ; Federico Macheda est italien, pas argentin
  (id 208).
- **Trophée gagné par un club/pays différent, ou hors période du joueur** :
  Tomori parti de Chelsea avant leur sacre LDC 2021 (id 196) ; Inzaghi vainqueur
  CDM 2006 mais jamais à l'Inter (à l'AC Milan, id 209) ; Disasi finaliste perdant
  CDM 2022 (id 205) ; Camavinga débute en Bleu après la CDM 2018 (id 213) ; Porro
  déjà reconnu vainqueur CDM mais jamais passé par Arsenal (id 200).
- **Poste réel différent** : Declan Rice jamais à Tottenham (id 180) ; Harvey
  Elliott est milieu, pas défenseur (id 194) ; Danilo Pereira jamais à la Juventus
  (id 188) ; Upamecano n'a jamais joué en pro en France, débuts en Autriche
  (id 190) ; Di Lorenzo jamais à l'AC Milan (id 198) ; Batistuta et Soulé bien
  argentins mais jamais à l'AC Milan — Inter ou Roma, pas Milan (id 203, 204) ;
  Wesley Fofana jamais à Man City (id 207).
- **Club déjà correct côté fiche** (le pont ne produirait déjà pas cette
  réponse) : Wilmots (id 178), Reyes (id 179), Cédric Soares (id 181), Belhadj ×
  Sedan déjà présent (id 174).
- **Bug d'affichage, pas une erreur de données** : Sterling (id 184) et Tevez
  (id 185) — parcours vérifiés exacts, le pop-up « Donner la réponse » restait
  affiché par-dessus la réponse (corrigé par la PR #844, avant ces deux
  signalements du 11 septembre).
- Autres clubs jamais joués : Rangers (Østigård, id 176), club colombien (Jesé,
  id 186), Bačka Topola (Immobile, id 189), Lille (Lloris, id 197), Everton
  (Lindegaard, id 211).

---

## Passe du 7 septembre 2026 — signalements 60 → 173 (114 lignes)

Passe déclenchée par l'audit des parties jouées. Répartition : 81 `gg_missed`,
22 `chain_missed`, 11 `reveal_bug`. Chaque `gg_missed` a été rejouée contre la
base **actuelle** avec la vraie logique de la grille (`ggPlayerMatchesCriterion`)
pour trier les vrais refus des revendications erronées.

Enseignement de la passe : l'écrasante majorité des `gg_missed` « ça match
pourtant » étaient des **signalements périmés** — la fiche a été corrigée depuis
par les lots d'enrichissement et le mercato (Jonathan David n'avait pas encore
la Juve, Akliouche pas encore le PSG, etc.). Rejouées aujourd'hui, elles
passent. On ne re-corrige rien : la donnée est déjà bonne.

### Fondés (7)

| id(s) | Signalement | Ce qui n'allait pas |
|-------|-------------|---------------------|
| gg | Platini — Juventus × Devenu entraîneur | `GG_COACHES` incomplet : sélectionneur de la France 1988-92, ajouté |
| gg | Mihajlović — Inter × Devenu entraîneur | idem : Bologne, Milan, Torino, Serbie, ajouté |
| gg | Cruyff — Barcelone × Devenu entraîneur | idem : Ajax, Dream Team du Barça, ajouté |
| gg | Fàbregas — Chelsea × Devenu entraîneur | idem : entraîne le Côme depuis 2024, ajouté |
| gg (×4) | Barcola — Liverpool × A joué en L1 | transfert PSG → Liverpool (été 2026, ~116 M€) manquant. Ajouté ; « A joué en L1 » couvert par Lyon |
| chain (×2) | Delort — Ajaccio | AC Ajaccio (2010-13) manquant de la fiche. Ajouté |
| — | Rodri — Barcelone (×2) | déjà corrigé (#817) avant cette passe |

### Rejetés (les principaux)

- **Stales confirmés périmés** (fiche déjà correcte aujourd'hui) : Bruno
  Fernandes ×3 (Man Utd × milieu ✓), Jonathan David ×2 (Juve × attaquant ✓),
  Pedro Porro, Thomas Partey, Riqui Puig, Donny van de Beek, Maghnes Akliouche.
- **Erreurs de joueur** (le nom cité ne matche vraiment pas) : James Rodríguez
  × Espagne (colombien), Sadio Mané × Arsenal (jamais joué), Thiago Silva ×
  Barcelona, Robinho × Inter (c'était le Milan), Cristian Romero × Atlético
  (confusion avec l'Atalanta), Matteo Gabbia × milieu (défenseur), Louis Saha ×
  Crystal Palace, Schürrle × Bayern, Schillaci × Monaco… — tous corrects au refus.
- **`reveal_bug` déjà bons** : Ederson est bien fiché au Fenerbahçe (pas
  Galatasaray), Kessié milieu, Jorginho italien, Muriqi termine à Majorque,
  Openda → Lyon (prêt confirmé pour 2026-27). Aucune correction nécessaire.

Références : fr/en.wikipedia (infobox + palmarès), recoupées sur des sources de
transfert (CBS, Goal, Juventus.com) pour les mouvements récents.

---

## Passe du 8 août 2026 — signalements 27 → 59 (33 lignes)

Re-vérification complète, y compris les id ≤ 46 déjà comptés comme traités :
la passe précédente n'avait pas laissé de trace de ses verdicts.

Référence : fr.wikipedia (infobox, section Palmarès, catégories), recoupée sur
l'année de naissance pour écarter les homonymes.

### Fondés (17)

| id | Signalement | Ce qui n'allait pas |
|----|-------------|---------------------|
| 27 | Pjanić — Juventus × milieu | corrigé avant cette passe |
| 28 | Inter × Marseille : un joueur en trop | Materazzi, retiré avant cette passe. Les 9 candidats restants sont tous confirmés |
| 29 | Mendy — Man City × Vainqueur CDM | corrigé avant cette passe |
| 32 | Lenglet — Atlético × A joué en L1 | corrigé avant cette passe |
| 34 | Platini — Juventus × A joué en L1 | corrigé avant cette passe (« Saint-Etienne » sans accent) |
| 36 | Kaká — Milan × Vainqueur CDM | corrigé avant cette passe |
| 35 | Baresi — Milan × Vainqueur CDM | `GG_WC_WINNERS` ne couvrait que 1994/1998/2002 ; Italie 1982 manquait |
| 40 | Beckenbauer — Bayern × Vainqueur LDC | `GG_CL_WINNERS` bornée aux finales depuis 2000 |
| 50 | Deschamps — OM × Vainqueur LDC | idem (OM 1993) |
| 51 | Desailly — OM × Vainqueur LDC | idem (OM 1993) |
| 53 | Boli — OM × Vainqueur LDC | idem (OM 1993) |
| 55 | Pires — Arsenal × Vainqueur CDM | oublié de la liste France 1998 |
| 52 | Keane — Man United × milieu | fiché attaquant, c'est un milieu de terrain |
| 57 | Albertini — Atlético × milieu | fiché attaquant, c'est un milieu défensif |
| 58 | Garnacho — Chelsea × attaquant | fiché milieu, c'est un ailier |
| 47 | Sidibé — Toulouse | club manquant (depuis août 2024). Bordeaux, qu'il n'a jamais connu, a été retiré au passage |
| 56 | Sima — Brest | club manquant (prêt 2024-25) |

Correctif de fond : le critère de la grille s'appelle « Vainqueur LDC » sans
borne de date, mais le set des vainqueurs était découpé finale par finale
depuis 2000 seulement — et s'arrêtait à PSG 2025, en ignorant la finale 2026.
Les deux sets sont désormais complétés depuis les catégories fr.wikipedia,
filtrées sur l'année de naissance puis sur la section Palmarès de chaque
article (5 homonymes écartés : Pepê/Pepe, Gerson/Gérson, Danilo, Carlos Romero,
Víctor Muñoz).

### Rejetés (16)

Aucune modification. À ne pas ré-ouvrir sans source nouvelle — ces verdicts sont
figés en négatif dans `src/test/goatgrid-signalements.test.ts`.

| id | Revendication | Pourquoi non |
|----|---------------|--------------|
| 30 | Kane → Fenerbahce | 11 clubs sur Wikidata, pas de Fenerbahce |
| 31 | Fontaine → Real Madrid | Nice et Reims, rien d'autre |
| 33 | Thiago Silva a joué en Liga | jamais joué en Espagne |
| 37 | S. Birindelli → Juventus | c'est son père Alessandro qui y a joué |
| 38 | Fran García attaquant | arrière gauche |
| 39 | Luis Enrique vainqueur LDC | gagnée comme entraîneur (2015, 2025), pas comme joueur |
| 41 | Roque Santa Cruz brésilien | paraguayen |
| 42 | Uwe Seeler → Man City | Hambourg toute sa carrière |
| 43 | André Gomes → Tottenham, brésilien | portugais, jamais à Tottenham |
| 44 | Andreas Möller → AC Milan | Francfort, Dortmund, Juventus, Schalke |
| 45 | Kompany vainqueur LDC | parti de City en 2019, City gagne en 2023 |
| 46 | Uwe Seeler → Man City | doublon du 42 |
| 48 | Luiz Gustavo a joué en PL | jamais joué en Angleterre |
| 49 | Kolo Muani vainqueur LDC | au prêt à la Juventus quand le PSG gagne en mai 2025 |
| 54 | Lemar → Man United | Monaco et Atlético |
| 59 | Rio Ferdinand devenu entraîneur | consultant, pas entraîneur |

### Note d'exploitation

La colonne `status` de `bb_reports` reste à `pending` sur les 33 lignes : la RLS
interdit l'UPDATE à la clé anon (testé, HTTP 200 mais 0 ligne touchée). Le
`lastProcessedId` de `reports-state.json` fait foi.
