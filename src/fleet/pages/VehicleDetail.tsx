import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useFleet, driverName } from "../store";
import { eur, km, dateFr, duration } from "../format";
import { PageHeader } from "../components/PageHeader";
import { VehicleStatusBadge, FineStatusBadge, MaintenanceStatusBadge, fuelLabel, maintenanceKindLabel, vehicleStatusLabel } from "../labels";
import type { VehicleStatus } from "../types";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles, drivers, fines, maintenance, trips, updateVehicle, removeVehicle } = useFleet();
  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate("/vehicules")}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <p className="mt-4 text-muted-foreground">Véhicule introuvable.</p>
      </div>
    );
  }

  const vFines = fines.filter((f) => f.vehicleId === vehicle.id);
  const vMaint = maintenance.filter((m) => m.vehicleId === vehicle.id);
  const vTrips = trips.filter((t) => t.vehicleId === vehicle.id);
  const serviceProgress = Math.min(100, Math.round((vehicle.mileage / vehicle.nextServiceKm) * 100));

  const remove = () => {
    if (confirm(`Supprimer ${vehicle.brand} ${vehicle.model} (${vehicle.plate}) ?`)) {
      removeVehicle(vehicle.id);
      navigate("/vehicules");
    }
  };

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => navigate("/vehicules")}>
        <ArrowLeft className="h-4 w-4" /> Véhicules
      </Button>
      <PageHeader
        title={`${vehicle.brand} ${vehicle.model}`}
        description={`${vehicle.plate} · ${vehicle.year}`}
        action={
          <Button variant="outline" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info label="Immatriculation" value={<span className="font-mono">{vehicle.plate}</span>} />
            <Info label="Carburant" value={fuelLabel[vehicle.fuel]} />
            <Info label="Année" value={vehicle.year} />
            <Info label="Kilométrage" value={km(vehicle.mileage)} />
            <Info label="Conducteur" value={driverName(drivers, vehicle.assignedDriverId)} />
            <Info label="État" value={<VehicleStatusBadge status={vehicle.status} />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gestion rapide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">État</div>
              <Select value={vehicle.status} onValueChange={(v) => updateVehicle(vehicle.id, { status: v as VehicleStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(vehicleStatusLabel) as VehicleStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {vehicleStatusLabel[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Conducteur assigné</div>
              <Select
                value={vehicle.assignedDriverId ?? "none"}
                onValueChange={(v) => updateVehicle(vehicle.id, { assignedDriverId: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.firstName} {d.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Prochaine révision</span>
                <span>{km(vehicle.nextServiceKm)}</span>
              </div>
              <Progress value={serviceProgress} />
              <div className="mt-1 text-xs text-muted-foreground">{serviceProgress}% atteint</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trips" className="mt-4">
        <TabsList>
          <TabsTrigger value="trips">Trajets ({vTrips.length})</TabsTrigger>
          <TabsTrigger value="fines">Amendes ({vFines.length})</TabsTrigger>
          <TabsTrigger value="maint">Entretien ({vMaint.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="trips">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Conducteur</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vTrips.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{dateFr(t.date)}</TableCell>
                    <TableCell>{t.from} → {t.to}</TableCell>
                    <TableCell>{driverName(drivers, t.driverId)}</TableCell>
                    <TableCell className="text-right">{km(t.distanceKm)}</TableCell>
                    <TableCell className="text-right">{duration(t.durationMin)}</TableCell>
                  </TableRow>
                ))}
                {vTrips.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Aucun trajet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="fines">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Lieu</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vFines.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{dateFr(f.date)}</TableCell>
                    <TableCell>{f.reason}</TableCell>
                    <TableCell>{f.location}</TableCell>
                    <TableCell className="text-right">{eur(f.amount)}</TableCell>
                    <TableCell><FineStatusBadge status={f.status} /></TableCell>
                  </TableRow>
                ))}
                {vFines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Aucune amende.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="maint">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vMaint.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{dateFr(m.date)}</TableCell>
                    <TableCell>{maintenanceKindLabel[m.kind]}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{m.notes}</TableCell>
                    <TableCell className="text-right">{eur(m.cost)}</TableCell>
                    <TableCell><MaintenanceStatusBadge status={m.status} /></TableCell>
                  </TableRow>
                ))}
                {vMaint.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Aucun entretien.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Astuce : enregistrez une amende ou un entretien pour ce véhicule depuis les pages{" "}
        <Link to="/amendes" className="underline">Amendes</Link> et{" "}
        <Link to="/entretien" className="underline">Entretien</Link>.
      </p>
    </div>
  );
}
