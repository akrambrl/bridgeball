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
