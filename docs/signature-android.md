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

## Brancher la signature sur le build

Crée `android/key.properties` (ignoré par git) :

```properties
storeFile=/chemin/absolu/vers/goatfc-upload.jks
storePassword=…
keyAlias=goatfc
keyPassword=…
```

`android/app/build.gradle` le lit s'il existe, et retombe sur la signature de
débogage sinon — de sorte qu'un `assembleDebug` marche sans clé, et qu'un
`bundleRelease` refuse de produire un AAB non signé silencieusement.

## Produire l'AAB du test fermé

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
