import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLang } from "@/lib/lang";

// Le repli de langue est passé du français à l'anglais. Ces tests fixent la
// nuance qui compte : le repli ne sert QU'AUX langues absentes des six. Un
// téléphone en français doit rester en français, sinon le changement se
// retournerait contre le public d'origine de l'app.
function poserLangueNavigateur(valeur: string) {
  Object.defineProperty(window.navigator, "language", { value: valeur, configurable: true });
}

describe("getLang", () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { localStorage.clear(); });

  it("garde le français pour un téléphone français, quelle que soit la région", () => {
    for (const loc of ["fr", "fr-FR", "fr-CA", "fr-BE"]) {
      poserLangueNavigateur(loc);
      expect(getLang()).toBe("fr");
    }
  });

  it("reconnaît les cinq autres langues en ignorant la région", () => {
    const attendu: [string, string][] = [
      ["de-DE", "de"], ["de-AT", "de"],
      ["it-IT", "it"],
      ["pt-BR", "pt"], ["pt-PT", "pt"],
      ["es-MX", "es"], ["es-AR", "es"], ["es-ES", "es"],
      ["en-GB", "en"], ["en-US", "en"],
    ];
    for (const [loc, code] of attendu) {
      poserLangueNavigateur(loc);
      expect(getLang(), loc).toBe(code);
    }
  });

  it("retombe sur l'anglais — et non le français — pour une langue non couverte", () => {
    for (const loc of ["ja-JP", "nl-NL", "ar-MA", "pl-PL", "zh-CN"]) {
      poserLangueNavigateur(loc);
      expect(getLang(), loc).toBe("en");
    }
  });

  it("un choix enregistré l'emporte sur la langue du téléphone", () => {
    poserLangueNavigateur("de-DE");
    localStorage.setItem("bb_lang", "es");
    expect(getLang()).toBe("es");
  });

  it("ignore une valeur enregistrée qui n'est pas une langue connue", () => {
    poserLangueNavigateur("nl-NL");
    localStorage.setItem("bb_lang", "kr");
    expect(getLang()).toBe("en");
  });
});
