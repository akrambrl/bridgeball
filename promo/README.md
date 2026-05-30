# GOAT FC — Pub animée (Remotion)

Vidéo publicitaire animée (MP4) pour le jeu **GOAT FC / Bridgeball**, écrite en React
avec [Remotion](https://www.remotion.dev/). Format vertical **1080×1920**, **16 s**, **30 fps**.

## Le scénario (4 scènes)

1. **Chambre** — une soirée entre potes, chacun le téléphone en main.
2. **Gameplay** — zoom sur un écran : deux clubs reliés par « le pont », réponse trouvée ✓.
3. **Duel** — réaction « VS », un pote célèbre, l'autre encaisse.
4. **Logo** — révélation du logo, tagline et call-to-action « Joue maintenant ».

L'habillage (couleurs `#1E5C2A` / `#276B34`, accent `#00E676`, logo terrain) est repris
de `bridgeball-logo.svg` et `manifest.json` à la racine du dépôt.

## Prévisualiser (studio interactif)

```bash
cd promo
npm install
npm run preview      # ouvre Remotion Studio
```

## Rendre le MP4

```bash
cd promo
npm install
npm run render       # -> out/goatfc-promo.mp4
```

### Rendu sans accès au CDN Chromium

Si l'environnement bloque le téléchargement du Chromium de Remotion, on peut fournir
un binaire Chromium installé via npm (aucun téléchargement externe) :

```bash
npm install @sparticuz/chromium
# récupérer le chemin extrait :
node -e "import('@sparticuz/chromium').then(m=>m.default.executablePath()).then(console.log)"
# puis :
npx remotion render Ad out/goatfc-promo.mp4 \
  --browser-executable=<chemin-affiché> --no-sandbox --gl=angle
```

## Personnaliser

- Durée / dimensions / fps : `src/Root.tsx`.
- Montage et fondus entre scènes : `src/Ad.tsx`.
- Textes, clubs affichés et réponse : `src/components/GameScreen.tsx` et les fichiers `src/scenes/*`.
- Couleurs de marque : `src/theme.ts`.

## Pas de son

La vidéo est muette. Pour ajouter une musique, déposez un fichier audio et utilisez
le composant `<Audio>` de Remotion dans `src/Ad.tsx`.
