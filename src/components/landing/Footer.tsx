export const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#0A1F11] text-white/70 border-t border-white/10">
      <div className="container py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <img
                src="/bridgeball-logo.svg"
                alt="GOAT FC"
                className="h-8 w-8 rounded-md"
              />
              <span className="text-lg font-bold text-white">GOAT FC</span>
            </div>
            <p className="text-sm max-w-md leading-relaxed">
              Le quiz football n°1 pour tester ta vraie culture mercato. Le pont
              entre deux clubs, la chaîne sans fin, la grille des légendes :
              prouve que t'es un GOAT.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3 text-sm">Le site</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#jeux" className="hover:text-white transition-colors">
                  Les jeux
                </a>
              </li>
              <li>
                <a href="#tutos" className="hover:text-white transition-colors">
                  Tutos
                </a>
              </li>
              <li>
                <a
                  href="#classements"
                  className="hover:text-white transition-colors"
                >
                  Classements
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3 text-sm">Légal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/privacy"
                  className="hover:text-white transition-colors"
                >
                  Confidentialité
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-white transition-colors">
                  Conditions
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
          <p>© {year} GOAT FC. Tous droits réservés.</p>
          <p>Fait avec ⚽ en France</p>
        </div>
      </div>
    </footer>
  );
};
