import { Button } from "@/components/ui/button";

type Props = { onPlay: () => void };

const NAV = [
  { label: "Les jeux", href: "#jeux" },
  { label: "Tutos", href: "#tutos" },
  { label: "Classements", href: "#classements" },
  { label: "FAQ", href: "#faq" },
  { label: "À propos", href: "#about" },
];

export const Header = ({ onPlay }: Props) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0F2E18]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0F2E18]/80">
      <div className="container flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2 text-white">
          <img src="/bridgeball-logo.svg" alt="GOAT FC" className="h-9 w-9 rounded-md" />
          <span className="text-lg font-bold tracking-tight">GOAT FC</span>
        </a>

        <nav className="hidden lg:flex items-center gap-7 text-sm text-white/70">
          {NAV.map((it) => (
            <a
              key={it.href}
              href={it.href}
              className="hover:text-white transition-colors"
            >
              {it.label}
            </a>
          ))}
        </nav>

        <Button
          onClick={onPlay}
          className="bg-[#00E676] hover:bg-[#00C966] text-[#0F2E18] font-semibold"
        >
          Jouer
        </Button>
      </div>
    </header>
  );
};
