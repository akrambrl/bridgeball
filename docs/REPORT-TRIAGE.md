# Triage automatique des signalements (bb_reports)

Process suivi pour vérifier et corriger les erreurs signalées par les joueurs
dans le jeu (bouton 🚩 « Signaler »). Conçu pour tourner en autonomie
(Routine planifiée) mais peut être lancé à la main.

## 1. Récupérer les nouveaux signalements

Table Supabase `bb_reports` (REST, clé anon en lecture) :

```
GET {SB_URL}/rest/v1/bb_reports?select=*&order=id.asc&id=gt.{lastProcessedId}
```

- `SB_URL` = `https://ialjlsrgcolocoaegzrc.supabase.co`
- Clé anon : voir `src/lib/track.ts` (constante `SB_KEY`).
- `lastProcessedId` = champ dans `docs/reports-state.json`.

⚠️ La RLS empêche l'anon de modifier `bb_reports` (pas de `status` à mettre à
jour). On suit donc l'avancement via `docs/reports-state.json` (id high-water
mark), versionné dans le repo.

## 2. Types de signalement et vérification

| `report_type`       | Sens | Champs utiles |
|---------------------|------|---------------|
| `wrong_player_club` | Un joueur validé du pont n'a jamais joué dans `c1` ou `c2` | `c1`, `c2` (les 2 clubs), `player_name` (tous les joueurs valides, séparés par `\|`), `given_answer` (le joueur pointé) |
| `missing_player`    | Réponse correcte refusée (The Plug/Mercato) | `c1`, `c2`, `given_answer` |
| `gg_missed`         | Réponse GOAT Grid refusée à tort | `c1` (contrainte 1 : club **ou** pays), `c2` (contrainte 2 : club, pays ou poste), `given_answer` |
| `wrong_club_name`   | Nom de club erroné | `c1`, `c2`, `message` |
| `daily_bug`         | Bug du défi du jour | `player_name` |
| `other`             | Divers | `message` |

**Règle de vérification** (référence transferts = **Transfermarkt**, recouper
2-3 sources, transferts officiels uniquement) :

- `wrong_player_club` : pour le pont `c1 × c2`, un joueur n'est valide que s'il a
  **réellement joué dans les DEUX clubs**. Vérifier `given_answer` (et par
  prudence tous les joueurs de `player_name`). Si un joueur a un club en trop dans
  sa fiche `src/players.jsx` → retirer le club faux (le remplacer par un vrai club
  de sa carrière si pertinent).
- `missing_player` / `gg_missed` : le `given_answer` est-il un vrai joueur qui
  satisfait les contraintes ? Si oui et qu'il est refusé, c'est que sa fiche est
  incomplète/fausse (club manquant, poste faux, nationalité manquante, ou joueur
  absent). Corriger la fiche (ajouter le club/poste, ou ajouter le joueur).
- `wrong_club_name` : corriger l'orthographe du club sur toutes les fiches
  concernées (garder l'orthographe canonique déjà majoritaire dans la base).
- `daily_bug` / `other` : lire `message`, juger au cas par cas. En cas de doute,
  ne rien changer et laisser une note.

**Ne corriger que si l'erreur est confirmée.** Un signalement peut être faux
(joueur qui a bien joué dans les 2 clubs, réponse réellement invalide, spam).
Dans ce cas, ne rien modifier — juste avancer le high-water mark.

## 3. Format des fiches joueur (`src/players.jsx`)

```js
{ name:"...", clubs:["...", "..."], diff:"facile|moyen|expert", nationalities:["..."], positions:["gardien|defenseur|milieu|attaquant"], birthYear:1990 },
```

- Clubs dans l'ordre chronologique, orthographe canonique de la base.
- Un joueur jouable dans The Plug / The Mercato doit avoir **≥ 2 clubs**.

## 4. Finalisation

1. `npm run build` (doit passer).
2. Bumper `CACHE_NAME` dans `public/sw.js` (incrémenter la version + date).
3. Mettre à jour `docs/reports-state.json` → `lastProcessedId` = plus grand id traité.
4. Commit (message clair listant les corrections + id des signalements), push sur
   la branche de dev, ouvrir la PR, merger en squash.
5. Ne PAS mettre l'identifiant du modèle dans les commits/PR.

## 5. Journal (optionnel)

Tenir un court récap par run dans le corps de la PR : id du signalement, verdict
(corrigé / rejeté + raison), fiche(s) touchée(s).
