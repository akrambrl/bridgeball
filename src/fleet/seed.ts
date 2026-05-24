import type { FleetData } from "./types";

export const seedData: FleetData = {
  vehicles: [
    { id: "v1", plate: "AB-123-CD", brand: "Renault", model: "Clio V", year: 2022, fuel: "essence", status: "active", mileage: 48250, nextServiceKm: 50000, assignedDriverId: "d1" },
    { id: "v2", plate: "EF-456-GH", brand: "Peugeot", model: "308", year: 2021, fuel: "diesel", status: "active", mileage: 78900, nextServiceKm: 80000, assignedDriverId: "d2" },
    { id: "v3", plate: "IJ-789-KL", brand: "Tesla", model: "Model 3", year: 2023, fuel: "electrique", status: "active", mileage: 22100, nextServiceKm: 30000, assignedDriverId: "d3" },
    { id: "v4", plate: "MN-012-OP", brand: "Citroën", model: "Berlingo", year: 2020, fuel: "diesel", status: "maintenance", mileage: 132400, nextServiceKm: 130000, assignedDriverId: "d4" },
    { id: "v5", plate: "QR-345-ST", brand: "Renault", model: "Kangoo", year: 2019, fuel: "diesel", status: "active", mileage: 156800, nextServiceKm: 160000, assignedDriverId: null },
    { id: "v6", plate: "UV-678-WX", brand: "Toyota", model: "Yaris Hybride", year: 2023, fuel: "hybride", status: "inactive", mileage: 12300, nextServiceKm: 20000, assignedDriverId: null },
  ],
  drivers: [
    { id: "d1", firstName: "Sophie", lastName: "Martin", email: "sophie.martin@example.com", phone: "06 12 34 56 78", licenseNumber: "B-2018-114520" },
    { id: "d2", firstName: "Karim", lastName: "Benali", email: "karim.benali@example.com", phone: "06 23 45 67 89", licenseNumber: "B-2016-998311" },
    { id: "d3", firstName: "Émilie", lastName: "Durand", email: "emilie.durand@example.com", phone: "06 34 56 78 90", licenseNumber: "B-2020-447902" },
    { id: "d4", firstName: "Thomas", lastName: "Leroy", email: "thomas.leroy@example.com", phone: "06 45 67 89 01", licenseNumber: "B-2014-203778" },
  ],
  fines: [
    { id: "f1", vehicleId: "v1", driverId: "d1", date: "2026-04-12", reason: "Excès de vitesse (+12 km/h)", amount: 68, location: "A6, Lyon", status: "paid" },
    { id: "f2", vehicleId: "v2", driverId: "d2", date: "2026-05-02", reason: "Stationnement gênant", amount: 35, location: "Paris 11e", status: "pending" },
    { id: "f3", vehicleId: "v4", driverId: "d4", date: "2026-05-15", reason: "Feu rouge non respecté", amount: 135, location: "Marseille", status: "contested" },
    { id: "f4", vehicleId: "v2", driverId: "d2", date: "2026-05-20", reason: "Stationnement non payé", amount: 17, location: "Lille", status: "pending" },
  ],
  maintenance: [
    { id: "m1", vehicleId: "v4", date: "2026-05-22", kind: "freins", cost: 420, mileage: 132000, status: "scheduled", notes: "Remplacement plaquettes + disques avant" },
    { id: "m2", vehicleId: "v1", date: "2026-03-10", kind: "vidange", cost: 95, mileage: 45000, status: "done", notes: "Vidange + filtre à huile" },
    { id: "m3", vehicleId: "v2", date: "2026-02-18", kind: "controle_technique", cost: 78, mileage: 75000, status: "done", notes: "Contrôle technique OK" },
    { id: "m4", vehicleId: "v5", date: "2026-06-01", kind: "revision", cost: 310, mileage: 158000, status: "scheduled", notes: "Révision constructeur 160 000 km" },
    { id: "m5", vehicleId: "v3", date: "2026-01-25", kind: "pneus", cost: 640, mileage: 18000, status: "done", notes: "4 pneus hiver" },
  ],
  trips: [
    { id: "t1", vehicleId: "v1", driverId: "d1", date: "2026-05-23", from: "Lyon", to: "Grenoble", distanceKm: 112, durationMin: 95 },
    { id: "t2", vehicleId: "v2", driverId: "d2", date: "2026-05-23", from: "Paris", to: "Reims", distanceKm: 145, durationMin: 105 },
    { id: "t3", vehicleId: "v3", driverId: "d3", date: "2026-05-22", from: "Nantes", to: "Rennes", distanceKm: 107, durationMin: 80 },
    { id: "t4", vehicleId: "v1", driverId: "d1", date: "2026-05-21", from: "Grenoble", to: "Lyon", distanceKm: 112, durationMin: 90 },
    { id: "t5", vehicleId: "v2", driverId: "d2", date: "2026-05-20", from: "Reims", to: "Lille", distanceKm: 205, durationMin: 140 },
    { id: "t6", vehicleId: "v5", driverId: null, date: "2026-05-19", from: "Bordeaux", to: "Toulouse", distanceKm: 244, durationMin: 150 },
  ],
};
