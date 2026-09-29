// La bannière AdMob est un calque NATIF posé par-dessus la webview : si elle
// reste affichée sur l'écran de jeu ou de fin de partie, elle recouvre les
// boutons (signalé en capture — « Rejouer » et « Accueil » cachés).
//
// Cause : `showBanner` met du temps (chargement réseau de l'annonce). Un joueur
// qui lance une partie pendant ce temps déclenche `banniereVisible(false)`, et
// l'ancien garde `|| banniereEnCours → return` avalait l'ordre sans trace. L'effet
// de l'appelant ne se relance que quand l'écran CHANGE : rien ne venait plus
// corriger, la bannière restait.
import { describe, it, expect, vi, beforeEach } from "vitest";

const appels: string[] = [];
let libererShow: () => void = () => {};
const ecouteurs: Record<string, (d: any) => void> = {};

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" },
}));
vi.mock("@capacitor/app", () => ({
  App: { getState: async () => ({ isActive: true }), addListener: async () => ({ remove() {} }) },
}));
vi.mock("@capacitor-community/admob", () => ({
  AdmobConsentStatus: { REQUIRED: "REQUIRED", OBTAINED: "OBTAINED", NOT_REQUIRED: "NOT_REQUIRED" },
  RewardAdPluginEvents: {},
  BannerAdPosition: { BOTTOM_CENTER: "BOTTOM_CENTER" },
  BannerAdSize: { ADAPTIVE_BANNER: "ADAPTIVE_BANNER" },
  BannerAdPluginEvents: { SizeChanged: "sizeChanged", FailedToLoad: "failedToLoad" },
  AdMob: {
    requestTrackingAuthorization: async () => {},
    initialize: async () => {},
    requestConsentInfo: async () => ({ status: "NOT_REQUIRED", canRequestAds: true }),
    showConsentForm: async () => ({ status: "OBTAINED", canRequestAds: true }),
    prepareRewardVideoAd: async () => {},
    addListener: async (evt: string, cb: (d: any) => void) => { ecouteurs[evt] = cb; return { remove() {} }; },
    // showBanner reste en suspens jusqu'à libererShow() : c'est la fenêtre de
    // course que le joueur ouvre en lançant une partie.
    showBanner: () => { appels.push("show"); return new Promise<void>((r) => { libererShow = r; }); },
    resumeBanner: async () => { appels.push("resume"); },
    hideBanner: async () => { appels.push("hide"); },
  },
}));

async function charger() {
  vi.resetModules();
  appels.length = 0;
  const pub = await import("../lib/pub");
  await pub.initPub();
  return pub;
}

describe("banniereVisible — un ordre reçu en cours de route n'est pas perdu", () => {
  beforeEach(() => { appels.length = 0; });

  it("cache la bannière si l'ordre « caché » arrive pendant que showBanner charge", async () => {
    const pub = await charger();
    const montre = pub.banniereVisible(true);   // showBanner démarre, reste en suspens
    await Promise.resolve();
    const cache = pub.banniereVisible(false);   // le joueur lance une partie
    libererShow();                              // l'annonce finit de charger
    await montre; await cache;
    await new Promise((r) => setTimeout(r, 0)); // l'ordre retenu est rejoué

    expect(appels).toEqual(["show", "hide"]);
  });

  it("l'ordre retenu ne boucle pas quand il est identique à celui exécuté", async () => {
    const pub = await charger();
    const a = pub.banniereVisible(true);
    await Promise.resolve();
    void pub.banniereVisible(true);             // doublon pendant le chargement
    libererShow();
    await a;
    await new Promise((r) => setTimeout(r, 0));

    expect(appels).toEqual(["show"]);
  });

  it("le dernier ordre gagne : caché puis remontré pendant le chargement", async () => {
    const pub = await charger();
    const a = pub.banniereVisible(true);
    await Promise.resolve();
    void pub.banniereVisible(false);
    void pub.banniereVisible(true);             // revenu sur l'accueil entre-temps
    libererShow();
    await a;
    await new Promise((r) => setTimeout(r, 0));

    expect(appels).toEqual(["show"]);           // état final voulu : montrée
  });

  it("cache une annonce qui arrive APRÈS que le joueur a quitté l'accueil", async () => {
    // showBanner répond dès que la demande part ; le plugin n'ajoute l'annonce à
    // l'écran qu'à sa réception. hideBanner n'avait alors rien à cacher.
    const pub = await charger();
    const montre = pub.banniereVisible(true);
    libererShow();                               // la DEMANDE est partie
    await montre;
    await pub.banniereVisible(false);            // le joueur lance une partie
    appels.length = 0;

    ecouteurs["sizeChanged"]({ width: 390, height: 50 });   // l'annonce arrive enfin

    expect(appels).toEqual(["hide"]);
  });

  it("ne cache pas une annonce qui arrive alors qu'on la veut", async () => {
    const pub = await charger();
    const montre = pub.banniereVisible(true);
    libererShow();
    await montre;
    appels.length = 0;

    ecouteurs["sizeChanged"]({ width: 390, height: 50 });

    expect(appels).toEqual([]);
  });
});
