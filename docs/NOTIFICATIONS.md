# Notifications push

## Ce qui ne marchait pas

L'app demandait la permission d'envoyer des notifications, enregistrait les
abonnements dans `bb_push_subscriptions`, et promettait « on te pinguera si t'as
pas joué depuis 24h ». **Rien, nulle part, n'envoyait de notification.** Pas
d'Edge Function, pas de cron, pas de `.github/workflows`, pas de dépendance
`web-push`. La permission était demandée pour rien.

C'est le pire des cas, parce qu'un refus de notification est **définitif** : le
navigateur ne permet pas de redemander.

Trois défauts côté client s'y ajoutaient :

| Défaut | Conséquence |
|---|---|
| `sendNotif` utilisait `new Notification()` | Lève « Illegal constructor » sur Chrome Android **et** en PWA iOS, c'est-à-dire sur tout le public. L'erreur était avalée par un `try/catch`. Une notification déclenchée par une page doit passer par le service worker. |
| `scheduleNextNotif` posait un `setTimeout` de 24 h | Suppose un onglet ouvert 24 h. Un onglet mobile est gelé en quelques minutes : il ne s'est jamais déclenché. |
| `subscribeToPush` rendait `true` sans lire la réponse du POST | Un échec réseau ou un refus de la base passait pour un succès. |
| L'abonnement ne se faisait qu'au moment du tap sur « Oui, active ! » | Un POST raté ce jour-là, un endpoint renouvelé par le navigateur, une permission accordée avant l'existence du code : dans tous ces cas, permission accordée et zéro notification, sans moyen de réparer — le bouton ne réapparaît jamais. |

## Ce qui existe maintenant

Quatre envoyeurs, un seul circuit.

```
scripts/push-io.mjs          ← le circuit : lecture paginée, chiffrement,
  │                             envoi, purge, marquage, RPC, upsert
  ├── notif-devinette.mjs    ← cron quotidien, même message pour tous
  ├── notif-amis.mjs         ← sondage /15 min : demande reçue ET acceptée
  ├── notif-inactivite.mjs   ← cron quotidien : 3 jours sans avoir joué
  └── notif-podium.mjs       ← cron horaire : sorti du top 3 du mois
```

Les **décisions** vivent dans `src/lib/push.js`, qui ne touche pas au réseau et se
teste unitairement. `push-io.mjs` ne fait que des entrées-sorties. Sans cette
séparation, chaque envoyeur aurait recopié la lecture paginée, le
chiffrement, la purge et la limite de parallélisme du premier — et tous
auraient divergé au premier correctif.

### Le fetch mort qu'on a retiré du client

`acceptRequest()` et l'envoi d'une demande (`LePont.jsx`) appelaient un `fetch`
vers `/functions/v1/send-friend-notification`, une Edge Function qui n'a
**jamais existé** côté serveur — sondée en direct : `HTTP 546`, jamais un
succès. C'est exactement le défaut décrit en haut de ce document, resurgi une
deuxième fois sur un autre chemin : un appel « best-effort » dont l'échec est
avalé par un `.catch(() => {})` ne prévient jamais personne qu'il ne fait
rien. Les deux appels (`type:"request"` et `type:"accepted"`) ont été retirés :
`notif-amis.mjs` couvre maintenant les deux annonces, de façon fiable. Les
deux autres appels du même genre (`duel_challenge`/`duel_new`/`duel_taken`,
dans `postDefi`/`submitDuelScore`) sont **restés en l'état** — annoncer un défi
en direct demande un déclenchement immédiat, donc une vraie Edge Function
derrière un webhook Supabase, pas ce sondage ; voir « Ce que ça ne couvre
pas » plus bas.

## Colonnes et tables à créer

**À lancer une fois** dans Supabase → SQL Editor, sinon le script concerné
s'arrête avec un message qui renvoie ici.

### `notif-amis.mjs` — demande reçue (déjà en place)

