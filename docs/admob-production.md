# Passer AdMob en production

Quatre valeurs à recopier depuis la console AdMob vers quatre fichiers. Rien de
plus, mais chacune des quatre au mauvais endroit produit une panne différente, et
aucune ne se voit à l'usage.

## Ces quatre identifiants ne sont PAS des secrets

C'est le point qui surprend, alors autant le poser d'emblée : contrairement au
keystore Android et à la clé `.p8` d'App Store Connect — qui ne doivent passer par
aucun canal et vivent en secrets GitHub — les identifiants AdMob sont **publics
par construction** :

- l'identifiant d'application et celui du bloc sont écrits en clair dans le
  paquet de l'app, lisibles par quiconque la décompresse ;
- `app-ads.txt` est un fichier que Google explore à la racine du site : son but
  même est d'être public.

Ils vont donc dans le dépôt, comme dans toutes les apps AdMob. Ce qui est
sensible dans AdMob, c'est l'accès au compte — pas ces chaînes.

## Étape 1 — la console AdMob

À faire sur **https://apps.admob.com**, avec un compte Google **personnel**.
Attention à l'adresse : `admob.google.com` est la page commerciale de Google, pas
la console — c'est `apps.admob.com` qui ouvre le tableau de bord. Pas
d'adresse `@projectxparis.fr`, et rien au nom de Project X Paris : le compte
AdMob est celui qui reçoit l'argent.

### a. Déclarer les deux applications

**Applications → Ajouter une application**, une fois pour iOS, une fois pour
Android.

À la question « votre application est-elle publiée sur un store ? », réponds
**Non** : GOAT FC n'est pas encore en ligne. L'association au store se fait plus
tard, dans les paramètres de l'app, une fois la fiche publiée — et il faudra
penser à la faire, c'est elle qui débloque le plein régime de diffusion.

Nom : `GOAT FC` pour les deux.

### b. Créer un bloc récompensé par application

Dans chaque app : **Blocs d'annonces → Ajouter un bloc → Avec récompense**.

- Nom : `Récompensée — bonus`
- Récompense : mets ce que tu veux, par exemple quantité `1`, article `bonus`.
  L'app **ignore** ces deux champs : elle n'écoute que l'événement « le joueur est
  allé au bout » et accorde elle-même le bonus. Ils ne servent qu'aux rapports
  d'AdMob.

### c. Relever les quatre valeurs

| Où la trouver | Ce que tu cherches | Sa forme |
|---|---|---|
| Chaque app → **Paramètres de l'app** | ID de l'application | `ca-app-pub-…~…` (**tilde**) |
| Chaque bloc → colonne « ID du bloc » | ID du bloc d'annonces | `ca-app-pub-…/…` (**barre oblique**) |
| **Paramètres du compte** | ID d'éditeur | `pub-…` (16 chiffres) |

**Le `~` et le `/` ne sont pas des détails de présentation** : ils distinguent
deux objets différents. Un ID d'application posé là où on attend un bloc fait
planter l'app au lancement, sur tous les téléphones, avant le premier écran.
C'est l'erreur la plus fréquente de cette manipulation. Un test du dépôt la
refuse désormais (`src/test/admob.test.ts`), donc le build échouera plutôt que de
partir cassé — mais autant ne pas la faire.

## Étape 2 — les quatre modifications

Toutes se font dans l'interface GitHub, bouton crayon en haut à droite du
fichier. Aucune n'exige le Mac ni le dépôt cloné.

Le dépôt est **public** : ces valeurs seront visibles, et c'est normal (voir plus
haut).

### 1. `public/app-ads.txt` — à CRÉER

Ce fichier n'existe pas encore. Sur GitHub : **Add file → Create new file**, nom
exact `public/app-ads.txt`, une seule ligne :

