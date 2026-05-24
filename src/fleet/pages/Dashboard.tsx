import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Car, ReceiptText, Wrench, Gauge, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFleet, driverName } from "../store";
import { eur, km, dateFr } from "../format";
import { PageHeader } from "../components/PageHeader";
import { FineStatusBadge, vehicleStatusLabel } from "../labels";
import type { ReactNode } from "react";

const STATUS_COLORS: Record<string, string> = {
  active: "hsl(142 71% 45%)",
  maintenance: "hsl(38 92% 50%)",
  inactive: "hsl(0 0% 60%)",
};

function Kpi({ title, value, sub, icon }: { title: string; value: string; sub?: string; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { vehicles, drivers, fines, maintenance, trips } = useFleet();

  const totalKm = vehicles.reduce((s, v) => s + v.mileage, 0);
  const pendingFines = fines.filter((f) => f.status === "pending");
  const pendingFinesTotal = pendingFines.reduce((s, f) => s + f.amount, 0);
  const scheduledMaint = maintenance.filter((m) => m.status === "scheduled");
  const serviceDue = vehicles.filter((v) => v.mileage >= v.nextServiceKm - 2000);

  const statusData = (["active", "maintenance", "inactive"] as const).map((s) => ({
    name: vehicleStatusLabel[s],
    key: s,
    value: vehicles.filter((v) => v.status === s).length,
  }));

  // Km parcourus par jour (7 derniers points de trajets)
  const byDate = new Map<string, number>();
  for (const t of trips) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.distanceKm);
  const tripData = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, distance]) => ({ date: dateFr(date).replace(/\.?\s\d{4}$/, ""), distance }));

  return (
    <div>
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de votre flotte" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Véhicules" value={`${vehicles.length}`} sub={`${vehicles.filter((v) => v.status === "active").length} en service`} icon={<Car className="h-4 w-4" />} />
        <Kpi title="Kilométrage total" value={km(totalKm)} sub={`${drivers.length} conducteurs`} icon={<Gauge className="h-4 w-4" />} />
        <Kpi title="Amendes à payer" value={eur(pendingFinesTotal)} sub={`${pendingFines.length} amende(s) en attente`} icon={<ReceiptText className="h-4 w-4" />} />
        <Kpi title="Entretiens planifiés" value={`${scheduledMaint.length}`} sub={`${eur(scheduledMaint.reduce((s, m) => s + m.cost, 0))} estimés`} icon={<Wrench className="h-4 w-4" />} />
      </div>

      {serviceDue.length > 0 && (
        <Card className="mt-4 border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-sm">Entretien à prévoir</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {serviceDue.map((v) => (
              <span key={v.id} className="mr-3 inline-block">
                <Link to={`/vehicules/${v.id}`} className="font-medium text-foreground hover:underline">
                  {v.brand} {v.model}
                </Link>{" "}
                — {km(v.mileage)} / révision à {km(v.nextServiceKm)}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kilomètres parcourus</CardTitle>
            <CardDescription>Derniers trajets enregistrés</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tripData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [`${v} km`, "Distance"]} />
                <Bar dataKey="distance" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">État des véhicules</CardTitle>
            <CardDescription>Répartition de la flotte</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {statusData.map((d) => (
                    <Cell key={d.key} fill={STATUS_COLORS[d.key]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex justify-center gap-4 text-xs">
              {statusData.map((d) => (
                <span key={d.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[d.key] }} />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Dernières amendes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {fines.slice(0, 5).map((f) => {
            const v = vehicles.find((x) => x.id === f.vehicleId);
            return (
              <div key={f.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0">
                <div>
                  <div className="font-medium">{f.reason}</div>
                  <div className="text-xs text-muted-foreground">
                    {v ? `${v.brand} ${v.model}` : "—"} · {driverName(drivers, f.driverId)} · {dateFr(f.date)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{eur(f.amount)}</span>
                  <FineStatusBadge status={f.status} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
