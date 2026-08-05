import { useEffect, useRef, useState } from "react";

// Bandeau « BUT ! » : court extrait animé (3,2 s) joué UNE SEULE FOIS sur une
// victoire, à côté du résultat.
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
// Deux séquences : le coup franc et le corner. On ALTERNE strictement d'une
// victoire à l'autre au lieu de tirer au sort — un tirage aléatoire répète le
// même extrait une fois sur deux, ce qui donne l'impression que rien n'a changé.
const CLIPS = [
  { mp4: "/but-banner.mp4",   webm: "/but-banner.webm",   poster: "/but-poster.webp" },
  { mp4: "/but-banner-2.mp4", webm: "/but-banner-2.webm", poster: "/but-poster-2.webp" },
];
const CLIP_KEY = "bb_win_clip";

function nextClip() {
  let n = 0;
  try { n = parseInt(localStorage.getItem(CLIP_KEY) || "0", 10) || 0; } catch { /* noop */ }
  const clip = CLIPS[n % CLIPS.length];
  try { localStorage.setItem(CLIP_KEY, String((n + 1) % CLIPS.length)); } catch { /* noop */ }
  return clip;
}

type Props = {
  /** Largeur max en px (le bandeau reste fluide en dessous). */
  maxWidth?: number;
  /** Marge haute, pour s'insérer dans des écrans aux rythmes différents. */
  marginTop?: number;
};

export const WinBanner = ({ maxWidth = 420, marginTop = 10 }: Props) => {
  const ref = useRef<HTMLVideoElement>(null);
  // Initialiseur de useState : le compteur n'avance qu'au MONTAGE, pas à chaque
  // rendu — sinon l'extrait changerait sous les yeux du joueur.
  const [clip] = useState(nextClip);

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
        border: "1px solid rgba(0,230,118,.35)",
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
