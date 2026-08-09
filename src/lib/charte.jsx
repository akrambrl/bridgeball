// ── La charte « Olive et Tom » ────────────────────────────────────────────
// Source unique des jetons et des recettes de la charte. Elle vivait dans le
// corps du composant LePont, ce qui la rendait inaccessible aux jeux qui vivent
// dans leurs propres fichiers (GOAT Guess, Trouve le joueur) : les habiller
// obligeait à recopier les valeurs, donc à les laisser diverger. Rien ici ne
// dépend d'un état React — ce sont des constantes et des fonctions pures.
//
// Ce qui fait le manga, c'est le TRAIT et l'OMBRE DURE, pas l'angle vif : les
// rayons restent des arrondis francs.

export const G = {
  // `bg` n'est PAS le fond de la page — celui-là vient de `fondCharte`. C'est la
  // surface de deux modales plein écran. Le passer à l'or y a mis du texte blanc
  // sur jaune, illisible : il reste donc une surface SOMBRE, alignée sur `nuit`.
  bg:"#12160F",bgPanel:"rgba(0,0,0,.5)",bgCard:"#141414",dark:"#0a0a0a",white:"#ffffff",
  // ── Jetons d'avant la charte — PLUS AUCUN USAGE, ne pas y revenir ──────
  // `accent` (vert LED) et `gold` (jaune fluo) sont les deux teintes néon que
  // la charte remplace : prendre `pelouseClaire` ou `projecteur` pour du texte,
  // `pelouse` ou `projecteur` pour un aplat. `heading` était un alias de `font`,
  // donc écrire `fontFamily:G.heading` ne distinguait rien : un titre se fait
  // avec posterText / posterTitre, pas avec une famille de police.
  offWhite:"#F5F5F5",accent:"#00E676",gold:"#FFD600",red:"#FF3D57",
  font:"'Bebas Neue',cursive,sans-serif",heading:"'Bebas Neue',cursive,sans-serif",

  // ── Charte « Olive et Tom », version OR ────────────────────────────
  // Ce qui fait le manga, c'est le TRAIT et l'OMBRE DURE, pas l'angle vif :
  // les rayons restent des arrondis francs.
  //
  // LE RENVERSEMENT. La charte était une pelouse verte avec le jaune en
  // accent. Elle est désormais calée sur le logo : un APLAT D'OR plein champ,
  // un écusson noir posé dessus, un lettrage crème. Le vert n'est plus le
  // sol, il redevient ce qu'il dit — la validation, le positif.
  //
  // La règle qui découle des mesures et qu'il ne faut jamais oublier :
  // SUR L'OR, SEULE L'ENCRE SE LIT. Le crème tombe à 1,4, le vert clair à 1,2,
  // le rouge à 2,8. Toute couleur autre que l'encre doit donc vivre À
  // L'INTÉRIEUR d'une forme cerclée d'encre, jamais en texte posé sur le fond.
  // Dans un panneau, à l'inverse, tout se lit : crème 14,9 · or 11,0 ·
  // vert clair 9,3 · pelouse 5,1.
  encre:"#081109",        // le trait — noir à biais vert, jamais noir pur
  or:"#F5C22B",           // LE FOND. Même teinte que l'ancien `projecteur`.
  orSombre:"#D9A21A",     // la trame de points et les aplats secondaires sur l'or
  creme:"#F2E7CE",        // le lettrage du logo — le blanc de la charte
  pelouse:"#2A9B4E",      // validation, aplat de positif — DANS un panneau
  // La pelouse est faite pour être un APLAT, pas une couleur de texte : elle
  // ne donne que 5,1 sur le panneau et 2,1 sur l'or. Voici sa teinte éclairée,
  // le seul vert autorisé sur du TEXTE : 9,3 sur le panneau. Sur l'or, aucun
  // vert ne se lit — pas même celui-là.
  pelouseClaire:"#4FD07A",
  // `projecteur` EST devenu le fond : un aplat jaune posé sur l'or disparaît.
  // Il ne sert donc plus qu'à l'intérieur d'un panneau, où il donne 11,0. Pour
  // une action principale posée sur le fond, prendre `nuit` (l'écusson noir).
  projecteur:"#F5C22B",
  maillot:"#D93A2B",      // urgence, défaite, compte à rebours
  ciel:"#2A6FBF",         // l'adversaire, le second camp
  nuit:"#12160F",         // l'écusson du logo : le noir des panneaux
  trait:"3px solid #081109",
  traitFin:"2px solid #081109",
  ombre:"4px 4px 0 #081109",
  ombreL:"5px 5px 0 #081109",
  rayon:18, rayonS:12, rayonL:20,
  poster:"'Anton',Impact,sans-serif",
};
// Lettrage de titre manga : légère italique, contour d'encre, ombre dure.
// paintOrder évite que le contour ne ronge l'intérieur des lettres.
//
// Le contour n'a de sens QUE pour du texte clair sur fond sombre : posé sur
// du texte sombre, il se confond avec la lettre, bouche les contre-formes et
// rend le mot illisible. Pour un aplat clair (jaune, blanc), utiliser
// posterLight, qui ne garde que l'italique.
//
// L'épaisseur est proportionnelle au corps : un contour fixe de 2 px étouffe
// un texte de 15 px alors qu'il se voit à peine sur un titre de 52 px.
export const posterText = function(size, color, stroke){
  const w = stroke != null ? stroke : Math.max(1.2, Math.round(size / 16 * 10) / 10);
  const base = {
    fontFamily:G.poster, fontSize:size, lineHeight:1, letterSpacing:.5,
    transform:"skewX(-7deg)", color:color||G.white,
  };
  // L'ombre dure d'encre est portée par TOUS les libellés, contourés ou non :
  // c'est elle qui donne le relief d'affiche. Son décalage suit le corps.
  // Contour et ombre du LETTRAGE sont réservés aux grands titres. Sur un
  // libellé de bouton, l'ombre dure ne lit pas comme un effet d'affiche : elle
  // double le mot d'un fantôme noir décalé, et le contour épaissit les lettres
  // sans qu'on y gagne rien. Le relief d'un bouton vient déjà de SON PROPRE
  // encadrement — contour d'encre + ombre dure sur le cadre, pas sur le texte.
  // Sauf demande explicite : un contour réclamé par l'appelant est appliqué
  // quelle que soit la taille. C'est le cas d'un petit libellé posé sur une
  // couleur qu'on ne choisit pas — le nom d'un club sur la moitié blanche de
  // son maillot n'est lisible que cerclé d'encre. Pas d'ombre dure pour
  // autant : sur un petit corps elle double le mot d'un fantôme.
  if (stroke != null && stroke > 0) {
    return { ...base, WebkitTextStroke:w+"px "+G.encre, paintOrder:"stroke fill" };
  }
  if (size < 32) return base;
  const d = Math.round((size / 18 + w) * 10) / 10;
  return { ...base, WebkitTextStroke:w+"px "+G.encre, paintOrder:"stroke fill",
    textShadow:d+"px "+d+"px 0 "+G.encre };
};
// Même lettrage, sans contour ni ombre : pour du texte sombre sur aplat clair.
export const posterLight = function(size, color){ return posterText(size, color || "#1A1206", 0); };
// Titre d'affiche susceptible de passer à la ligne. `posterText` colle les
// lignes (lineHeight 1) : sur un titre d'un seul tenant c'est ce qu'on veut,
// mais dès qu'il se casse en deux, l'ombre dure de la première ligne retombe
// dans les lettres de la seconde et le mot devient sale. On desserre donc
// l'interligne de la hauteur exacte du décalage de l'ombre.
// Une fois et demie le décalage, et non une seule : en français les capitales
// portent des accents (É, À) qui montent au-dessus de la hauteur de capitale, et
// c'est eux qui viennent toucher l'ombre de la ligne du dessus.
export const posterTitre = function(size, color){
  const w = Math.max(1.2, Math.round(size / 16 * 10) / 10);
  const d = Math.round((size / 18 + w) * 10) / 10;
  return {...posterText(size, color), lineHeight:1 + 1.5 * d / size};
};
// Bouton unique de la charte. `bg` porte le sens (jaune = action principale,
// vert = classement, rouge = urgence) ; le traitement, lui, ne change jamais.
// `fg` clair → lettrage contouré ; `fg` sombre → lettrage nu (le contour
// boucherait les lettres).
//
// ATTENTION : cette recette pose `display:flex`, donc le bouton est un bloc.
// Dans un parent en `text-center`, il ne se centrera PAS — `text-center` ne
// centre que de l'inline — et se collera à gauche à la largeur de son contenu.
// Pour un bouton centré, redéclarer `display:"inline-flex"` APRÈS l'étalement.
export const btn = function(bg, fg, size){
  const c = fg || "#1A1206";
  const clair = c === G.white || c === "#fff" || c === "#ffffff";
  return {
    background:bg, color:c, border:G.trait, boxShadow:G.ombre, borderRadius:G.rayon,
    padding:"10px 16px",
    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
    ...(clair ? posterText(size||17, c) : posterLight(size||17, c)),
  };
};
// ── Le fond de la charte ──────────────────────────────────────────────
// Le trait d'encre (#081109) et l'ombre dure n'existent que sur un fond plus
// clair qu'eux. C'était la difficulté de la version verte, où le panneau et
// son ombre se noyaient dans la pelouse sombre. Sur l'or, la question ne se
// pose plus : 11,5 de contraste, le trait claque et l'ombre porte.
// À écraser dans la clé `background` du conteneur, pas en `backgroundImage` :
// le raccourci `background:transparent` de `shell` reprendrait le dessus.
export const fondCharte = "radial-gradient(120% 80% at 50% 38%, rgba(245,194,43,.96) 0 34%, rgba(217,162,26,.55) 100%),#F5C22B";
// Le terrain est DESSINÉ par-dessus ce fond — bandes de tonte translucides et
// tracés d'encre — au lieu d'être peint en aplats opaques qui recouvraient le
// fond. Le grain de trame sérigraphié ferme la couche, comme sur l'accueil.
// zIndex -1 et non 0 : un élément POSITIONNÉ à zIndex 0 se peint AU-DESSUS du
// flux normal, pas en dessous. Le terrain se posait donc par-dessus le contenu
// des écrans dont le conteneur n'est pas lui-même positionné — la barre
// d'indices jaune de « Trouve le joueur » paraissait translucide, les carrés
// d'indice étaient grenés, et le rond central traversait les cases de la grille
// GOAT GRID et le plateau du duel. À -1, il passe derrière le contenu tout en
// restant devant le fond de son conteneur, qui est exactement sa place.
//
// Ce qui suppose que le conteneur soit un CONTEXTE D'EMPILEMENT, sinon un
// calque négatif remonterait derrière le fond d'un ancêtre et disparaîtrait.
// Les conteneurs qui portent déjà un zIndex (overlays, feuilles de mode) en
// sont un ; ceux qui n'en ont pas doivent porter `isolation:"isolate"`.
// L'ARÈNE remplace le terrain. Les bandes de tonte, la ligne médiane et le rond
// central étaient l'iconographie d'une pelouse : sur un aplat d'or, ils ne
// veulent plus rien dire. Le logo donne le motif de remplacement — les lignes
// de vitesse du manga, qui convergent vers le centre, et la trame sérigraphiée.
//
// Les lignes sont un `repeating-conic-gradient` : un dégradé conique répété
// dessine des coins qui rayonnent depuis un point, ce qui est exactement une
// ligne de vitesse. Le centre est ensuite RECOUVERT d'un aplat d'or au lieu
// d'être masqué : un `mask-image` aurait marché aussi, mais il n'est pas
// également fiable d'un moteur à l'autre, et le recouvrement ne coûte rien.
//
// zIndex -1 et non 0 : un élément POSITIONNÉ à zIndex 0 se peint AU-DESSUS du
// flux normal, pas en dessous. Le décor se posait donc par-dessus le contenu
// des écrans dont le conteneur n'est pas lui-même positionné. À -1, il passe
// derrière le contenu tout en restant devant le fond de son conteneur.
//
// Ce qui suppose que le conteneur soit un CONTEXTE D'EMPILEMENT, sinon un
// calque négatif remonterait derrière le fond d'un ancêtre et disparaîtrait.
// Les conteneurs qui portent déjà un zIndex (overlays, feuilles de mode) en
// sont un ; ceux qui n'en ont pas doivent porter `isolation:"isolate"`.
export const areneCharte = (
  <div aria-hidden="true" style={{position:"absolute",inset:0,zIndex:-1,pointerEvents:"none",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:"-25%",
      background:"repeating-conic-gradient(from 0deg at 50% 42%, rgba(8,17,9,.42) 0deg .55deg, rgba(8,17,9,0) .55deg 2.7deg)"}}/>
    {/* Le cœur de l'arène reste dégagé, comme au centre du logo : sans ça, les
        lignes se rejoignent en une tache noire au milieu de l'écran. */}
    <div style={{position:"absolute",inset:0,
      background:"radial-gradient(circle at 50% 42%, #F5C22B 0 20%, rgba(245,194,43,.92) 32%, rgba(245,194,43,0) 62%)"}}/>
    {/* La trame sérigraphiée ferme la couche. Points d'or sombre et non de noir :
        sur l'or, une trame noire grise le fond au lieu de le texturer. */}
    <div style={{position:"absolute",inset:0,opacity:.5,
      backgroundImage:"radial-gradient(circle,#D9A21A 1.4px,transparent 1.7px)",backgroundSize:"7px 7px"}}/>
  </div>
);
// Bouton retour de la charte : le même cadre d'encre et la même ombre dure que
// les autres boutons, au rayon franc. La pastille translucide et floutée
// d'avant était le seul élément d'interface « verre » resté sur ces écrans.
// La flèche garde la fonte de texte : l'italique d'affiche penche un glyphe
// directionnel, et Anton n'a pas de dessin pour « ← ».
export const retourStyle = {...btn(G.nuit,G.white,20),
  width:44,height:44,padding:0,borderRadius:G.rayonS,flexShrink:0,
  fontFamily:G.font,fontSize:20,fontWeight:800,letterSpacing:0,transform:"none"};
