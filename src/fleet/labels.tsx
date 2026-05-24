import { Badge } from "@/components/ui/badge";
import type { FineStatus, FuelType, MaintenanceKind, MaintenanceStatus, VehicleStatus } from "./types";

export const vehicleStatusLabel: Record<VehicleStatus, string> = {
  active: "En service",
  maintenance: "En entretien",
  inactive: "Hors service",
};

export const fuelLabel: Record<FuelType, string> = {
  essence: "Essence",
  diesel: "Diesel",
  electrique: "Électrique",
  hybride: "Hybride",
};

export const fineStatusLabel: Record<FineStatus, string> = {
  pending: "À payer",
  paid: "Payée",
  contested: "Contestée",
};

export const maintenanceKindLabel: Record<MaintenanceKind, string> = {
  revision: "Révision",
  pneus: "Pneus",
  freins: "Freins",
  vidange: "Vidange",
  controle_technique: "Contrôle technique",
  reparation: "Réparation",
};

export const maintenanceStatusLabel: Record<MaintenanceStatus, string> = {
  scheduled: "Planifié",
  done: "Effectué",
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const variant = status === "active" ? "default" : status === "maintenance" ? "secondary" : "outline";
  return <Badge variant={variant}>{vehicleStatusLabel[status]}</Badge>;
}

export function FineStatusBadge({ status }: { status: FineStatus }) {
  const variant = status === "paid" ? "secondary" : status === "pending" ? "destructive" : "outline";
  return <Badge variant={variant}>{fineStatusLabel[status]}</Badge>;
}

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return <Badge variant={status === "done" ? "secondary" : "default"}>{maintenanceStatusLabel[status]}</Badge>;
}