```sql
alter table public.bb_friend_requests add column if not exists notified_at timestamptz;
```

Pourquoi une colonne et pas seulement le `tag` de la notification : un tag
remplace une notification **encore affichée**. Dès que l'utilisateur la balaie,
le sondage suivant en recrée une, avec vibration. Il faut une trace en base, et
`bb_pseudos.last_notified_grade` posait déjà ce précédent.

### `notif-amis.mjs` — demande acceptée (nouveau)

```sql
alter table public.bb_friend_requests add column if not exists accepted_notified_at timestamptz;

-- Backfill IMMÉDIAT et OBLIGATOIRE, dans la même session SQL : sans lui, la
-- toute première exécution du script annoncerait à tout le monde, d'un coup,
-- que sa demande a été acceptée — même celles d'il y a des mois. C'est le
-- même risque que `notified_at` traite avec une fenêtre de 24 h côté demandes
-- reçues, mais réglé ici une fois pour toutes plutôt qu'à chaque sondage :
-- l'instant de l'acceptation elle-même n'est enregistré nulle part, donc
-- aucune fenêtre d'âge n'est calculable après coup.
update public.bb_friend_requests set accepted_notified_at = now()
  where status = 'accepted' and accepted_notified_at is null;
```

### `notif-inactivite.mjs` — relance 3 jours (nouveau)

```sql
alter table public.bb_pseudos add column if not exists relance_inactivite_at timestamptz;
```

Le garde qui empêche la relance quotidienne à vie, tant qu'un joueur ne revient
pas : voir `joueursARelancer` dans `src/lib/push.js`.

### `notif-podium.mjs` — sorti du podium (nouveau)

```sql
create table if not exists public.bb_podium_suivi (
  mois       text not null,
  player_id  text not null,
  rang       int not null,
  vu_le      timestamptz not null default now(),
  primary key (mois, player_id)
);
```

Pas de RLS à activer : ni le client ne la lit ni ne l'écrit, seul le script (clé
`service_role`) y touche. Pourquoi une table de suivi et non un calcul à la
volée : voir l'en-tête de `scripts/notif-podium.mjs`.

Aucune règle RLS à toucher pour les trois premiers cas non plus : les
envoyeurs utilisent la clé `service_role`, qui les contourne. Le client
n'écrit jamais ces colonnes.

## La devinette du jour

Un seul message, une fois par jour. Le texte est une
accroche, pas une réponse — nombre de clubs, poste, décennie d'éclosion. Il ne
cite ni le nom ni aucun club, et un test le vérifie sur la totalité du vivier :
une notification arrive avant qu'on ouvre le jeu, un nom dedans supprimerait la
partie du jour pour tous ceux qui la reçoivent.

### Pourquoi le calcul du joueur est dans `src/lib/devinette.js`

Il vivait dans `FindPlayer.tsx`, qui importe `LePont.jsx` (15 000 lignes) et
React : impossible à charger depuis un script Node. Recopier la formule dans
l'envoyeur aurait garanti sa divergence, et une notification qui décrit un autre
joueur que le jeu est un mensonge visible par tout le monde. Une seule
implémentation, deux appelants, et un test (`src/test/devinette.test.ts`) qui
tombe si quelqu'un remet une copie dans le composant.

## Les demandes d'ami

Un sondage toutes les 15 minutes, et non un envoi à l'instant de l'insertion :
signer une notification depuis le client demanderait la clé privée VAPID, où elle
serait publique. Il faut un serveur, et le seul disponible est le cron GitHub.
Une demande d'ami annoncée dans le quart d'heure reste utile — un défi en direct
ne le supporterait pas, ce qui est la raison pour laquelle « X te défie » n'est
pas branché de cette façon.

GitHub accepte 5 minutes au minimum mais retarde volontiers ses crons de
plusieurs minutes sous charge : viser plus serré donnerait l'illusion du temps
réel sans la tenir.

