// L'écran « Mise à jour » de l'app native : bloquant quand la version est trop ancienne,
// simple bandeau quand une version plus récente est conseillée. La décision est dans
// src/lib/version.ts ; ici il n'y a que l'affichage et le moment où l'on revérifie
// (au lancement, au retour dans l'app, puis toutes les 30 minutes).
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { G, posterText, btn, fondCharte } from "@/lib/charte.jsx";
import { tr } from "@/lib/lang";
import { openExternalLink } from "@/lib/native";
import { verifierVersion, URL_APP_STORE, URL_PLAY_STORE, type EtatVersion } from "@/lib/version";

const CLE_REPORT = "bb_maj_reportee";
const REPORT_MS = 24 * 3600 * 1000;

function reporteRecemment(): boolean {
  try {
    const t = parseInt(localStorage.getItem(CLE_REPORT) || "0", 10);
    return Number.isFinite(t) && Date.now() - t < REPORT_MS;
  } catch { return false; }
}

export default function MiseAJour() {
  const [etat, setEtat] = useState<EtatVersion>("ok");
  const [reporte, setReporte] = useState<boolean>(reporteRecemment);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let vivant = true;
    const verifier = () => { verifierVersion().then((e) => { if (vivant) setEtat(e); }); };
    verifier();
    const iv = setInterval(verifier, 30 * 60 * 1000);
    let retirer: (() => void) | null = null;
    import("@capacitor/app").then(({ App }) => {
      App.addListener("appStateChange", ({ isActive }) => { if (isActive) verifier(); })
        .then((h) => { retirer = () => { try { h.remove(); } catch {} }; })
        .catch(() => {});
    }).catch(() => {});
    return () => { vivant = false; clearInterval(iv); if (retirer) retirer(); };
  }, []);

  if (!Capacitor.isNativePlatform() || etat === "ok") return null;

  const url = Capacitor.getPlatform() === "ios" ? URL_APP_STORE : URL_PLAY_STORE;
  const ouvrir = () => openExternalLink(url);

  if (etat === "obligatoire") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: fondCharte, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 380, background: G.nuit, border: G.trait, boxShadow: G.ombreL,
          borderRadius: 28, padding: "28px 22px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>⬆️</div>
          <div style={{ ...posterText(26, G.white), lineHeight: 1.08, marginBottom: 10 }}>
            {tr("Mise à jour obligatoire", "Update required", "Update erforderlich", "Aggiornamento obbligatorio", "Atualização obrigatória", "Actualización obligatoria")}
          </div>
          <div style={{ fontSize: 14, color: "rgba(242,231,206,.88)", lineHeight: 1.55, marginBottom: 18 }}>
            {tr("Une nouvelle version de GOAT FC est nécessaire pour continuer à jouer et garder ton classement à jour.",
                "A new version of GOAT FC is required to keep playing and keep your ranking up to date.",
                "Eine neue Version von GOAT FC ist nötig, um weiterzuspielen und deine Rangliste aktuell zu halten.",
                "Serve una nuova versione di GOAT FC per continuare a giocare e tenere aggiornata la tua classifica.",
                "É necessária uma nova versão do GOAT FC para continuar a jogar e manter o seu ranking atualizado.",
                "Se necesita una nueva versión de GOAT FC para seguir jugando y mantener tu clasificación al día.")}
          </div>
          <button onClick={ouvrir} style={{ ...btn(G.projecteur, G.encre, 19), width: "100%", padding: "14px" }}>
            {tr("Mettre à jour", "Update now", "Jetzt aktualisieren", "Aggiorna ora", "Atualizar agora", "Actualizar ahora")}
          </button>
        </div>
      </div>
    );
  }

  // Conseillée : un bandeau en haut, qu'on peut repousser d'un jour.
  if (reporte) return null;
  return (
    <div style={{ position: "fixed", top: "max(10px, env(safe-area-inset-top))", left: 12, right: 12,
      zIndex: 2147482000, background: G.projecteur, color: G.encre, border: G.trait, boxShadow: G.ombre,
      borderRadius: 16, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, lineHeight: 1.3 }}>
        ⬆️ {tr("Nouvelle version disponible", "New version available", "Neue Version verfügbar", "Nuova versione disponibile", "Nova versão disponível", "Nueva versión disponible")}
      </div>
      <button onClick={ouvrir} style={{ ...btn(G.encre, G.creme, 13), padding: "8px 12px", flexShrink: 0 }}>
        {tr("Mettre à jour", "Update", "Update", "Aggiorna", "Atualizar", "Actualizar")}
      </button>
      <button aria-label="Plus tard" onClick={() => { try { localStorage.setItem(CLE_REPORT, String(Date.now())); } catch {} setReporte(true); }}
        style={{ background: "none", border: "none", color: G.encre, fontSize: 18, fontWeight: 900, cursor: "pointer", padding: 4 }}>✕</button>
    </div>
  );
}
