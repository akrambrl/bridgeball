import type { Maintenance, Vehicle } from "./types";

// Intervalle de révision (km) utilisé pour la jauge et les suggestions.
export const SERVICE_INTERVAL_KM = 15000;
// Marges d'alerte.
const KM_SOON = 2000;
const CT_SOON_MONTHS = 3;

export type Level = "ok" | "soon" | "due";

const worst = (a: Level, b: Level): Level => {
  const rank = { ok: 0, soon: 1, due: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
};

export interface ServiceStatus {
  nextKm: number;
  remainingKm: number; // négatif = dépassé
  progress: number; // 0..100
  level: Level;
}

export function serviceStatus(v: Vehicle): ServiceStatus {
  const nextKm = v.nextServiceKm;
  const lastKm = Math.max(0, nextKm - SERVICE_INTERVAL_KM);
  const span = Math.max(1, nextKm - lastKm);
  const remainingKm = nextKm - v.mileage;
  const progress = Math.min(100, Math.max(0, Math.round(((v.mileage - lastKm) / span) * 100)));
  const level: Level = remainingKm <= 0 ? "due" : remainingKm <= KM_SOON ? "soon" : "ok";
  return { nextKm, remainingKm, progress, level };
}

export interface CtStatus {
  required: boolean; // véhicule assez vieux pour être soumis au CT
  lastDate: string | null;
  dueDate: string | null;
  monthsRemaining: number | null;
  level: Level;
}

// Contrôle technique : 1er à 4 ans, puis tous les 2 ans.
export function ctStatus(v: Vehicle, maint: Maintenance[], now = new Date()): CtStatus {
  const required = now.getFullYear() - v.year >= 4;
  const cts = maint
    .filter((m) => m.kind === "controle_technique")
    .map((m) => ({ date: m.date, status: m.status }));
  const done = cts.filter((c) => c.status === "done").map((c) => c.date).sort();
  const scheduled = cts.filter((c) => c.status === "scheduled").map((c) => c.date).sort();
  const lastDate = done.length ? done[done.length - 1] : null;

  if (!required && !scheduled.length && !lastDate) {
    return { required, lastDate, dueDate: null, monthsRemaining: null, level: "ok" };
  }

  let due: Date;
  if (scheduled.length) {
    due = new Date(scheduled[0]); // échéance saisie (date limite du CT)
  } else if (lastDate) {
    due = new Date(lastDate);
    due.setFullYear(due.getFullYear() + 2);
  } else {
    due = new Date(v.year + 4, 0, 1); // premier CT aux 4 ans
  }
  const dueDate = due.toISOString().slice(0, 10);
  const monthsRemaining = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.4));
  const level: Level = monthsRemaining <= 0 ? "due" : monthsRemaining <= CT_SOON_MONTHS ? "soon" : "ok";
  return { required, lastDate, dueDate, monthsRemaining, level };
}

export interface Suggestion {
  id: string;
  title: string;
  detail: string;
  level: Level;
}

export function suggestions(v: Vehicle, maint: Maintenance[], now = new Date()): Suggestion[] {
  const out: Suggestion[] = [];
  const svc = serviceStatus(v);
  if (svc.level !== "ok") {
    out.push({
      id: "service",
      title: "Révision",
      level: svc.level,
      detail:
        svc.remainingKm <= 0
          ? `Dépassée de ${Math.abs(svc.remainingKm).toLocaleString("fr-FR")} km`
          : `À prévoir dans ${svc.remainingKm.toLocaleString("fr-FR")} km`,
    });
  }
  const ct = ctStatus(v, maint, now);
  if (ct.required && ct.level !== "ok" && ct.dueDate) {
    out.push({
      id: "ct",
      title: "Contrôle technique",
      level: ct.level,
      detail:
        (ct.monthsRemaining ?? 0) <= 0
          ? "Échéance dépassée"
          : `À faire avant ${new Date(ct.dueDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}`,
    });
  }
  return out;
}

// Pire niveau d'alerte d'un véhicule (pour les vues d'ensemble).
export function vehicleAlertLevel(v: Vehicle, maint: Maintenance[], now = new Date()): Level {
  const ct = ctStatus(v, maint, now);
  return worst(serviceStatus(v).level, ct.required ? ct.level : "ok");
}