Trois règles gouvernent le tri (`demandesANotifier`) :

| Cas | Décision | Pourquoi |
|---|---|---|
| `notified_at` déjà rempli | ignorer | sinon la même demande repart à chaque sondage |
| statut ≠ `pending` | marquer, ne pas envoyer | rien à annoncer, et la ligne n'a plus à être réexaminée |
| plus vieille que 24 h | marquer, ne pas envoyer | garde-fou de la **première** exécution : sans lui, toutes les demandes en attente depuis des mois partiraient d'un coup |

Deux détails qui comptent :

- **Une notification par destinataire, pas par demande.** Quelqu'un qui revient
  après une absence peut avoir trois demandes en attente ; trois notifications
  simultanées se lisent comme du harcèlement.
- **On ne marque que ce qui a été reçu.** Une panne passagère du service de push
  laisse la demande annonçable au prochain sondage, au lieu de la perdre.

### La moitié qui manquait : la demande acceptée

Le même script, le même sondage, la même table — mais l'autre sens. Une
demande d'ami dit au **destinataire** qu'on veut être son ami ; rien ne disait
à l'**expéditeur** que la personne a dit oui. Sans ça, il n'a aucun moyen de le
savoir sans rouvrir l'app et vérifier lui-même.

`acceptationsANotifier` filtre `status=accepted&accepted_notified_at=is.null` :
pas de fenêtre d'âge, parce que le risque qu'elle couvre côté demandes reçues
(un backlog de mois qui partirait d'un coup) est traité une fois pour toutes
par le backfill de la migration — voir plus haut. Toute ligne qui arrive ici
est donc forcément postérieure au déploiement.

Les deux volets partagent la même liste d'abonnements (une seule lecture de
`bb_push_subscriptions` pour les deux), mais s'envoient en **deux lots
séparés** : une personne qui a reçu une demande ET vient de voir la sienne
acceptée dans le même sondage doit recevoir **deux** notifications distinctes,
pas une charge qui écrase l'autre.

## Relance d'inactivité — 3 jours sans avoir joué

Cron quotidien, un seul message, comme la devinette — sauf que le
destinataire n'est pas « tout le monde », mais qui a été inactif juste ce
qu'il faut, et jamais relancé pour cet épisode précis.

**La dernière activité** vient de `bb_scores` ET `bb_gg_scores` (peu importe le
mode, seule la date compte), réduite à une date par joueur
(`derniereActivitePar`). La lecture porte sur une fenêtre glissante de 30
jours — pas tout l'historique, qui ne cesse de grossir, et au-delà de ce délai
une relance a de toute façon peu de chances de faire revenir quelqu'un.

**Le garde contre la relance à vie** (`joueursARelancer`) : `relance_inactivite_at`
n'autorise une nouvelle relance que si la dernière partie du joueur est
**postérieure** à sa dernière relance. Sans lui, un cron qui tourne tous les
jours renverrait « tu nous manques » tous les jours, pour toujours, à
quiconque ne revient jamais — puisque « inactif depuis 3 jours ou plus » reste
vrai indéfiniment. Dès que le joueur rejoue, sa nouvelle date d'activité
dépasse la dernière relance enregistrée : un nouvel épisode d'inactivité pourra
légitimement en déclencher une autre, plus tard.

## Podium — sorti du top 3 du classement du mois

Cron horaire : un classement qui change de tête plusieurs fois par jour
mérite mieux qu'un passage quotidien, sans tourner en continu pour autant.

« Perdre sa place » veut dire **sortir** du top 3, pas descendre dedans —
passer de 2e à 1er est une progression, pas une chute, et ne doit rien
déclencher. `evolutionPodium` (src/lib/push.js) le distingue en testant la
PRÉSENCE dans le top 3 actuel, jamais l'égalité de rang.

