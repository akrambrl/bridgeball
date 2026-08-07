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
  bg:"#0E1F14",bgPanel:"rgba(0,0,0,.5)",bgCard:"#141414",dark:"#0a0a0a",white:"#ffffff",
  offWhite:"#F5F5F5",accent:"#00E676",gold:"#FFD600",red:"#FF3D57",
  font:"'Bebas Neue',cursive,sans-serif",heading:"'Bebas Neue',cursive,sans-serif",

  // ── Charte « Olive et Tom » ────────────────────────────────────────
  // Ce qui fait le manga, c'est le TRAIT et l'OMBRE DURE, pas l'angle vif :
  // les rayons restent proches de ceux d'avant (arrondi franc). Ces jetons
  // ne sont pour l'instant appliqués QUE sur l'écran d'accueil mobile.
  encre:"#081109",        // le trait — noir à biais vert, jamais noir pur
  pelouse:"#2A9B4E",      // l'accent principal, remplace le vert LED #00E676
  projecteur:"#F5C22B",   // actions et réussites, moins fluo que #FFD600
  maillot:"#D93A2B",      // urgence, défaite, compte à rebours
  ciel:"#2A6FBF",         // l'adversaire, le second camp
  nuit:"#0E2C17",
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
// ── Le terrain de la charte ───────────────────────────────────────────
// Le trait d'encre (#081109) et l'ombre dure n'existent que sur un fond plus
// clair qu'eux. Sur les bandes de pelouse d'origine (#0E1F14) doublées d'un
// voile noir, un panneau de nuit cerclé d'encre rendait un rectangle mou :
// le cadre et son ombre se fondaient dans le fond. La pelouse passe donc à la
// valeur éclairée de la charte, celle du bas du dégradé de l'accueil, avec le
// halo des projecteurs en haut.
// À écraser dans la clé `background` du conteneur, pas en `backgroundImage` :
// le raccourci `background:transparent` de `shell` reprendrait le dessus.
export const fondCharte = "radial-gradient(72% 18% at 14% 0%, rgba(245,194,43,.20), transparent 70%),radial-gradient(72% 18% at 86% 0%, rgba(245,194,43,.20), transparent 70%),#17572C";
// Le terrain est DESSINÉ par-dessus ce fond — bandes de tonte translucides et
// tracés d'encre — au lieu d'être peint en aplats opaques qui recouvraient le
// fond. Le grain de trame sérigraphié ferme la couche, comme sur l'accueil.
export const terrainCharte = (
  <div aria-hidden="true" style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
    {[0,1,2,3,4,5,6].map(function(i){return(
      <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"rgba(8,17,9,.16)":"transparent"}}/>
    );})}
    {/* Ligne médiane, rond central et point de coup d'envoi : à l'encre, comme
        tout tracé de la charte, et non plus en blanc translucide. */}
    <div style={{position:"absolute",left:0,right:0,top:"50%",height:3,background:"rgba(8,17,9,.45)",transform:"translateY(-50%)"}}/>
    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"3px solid rgba(8,17,9,.45)"}}/>
    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:10,height:10,borderRadius:"50%",background:"rgba(8,17,9,.45)"}}/>
    {/* Nocturne en haut d'écran : un voile d'encre sur la hauteur du titre, pour
        garder la nuit de l'accueil sous le lettrage et n'éclairer la pelouse
        qu'à partir des panneaux. Hauteur fixe et non proportionnelle : sur une
        page qui défile, un dégradé sur toute la hauteur laisserait la moitié
        haute dans le noir et le trait d'encre y disparaîtrait à nouveau. */}
    <div style={{position:"absolute",top:0,left:0,right:0,height:200,
      background:"linear-gradient(180deg,rgba(8,17,9,.74),rgba(8,17,9,0))"}}/>
    <div style={{position:"absolute",inset:0,opacity:.12,
      backgroundImage:"radial-gradient(circle,#000 1px,transparent 1.3px)",backgroundSize:"5px 5px"}}/>
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
  <button onClick={onClick} style={{...retourStyle,position:"fixed",top:14,left:14,zIndex:100}}>←</button>
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
