import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, Plus, Check, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useFleet, driverName } from "../store";
import { eur, km, dateFr, duration } from "../format";
import { PageHeader } from "../components/PageHeader";
import { VehicleStatusBadge, FineStatusBadge, MaintenanceStatusBadge, fuelLabel, maintenanceKindLabel, vehicleStatusLabel } from "../labels";
import { serviceStatus, ctStatus, suggestions, SERVICE_INTERVAL_KM, type Level } from "../maintenance";
import type { MaintenanceKind, VehicleStatus } from "../types";

const LEVEL_BAR: Record<Level, string> = {
  ok: "bg-emerald-500",
  soon: "bg-amber-500",
  due: "bg-red-500",
};
const LEVEL_TEXT: Record<Level, string> = {
  ok: "text-emerald-600",
  soon: "text-amber-600",
  due: "text-red-600",
};

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Gauge({ level, progress }: { level: Level; progress: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full transition-all ${LEVEL_BAR[level]}`} style={{ width: `${progress}%` }} />
    </div>
  );
}

function AddMaintenanceDialog({ vehicleId, mileage }: { vehicleId: string; mileage: number }) {
  const { addMaintenance, updateVehicle } = useFleet();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const blank = { date: today, kind: "revision" as MaintenanceKind, cost: 0, mileage, notes: "", done: true };
  const [form, setForm] = useState(blank);

  const submit = () => {
    const status = form.done ? "done" : "scheduled";
    addMaintenance({ vehicleId, date: form.date, kind: form.kind, cost: form.cost, mileage: form.mileage, notes: form.notes, status });
    // Un entretien réalisé fait avancer le compteur et le prochain seuil de révision.
    if (form.done) {
      const patch: { mileage?: number; nextServiceKm?: number } = {};
      if (form.mileage > mileage) patch.mileage = form.mileage;
      if (form.kind === "revision" || form.kind === "vidange") {
        patch.nextServiceKm = (form.mileage || mileage) + SERVICE_INTERVAL_KM;
      }
      if (Object.keys(patch).length) updateVehicle(vehicleId, patch);
    }
    setForm({ ...blank });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entretien / réparation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as MaintenanceKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(maintenanceKindLabel).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Kilométrage</Label>
              <Input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Coût (€)</Label>
              <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Détail des opérations…" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.done} onChange={(e) => setForm({ ...form, done: e.target.checked })} />
            Déjà réalisé (sinon : planifié)
          </label>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles, drivers, fines, maintenance, trips, updateVehicle, removeVehicle, completeMaintenance } = useFleet();
  const vehicle = vehicles.find((v) => v.id === id);
  const [kmInput, setKmInput] = useState("");

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
  const vMaint = maintenance.filter((m) => m.vehicleId === vehicle.id).sort((a, b) => b.date.localeCompare(a.date));
  const vTrips = trips.filter((t) => t.vehicleId === vehicle.id);

  const svc = serviceStatus(vehicle);
  const ct = ctStatus(vehicle, vMaint);
  const tips = suggestions(vehicle, vMaint);

  const saveKm = () => {
    const n = Number(kmInput);
    if (n > 0) updateVehicle(vehicle.id, { mileage: n });
    setKmInput("");
  };

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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(vehicleStatusLabel) as VehicleStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{vehicleStatusLabel[s]}</SelectItem>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.firstName} {d.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Mettre à jour le kilométrage</div>
              <div className="flex gap-2">
                <Input type="number" placeholder={`${vehicle.mileage}`} value={kmInput} onChange={(e) => setKmInput(e.target.value)} />
                <Button variant="outline" onClick={saveKm} disabled={!kmInput}>OK</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4" /> État d'entretien
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">Prochaine révision</span>
              <span className="text-muted-foreground">{km(svc.nextKm)}</span>
            </div>
            <Gauge level={svc.level} progress={svc.progress} />
            <div className={`mt-1.5 text-sm font-medium ${LEVEL_TEXT[svc.level]}`}>
              {svc.remainingKm <= 0
                ? `Dépassée de ${km(Math.abs(svc.remainingKm))}`
                : `Encore ${km(svc.remainingKm)}`}
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Contrôle technique</div>
            {ct.required && ct.dueDate ? (
              <>
                <div className={`text-sm font-medium ${LEVEL_TEXT[ct.level]}`}>
                  {(ct.monthsRemaining ?? 0) <= 0
                    ? "Échéance dépassée"
                    : `Avant ${dateFr(ct.dueDate)}`}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {ct.lastDate ? `Dernier CT : ${dateFr(ct.lastDate)}` : "Aucun CT enregistré"}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Pas encore soumis au CT (moins de 4 ans).</div>
            )}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Suggestions</div>
            {tips.length === 0 ? (
              <div className="text-sm text-emerald-600">À jour, rien à prévoir.</div>
            ) : (
              <ul className="space-y-1.5">
                {tips.map((t) => (
                  <li key={t.id} className="text-sm">
                    <span className={`font-medium ${LEVEL_TEXT[t.level]}`}>{t.title}</span>{" "}
                    <span className="text-muted-foreground">— {t.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="maint" className="mt-4">
        <TabsList>
          <TabsTrigger value="maint">Entretien ({vMaint.length})</TabsTrigger>
          <TabsTrigger value="fines">Amendes ({vFines.length})</TabsTrigger>
          <TabsTrigger value="trips">Trajets ({vTrips.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="maint">
          <div className="mb-3 flex justify-end">
            <AddMaintenanceDialog vehicleId={vehicle.id} mileage={vehicle.mileage} />
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vMaint.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{dateFr(m.date)}</TableCell>
                    <TableCell>{maintenanceKindLabel[m.kind]}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{m.notes}</TableCell>
                    <TableCell className="text-right">{km(m.mileage)}</TableCell>
                    <TableCell className="text-right">{eur(m.cost)}</TableCell>
                    <TableCell><MaintenanceStatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-right">
                      {m.status === "scheduled" && (
                        <Button variant="outline" size="sm" onClick={() => completeMaintenance(m.id)}>
                          <Check className="h-4 w-4" /> Terminé
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {vMaint.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Aucun entretien enregistré.</TableCell>
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
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Astuce : le bouton « Ajouter » enregistre une révision/réparation et recale automatiquement la prochaine échéance. Voir aussi la page{" "}
        <Link to="/entretien" className="underline">Entretien</Link>.
      </p>
    </div>
  );
}