**Pourquoi une table de suivi** (`bb_podium_suivi`) : rien d'autre ne garde le
top 3 « d'avant » nécessaire à la comparaison — le classement lui-même ne
connaît que le présent. Elle est donc **réécrite à chaque passage** sur l'état
observé, qu'il y ait ou non un déchu à annoncer : un déchu qu'on laisserait
dans le suivi reviendrait identique au tour suivant et repartirait en
notification indéfiniment, exactement le défaut que `notified_at` évite
ailleurs — mais ici sans colonne de marquage possible, puisque la ligne
elle-même doit disparaître.

Le message nomme, quand c'est possible, qui occupe désormais l'ancien rang du
déchu (`accrocheDechu`) — pas nécessairement « qui l'a dépassé » au sens
causal, mais toujours qui tient sa place aujourd'hui.

## Mise en route — les deux secrets à créer

Dans **Settings → Secrets and variables → Actions** du dépôt :

| Secret | Où le trouver |
|---|---|
| `SB_SERVICE_KEY` | Supabase → Project Settings → API → `service_role`. Indispensable : `bb_push_subscriptions` est volontairement **illisible** avec la clé publique (les endpoints push sont des données sensibles), donc la clé `anon` ne permet pas de lire les abonnés. |
| `VAPID_PRIVATE_KEY` | La moitié privée de la paire VAPID. Elle a été générée en même temps que la clé publique du client et **ne doit jamais entrer dans le dépôt**. |

La clé **publique** vit dans `src/components/LePont.jsx` (`VAPID_PUBLIC_KEY`) —
c'est normal, elle est publique par construction.

### La clé service_role sort de Supabase

C'est la contrepartie assumée du choix « GitHub Actions » : la clé vit dans les
secrets GitHub. Elle est révocable à tout moment depuis le tableau de bord
Supabase (Project Settings → API → *Reset*), ce qui la rend moins définitive
qu'il n'y paraît. L'autre option — une Edge Function Supabase déclenchée par
`pg_cron` — garde la clé à l'intérieur de Supabase, au prix d'un déploiement
avec la CLI `supabase`.

## Essayer sans rien envoyer

```bash
npm run notif:essai   # les deux circuits, contre un faux Supabase et un faux service de push
```

Ces essais vérifient ce que les tests unitaires ne peuvent pas : lecture paginée,
chiffrement `aes128gcm`, signature VAPID, purge des morts et des doublons. Ils
servent de vraies clés ECDH et un vrai HTTPS (certificat auto-signé jetable),
parce que `web-push` refuse de chiffrer sans les premières et que la vérification
d'abonnement exige le second.

Celui des amis lance le script **deux fois de suite** et vérifie que le second
passage n'envoie rien. C'est la propriété qui compte : un sondage qui réenverrait
la même demande toutes les 15 minutes serait pire que pas de notification.

Pour une simulation contre la **vraie** base, sans envoyer :

```bash
SB_SERVICE_KEY=... npm run notif:sec
```

Elle compte les abonnés par plateforme et n'envoie rien. Pour les amis :

```bash
SB_SERVICE_KEY=... npm run notif:amis:sec
```

Elle affiche les messages qui partiraient, sans envoyer ni marquer quoi que ce
soit — donc sans consommer les demandes. Même chose pour les deux nouveaux
circuits :

```bash
SB_SERVICE_KEY=... npm run notif:inactivite:sec
SB_SERVICE_KEY=... npm run notif:podium:sec
```

