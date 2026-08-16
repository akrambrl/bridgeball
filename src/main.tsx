import { inject } from '@vercel/analytics';
inject();
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./lib/native";
import { initPub } from "./lib/pub";

initNative();
// Le SDK publicitaire et le consentement. Sans effet hors coque native, et
// volontairement pas attendu : une pub qui met du temps à s'initialiser ne doit
// pas retarder d'une milliseconde l'affichage du jeu.
void initPub();

createRoot(document.getElementById("root")!).render(<App />);
