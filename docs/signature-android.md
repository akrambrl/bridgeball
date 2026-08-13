# La clé de signature Android, et pourquoi tu la génères toi-même

## Ce qui est en jeu

Google Play utilise **deux** clés, et la confusion entre les deux coûte cher :

| clé | qui la détient | ce qu'elle fait |
|---|---|---|
| **clé de signature de l'app** | Google, via Play App Signing | signe l'APK que les téléphones installent |
| **clé d'envoi** (*upload key*) | **toi** | prouve à Play que c'est bien toi qui déposes |

Play App Signing est activé par défaut pour toute nouvelle application, et c'est
une bonne nouvelle : si tu perds ta clé d'envoi, Google peut la réinitialiser. Si
tu détenais la clé de signature et que tu la perdais, tu ne pourrais **plus jamais**
mettre l'app à jour — il faudrait la republier sous un autre identifiant et
repartir de zéro, installations et avis compris.

## Pourquoi ce n'est pas moi qui la crée

Je tourne dans un conteneur éphémère. Une clé générée ici devrait m'être reprise
en la faisant passer par la conversation, avec son mot de passe — deux secrets
qui transiteraient par un canal qui n'est pas fait pour ça, et qui resteraient
dans l'historique.

Une clé d'envoi qui fuit permet à quelqu'un de déposer une version sur ton compte.
Play App Signing limite les dégâts et la clé est réinitialisable, mais la bonne
pratique reste simple : **elle ne quitte jamais ta machine**.

## D'abord : as-tu keytool ?

`keytool` vient avec Java, et **macOS ne l'a pas d'origine**. À vérifier avant tout :

```bash
keytool -help
```

Si la réponse est `command not found`, installe un JDK :

```bash
brew install --cask temurin
```

