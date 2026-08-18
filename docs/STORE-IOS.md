# 🍎 Publier GOAT FC sur l'App Store (iOS, via Capacitor)

Contrairement à Android, Apple **refuse** les simples « site web emballé » (règle
**4.2 – Minimum Functionality**). On utilise donc **Capacitor** pour créer une
vraie coque native, avec des **fonctions natives** et les assets **empaquetés**
(l'app marche offline). C'est ce qui fait passer la revue.

> ✅ **Tu n'as PAS besoin d'installer Xcode.** Le workflow
> `.github/workflows/ipa-ios.yml` construit l'IPA signé sur un runner macOS de
> GitHub et le dépose sur TestFlight. Le dépôt étant public, ces minutes ne sont
> pas facturées. Xcode ne devient utile que pour déboguer sur un simulateur.

---

## 🚦 L'ordre réel des choses, et le seul vrai bloquant

| # | étape | délai | qui |
|---|---|---|---|
| 1 | **S'inscrire au Apple Developer Program — 99 $/an** | **24-48 h**, parfois plus (vérification d'identité) | toi |
| 2 | Créer la clé d'API App Store Connect (3 secrets) | 5 min | toi |
| 3 | Créer l'app dans App Store Connect (`fr.goatfc.app`) | 10 min | toi |
| 4 | Lancer le workflow **IPA iOS** | ~20 min | un clic |
| 5 | TestFlight interne (jusqu'à 100 testeurs) | immédiat, sans revue | toi |
| 6 | Revue App Store | 1 à 3 jours | Apple |

**Rien ne peut avancer avant le point 1**, pas même un essai du workflow.

**Et le point 1 cache une décision.** Les 24-48 h annoncées valent pour une
inscription en **Particulier** — et le vendeur affiché sous l'app est alors le
nom d'état civil, Apple ne proposant pas de nom commercial libre aux comptes
particuliers (contrairement à Play). Pour afficher `GOAT FC`, il faut une
inscription en **Organisation** : entité immatriculée, site à son nom, et un
**numéro D-U-N-S** — gratuit, mais jusqu'à 5 jours ouvrés, parfois deux
semaines. C'est le seul délai du projet qu'on ne peut pas comprimer.

**Et la bonne nouvelle :** Apple n'a **aucune** exigence équivalente aux 12 testeurs
pendant 14 jours de Google. TestFlight interne est immédiat. À compte égal, iOS
sort donc PLUS VITE qu'Android.

## 📱 iPhone SEUL, et c'est une décision datée

`TARGETED_DEVICE_FAMILY` est passé de `"1,2"` à `"1"` le 14 août 2026.

Motif, mesuré et non supposé : la mise en page à trois colonnes (celle qui
s'active au-delà de 900 px de large) **ne remplit pas un iPad en portrait** — le
contenu tient dans le haut du cadre et 60 % de l'écran reste du fond vide. Apple
contrôle le rendu iPad dès qu'une app se déclare compatible, et une mise en page
qui ne remplit pas est un motif de refus au titre du design.

Ouvrir ce chantier à six semaines du lancement n'était pas le bon échange. L'iPad
reste jouable dans le navigateur, comme aujourd'hui.

**Pour le rétablir plus tard :** remettre `"1,2"`, adapter la mise en page large
aux ratios hauts, puis `npm run ios:visuels -- --ipad`. Le contrôle des visuels
LIT cette valeur dans le projet : remettre l'iPad sans refaire les captures fait
échouer `npm run ios:visuels`, et non le téléversement chez Apple.

---

## ✅ Ce qui est déjà fait dans le repo

- **Dépendances Capacitor** installées : `@capacitor/core`, `ios`, `cli`, +
  plugins `app`, `haptics`, `status-bar`, `keyboard`, `splash-screen`.
- **`capacitor.config.ts`** : `appId: fr.goatfc.app`, `appName: GOAT FC`,
  `webDir: dist`, fond `#0A140A`, splash + clavier natif.
- **`src/lib/native.ts`** : initialisation native (barre de statut sombre, splash,
  bouton retour) + **retour haptique** (`hapticSuccess` / `hapticError`), le tout
  **no-op sur le web**.
- **Haptique branchée** dans le jeu : vibration native sur bonne/mauvaise réponse
  (`handleCorrectAnswer` / `handleWrongAnswer`).
- **`initNative()`** appelée au démarrage (`main.tsx`).
- Scripts : `npm run ios:sync` (build + sync) et `npm run ios:open`.

Ces fonctions natives (haptique, barre de statut, splash, offline) sont
justement ce qu'Apple attend pour ne **pas** te refuser sous 4.2.

---

## 1. Générer le projet iOS (sur Mac)

Le dossier `ios/` **existe déjà** dans le dépôt — `npx cap add ios` n'est plus à
faire et écraserait la configuration. Sur un Mac, pour déboguer :

```bash
npm install
npm run ios:sync        # build web + copie dans la coque
npm run ios:open        # ouvre Xcode
```

À chaque modif du site ensuite : `npm run ios:sync`. Le workflow le fait seul.

## 2. Icônes & splash

Les sources sont **déjà prêtes** dans `assets/` (`icon.png` 1024, `splash.png`
et `splash-dark.png` 2732×2732). Il suffit de générer tous les formats iOS :

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --ios   # lit automatiquement le dossier assets/
```

Fournis une icône **1024×1024** propre (sans coins arrondis, sans transparence —
Apple les ajoute). Ton `public/icon-512.png` peut servir de base (à re-générer en 1024).

## 3. Réglages Xcode

- **Signing & Capabilities** : sélectionne ton **Team** (compte Apple Developer),
  Bundle Identifier `fr.goatfc.app`.
- **Deployment Target** : le projet est à **iOS 15.0** — relevé dans
  `project.pbxproj`, et non supposé. Ce document annonçait « iOS 14+ ».
  Il faudra 16.4+ le jour où tu activeras le push natif.
- Lance sur un **simulateur** puis un **iPhone réel** pour vérifier haptique,
  splash, clavier, offline.

## 4. Compte & soumission

- **Apple Developer Program** : **99 $/an** (obligatoire).
- **App Store Connect** → crée l'app (Bundle ID `fr.goatfc.app`).
- **Captures d'écran** : `npm run ios:visuels` les rend et les CONTRÔLE, dans
  `visuels/store-ios/`. Une seule taille iPhone est exigée — **6.9" en
  1290×2796** — et Apple dérive les autres. L'ancienne version de ce document
  demandait aussi du 6.5" en 1242×2688 : ce n'est plus nécessaire, et le second
  format n'était même pas le bon. Vérifié sur la documentation d'App Store
  Connect le 14 août 2026, en recroisant deux sources — un premier relevé
  annonçait « 1260 × 2736 », un format qui ne correspond à aucun iPhone.
- **Aucun canal alpha**, nulle part. Apple refuse. Play ne le refuse que sur sa
  bannière, donc c'est un piège pour qui recopie les visuels d'un store à l'autre.
- **App Privacy (nutrition labels)** — déclare les mêmes données que côté Android :
  - Pseudo, scores → *User Content / Identifiers*
  - **Pays via IP** (`ipapi.co`, tiers) → *Location (Coarse)*
  - Identifiant d'appareil anonyme + events → *Identifiers / Usage Data*
  - Tokens push (si activé)
  - **Publicité — cette ligne a changé.** Ce document affirmait « pas de suivi
    publicitaire, App Tracking Transparency non requis ». C'était vrai jusqu'à
    l'arrivée d'AdMob. Il faut désormais déclarer, dans les étiquettes de
    confidentialité, **Identifiers → Third-Party Advertising** et
    **Usage Data → Advertising Data**, et l'app demande l'autorisation ATT au
    lancement. Refuser ne bloque rien : les pubs deviennent non personnalisées.
- **Suppression de compte** : Apple l'exige → déjà présente in-app ✅.
- **Politique de confidentialité** : `https://goatfc.fr/privacy/` — vérifiée
  vivante (HTTP 200). L'adresse de contact qui y figure est `contact@goatfc.online`.
- **Classification d'âge** : quiz → 4+, mais signale l'**interaction entre
  utilisateurs** (pseudos/duels) et prévois signalement/blocage.

## 5. Notifications push (optionnel)

Si tu veux le push natif iOS : ajoute `@capacitor/push-notifications`, active la
capability **Push Notifications** + **Background Modes** dans Xcode, configure
**APNs** dans App Store Connect, et relie les tokens à ta table
`bb_push_subscriptions`. À faire dans un second temps si besoin.

---

## 📺 Publicités sur iOS — deux clés qui font planter l'app si elles manquent

`ios/App/App/Info.plist` porte maintenant deux clés, et **l'absence de l'une ou
l'autre fait planter l'app**, pour deux raisons différentes :

| clé | sans elle |
|---|---|
| `GADApplicationIdentifier` | le SDK Google Mobile Ads lève au **démarrage**, avant le premier écran, sur tous les iPhone |
| `NSUserTrackingUsageDescription` | iOS fait planter l'app au moment d'**afficher** la fenêtre d'autorisation |

L'identifiant présent est celui de **TEST** de Google
(`ca-app-pub-3940256099942544~1458002511`). À remplacer par celui de l'app iOS
créée dans AdMob **au moment de passer en production, et pas avant** — un clic
sur sa propre vraie publicité fait fermer un compte AdMob définitivement.

C'est l'identifiant d'**application** (avec un `~`), jamais celui du **bloc
d'annonces** (avec un `/`). Ce dernier va dans `src/lib/pub.ts`, champ
`ID_REEL_RECOMPENSE.ios`, aujourd'hui vide — et vide veut dire mode test, ce qui
est le bon défaut.

**Deux points restés ouverts, volontairement :**

- **La phrase ATT est en anglais.** `CFBundleDevelopmentRegion` vaut `en`, c'est
  donc la langue de repli du bundle. La traduire demande un
  `fr.lproj/InfoPlist.strings` ajouté aux ressources du projet — à faire depuis
  Xcode, pas à la main dans le `.xcodeproj`.
- **`SKAdNetworkItems` n'est pas renseigné.** Google publie une liste d'une
  centaine d'identifiants de réseaux à coller dans le plist ; elle améliore
  l'attribution, donc le revenu. Elle n'a pas été ajoutée ici parce qu'elle
  change régulièrement et qu'une liste recopiée de mémoire serait fausse : à
  prendre à la source, sur la page « Configure SKAdNetwork » d'AdMob, le jour de
  la mise en production.

## 🔑 Le premier IPA, dans l'ordre

Le compte Apple Developer existant, il reste quatre gestes.

**1. Enregistrer le Bundle ID.** `developer.apple.com/account` → Certificates,
Identifiers & Profiles → **Identifiers → +** → App IDs → App → `fr.goatfc.app`.
Sans lui, App Store Connect refuse de créer l'app à l'étape 3.

**2. Créer la clé d'API.** App Store Connect → Utilisateurs et accès →
Intégrations → Clés API → **+**. Rôle **Admin** : le workflow s'appuie sur
`-allowProvisioningUpdates` pour créer lui-même certificat et profil, ce qu'un
rôle App Manager ne permet pas — lui suffit à téléverser, pas à signer.

Tu obtiens `KEY_ID`, `ISSUER_ID`, et le fichier `.p8`. **Le .p8 ne se télécharge
qu'une fois.** Il ne doit passer par aucun autre canal que le formulaire des
secrets GitHub : il permet de déposer des versions sur le compte, et de les
retirer.

**3. Créer l'app** dans App Store Connect → Mes apps → **+** → Bundle ID
`fr.goatfc.app`. Le nom `GOAT FC` doit être libre sur l'App Store ; s'il est
pris, il faut un variant, et c'est le nom affiché qu'on ne peut plus changer
librement ensuite.

**4. Lancer Actions → IPA iOS.** Le pipeline a produit son premier IPA valide
le 17 août 2026 — 8 min 33 s, 16,1 Mo, `altool --validate-app` passé.

Il a fallu sept passages, et les pièges sont consignés dans l'en-tête de
`.github/workflows/ipa-ios.yml`. Les deux qui coûtent le plus cher à retrouver :

- **un appareil doit être enregistré** dans Certificates, Identifiers & Profiles.
  L'archivage réclame un profil de DÉVELOPPEMENT — c'est l'export qui signe en
  distribution — et un profil de développement exige au moins un appareil ;
- **le runner doit porter Xcode 26 ET la plateforme iOS**, qui ne vient plus
  dans le paquet Xcode et se télécharge à la demande.

### Si l'archivage échoue sur la signature

```
error: Signing for "App" requires a development team.
```

Attendu : le projet est en `CODE_SIGN_STYLE = Automatic` mais ne porte aucun
`DEVELOPMENT_TEAM` — il a été généré par Capacitor, jamais ouvert dans Xcode sur
un compte. Avec une équipe unique, `-allowProvisioningUpdates` la déduit parfois
seule de la clé d'API ; « parfois » ne se paramètre pas.

Le correctif est un secret de plus, **facultatif** et lu seulement s'il existe :
`APPSTORE_TEAM_ID`, l'identifiant à 10 caractères visible dans **Membership
details** sur `developer.apple.com/account`. Renseigne-le, relance, rien d'autre
à changer — le workflow l'injecte alors dans `xcodebuild` et dans le `teamID` des
options d'export.

## ⚠️ Avant de soumettre — rappels

- **RLS Supabase appliqué** (voir `docs/SECURITY-SUPABASE.md`) — Phase 1 + 2.
- **Manifest & icônes** OK (déjà en place).
- Teste le parcours complet dans la coque : création de compte, jeu, classement,
  amis, salon multi, **offline** (mode avion → l'app doit se lancer).

## Anti-rejet 4.2 — la checklist qui compte

Si Apple te met quand même un 4.2, mets en avant (et renforce au besoin) :
- l'app fonctionne **hors-ligne** (assets empaquetés) ✅
- **retour haptique** natif en jeu ✅
- **barre de statut / splash** natifs ✅
- push natif (si tu l'ajoutes)
- éventuellement : partage natif des scores (`@capacitor/share`), sauvegarde
  d'image de résultat — chaque touche native supplémentaire réduit le risque.

## Chiffrement à l'export — réglé une fois pour toutes

App Store Connect posait à **chaque build téléversé** la question « votre app
utilise-t-elle un chiffrement ? », et laissait le build en attente tant qu'on n'y
avait pas répondu à la main. Sur un projet qui déploie par workflow, c'est une
intervention manuelle imposée à chaque fois — et surtout un build qu'on croit
disponible dans TestFlight alors qu'il attend une réponse.

`ITSAppUsesNonExemptEncryption` = `false` dans `ios/App/App/Info.plist` supprime
la question. La valeur est vérifiée, pas supposée :

- **aucune bibliothèque de chiffrement** dans les dépendances — ni forge, ni
  tweetnacl, ni sodium, ni bcrypt ;
- **aucun algorithme maison** : le seul appel à `crypto` du projet est
  `crypto.randomUUID()` dans `src/hooks/useMultiplayer.ts`, qui fabrique un
  identifiant aléatoire. Générer un UUID n'est pas chiffrer ;
- **tout le réseau passe en HTTPS/TLS**, donc le chiffrement fourni par iOS.
  C'est le cas exempté par la réglementation, et la raison pour laquelle la
  réponse honnête est « non ».

⚠️ La clé n'agit que sur les builds SUIVANTS. Un build déjà téléversé garde sa
question en attente : il faut y répondre une dernière fois à la main.

À rouvrir si l'app se met un jour à chiffrer elle-même quelque chose — stocker
des données avec sa propre clé, par exemple. La valeur passerait à `true` et une
déclaration d'exportation deviendrait obligatoire.

## Statut de commerçant (DSA) — le seul champ qui publie une adresse

App Store Connect demande, pour distribuer dans l'Union européenne, de se
déclarer **commerçant** ou **non-commerçant** au sens du règlement sur les
services numériques (DSA).

**GOAT FC est commerçant.** Le critère n'est pas le prix de l'app mais la
finalité : une app gratuite **monétisée par la publicité** relève d'une activité
commerciale. Le statut non-commerçant vise les apps distribuées sans aucune
finalité de ce genre. Avec AdMob branché et un profil de paiement actif, la
réponse honnête est « commerçant ».

### ⚠️ CE QUE CE CHAMP DÉCLENCHE, ET QU'IL FAUT RÉGLER AVANT DE LE COCHER

En se déclarant commerçant, on fournit une **adresse, un numéro de téléphone et
un e-mail qui sont PUBLIÉS sur la page produit de l'App Store**, visibles de tous.

Sur un compte Apple de type **Particulier**, ça veut dire l'adresse du DOMICILE
et le numéro de téléphone PERSONNEL, affichés publiquement. Ce n'est pas
réversible d'un clic : une fois la fiche en ligne, l'information a circulé.

L'ordre à respecter est donc :

1. **une adresse qui n'est pas le domicile** — société de domiciliation ou espace
   de coworking qui fournit un siège. Compter quelques jours et ~15-30 €/mois.
   C'est le seul élément à délai de cette étape ;
2. **un numéro qui n'est pas la ligne personnelle**, si l'exposition gêne — une
   seconde ligne ou un numéro VoIP suffit ;
3. **l'e-mail** : `contact@goatfc.online`, déjà utilisé sur les pages légales et
   la page d'assistance, donc déjà public. Rien à créer ;
4. **puis seulement** cocher « commerçant » avec ces coordonnées.

### Ne pas essayer de gagner deux semaines

Se déclarer non-commerçant parce que le build tourne encore sur les identifiants
de TEST d'AdMob — donc sans revenu — serait exact aujourd'hui et faux le jour de
la mise en production. Apple restreint la disponibilité dans l'UE des comptes qui
n'ont pas complété leur statut de commerçant : le risque n'est pas une amende, il
est de voir l'app retirée du marché principal du jeu.

### Le lien avec les revenus AdMob

Les revenus publicitaires sont des revenus d'activité imposables. En France, le
véhicule habituel est la **micro-entreprise (auto-entrepreneur)** : immatriculation
gratuite, un SIREN, et une déclaration de commerçant cohérente. Le compte Apple
peut rester **Particulier** — un auto-entrepreneur est une personne physique.

⚠️ Rien de tout ça ne se fait au nom de **Project X Paris**. C'est un employeur,
pas une structure qu'on peut engager. Et la partie fiscale mérite d'être
confirmée par un comptable ou l'URSSAF, pas par ce document.

## Formulaire fiscal W-8BEN — les trois champs qui coincent

Apple le réclame pour activer le contrat « Apps payantes ». À faire même si l'app
est gratuite et sans achat intégré : ça n'a **aucun effet sur les revenus AdMob**
(qui viennent de Google, pas d'Apple), mais ça évite de devoir le remplir en
urgence le jour où un achat intégré est ajouté.

Le formulaire est valable **trois ans**, et à refaire dans les 30 jours si l'une
des déclarations devient fausse — changement d'adresse compris.

### Ligne 5 — U.S. taxpayer identification number : LAISSER VIDE

C'est le piège de ce formulaire. Le bouton « Download Form SS-4 » invite à
demander un **EIN** américain, ce qui prend des semaines et n'est **pas
nécessaire** : un résident français qui réclame les avantages de la convention
fiscale renseigne son numéro fiscal étranger en ligne 6a, et rien en ligne 5.

### Ligne 6a — Foreign Tax Identifying Number

Le **numéro fiscal français**, 13 chiffres, celui qui figure sur l'avis
d'imposition et dans l'espace particulier d'impots.gouv.fr. Il est **obligatoire**
dès lors qu'on réclame la convention sans numéro américain.

### Ligne 3 — Permanent Residence Address : le VRAI domicile

À ne pas confondre avec l'adresse de domiciliation évoquée plus haut pour le
statut de commerçant DSA. La ligne 3 exige la **résidence permanente réelle** :
une adresse de domiciliation ou une boîte postale y invalide le formulaire. La
ligne 4 (Mailing Address), elle, accepte autre chose.

Ce sont donc deux adresses avec deux règles opposées, et c'est exactement là qu'on
se trompe : l'adresse publiée sur la fiche App Store peut être une domiciliation,
celle du W-8BEN non — mais elle n'est vue que par Apple et l'IRS.

### Partie II — la convention France / États-Unis

Ligne 9 : cocher la résidence fiscale en France.

Ligne 10 : les revenus tirés de la vente d'applications sont des **redevances**,
couvertes par l'**article 12** de la convention, au taux de **0 %**. Cocher
« Income from the sale of applications ». L'encadré d'explication des conditions
supplémentaires reste vide : le cas est le cas standard.

⚠️ Vérifier l'article et le paragraphe sur le **« Form W-8BEN Tips Sheet »**
téléchargeable depuis la page : Apple y donne la référence pays par pays, et c'est
la source qui fait foi pour ce formulaire-là.

### Le second formulaire — « Certificate of Foreign Status »

Apple en présente deux à la suite, et on croit s'être trompé de page. Le premier
est le W-8BEN de l'IRS ; celui-ci est une déclaration **propre à Apple**, plus
courte, rattachée au même contrat.

Tout y est pré-rempli sauf deux choses :

- **Type of Beneficial Owner** → `Individual/Sole proprietor`. Reste vrai même
  après une immatriculation en micro-entreprise : un auto-entrepreneur est une
  entreprise individuelle ;
- **Title** → `Owner`. C'est la capacité en laquelle on signe, pas un titre
  honorifique. Pour quelqu'un qui signe pour lui-même, `Owner` ou
  `Sole Proprietor` ; cohérent avec le champ ci-dessus.

**Permanent Residence** suit la même règle que la ligne 3 du W-8BEN : la résidence
RÉELLE, pas une domiciliation.

#### La phrase qu'il faut lire deux fois

> *the beneficial owner does not have any employees in the United States and does
> not own, lease, or control any equipment or other assets in the United States
> that are used to derive revenue from Apple*

Elle est vraie pour ce projet, mais elle mérite d'être comprise plutôt que
cochée : GOAT FC s'appuie sur **Supabase (USA)** et **Vercel (USA)**, listés dans
la politique de confidentialité. Ce sont des **services achetés**, pas du matériel
possédé, loué ou contrôlé — la distinction que cette déclaration cherche à établir
est celle d'un établissement stable aux États-Unis.

À réexaminer si le projet louait un jour des serveurs dédiés sur le sol américain.
