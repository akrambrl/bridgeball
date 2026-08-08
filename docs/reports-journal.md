# Journal de triage des signalements

Un bloc par passe. Le high-water mark vit dans `docs/reports-state.json` ; ce
fichier dit *pourquoi* chaque signalement a été fermé, ce que le simple compteur
ne dit pas. Utile surtout pour les **rejets** : sans trace, la même
revendication revient et on refait la vérification à zéro.

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