**Ce que `npm run notif:essai` NE couvre PAS.** Ces trois `--dry-run` (amis,
inactivité, podium) restent la seule vérification avant un premier envoi
réel : contrairement à la devinette et à l'ancien volet des amis, aucun banc
d'essai avec faux Supabase et faux service de push n'a été construit pour
l'acceptation, la relance ou le podium. La lecture paginée, le chiffrement et
la purge sont bien exercés — ce sont ceux de `push-io.mjs`, partagés par les
quatre — mais la logique propre à chacun (le backfill de migration, le
ré-épisode d'inactivité, la réécriture du suivi de podium) n'est éprouvée que
par les tests unitaires de `src/lib/push.js` et par ces essais en lecture
contre la vraie base.

Depuis GitHub : **Actions → Notification devinette → Run workflow**, en laissant
`dry_run` coché.

## Le cron

`0 9 * * *`, visant **midi à Paris**. Deux corrections par rapport à la lecture
naïve du cron :

- GitHub ne garantit rien sur l'heure des tâches planifiées. Les exécutions
  observées ont démarré **57 minutes** après l'heure demandée (17:57 pour un cron
  à 17:00), deux fois de suite. L'arrivée réelle est donc attendue entre 11 h et
  12 h à Paris en été.
- L'heure d'été. `9:00` UTC vaut 11 h à Paris en été et 10 h en hiver. Une heure
  de décalage l'hiver vaut mieux que deux crons, qui risqueraient d'envoyer deux
  fois le même jour.

Garde-fou supplémentaire : le `tag` de la notification contient le jour
(`goatfc-devinette-2026-08-11`). Deux notifications de même tag se **remplacent**
sur l'appareil au lieu de s'empiler — même envoyée deux fois, la devinette
n'apparaît qu'une fois.

### Pourquoi midi, et pas 20 h ni 10 h

L'envoi partait à 20 h. La question « et si le joueur a déjà fait la devinette ? »
a une réponse chiffrée, que `npm run stats:heures -- --mode=devinette` recalcule à
la demande (lecture seule, clé publique). Sur 183 parties et 14 jours :

| envoi à | ont déjà joué | joueurs présents à cette heure |
|---|---|---|
| 8 h  | 27 % | 4 |
| 10 h | 32 % | 1 |
| 12 h | 40 % | 9 |
| 13 h | 48 % | 9 |
| 19 h | 76 % | 9 |
| 20 h | 81 % | 7 |
| 22 h | 95 % | 12 |

À 20 h, **quatre notifications sur cinq arrivaient après la partie qu'elles
annonçaient**. Une relance qui annonce ce qui est déjà fait n'agace pas seulement :
elle apprend à ne plus ouvrir les suivantes, et c'est le canal entier qui se perd.

Le matin très tôt vide la colonne « déjà joué » mais ne trouve personne : ce
public joue le midi, le soir, et jusqu'à 2 h du matin — 22 joueurs distincts entre
minuit et 2 h, contre 1 à 10 h. Midi garde 60 % de marge, rassemble le plus de
monde avec 13 h, et laisse tout l'après-midi et la soirée pour jouer si la
notification est balayée.

Deux précautions de lecture, à garder si l'heure est rediscutée :

- La distribution est **elle-même façonnée** par l'envoi de 20 h. L'effet est
  faible — seules 14 des 183 parties tombent dans les deux heures qui suivent la
  notification — et cette faiblesse est justement ce qui prouve que 20 h ne
  fonctionnait pas.
- Compter les **parties** ne suffit pas : quelques joueurs qui enchaînent les
  manches créent un pic. Ce sont les **joueurs distincts** par heure qui décident.
  La première mesure donnait 77 parties à 1 h du matin ; c'était bien 13 personnes
  différentes, mais il fallait le vérifier.

Il reste 40 % de notifications qui arrivent après coup. Les supprimer demande de
savoir qui a **terminé** la devinette, ce que le serveur ignore : `trackPlay`
signale l'**ouverture** du mode, pas sa fin. Filtrer là-dessus tairait la relance
de celui qui a commencé et abandonné — précisément celui à qui elle sert. Le jour
où ça vaudra le coup, il faudra d'abord enregistrer la fin de partie.

## Lire un échec d'envoi

Le journal du workflow donne, à chaque exécution, un bilan **par service de
push** :

