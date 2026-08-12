// Faire réagir une liste de suggestions AU DOIGT, clavier ouvert.
//
// LE DÉFAUT. Dans GOAT Battle, taper le nom d'un joueur puis toucher la
// suggestion ne faisait rien : il fallait d'abord fermer le clavier, puis
// toucher. La suggestion était pourtant bien visible, largement au-dessus du
// clavier — ce n'était donc pas un recouvrement.
//
// L'enchaînement réel, sur iOS :
//   1. le doigt touche la suggestion ;
//   2. l'action par défaut du navigateur retire le focus de l'input ;
//   3. le clavier se referme, `visualViewport` change de hauteur ;
//   4. l'app repasse en layout NON compact — dans GOAT Battle les deux cartes
//      de club passent de côte à côte à empilées, ce qui rallonge le bloc de
//      plus de cent pixels et pousse tout ce qui suit vers le bas ;
//   5. le `click` est enfin distribué… aux coordonnées du doigt, où la
//      suggestion ne se trouve plus.
// Le clic n'était pas perdu : il tombait à côté. Une fois le clavier déjà fermé,
// plus rien ne bouge et le même geste fonctionne.
//
// LA CORRECTION. Agir sur `touchend`, qui arrive AVANT que le focus ne change et
// donc avant tout déplacement, et y appeler `preventDefault()` : ça supprime à la
// fois le clic émulé (pas de double envoi) et la perte de focus (le clavier reste
// ouvert, prêt pour la manche suivante).
//
// Pourquoi pas `pointerdown`, qui serait plus direct : `preventDefault()` sur
// pointerdown empêche aussi le DÉFILEMENT tactile initié depuis l'élément. La
// liste de « Trouve le joueur » est haute et défilante — on l'aurait rendue
// impossible à faire défiler pour corriger un clic. `touchend` n'a pas cet
// inconvénient, le défilement étant décidé bien avant lui.
//
// Reste à distinguer un TAP d'un DÉFILEMENT qui se termine sur un élément : sans
// ça, faire défiler la liste et lever le doigt validerait la suggestion sous le
// doigt. D'où le seuil de déplacement.

/** Au-delà de ce déplacement, le geste est un défilement et non un tap (px). */
const SEUIL_TAP = 10;

// État au niveau du MODULE et non dans une fermeture par élément : un rendu de
// React entre le toucher et le relâchement recréerait les gestionnaires, et
// remettrait la position de départ à zéro au milieu du geste. Il n'y a de toute
// façon qu'un seul geste à la fois.
let depart = null;
let bouge = false;
// Horodatage du dernier envoi déclenché par le doigt. Si un navigateur laissait
// malgré tout passer le clic émulé, il arriverait dans les ~300 ms : on l'ignore
// plutôt que d'envoyer deux fois la même réponse.
let dernierTactile = 0;
const FENETRE_FANTOME = 700;

/**
 * Les gestionnaires à étaler sur un élément de liste tapable.
 *
 *     <div {...handlersDeTap(function(){ repondre(p.name); })}>{p.name}</div>
 *
 * Le clic reste branché : sur ordinateur `touchend` n'arrive jamais, et une
 * activation au clavier (Entrée sur un `<button>`) passe elle aussi par le clic.
 *
 * Le second paramètre est INDISPENSABLE sur un bouton désactivé : `disabled`
 * empêche le navigateur d'émettre un `click`, mais pas `touchend`, qui reste
 * distribué à l'élément. Sans ce garde, toucher un « VALIDER » grisé validerait.
 *
 * @param {() => void} action ce qu'il faut faire quand l'élément est activé
 * @param {boolean} [actif] à faux, l'élément ne réagit à rien (bouton désactivé)
 */
export function handlersDeTap(action, actif) {
  const permis = actif === undefined ? true : !!actif;
  return {
    onTouchStart: function (e) {
      const t = e && e.touches && e.touches[0];
      depart = t ? { x: t.clientX, y: t.clientY } : null;
      bouge = false;
    },
    onTouchMove: function (e) {
      const t = e && e.touches && e.touches[0];
      if (!t || !depart) return;
      if (Math.abs(t.clientX - depart.x) > SEUIL_TAP ||
          Math.abs(t.clientY - depart.y) > SEUIL_TAP) bouge = true;
    },
    onTouchEnd: function (e) {
      if (!permis) { depart = null; return; }
      if (bouge) { depart = null; return; }   // c'était un défilement
      // Supprime le clic émulé ET la perte de focus : rien ne se déplace, et le
      // clavier reste ouvert.
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      dernierTactile = Date.now();
      depart = null;
      action();
    },
    onClick: function () {
      if (!permis) return;
      if (Date.now() - dernierTactile < FENETRE_FANTOME) return;  // clic fantôme
      action();
    },
  };
}

/** Remet l'état du geste à zéro. Réservé aux tests. */
export function reinitialiserTap() {
  depart = null; bouge = false; dernierTactile = 0;
}
