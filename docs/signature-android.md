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

## La commande, à lancer sur ton Mac

Dans un dossier que tu sauvegardes (pas dans le dépôt) :

```bash
keytool -genkeypair -v \
  -keystore goatfc-upload.jks \
  -alias goatfc \
  -keyalg RSA -keysize 4096 \
  -validity 10000 \
  -storetype JKS
```

- **10 000 jours** ≈ 27 ans. Play exige une validité qui dépasse largement 2033 ;
  une clé qui expire est une app qu'on ne peut plus mettre à jour.
- **4096 bits** plutôt que 2048 : ça ne coûte rien et ça ne se change pas après coup.
- L'alias `goatfc` et le mot de passe te seront redemandés à chaque build. Note-les
  dans ton gestionnaire de mots de passe **tout de suite** — pas dans un fichier
  texte à côté du keystore.

Aux questions posées, ce qui compte : `CN` (ton nom ou GOAT FC), `O` (l'entité),
`C` = `FR`. Ces valeurs apparaissent dans le certificat, pas sur la fiche.

## Ce que le dépôt ne doit JAMAIS contenir

```
*.jks
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
| `ANDROID_KEYSTORE_BASE64` | `base64 -i goatfc-upload.jks \| pbcopy` puis coller |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `goatfc` |
| `ANDROID_KEY_PASSWORD` | le mot de passe de la clé |

Puis Actions → **AAB Android** → Run workflow. L'AAB est en bas de la page
d'exécution, dans les artefacts.

Le workflow **vérifie la signature avant de te livrer le fichier** (`jarsigner
-verify`) : sans ça, Play refuse le dépôt après le téléversement, ce qui coûte un
aller-retour.

### Le numéro de version est le piège

Play refuse un `versionCode` déjà déposé, et il ne peut que **monter**. Le workflow
prend par défaut le numéro d'exécution, strictement croissant. Un build local, lui,
garde le `versionCode 1` du fichier gradle — d'où l'intérêt de ne construire que
par le workflow.

## Et en local, si tu y tiens

Il faut le SDK Android et un JDK 21. Crée `android/key.properties`, ignoré par git :

```properties
storeFile=/chemin/absolu/vers/goatfc-upload.jks
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
