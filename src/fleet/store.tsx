import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { seedData } from "./seed";
import type { Driver, FleetData, Fine, Maintenance, Trip, Vehicle } from "./types";

const STORAGE_KEY = "fleet-data-v1";

function load(): FleetData {
  if (typeof localStorage === "undefined") return seedData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as FleetData;
  } catch {
    /* ignore corrupt storage */
  }
  return seedData;
}

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface FleetContextValue extends FleetData {
  addVehicle: (v: Omit<Vehicle, "id">) => void;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  removeVehicle: (id: string) => void;
  addDriver: (d: Omit<Driver, "id">) => void;
  removeDriver: (id: string) => void;
  addFine: (f: Omit<Fine, "id">) => void;
  setFineStatus: (id: string, status: Fine["status"]) => void;
  addMaintenance: (m: Omit<Maintenance, "id">) => void;
  completeMaintenance: (id: string) => void;
  addTrip: (t: Omit<Trip, "id">) => void;
  reset: () => void;
}

const FleetContext = createContext<FleetContextValue | null>(null);

export function FleetProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FleetData>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage may be unavailable */
    }
  }, [data]);

  const addVehicle = useCallback((v: Omit<Vehicle, "id">) => {
    setData((d) => ({ ...d, vehicles: [...d.vehicles, { ...v, id: newId("v") }] }));
  }, []);

  const updateVehicle = useCallback((id: string, patch: Partial<Vehicle>) => {
    setData((d) => ({ ...d, vehicles: d.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
  }, []);

  const removeVehicle = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      vehicles: d.vehicles.filter((v) => v.id !== id),
      drivers: d.drivers,
    }));
  }, []);

  const addDriver = useCallback((driver: Omit<Driver, "id">) => {
    setData((d) => ({ ...d, drivers: [...d.drivers, { ...driver, id: newId("d") }] }));
  }, []);

  const removeDriver = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      drivers: d.drivers.filter((dr) => dr.id !== id),
      vehicles: d.vehicles.map((v) => (v.assignedDriverId === id ? { ...v, assignedDriverId: null } : v)),
    }));
  }, []);

  const addFine = useCallback((f: Omit<Fine, "id">) => {
    setData((d) => ({ ...d, fines: [{ ...f, id: newId("f") }, ...d.fines] }));
  }, []);

  const setFineStatus = useCallback((id: string, status: Fine["status"]) => {
    setData((d) => ({ ...d, fines: d.fines.map((f) => (f.id === id ? { ...f, status } : f)) }));
  }, []);

  const addMaintenance = useCallback((m: Omit<Maintenance, "id">) => {
    setData((d) => ({ ...d, maintenance: [{ ...m, id: newId("m") }, ...d.maintenance] }));
  }, []);

  const completeMaintenance = useCallback((id: string) => {
    setData((d) => ({ ...d, maintenance: d.maintenance.map((m) => (m.id === id ? { ...m, status: "done" } : m)) }));
  }, []);

  const addTrip = useCallback((t: Omit<Trip, "id">) => {
    setData((d) => ({ ...d, trips: [{ ...t, id: newId("t") }, ...d.trips] }));
  }, []);

  const reset = useCallback(() => setData(seedData), []);

  const value = useMemo<FleetContextValue>(
    () => ({
      ...data,
      addVehicle,
      updateVehicle,
      removeVehicle,
      addDriver,
      removeDriver,
      addFine,
      setFineStatus,
      addMaintenance,
      completeMaintenance,
      addTrip,
      reset,
    }),
    [data, addVehicle, updateVehicle, removeVehicle, addDriver, removeDriver, addFine, setFineStatus, addMaintenance, completeMaintenance, addTrip, reset],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet doit être utilisé dans un <FleetProvider>");
  return ctx;
}

export function driverName(drivers: Driver[], id: string | null): string {
  if (!id) return "—";
  const d = drivers.find((x) => x.id === id);
  return d ? `${d.firstName} ${d.lastName}` : "—";
}

export function vehicleLabel(vehicles: Vehicle[], id: string): string {
  const v = vehicles.find((x) => x.id === id);
  return v ? `${v.brand} ${v.model} (${v.plate})` : "—";
}
