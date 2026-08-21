package fr.goatfc.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.auth.blockstore.Blockstore;
import com.google.android.gms.auth.blockstore.BlockstoreClient;
import com.google.android.gms.auth.blockstore.StoreBytesData;
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest;
import com.google.android.gms.auth.blockstore.RetrieveBytesResponse;

import java.nio.charset.StandardCharsets;
import java.util.Map;

// LE COFFRE, CÔTÉ ANDROID — le Block Store des services Google Play.
//
// Le Keystore d'Android est vidé à la désinstallation, comme le reste. Le Block
// Store, lui, est FAIT pour survivre : Google l'a conçu pour restaurer une petite
// donnée après une réinstallation ou sur un nouvel appareil, sans que
// l'utilisateur ait à se connecter. La donnée est chiffrée de bout en bout et
// liée au compte Google de l'appareil.
//
// On écrit sur la CLÉ PAR DÉFAUT (un seul secret à ranger, pas besoin de la
// gestion multi-clés qui exige une version plus récente des services Play). La
// lecture relit cette même clé par défaut.
//
// Chaque méthode résout proprement, même en cas d'échec : la façade JS
// (src/lib/coffre.ts) considère le coffre comme « au mieux », jamais comme un
// prérequis. Un appareil sans services Google, ou avec la sauvegarde coupée,
// retombe simplement sur la saisie manuelle du code.
@CapacitorPlugin(name = "Coffre")
public class Coffre extends Plugin {

    @PluginMethod
    public void sauver(PluginCall call) {
        String code = call.getString("code");
        if (code == null || code.isEmpty()) {
            call.resolve();
            return;
        }
        try {
            BlockstoreClient client = Blockstore.getClient(getContext());
            StoreBytesData data = new StoreBytesData.Builder()
                .setBytes(code.getBytes(StandardCharsets.UTF_8))
                .build();
            client.storeBytes(data)
                .addOnSuccessListener(result -> call.resolve())
                // Un échec n'est pas une erreur pour l'appelant : on résout quand même.
                .addOnFailureListener(e -> call.resolve());
        } catch (Exception e) {
            call.resolve();
        }
    }

    @PluginMethod
    public void lire(PluginCall call) {
        try {
            BlockstoreClient client = Blockstore.getClient(getContext());
            RetrieveBytesRequest request = new RetrieveBytesRequest.Builder()
                .setRetrieveAll(true)
                .build();
            client.retrieveBytes(request)
                .addOnSuccessListener(response -> {
                    JSObject ret = new JSObject();
                    ret.put("code", null);
                    try {
                        Map<String, RetrieveBytesResponse.BlockstoreData> map =
                            response.getBlockstoreDataMap();
                        RetrieveBytesResponse.BlockstoreData data =
                            map.get(BlockstoreClient.DEFAULT_BYTES_DATA_KEY);
                        if (data != null) {
                            byte[] bytes = data.getBytes();
                            if (bytes != null && bytes.length > 0) {
                                ret.put("code", new String(bytes, StandardCharsets.UTF_8));
                            }
                        }
                    } catch (Exception ignore) { /* code reste null */ }
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> {
                    JSObject ret = new JSObject();
                    ret.put("code", null);
                    call.resolve(ret);
                });
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("code", null);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void effacer(PluginCall call) {
        // Écrire un secret VIDE sur la clé par défaut revient à l'effacer : la
        // prochaine lecture rendra une chaîne vide, que la façade JS écarte.
        try {
            BlockstoreClient client = Blockstore.getClient(getContext());
            StoreBytesData data = new StoreBytesData.Builder()
                .setBytes(new byte[0])
                .build();
            client.storeBytes(data)
                .addOnSuccessListener(result -> call.resolve())
                .addOnFailureListener(e -> call.resolve());
        } catch (Exception e) {
            call.resolve();
        }
    }
}
