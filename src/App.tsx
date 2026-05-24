import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import { FleetProvider } from "./fleet/store";
import FleetLayout from "./fleet/components/FleetLayout";
import Dashboard from "./fleet/pages/Dashboard";
import Vehicles from "./fleet/pages/Vehicles";
import VehicleDetail from "./fleet/pages/VehicleDetail";
import Drivers from "./fleet/pages/Drivers";
import Fines from "./fleet/pages/Fines";
import MaintenancePage from "./fleet/pages/Maintenance";
import Trips from "./fleet/pages/Trips";
import Employee from "./fleet/pages/Employee";
import Privacy from "./fleet/pages/Privacy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <FleetProvider>
          <Routes>
            <Route element={<FleetLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/vehicules" element={<Vehicles />} />
              <Route path="/vehicules/:id" element={<VehicleDetail />} />
              <Route path="/conducteurs" element={<Drivers />} />
              <Route path="/amendes" element={<Fines />} />
              <Route path="/entretien" element={<MaintenancePage />} />
              <Route path="/trajets" element={<Trips />} />
            </Route>
            <Route path="/salarie" element={<Employee />} />
            <Route path="/confidentialite" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </FleetProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
