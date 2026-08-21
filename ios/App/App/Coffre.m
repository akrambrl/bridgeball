#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Le pont Objective-C qui EXPOSE le greffon Swift à Capacitor.
//
// Sans ce fichier, `Coffre.swift` compile mais reste invisible : Capacitor
// découvre les greffons par cette macro, lue au démarrage du pont. C'est
// l'étape qu'on oublie, et le symptôme est un `registerPlugin("Coffre")` côté
// JS dont tous les appels lèvent « not implemented » — ce que la façade rattrape,
// donc l'app marche sans que le coffre serve à rien. À vérifier sur appareil.
CAP_PLUGIN(Coffre, "Coffre",
    CAP_PLUGIN_METHOD(sauver, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(lire, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(effacer, CAPPluginReturnPromise);
)