```
── Envoyé : 6 ✓  |  morts : 0  |  à retenter : 0  |  erreurs : 7
   web.push.apple.com : 0/7 reçus
     ×7  400 BadDeviceToken
   fcm.googleapis.com : 6/6 reçus
```

C'est le découpage qui compte : `platform` est déclarée par l'app d'après l'agent
utilisateur, alors qu'un échec en masse se lit par service. Si tous les échecs
sont chez le même service et tous les succès chez un autre, la cause est dans ce
que ce service exige de nous ; s'ils sont mélangés, elle est dans les
abonnements.

Le motif vient du **corps** de la réponse, pas du message d'erreur. `web-push`
lève toujours le même `Received unexpected response code` quelle que soit la
cause, et met l'explication dans `body` — les trois services n'ayant aucun format
commun (`{"reason":…}` chez Apple, `{"error":{"message":…}}` chez FCM,
`{"errno":…,"message":…}` chez Mozilla), `resumerCorps` les lit tous les trois.

### Le cas du HTTP 400

Un `400` ne dit pas à lui seul de qui il parle, et c'est son motif qui décide :

| motif | verdict |
|---|---|
| `BadDeviceToken`, `NotRegistered`, `Invalid subscription`… | **purge** : le jeton est mort, comme un 410 |
| `VapidPkHashMismatch` | **purge, mais seulement si un autre envoi a réussi** — voir ci-dessous |
| `BadJwtToken`, `ExpiredProviderToken`, `signature`, `encryption`… | **alerte, aucune purge** : c'est notre clé qui est en cause |
| inconnu | **alerte, aucune purge** |

La liste des motifs est volontairement étroite (`abonnementMortSelonCorps`) : en
cas de doute, on n'efface pas, et le motif reste dans le journal pour élargir la
règle sur pièces plutôt que par supposition.

### `VapidPkHashMismatch`, le refus qui était immortel

C'est le seul motif mentionnant VAPID qui parle de l'**abonnement** et non de
nous : le hachage de la clé publique enregistrée dans l'abonnement ne correspond
pas à celle qui signe. Autrement dit, cet abonnement a été créé avec notre
**ancienne** paire. Apple répond `400` là où les autres services répondent `403`
pour le même fait.

Il a fallu un journal pour le voir. Celui du 13 août 2026 :

```
── 15 lignes en base → 15 abonnés uniques
── Envoyé : 8 ✓  |  morts : 0  |  à retenter : 0  |  erreurs : 7
   web.push.apple.com : 5/12 reçus
     ×7  400 VapidPkHashMismatch
   fcm.googleapis.com : 3/3 reçus
```

Sept abonnements iOS refusés **chaque jour, à l'identique**, depuis le changement
de paire. Jamais purgés, parce que le mot « vapid » dans le corps faisait conclure
à un problème de notre clé — ce qui est juste pour `ExpiredProviderToken`, et faux
ici. Jamais délivrés, puisque la clé de l'abonnement est bien celle d'avant. Sept
téléphones muets et un journal rouge tous les midis.

Le côté client, lui, faisait déjà son travail : `memeCleServeur` compare la clé de
l'abonnement à la nôtre, se désabonne et se réabonne. Mais **le POST de
réabonnement AJOUTE une ligne, il n'en remplace aucune** : la vieille restait en
base et échouait à vie. D'où les chiffres — 15 lignes pour 8 appareils joignables.

La purge est donc décidée comme pour un `403` : uniquement **si au moins un envoi
a réussi**. Ce garde-fou n'est pas facultatif. Au lendemain d'une rotation de clé,
tous les abonnements rendraient ce refus, et purger viderait la table entière.
Aucun succès, aucune purge.

### Pourquoi une purge est réparable

