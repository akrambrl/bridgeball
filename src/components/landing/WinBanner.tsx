import { useEffect, useRef, useState } from "react";

// Bandeau animé joué UNE SEULE FOIS à côté du résultat : séquence de but sur
// une victoire, séquence de défaite sinon.
//
// Choix qui comptent :
// • muted + playsInline — sans les deux, les navigateurs mobiles refusent
//   l'autoplay et le bandeau resterait figé sur son affiche.
// • le composant n'est monté QUE sur une victoire : c'est déjà le chargement
//   différé. Pas de preload="none", qui empêchait l'autoplay de démarrer —
//   une partie perdue ne télécharge rien de toute façon.
// • deux sources par extrait : le MP4 (H.264) couvre Safari/iOS et tous les
//   navigateurs courants ; le WebM VP9 sert de repli aux versions de Chromium
//   livrées sans codecs propriétaires. Une seule est téléchargée.
// • poster — évite le cadre noir le temps du chargement.
// • pas de boucle : un extrait qui tourne en fond pendant qu'on lit son score
//   devient vite pénible.
// Deux séquences de but (le coup franc et le corner), deux séquences de défaite.
// On ALTERNE strictement d'une partie à l'autre au lieu de tirer au sort — un
// tirage aléatoire répète le même extrait une fois sur deux, ce qui donne
// l'impression que rien n'a changé.
const WIN_CLIPS = [
  { mp4: "/but-banner.mp4",   webm: "/but-banner.webm",   poster: "/but-poster.webp" },
  { mp4: "/but-banner-2.mp4", webm: "/but-banner-2.webm", poster: "/but-poster-2.webp" },
];
// Deux séquences de défaite également, alternées de la même façon.
const LOSE_CLIPS = [
  { mp4: "/lose-banner.mp4",   webm: "/lose-banner.webm",   poster: "/lose-poster.webp" },
  { mp4: "/lose-banner-2.mp4", webm: "/lose-banner-2.webm", poster: "/lose-poster-2.webp" },
];
// Un compteur PAR LISTE : avec un compteur commun, une victoire ferait avancer
// l'alternance des défaites (et l'inverse), et on retomberait sur le même
// extrait plusieurs fois de suite.
const CLIP_KEYS = { win: "bb_win_clip", lose: "bb_lose_clip" };

function nextClip(lose: boolean) {
  const list = lose ? LOSE_CLIPS : WIN_CLIPS;
  if (list.length === 1) return list[0];
  const key = lose ? CLIP_KEYS.lose : CLIP_KEYS.win;
  let n = 0;
  try { n = parseInt(localStorage.getItem(key) || "0", 10) || 0; } catch { /* noop */ }
  const clip = list[n % list.length];
  try { localStorage.setItem(key, String((n + 1) % list.length)); } catch { /* noop */ }
  return clip;
}

type Props = {
  /** Largeur max en px (le bandeau reste fluide en dessous). */
  maxWidth?: number;
  /** Marge haute, pour s'insérer dans des écrans aux rythmes différents. */
  marginTop?: number;
  /** true = séquence de défaite (cadre neutre au lieu du liseré vert). */
  lose?: boolean;
};

export const WinBanner = ({ maxWidth = 420, marginTop = 10, lose = false }: Props) => {
  const ref = useRef<HTMLVideoElement>(null);
  // Initialiseur de useState : le compteur n'avance qu'au MONTAGE, pas à chaque
  // rendu — sinon l'extrait changerait sous les yeux du joueur.
  const [clip] = useState(() => nextClip(lose));

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Certains navigateurs (économiseur de données, réglages stricts) refusent
    // malgré tout : on ignore l'échec, l'affiche reste à l'écran.
    v.play().catch(() => { /* noop */ });
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        width: "100%",
        maxWidth,
        margin: marginTop + "px auto 0",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid " + (lose ? "rgba(255,255,255,.14)" : "rgba(0,230,118,.35)"),
        boxShadow: "0 10px 30px -12px rgba(0,0,0,.8)",
        lineHeight: 0,
        animation: "fadeUp .45s ease .1s both",
      }}
    >
      <video
        ref={ref}
        poster={clip.poster}
        muted
        playsInline
        autoPlay
        /* En boucle, comme un GIF : la séquence dure 2 à 3 s et s'arrêtait sur
           sa dernière image tant que l'écran de fin restait ouvert. */
        loop
        preload="auto"
        onCanPlay={e => { e.currentTarget.play().catch(() => { /* noop */ }); }}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <source src={clip.mp4} type="video/mp4" />
        <source src={clip.webm} type="video/webm" />
      </video>
    </div>
  );
};
