# 🔒 Sécurité Supabase — à lire avant le lancement public

## Le modèle de menace (important à comprendre)

GOAT FC n'utilise **pas** Supabase Auth : chaque joueur est un **identifiant
anonyme** (`bb_player_id`, 6 caractères) stocké en localStorage. Tous les appels
partent donc avec la **clé `anon`**, qui est **publique** — n'importe qui peut
l'extraire du bundle JS et taper directement l'API REST Supabase.

Conséquence : sans **Row Level Security (RLS)**, la clé `anon` donne par défaut
un accès **lecture + écriture + suppression** sur toutes tes tables. Concrètement,
aujourd'hui, un inconnu pourrait :

- vider ton classement (`DELETE FROM bb_scores`),
- lire la table des abonnements push,
- **moissonner tous les `recovery_code` et prendre le contrôle des comptes** (🚨).

Comme il n'y a pas d'identité (`auth.uid()`), on ne peut pas isoler par
utilisateur. La bonne stratégie est le **moindre privilège par table** :
n'autoriser que les opérations que l'app fait vraiment. C'est ce que fait
`docs/supabase-rls.sql`.

---

## 🚨 Faille principale trouvée : `recovery_code` en clair et lisible

La récupération de compte fonctionne ainsi :
`GET bb_pseudos?recovery_code=eq.<code>`. Ça oblige le rôle `anon` à pouvoir
**lire** la colonne `recovery_code` — donc à pouvoir la lister en masse. Un
attaquant fait `SELECT player_id, recovery_code FROM bb_pseudos` et récupère de
quoi usurper **tous** les comptes.

➡️ **Correctif** en 2 temps (détaillé plus bas et dans le `.sql`) : passer la
récupération par une fonction serveur `recover_account()` puis **retirer la
lecture** de la colonne.

---

## Comment appliquer

### Phase 1 — maintenant (ne casse rien)
1. Ouvre **Supabase → SQL Editor**.
2. Colle le contenu de `docs/supabase-rls.sql` **jusqu'à la fin de la PHASE 1**.
3. **Run.** RLS est activé partout et calqué sur les opérations réelles de l'app.

Après ça, teste que l'app marche toujours (créer un compte, jouer, classement,
amis, salon multi). Tout doit fonctionner à l'identique.

### Phase 2 — fermer la faille `recovery_code` (recommandé avant lancement)
1. **Déploie d'abord le changement client** ci-dessous (récupération via RPC).
2. **Ensuite seulement**, exécute le bloc PHASE 2 du `.sql` (crée `recover_account`
   et retire `select (recovery_code)`).

Changement client — dans `src/components/LePont.jsx`, remplacer la lecture
directe par un appel RPC :

```js
// AVANT (expose la colonne) :
const found = await sbFetch("bb_pseudos?recovery_code=eq."+encodeURIComponent(code)+"&limit=1");

// APRÈS (le serveur vérifie, la colonne reste secrète) :
const found = await sbFetch("rpc/recover_account", {
  method: "POST",
  body: JSON.stringify({ p_code: code })
});
// `found` = [{ player_id, pseudo }] ou []
```

---

## Vérifier que `delete_user_account` est sûre

L'app appelle déjà `rpc/delete_user_account(p_player_id, p_recovery_code)`.
Vérifie dans Supabase qu'elle est **`SECURITY DEFINER`** et qu'elle ne supprime
**que si** `p_recovery_code` correspond bien au compte — sinon connaître un simple
`player_id` suffirait à supprimer le compte d'autrui :

```sql
select prosecdef, pg_get_functiondef(oid)
from pg_proc where proname = 'delete_user_account';
```

---

## Tester que le verrou tient (avec la clé anon publique)

Depuis un terminal, avec l'URL et la clé anon du projet, ces requêtes doivent
être **refusées / vides** une fois la PHASE 1 (et 2) appliquée :

