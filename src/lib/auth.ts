// COMPTE ANONYME SUPABASE — l'identité vérifiable qui manquait
//
// ── LE PROBLÈME ───────────────────────────────────────────────────────────
//
// `player_id` est une chaîne tirée au sort par le client et rangée dans
// localStorage. La clé publique est dans le paquet de l'app, donc lisible par
// quiconque le décompresse. Et les player_id sont énumérables : mesuré en
// production, `bb_pseudos?select=player_id` répond 200 sur 337 lignes.
//
// N'importe qui pouvait donc écrire un score sous l'identité de n'importe qui,
// et réécrire l'XP ou le pseudo d'un autre joueur. Avec un concours doté, c'est
// le genre de chose qui finit par arriver.
//
// La connexion anonyme de Supabase donne à chaque appareil un vrai jeton, donc
// un `auth.uid()` que le serveur peut vérifier. Voir
// docs/supabase-auth-anonyme.sql pour la moitié serveur.
//
// ── CE MODULE NE DOIT JAMAIS EMPÊCHER DE JOUER ────────────────────────────
//
// C'est sa règle principale, et elle explique toute sa forme. Trois choses
// peuvent manquer, indépendamment les unes des autres :
//
//   • la connexion anonyme peut ne pas être activée dans le tableau de bord
//     Supabase (c'est un interrupteur, désactivé par défaut) ;
//   • la migration SQL peut ne pas avoir été jouée, et alors le rôle
//     `authenticated` n'a AUCUNE politique — tout serait refusé ;
//   • le réseau peut simplement être coupé.
//
// Dans les trois cas, on retombe sur la clé publique et l'app fonctionne comme
// avant. L'ORDRE DE DÉPLOIEMENT N'A DONC PAS D'IMPORTANCE, ce qui est le seul
// moyen de ne pas transformer une mise en production en chorégraphie.
//
// Le repli n'est pas théorique : il est ÉPROUVÉ par une requête de contrôle
// juste après la connexion. Se contenter d'obtenir un jeton ne prouve rien —
// c'est le serveur qui décide s'il l'accepte.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Etat = "inconnu" | "actif" | "replie";

let client: SupabaseClient | null = null;
let etat: Etat = "inconnu";
let motifRepli = "";

/** Vrai quand un jeton est utilisable ; faux tant qu'on est sur la clé publique. */
export const authActive = (): boolean => etat === "actif";

/** Pourquoi on est retombé sur la clé publique. Vide si tout va bien. */
export const raisonDuRepli = (): string => motifRepli;

function replier(raison: string): void {
  if (etat === "replie") return;
  etat = "replie";
  motifRepli = raison;
  // Une trace en console et pas une remontée d'erreur : ce n'est pas une panne,
  // c'est un mode de fonctionnement — celui d'avant ce module.
  console.info("[auth] clé publique conservée : " + raison);
}

/**
 * Ouvre une session anonyme, et VÉRIFIE qu'elle est acceptée par le serveur.
 * À appeler une fois au lancement. Ne lève jamais.
 */
export async function initAuth(url: string, clePublique: string): Promise<void> {
  if (client) return;
  try {
    client = createClient(url, clePublique, {
      auth: {
        // `persistSession` est ce qui fait qu'un joueur garde le MÊME compte
        // d'un lancement à l'autre. Sans lui, chaque ouverture créerait un
        // compte anonyme neuf, et le lien avec son pseudo serait à refaire —
        // sauf qu'il échouerait, le pseudo étant déjà lié à l'ancien compte.
        // C'est le réglage le plus important du fichier.
        persistSession: true,
        autoRefreshToken: true,
        // L'app n'utilise aucun lien de connexion : rien à lire dans l'URL, et
        // le laisser à `true` ferait inspecter le fragment à chaque démarrage.
        detectSessionInUrl: false,
      },
    });

    const { data } = await client.auth.getSession();
    if (!data.session) {
      const { error } = await client.auth.signInAnonymously();
      if (error) {
        // Le cas le plus probable au premier déploiement : l'interrupteur
        // « Anonymous sign-ins » n'est pas activé dans le tableau de bord.
        replier("connexion anonyme refusée (" + error.message + ")");
        return;
      }
    }

    // ── LE CONTRÔLE QUI COMPTE ────────────────────────────────────────────
    // Un jeton obtenu ne veut pas dire un jeton accepté. Si la migration SQL
    // n'a pas été jouée, le rôle `authenticated` n'a aucune politique et TOUTES
    // les requêtes seraient refusées — l'app paraîtrait vide alors qu'elle
    // fonctionnait une minute avant. On l'essaie donc sur une lecture anodine
    // avant de s'engager.
    const jetonEssai = (await client.auth.getSession()).data.session?.access_token;
    if (!jetonEssai) { replier("aucun jeton après connexion"); return; }

    const r = await fetch(url + "/rest/v1/bb_pseudos?select=player_id&limit=1", {
      headers: { apikey: clePublique, Authorization: "Bearer " + jetonEssai },
    });
    if (!r.ok) {
      replier("le serveur refuse le jeton (" + r.status
        + ") — docs/supabase-auth-anonyme.sql n'a probablement pas été joué");
      return;
    }

    etat = "actif";
  } catch (e) {
    replier("erreur au démarrage (" + (e instanceof Error ? e.message : String(e)) + ")");
  }
}

/**
 * Le jeton à mettre dans l'en-tête Authorization, ou `null` pour dire à
 * l'appelant d'utiliser la clé publique.
 *
 * Passe par `getSession()` à chaque appel plutôt que de garder le jeton en
 * mémoire : c'est lui qui rafraîchit un jeton expiré. Le cacher nous-mêmes
 * marcherait une heure, puis toutes les écritures échoueraient — en silence,
 * puisque sbFetch avale les échecs.
 */
export async function jetonAuth(): Promise<string | null> {
  if (etat !== "actif" || !client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** L'identifiant du compte anonyme, pour affichage ou diagnostic. */
export async function idCompte(): Promise<string | null> {
  if (!client) return null;
  try { return (await client.auth.getSession()).data.session?.user?.id ?? null; }
  catch { return null; }
}

/**
 * Lie ce pseudo au compte de cet appareil. Le code de récupération sert de
 * PREUVE de propriété : les player_id étant publics, une revendication sans
 * preuve permettrait de voler le compte de tout joueur pas encore mis à jour.
 *
 * Rend l'un des états de la fonction serveur : `lie`, `deja_lie`, `inconnu`,
 * `code_invalide`, `appartient_a_un_autre`, `banni`, `non_authentifie`, ou
 * `indisponible` quand on est sur la clé publique.
 *
 * Une fois lié, le serveur refuse toute écriture sous ce pseudo venant d'un
 * autre compte — y compris d'un client sans jeton.
 */
export async function lierCompte(playerId: string, code: string | null): Promise<string> {
  if (etat !== "actif" || !client) return "indisponible";
  try {
    const { data, error } = await client.rpc("lier_compte", {
      p_player_id: playerId,
      p_code: code || null,
    });
    if (error) { console.info("[auth] lier_compte : " + error.message); return "erreur"; }
    return typeof data === "string" ? data : "erreur";
  } catch {
    return "erreur";
  }
}