```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

Remplace `pub-XXXXXXXXXXXXXXXX` par ton ID d'éditeur. Le dernier champ est le même
pour tout le monde, ne le touche pas. AdMob affiche d'ailleurs la ligne exacte à
copier dans **Applications → app-ads.txt**.

**Fais celui-ci en premier.** Google doit explorer https://goatfc.fr/app-ads.txt
avant d'autoriser l'inventaire, et cette exploration peut prendre jusqu'à 24 h.
Le publier maintenant, avant même que l'app soit en ligne, ne fait que gagner du
temps.

Une particularité du site, vérifiée : `goatfc.fr` redirige en 307 vers
`www.goatfc.fr`. Ce n'est pas un problème ici — la spécification `app-ads.txt`
autorise l'explorateur à suivre une redirection tant qu'elle reste sur le même
domaine racine, ce qui est le cas. Le fichier sera donc trouvé par les deux
adresses. En revanche, le champ « site web du développeur » des fiches App Store
et Play doit désigner ce domaine et pas un autre : c'est de là que Google part
pour trouver le fichier.

Un fichier absent, ou qui désigne un autre éditeur, ne casse rien de visible : les
pubs s'affichent, les enchérisseurs premium disparaissent, et le revenu s'écrase
sans message d'erreur. C'est pour ça qu'un test compare l'éditeur déclaré ici à
celui des identifiants de l'app.

### 2. `src/lib/pub.ts` — les deux blocs

Cherche `ID_REEL_RECOMPENSE` (vers la ligne 59) et remplis les deux champs :

```ts
const ID_REEL_RECOMPENSE = {
  android: "ca-app-pub-…/…",
  ios: "ca-app-pub-…/…",
};
```

Ce sont les IDs de **bloc**, avec la barre oblique. Deux valeurs différentes, une
par plateforme.

Remplir ces champs suffit à faire basculer tout le module : `enModeTest()` devient
faux, et le SDK démarre avec `initializeForTesting: false`. Il n'y a pas d'autre
interrupteur à trouver.

### 3. `ios/App/App/Info.plist` — l'app iOS

Cherche `GADApplicationIdentifier`. Remplace la valeur, en gardant les balises :

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-…~…</string>
```

ID d'**application** iOS, avec le tilde.

### 4. `android/app/src/main/AndroidManifest.xml` — l'app Android

Cherche `com.google.android.gms.ads.APPLICATION_ID`, vers la ligne 44 :

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-…~…" />
```

ID d'**application** Android, avec le tilde. Ce n'est pas le même que celui d'iOS.

## Étape 3 — vérifier avant de construire

Le build lance les tests avant de compiler : si une des quatre modifications
manque, il s'arrête avec le détail de l'état mixte plutôt que de produire un
paquet à moitié converti. Tu n'as donc rien de plus à faire que relancer :

**Actions → IPA iOS → Run workflow**, branche `main`, version `1.0.0`, numéro de
build vide, **☑ Déposer sur TestFlight**.

## Ne clique jamais sur ta propre publicité

Une fois les vrais identifiants en place, un seul clic sur une de tes propres
publicités peut faire fermer le compte AdMob — définitivement, sans recours utile.
Ce n'est pas une précaution excessive, c'est le motif de fermeture le plus courant.

Ouvrir la pub pour vérifier qu'elle se charge, puis la fermer, ne pose pas de
problème. **Cliquer sur son contenu, si.**

Pour tester vraiment, AdMob a une liste d'appareils de confiance :
**Paramètres → Appareils de test**. Elle demande l'identifiant publicitaire du
téléphone, que le SDK écrit dans les journaux au premier lancement — donc en
pratique elle demande Xcode ou `adb`. Tant que ce n'est pas en place, la règle
simple est celle du paragraphe au-dessus.

## Ce qui ne démarrera pas tout de suite

Deux choses à savoir pour ne pas s'inquiéter sur de faux signaux :

- **AdMob limite la diffusion sur une app non publiée.** Le taux de remplissage
  et le revenu par mille resteront bas jusqu'à ce que l'app soit en ligne sur les
  stores et associée à sa fiche dans les paramètres AdMob.
- **AdMob ne paie qu'après vérification du compte** : adresse postale confirmée
  par courrier avec code, informations fiscales, et un seuil de versement de
  70 € atteint. À lancer tôt, parce que le courrier prend des semaines — c'est le
  délai le plus long de toute la chaîne et il ne dépend de personne.

## SKAdNetwork, déjà fait

`Info.plist` déclare désormais les 50 réseaux publicitaires publiés par Google
pour AdMob. C'est ce qui permet d'attribuer une installation quand le joueur
refuse la fenêtre ATT — et la majorité refuse. Sans cette liste, les annonceurs
ne voient plus ce que leur budget produit sur iOS et cessent d'enchérir.

La liste bouge : Google ajoute et retire des réseaux. Elle se relit sur
https://developers.google.com/admob/ios/privacy/strategies et vaut d'être rafraîchie à
l'occasion d'une mise à jour, pas plus souvent.
