// Pool d'adversaires du mode EN LIGNE, partagé entre le desktop
// (components/landing/MatchmakingOverlay.tsx) et le mobile (components/LePont.jsx).
//
// ⚠️ Ces adversaires sont simulés : leur score est fabriqué en fin de partie à
// partir de celui du joueur (voir generateBotScore dans LePont.jsx), personne ne
// joue en face. Tant que c'est le cas, ne pas présenter ce mode comme un match
// contre un humain ailleurs que dans l'UI existante.

export type Opponent = { pseudo: string; country: string; avatar: string };

const POOL: { pseudo: string; country: string }[] = [
  { pseudo: "EagleEye_92", country: "🇫🇷" },
  { pseudo: "TransferKing", country: "🇪🇸" },
  { pseudo: "MercatoMaster", country: "🇮🇹" },
  { pseudo: "BridgeBuilder", country: "🇬🇧" },
  { pseudo: "FootGuru42", country: "🇧🇷" },
  { pseudo: "ZidaneFan10", country: "🇫🇷" },
  { pseudo: "RonaldoSiu", country: "🇵🇹" },
  { pseudo: "PetitPont", country: "🇫🇷" },
  { pseudo: "Cantona7", country: "🇫🇷" },
  { pseudo: "LeMercatoGuy", country: "🇫🇷" },
  { pseudo: "DiegoLover", country: "🇦🇷" },
  { pseudo: "OldTrafford_99", country: "🇬🇧" },
  { pseudo: "BernabeuKid", country: "🇪🇸" },
  { pseudo: "SanSiro_AC", country: "🇮🇹" },
  { pseudo: "AllianzWolf", country: "🇩🇪" },
  { pseudo: "ParcDesGOAT", country: "🇫🇷" },
  { pseudo: "VeloDromeFan", country: "🇫🇷" },
  { pseudo: "Bombonera_Boca", country: "🇦🇷" },
  { pseudo: "Maracana10", country: "🇧🇷" },
  { pseudo: "AnfieldRoad", country: "🇬🇧" },
  { pseudo: "PlugMaster_X", country: "🇧🇪" },
  { pseudo: "GoatHunter", country: "🇳🇱" },
  { pseudo: "ChainBreaker", country: "🇲🇦" },
  { pseudo: "Iniesta_8", country: "🇪🇸" },
  { pseudo: "Pirlo_21", country: "🇮🇹" },
  { pseudo: "Modric_LM10", country: "🇭🇷" },
];

// Avatars : réutilise les visuels GOAT FC existants (joueurs en maillot)
const AVATARS = ["/win1.webp", "/win2.webp", "/win3.webp", "/win4.webp", "/win5.webp"];

// Hash stable pseudo → avatar (le même pseudo garde toujours le même visage)
export function avatarFor(pseudo: string): string {
  let h = 0;
  for (let i = 0; i < pseudo.length; i++) {
    h = (h * 31 + pseudo.charCodeAt(i)) | 0;
  }
  return AVATARS[Math.abs(h) % AVATARS.length];
}

export function pickOpponent(): Opponent {
  const base = POOL[Math.floor(Math.random() * POOL.length)];
  return { ...base, avatar: avatarFor(base.pseudo) };
}
