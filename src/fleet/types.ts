export type VehicleStatus = "active" | "maintenance" | "inactive";
export type FuelType = "essence" | "diesel" | "electrique" | "hybride";

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  fuel: FuelType;
  status: VehicleStatus;
  mileage: number;
  /** Kilométrage auquel le prochain entretien est dû. */
  nextServiceKm: number;
  assignedDriverId: string | null;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseNumber: string;
}

export type FineStatus = "pending" | "paid" | "contested";

export interface Fine {
  id: string;
  vehicleId: string;
  driverId: string | null;
  date: string; // ISO
  reason: string;
  amount: number; // EUR
  location: string;
  status: FineStatus;
}

export type MaintenanceStatus = "scheduled" | "done";
export type MaintenanceKind =
  | "revision"
  | "pneus"
  | "freins"
  | "vidange"
  | "controle_technique"
  | "reparation";

export interface Maintenance {
  id: string;
  vehicleId: string;
  date: string; // ISO
  kind: MaintenanceKind;
  cost: number; // EUR
  mileage: number;
  status: MaintenanceStatus;
  notes: string;
}

export interface Trip {
  id: string;
  vehicleId: string;
  driverId: string | null;
  date: string; // ISO
  from: string;
  to: string;
  distanceKm: number;
  durationMin: number;
}

export interface FleetData {
  vehicles: Vehicle[];
  drivers: Driver[];
  fines: Fine[];
  maintenance: Maintenance[];
  trips: Trip[];
}