export const retourCharte = function(onClick){ return (
  <button onClick={onClick} style={{...retourStyle,position:"fixed",
    // Même décalage que son jumeau `fermerCharte` : sans lui, le bouton se
    // range sous la barre d'état sur un iPhone à encoche.
    top:"calc(14px + env(safe-area-inset-top))",left:14,zIndex:100}}>←</button>
); };
// Son pendant en haut à droite, pour les feuilles de mode qui se ferment au
// lieu de revenir en arrière. Même cadre : une croix et une flèche qui ne se
// ressemblent pas donneraient deux vocabulaires pour un même geste.
export const fermerCharte = function(onClick, z){ return (
  <button onClick={onClick} style={{...retourStyle,position:"fixed",
    top:"calc(14px + env(safe-area-inset-top))",right:14,zIndex:z||100,fontSize:24,fontWeight:400}}>×</button>
); };
// Ligne de liste de la charte — réglage, accès, lien : panneau de nuit, trait
// d'encre, ombre dure. Une seule définition pour Mon compte et Mon profil,
// sinon les deux listes divergent au premier ajustement.
// Trait PLEIN, comme les lignes du classement : un rectangle de contenu est
// toujours dessiné du même crayon d'un écran à l'autre. Le trait fin est
// réservé aux petits éléments — pastilles, vignettes, séparateurs internes.
export const ligneCharte = {
  padding:"14px 18px", background:G.nuit, border:G.trait, borderRadius:G.rayon,
  boxShadow:G.ombre, color:G.white, fontFamily:G.font, fontSize:14, fontWeight:700,
  display:"flex", alignItems:"center", gap:12, textAlign:"left", textDecoration:"none",
  width:"100%", boxSizing:"border-box", cursor:"pointer",
};
// Pastille d'icône des lignes : aplat de la couleur qui porte le sens, cerclé
// d'encre. Les carrés translucides d'avant (couleur à 12 % sur filet à 28 %)
// ne tenaient pas sur un panneau de nuit.
export const pastilleCharte = function(bg, taille){
  const t = taille || 40;
  return {width:t,height:t,borderRadius:G.rayonS,background:bg,border:G.traitFin,
    display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(t*.48),
    flexShrink:0,boxShadow:"2px 2px 0 "+G.encre};
};
