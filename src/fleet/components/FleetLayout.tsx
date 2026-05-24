import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Car, LayoutDashboard, Users, ReceiptText, Wrench, Route as RouteIcon, Menu, X, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/vehicules", label: "Véhicules", icon: Car },
  { to: "/conducteurs", label: "Conducteurs", icon: Users },
  { to: "/amendes", label: "Amendes", icon: ReceiptText },
  { to: "/entretien", label: "Entretien", icon: Wrench },
  { to: "/trajets", label: "Trajets", icon: RouteIcon },
];

export default function FleetLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-card transition-transform md:static md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <Car className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">FleetView</span>
          </div>
          <nav className="space-y-1 p-3">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="absolute inset-x-0 bottom-0 border-t p-3">
            <NavLink
              to="/salarie"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Smartphone className="h-4 w-4" />
              Espace salarié
            </NavLink>
          </div>
        </aside>

        {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

        {/* Main */}
        <div className="flex min-h-screen flex-1 flex-col md:ml-0">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur md:px-8">
            <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <h1 className="text-sm font-semibold leading-none">Gestion de flotte automobile</h1>
              <p className="text-xs text-muted-foreground">Espace employeur</p>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
