// L'INVITATION À CRÉER UN PSEUDO, APRÈS UNE PARTIE.
//
// Un joueur sans pseudo peut jouer à certains modes (« Trouve le joueur », la
// Devinette) : son score part sous le nom « Anonyme » et il apparaît au
// classement comme « ? ». Il joue pour un concours où il ne peut pas être
// reconnu — ni, le moment venu, réclamer un lot. Cette règle décide QUAND le lui
// dire. Elle ne touche pas au réseau : elle se teste.
//
// Une fenêtre de répit sépare deux invitations. Redemander après CHAQUE partie
// ferait fuir le joueur qu'on veut garder ; ne le demander qu'une fois ne
// l'atteindrait jamais s'il ferme le premier message sans y penser.

/** Délai minimal entre deux invitations : un quart d'heure. */
export const DELAI_INVITATION_MS = 15 * 60 * 1000;

/**
 * Faut-il proposer au joueur de créer son pseudo maintenant ?
 *
 * @param {object} p
 * @param {boolean} p.aPseudo           le joueur a déjà un pseudo
 * @param {number|string|null} p.derniereInvitation  horodatage (ms) de la dernière invitation affichée
 * @param {number} [p.maintenant]       horodatage courant (ms)
 * @param {number} [p.delaiMs]
 */
export function faut_il_inviter({ aPseudo, derniereInvitation, maintenant, delaiMs }) {
  if (aPseudo) return false;
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  const delai = Number.isFinite(delaiMs) ? delaiMs : DELAI_INVITATION_MS;
  const derniere = Number(derniereInvitation);
  // Jamais invité (ou valeur illisible) : on invite. Une horloge qui recule
  // (dernière invitation « dans le futur ») ne doit pas bloquer à vie.
  if (!Number.isFinite(derniere) || derniere <= 0 || derniere > t) return true;
  return t - derniere >= delai;
}