```bash
SB="https://ialjlsrgcolocoaegzrc.supabase.co"
KEY="<ta_cle_anon>"

# Doit échouer (aucune policy DELETE sur bb_scores) :
curl -s -X DELETE "$SB/rest/v1/bb_scores?id=eq.0" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -i | head -1

# Doit renvoyer [] (lecture des abonnements push bloquée) :
curl -s "$SB/rest/v1/bb_push_subscriptions?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Après PHASE 2 — doit échouer (colonne recovery_code non lisible) :
curl -s "$SB/rest/v1/bb_pseudos?select=player_id,recovery_code" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

---

## Limite honnête & correctif long terme

Le moindre privilège empêche la **destruction/exfiltration de masse**, mais comme
il n'y a pas d'identité, un utilisateur mal intentionné peut toujours écrire des
données « au nom » d'un autre `player_id` (les `player_id` circulent). Pour une
vraie isolation par utilisateur, la solution propre est :

- **Supabase Anonymous Auth** (`signInAnonymously`) → chaque joueur obtient un
  vrai JWT et un `auth.uid()`. On peut alors écrire des policies
  `using (auth.uid() = user_id)` et bloquer l'usurpation. Ça demande une petite
  migration côté client (stocker/rafraîchir la session) — à planifier après le
  lancement.

En attendant, **Phase 1 + Phase 2 couvrent les risques critiques** (destruction
du classement, fuite des push, prise de contrôle via recovery_code).

---

## Modération des pseudos

Un pseudo haineux ou injurieux est visible partout : classement, Hall of Fame,
demandes d'amis, salons de duel. `src/lib/pseudo.ts` refuse la saisie côté
client, avec une normalisation qui ramène « H1tl3r », « h.i.t.l.e.r » et
« HiiiTLER » au même squelette.

**Mais ce contrôle ne protège rien tout seul.** La clé `anon` est publique, donc
un POST direct sur `bb_pseudos` s'en moque complètement — c'est exactement la
limite décrite ci-dessus. Le verrou réel est
[`supabase-pseudos-interdits.sql`](supabase-pseudos-interdits.sql) : un trigger
`before insert or update` qui rejoue la même liste en base, plus un contrôle de
format qui refuse tout ce qui n'est pas `[a-zA-Z0-9_-]{3,12}`. Ce dernier ferme
le trou des homoglyphes — « Hitlеr » avec un « е » cyrillique passe n'importe
quelle liste de termes, mais pas ce gabarit.

Le fichier SQL est **généré** depuis la liste JavaScript (`node
scripts/pseudos-sql.mjs`) : deux listes tenues à la main auraient divergé, et on
aurait cru bloquer ce qu'on ne bloquait plus.

Les pseudos **déjà en base** échappent au trigger, qui ne regarde que les
écritures. `node scripts/audit-pseudos.mjs` les relit et liste ceux à traiter ; il
est en lecture seule, le renommage se fait à la main.

---

## Classement mensuel : d'une colonne falsifiable à un calcul serveur

Le champion du mois était décidé par `bb_pseudos.xp_season`, **une colonne que le
client écrivait lui-même**. La clé `anon` étant publique, une requête suffisait
pour se poser à 999 999 999, ou pour remettre un rival à zéro — le filtre étant un
simple `player_id`. Et la **clôture de saison était faite par l'app** : le premier
joueur à l'ouvrir après le 1er du mois écrivait le Hall of Fame, `bb_seasons`
étant elle aussi ouverte en écriture.

Trois portes ouvertes, sur ce qui doit décider de l'attribution d'un lot.

[`supabase-classement.sql`](supabase-classement.sql) les ferme :

- le classement est **recalculé** depuis `bb_scores` — il n'y a plus de compteur à
  falsifier ;
- pour chaque **jour** et chaque **mode**, seul le meilleur score compte, et il
  rapporte **au plus 100 points**. Un score gonflé ne rapporte donc pas plus qu'un
  très bon score honnête ;
- un trigger borne les scores, impose une cadence minimale et **écrase
  `created_at` avec l'heure du serveur** — sans quoi on pouvait antidater une
  partie pour paraître régulier, ou l'insérer dans un mois déjà clos ;
- `bb_seasons` est fermée au client, la clôture passe par
  `.github/workflows/cloture-saison.yml`, qui **refuse de couronner** si un mode
  joué manque au barème ou s'il y a moins de trois participants.

**Ce que ça ne fait pas** : il n'y a toujours pas d'authentification, donc le
serveur ne sait pas qui l'appelle. Quelqu'un peut encore déclarer un score
plausible sans avoir joué. Le plafond journalier fait qu'il ne peut pas gagner
avec un seul coup — pour truquer un mois entier il faudrait poser un bon score
chaque jour dans chaque mode, ce qui se voit dans les colonnes `jours` et `modes`
du classement. **Avant d'expédier un lot, regarder ces deux colonnes.**

L'étape suivante, si les lots prennent de la valeur, est l'authentification
anonyme Supabase — elle seule empêche l'usurpation et rend les bannissements
possibles.
