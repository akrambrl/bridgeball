// Toucher une suggestion, clavier ouvert, doit valider la réponse.
//
// Le défaut d'origine : dans GOAT Battle, toucher la suggestion ne faisait rien
// tant que le clavier était ouvert. La perte de focus refermait le clavier, le
// layout compact se défaisait — les deux cartes de club passant de côte à côte à
// empilées — et le `click`, distribué après ce déplacement, tombait à côté.
//
// Ces tests fixent les quatre comportements de handlersDeTap, dont deux
// régressions que la correction pouvait introduire : un défilement qui valide, et
// un double envoi.
import { describe, it, expect, beforeEach } from "vitest";
import { handlersDeTap, reinitialiserTap } from "../lib/tap.js";

const toucher = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] }) as any;
const fin = () => {
  let empeche = false;
  return { e: { preventDefault: () => { empeche = true; } } as any, empeche: () => empeche };
};

describe("handlersDeTap", () => {
  beforeEach(() => reinitialiserTap());

  it("valide au relâchement du doigt, sans attendre le clic", () => {
    // C'est tout l'objet : `touchend` arrive AVANT que le focus ne change, donc
    // avant que le clavier ne se referme et que la mise en page ne bouge.
    let appels = 0;
    const h = handlersDeTap(() => { appels++; });
    h.onTouchStart(toucher(100, 200));
    const f = fin();
    h.onTouchEnd(f.e);
    expect(appels).toBe(1);
  });

  it("empêche l'action par défaut : le clavier reste ouvert", () => {
    // Sans preventDefault, le focus part, le clavier se referme, et on retombe
    // exactement sur le défaut qu'on corrige.
    const h = handlersDeTap(() => {});
    h.onTouchStart(toucher(10, 10));
    const f = fin();
    h.onTouchEnd(f.e);
    expect(f.empeche()).toBe(true);
  });

  it("NE valide PAS un défilement qui se termine sur la suggestion", () => {
    // Première régression possible. La liste de « Trouve le joueur » est haute et
    // défilante : sans seuil de déplacement, faire défiler puis lever le doigt
    // aurait validé la suggestion qui se trouvait dessous.
    let appels = 0;
    const h = handlersDeTap(() => { appels++; });
    h.onTouchStart(toucher(100, 200));
    h.onTouchMove(toucher(102, 260));      // 60 px vers le bas = défilement
    h.onTouchEnd(fin().e);
    expect(appels).toBe(0);
  });

  it("tolère le petit tremblement d'un doigt posé", () => {
    // Un tap n'est jamais parfaitement immobile : à 4 px, c'est encore un tap.
    let appels = 0;
    const h = handlersDeTap(() => { appels++; });
    h.onTouchStart(toucher(100, 200));
    h.onTouchMove(toucher(103, 204));
    h.onTouchEnd(fin().e);
    expect(appels).toBe(1);
  });

  it("n'envoie pas deux fois si le clic émulé passe quand même", () => {
    // Deuxième régression possible. `preventDefault` sur touchend supprime le
    // clic émulé, mais on ne le PARIE pas : un envoi double compterait deux
    // réponses pour un seul geste.
    let appels = 0;
    const h = handlersDeTap(() => { appels++; });
    h.onTouchStart(toucher(50, 50));
    h.onTouchEnd(fin().e);
    h.onClick();                            // le fantôme, ~300 ms plus tard
    expect(appels).toBe(1);
  });

  it("laisse passer le clic de la souris et du clavier", () => {
    // Sur ordinateur `touchend` n'arrive jamais, et Entrée sur un <button> passe
    // par le clic : sans ce chemin, la liste deviendrait inutilisable au clavier.
    let appels = 0;
    const h = handlersDeTap(() => { appels++; });
    h.onClick();
    expect(appels).toBe(1);
  });

  it("ne plante pas sur un événement sans touche", () => {
    const h = handlersDeTap(() => {});
    expect(() => { h.onTouchStart({} as any); h.onTouchMove({} as any); }).not.toThrow();
  });

  it("un geste ne contamine pas le suivant", () => {
    // L'état du geste vit au niveau du module : il doit être remis à zéro, sinon
    // un défilement rendrait le tap suivant inopérant.
    let appels = 0;
    const h = handlersDeTap(() => { appels++; });
    h.onTouchStart(toucher(0, 0));
    h.onTouchMove(toucher(0, 90));          // défilement
    h.onTouchEnd(fin().e);
    expect(appels).toBe(0);
    h.onTouchStart(toucher(0, 0));          // puis un vrai tap
    h.onTouchEnd(fin().e);
    expect(appels).toBe(1);
  });
});

// `disabled` empêche le navigateur d'émettre un `click`, mais PAS `touchend` :
// sans garde, toucher un bouton grisé l'aurait activé — une régression que
// l'extension aux boutons « OK » et « VALIDER » introduisait directement.
describe("handlersDeTap sur un élément désactivé", () => {
  beforeEach(() => reinitialiserTap());

  it("ne réagit ni au doigt ni au clic quand actif vaut faux", () => {
    let appels = 0;
    const h = handlersDeTap(() => { appels++; }, false);
    h.onTouchStart(toucher(10, 10));
    h.onTouchEnd(fin().e);
    h.onClick();
    expect(appels).toBe(0);
  });

  it("réagit normalement quand actif vaut vrai, ou n'est pas précisé", () => {
    let a = 0, b = 0;
    const vrai = handlersDeTap(() => { a++; }, true);
    vrai.onTouchStart(toucher(0, 0)); vrai.onTouchEnd(fin().e);
    reinitialiserTap();
    const omis = handlersDeTap(() => { b++; });
    omis.onTouchStart(toucher(0, 0)); omis.onTouchEnd(fin().e);
    expect([a, b]).toEqual([1, 1]);
  });

  it("n'empêche pas l'action par défaut d'un élément désactivé", () => {
    // Rien ne doit être consommé : le navigateur garde son comportement.
    const h = handlersDeTap(() => {}, false);
    h.onTouchStart(toucher(5, 5));
    const f = fin();
    h.onTouchEnd(f.e);
    expect(f.empeche()).toBe(false);
  });
});
