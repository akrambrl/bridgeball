import Foundation
import Capacitor
import Security

// LE COFFRE, CÔTÉ iOS — le Trousseau (Keychain), qui survit à la désinstallation.
//
// Le Trousseau est le SEUL magasin d'iOS qui n'est pas vidé quand on supprime
// l'app. `kSecAttrSynchronizable = true` le fait en plus se synchroniser via le
// Trousseau iCloud : le code suit le joueur d'un iPhone à l'autre, sans qu'il
// ait rien à noter.
//
// On n'ajoute AUCUN entitlement : un item de Trousseau ordinaire (classe
// GenericPassword) ne demande rien de spécial, et la synchronisation iCloud
// Keychain non plus — c'est le réglage iCloud de l'utilisateur qui décide, pas
// une capacité de l'app. Garder zéro entitlement, c'est garder le build simple
// et la revue Apple sans question.
//
// Chaque méthode renvoie proprement : jamais de crash, au pire un resolve à
// vide. La façade JS (src/lib/coffre.ts) rattrape de toute façon, mais un
// greffon qui ne lève pas est plus facile à raisonner.
@objc(Coffre)
public class Coffre: CAPPlugin {

    // Un compte unique dans le Trousseau. Le service porte l'identifiant du
    // bundle pour ne rien risquer de partager avec une autre app.
    private let service = "fr.goatfc.app.recovery"
    private let compte = "recovery_code"

    private func requeteBase() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: compte,
            // Synchronisé via iCloud Keychain : c'est ce qui fait suivre le code
            // sur un nouvel appareil, pas seulement après réinstallation.
            kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
        ]
    }

    @objc func sauver(_ call: CAPPluginCall) {
        guard let code = call.getString("code"), !code.isEmpty else {
            call.resolve()
            return
        }
        guard let donnee = code.data(using: .utf8) else {
            call.resolve()
            return
        }
        // On efface avant d'écrire : SecItemUpdate est plus délicat sur un item
        // synchronizable, et un delete+add est idempotent et sans surprise.
        SecItemDelete(requeteBase() as CFDictionary)

        var ajout = requeteBase()
        ajout[kSecValueData as String] = donnee
        // Accessible dès le premier déverrouillage, et NON lié à cet appareil :
        // ...ThisDeviceOnly interdirait justement la synchronisation qu'on veut.
        ajout[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock

        SecItemAdd(ajout as CFDictionary, nil)
        // On ne fait pas échouer l'appel sur un statut non-zéro : la façade JS
        // considère l'écriture comme « au mieux », jamais comme un prérequis.
        call.resolve()
    }

    @objc func lire(_ call: CAPPluginCall) {
        var requete = requeteBase()
        requete[kSecReturnData as String] = kCFBooleanTrue as Any
        requete[kSecMatchLimit as String] = kSecMatchLimitOne

        var resultat: AnyObject?
        let statut = SecItemCopyMatching(requete as CFDictionary, &resultat)

        if statut == errSecSuccess,
           let donnee = resultat as? Data,
           let code = String(data: donnee, encoding: .utf8) {
            call.resolve(["code": code])
        } else {
            // errSecItemNotFound au premier lancement : ce n'est pas une erreur.
            call.resolve(["code": NSNull()])
        }
    }

    @objc func effacer(_ call: CAPPluginCall) {
        SecItemDelete(requeteBase() as CFDictionary)
        call.resolve()
    }
}