L'app garde en `localStorage` l'endpoint déjà transmis, pour ne pas ajouter une
ligne à chaque ouverture. Ce marqueur **périme au bout d'une semaine**
(`pushARetransmettre`), et c'est ce qui rend toute purge réversible : sans
péremption, une ligne supprimée côté serveur n'était jamais réécrite — la
permission restant accordée sur l'appareil, rien ne le signalait à l'utilisateur
et rien ne le lui redemandait, si bien qu'il disparaissait des notifications pour
de bon.

Coût : au maximum une ligne en doublon par abonné et par semaine, que le
dédoublonnage supprime le jour même.

## Changer les clés VAPID

Un abonnement est lié **pour toujours** à la clé publique avec laquelle il a été
créé. Changer la paire invalide donc tous les abonnements existants.

Ce n'est pas une catastrophe : `subscribeToPush` compare l'`applicationServerKey`
de l'abonnement en place à la clé courante, révoque celui qui ne correspond pas,
et se réabonne. Le remplacement se fait au prochain lancement de l'app, sans que
l'utilisateur ait quoi que ce soit à faire — la permission, elle, reste acquise.

Côté serveur, les lignes périmées se nettoient aussi toutes seules, mais **pas au
premier lancement** :

- un abonnement créé avec une autre clé répond `403` ;
- un `403` **alors qu'aucun envoi n'a réussi** est traité comme une erreur de
  configuration : le workflow échoue et **ne supprime rien**. Purger là-dessus
  viderait toute la table sur ce qui pourrait n'être qu'un secret mal collé ;
- un `403` **alors que d'autres envois ont réussi** prouve que la clé privée est
  bonne : cette ligne-là vient d'une paire précédente, elle est supprimée.

Conséquence pratique après une rotation : le premier envoi réel est **rouge**,
avec autant d'erreurs que d'anciens abonnés. Il redevient vert dès qu'une seule
personne s'est réabonnée, et les anciennes lignes disparaissent à ce moment-là.
Pour aller plus vite, on peut vider la table à la main dans Supabase — rien n'est
perdu, ces abonnements ne pouvaient de toute façon plus rien recevoir :

```sql
delete from public.bb_push_subscriptions;
```

Pour générer une paire :

```bash
node -e 'const c=require("crypto");
const {publicKey,privateKey}=c.generateKeyPairSync("ec",{namedCurve:"prime256v1"});
const b=x=>Buffer.from(x).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
console.log("PUBLIC :",b(publicKey.export({type:"spki",format:"der"}).subarray(-65)));
console.log("PRIVATE:",privateKey.export({format:"jwk"}).d);'
```

La publique fait 87 caractères, la privée 43. La publique va dans
`VAPID_PUBLIC_KEY`, la privée dans le secret GitHub.

## Ce que ça ne couvre pas

- **La langue.** L'accroche est en français pour tout le monde.
  `bb_push_subscriptions` ne porte pas la langue de l'utilisateur (`bb_lang` ne
  vit que dans son `localStorage`), donc le serveur ne peut pas la connaître. La
  corriger demande une colonne de plus et une écriture côté client.
- **Les défis reçus.** `bb_duels` contient déjà les défis en attente
  (`status=sent`) : « X te défie » serait la notification la plus forte, et elle
  pousserait le mode multi. Elle n'est pas branchée — et un quart d'heure de
  retard, acceptable pour une demande d'ami, ne l'est pas pour un défi qui
  attend une réponse. Elle mériterait un déclenchement immédiat, donc une Edge
  Function appelée par un webhook Supabase.
- **iOS hors PWA.** Sur iPhone, les notifications web n'existent que si l'app est
  **installée** sur l'écran d'accueil. Le code en tient compte
  (`typeof Notification === "undefined"`), mais aucun message n'explique cette
  condition à l'utilisateur.
- **La mesure.** Rien ne compte les notifications ouvertes. Le lien porte
  `utm_source=push`, donc le tableau de bord peut le voir, mais aucun écran ne
  l'affiche aujourd'hui.