(ou télécharge Temurin 21 sur adoptium.net si tu n'as pas Homebrew). Puis
relance `keytool -help` — tu dois voir une liste d'options.

## La commande

Dans un dossier que tu sauvegardes, PAS dans le dépôt :

```bash
keytool -genkeypair -v \
  -keystore goatfc-upload.p12 \
  -alias goatfc \
  -keyalg RSA -keysize 4096 \
  -validity 10000 \
  -storetype PKCS12
```

- **PKCS12 et non JKS.** Éprouvé : JKS affiche un avertissement
  (« proprietary format… recommended to migrate to PKCS12 ») et demande un
  **second** mot de passe pour la clé. PKCS12 est propre, n'en demande qu'un, et
  Play l'accepte aussi bien.
- **10 000 jours** ≈ 27 ans. Vérifié à la génération : valide jusqu'au
  29 décembre 2053. Play exige une validité qui dépasse largement 2033 ; une clé
  qui expire est une app qu'on ne peut plus mettre à jour.
- **4096 bits** plutôt que 2048 : ça ne coûte rien et ça ne se change pas après.

### Les neuf invites, dans l'ordre — ET DANS LA LANGUE DU JDK

C'est là qu'on se perd, pour deux raisons. keytool pose six questions d'identité
que rien n'annonce, et si une réponse se décale il **recommence tout depuis le
début**. Et il parle la langue du système : sur un Mac français, les invites sont
en français **et la confirmation attend `oui`**.

Ce n'est pas un détail cosmétique. Éprouvé sur un keytool français en répondant
`yes` : la commande a reposé la première question **21 fois** et n'a créé **aucun
fichier**. Répondre dans la mauvaise langue, c'est la boucle infinie.

| # | JDK en français | JDK en anglais | réponse |
|---|---|---|---|
| 1 | `Entrez le mot de passe du fichier de clés :` | `Enter keystore password:` | ton mot de passe (invisible à la frappe) |
| 2 | `Ressaisissez le nouveau mot de passe :` | `Re-enter new password:` | le même |
| 3 | `Quels sont vos nom et prénom ?` | `What is your first and last name?` | ton nom |
| 4 | `Quel est le nom de votre unité organisationnelle ?` | `…organizational unit?` | `GOAT FC` |
| 5 | `Quel est le nom de votre entreprise ?` | `…organization?` | `GOAT FC` |
| 6 | `Quel est le nom de votre ville de résidence ?` | `…City or Locality?` | ta ville |
| 7 | `Quel est le nom de votre état ou province ?` | `…State or Province?` | ta région |
| 8 | `Quel est le code pays à deux lettres pour cette unité ?` | `…two-letter country code…?` | `FR` |
| 9 | `Est-ce CN=… ?` `[non]:` | `Is CN=… correct?` `[no]:` | **`oui`** / **`yes`** |

L'invite 9 est le piège : la valeur par défaut entre crochets est *non*, donc
ENTRÉE relance les six questions — et un `yes` sur un JDK français fait pareil.

Pour forcer l'anglais si les accents s'affichent mal :
`keytool -J-Duser.language=en …`

Ces valeurs finissent dans le certificat, pas sur la fiche Play. Personne ne les
verra.

### Et si keytool est absent

`keytool` fait partie du JDK, et **macOS répond « Unable to locate a Java
Runtime »** sans lui — pas `command not found`, donc même le diagnostic était
faux dans une version précédente de ce document.

Sans Homebrew, ce qui est le cas le plus courant sur un Mac neuf, un seul bloc
télécharge le bon installateur et l'ouvre, en détectant Apple Silicon ou Intel :

```bash
curl -L -o ~/Downloads/temurin21.pkg \
  "https://api.adoptium.net/v3/installer/latest/21/ga/mac/$(uname -m | sed 's/arm64/aarch64/;s/x86_64/x64/')/jdk/hotspot/normal/eclipse?project=jdk" \
  && open ~/Downloads/temurin21.pkg
```

Les deux liens ont été vérifiés : ils répondent 200 et rendent bien
`OpenJDK21U-jdk_aarch64_mac` et `OpenJDK21U-jdk_x64_mac`.

Puis **fermer complètement le Terminal** (`Cmd + Q`) et le rouvrir : un shell déjà
ouvert ne verra pas le nouveau JDK.

### Vérifier que la clé est bonne

```bash
keytool -list -v -keystore goatfc-upload.p12 | grep -E "Alias|Valid|RSA"
```

Tu dois lire `goatfc`, une validité jusqu'en 2053, et `4096-bit RSA key`.

### Note le mot de passe MAINTENANT

Dans ton gestionnaire de mots de passe, pas dans un fichier à côté du keystore.
Il te sera redemandé à chaque build, et personne ne peut le retrouver pour toi.

## Ce que le dépôt ne doit JAMAIS contenir

```
*.jks
*.p12
*.keystore
key.properties
```

Déjà couvert par `.gitignore`. Un keystore poussé sur GitHub, même dans un dépôt
privé, est à considérer comme compromis : il faut alors demander à Google de
réinitialiser la clé d'envoi.

## Produire l'AAB : par GitHub Actions

C'est le chemin retenu, et il évite d'installer 6 Go d'outils Android sur une
machine. Le workflow `.github/workflows/aab-android.yml` construit l'AAB signé et
le dépose en artefact.

**Quatre secrets à créer**, dans Réglages du dépôt → Secrets and variables →
Actions → New repository secret. La clé va de ta machine à ce formulaire,
directement : ni message, ni e-mail, ni fichier partagé.

| secret | valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i goatfc-upload.p12 \| pbcopy` puis coller |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `goatfc` |
| `ANDROID_KEY_PASSWORD` | **le même mot de passe** — PKCS12 n'en a qu'un |

Puis Actions → **AAB Android** → Run workflow. L'AAB est en bas de la page
d'exécution, dans les artefacts.

Le workflow **vérifie la signature avant de te livrer le fichier** (`jarsigner
-verify`) : sans ça, Play refuse le dépôt après le téléversement, ce qui coûte un
aller-retour.

### Mesuré au premier build réussi

Run n° 2 du 13 août 2026, tout vert en **2 min 56 s** — dont 1 min 35 s pour
`bundleRelease`. `jarsigner` répond « jar verified », l'AAB pèse **16 Mo**, très
loin de la limite de 200 Mo.

### L'artefact est un ZIP, l'AAB est dedans

GitHub emballe toujours les artefacts. Le téléchargement donne
`goatfc-aab-1.0.0-N.zip` : **il faut le décompresser** et déposer le
`app-release.aab` qu'il contient. Play refuse le `.zip` tel quel.

### Ce que le premier build a appris

Il a échoué une fois, en 39 s, sur `mergeReleaseResources` : un `--` dans un
commentaire XML de `ic_launcher_background.xml`, ce que **XML interdit** à
l'intérieur d'un `<!-- -->`. `npm run coque:verifie` scanne désormais tous les XML
de `res` pour ça, et tourne APRÈS `cap sync` pour voir ce que Gradle va vraiment
compiler.

### Le numéro de version est le piège

Play refuse un `versionCode` déjà déposé, et il ne peut que **monter**. Le workflow
prend par défaut le numéro d'exécution, strictement croissant. Un build local, lui,
garde le `versionCode 1` du fichier gradle — d'où l'intérêt de ne construire que
par le workflow.

## Et en local, si tu y tiens

Il faut le SDK Android et un JDK 21. Crée `android/key.properties`, ignoré par git :

```properties
storeFile=/chemin/absolu/vers/goatfc-upload.p12
storePassword=…
keyAlias=goatfc
keyPassword=…
```

`android/app/build.gradle` le lit s'il existe. **S'il manque, la tâche s'arrête**
avec un message qui dit quoi faire, au lieu de retomber sur la clé de débogage :
un AAB signé en debug est accepté par Gradle et rejeté par Play.

```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
```

Le fichier sort dans `android/app/build/outputs/bundle/release/app-release.aab`.
C'est lui qu'on dépose dans **Tester et publier → Tests fermés**.

## Le calendrier que ça déclenche

Le compteur des **12 testeurs pendant 14 jours consécutifs** ne démarre qu'une fois
la version approuvée ET les 12 testeurs inscrits. Puis la demande d'accès
production prend jusqu'à 7 jours. En remontant depuis le 1er octobre, l'AAB doit
être déposé autour du 1er septembre.
