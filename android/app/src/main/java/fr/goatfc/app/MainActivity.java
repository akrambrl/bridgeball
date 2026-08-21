package fr.goatfc.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enregistrer le greffon AVANT super.onCreate : c'est là que le pont
        // Capacitor recense les greffons. Oublié, `registerPlugin("Coffre")`
        // côté JS rendrait un mandataire dont tous les appels lèvent — que la
        // façade rattrape, donc l'app marche sans que le coffre serve.
        registerPlugin(Coffre.class);
        super.onCreate(savedInstanceState);
    }
}
