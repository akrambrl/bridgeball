import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleet, driverName } from "../store";
import { km } from "../format";
import { PageHeader } from "../components/PageHeader";
import { VehicleStatusBadge, fuelLabel } from "../labels";
import type { FuelType, VehicleStatus } from "../types";

function AddVehicleDialog() {
  const { addVehicle, drivers } = useFleet();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    plate: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    fuel: "essence" as FuelType,
    status: "active" as VehicleStatus,
    mileage: 0,
    nextServiceKm: 15000,
    assignedDriverId: "none",
  });

  const submit = () => {
    if (!form.plate || !form.brand || !form.model) return;
    addVehicle({ ...form, assignedDriverId: form.assignedDriverId === "none" ? null : form.assignedDriverId });
    setOpen(false);
    setForm({ plate: "", brand: "", model: "", year: new Date().getFullYear(), fuel: "essence", status: "active", mileage: 0, nextServiceKm: 15000, assignedDriverId: "none" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Ajouter un véhicule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau véhicule</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Immatriculation</Label>
            <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} placeholder="AB-123-CD" />
          </div>
          <div className="space-y-1.5">
            <Label>Année</Label>
            <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Marque</Label>
            <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Renault" />
          </div>
          <div className="space-y-1.5">
            <Label>Modèle</Label>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Clio" />
          </div>
          <div className="space-y-1.5">
            <Label>Carburant</Label>
            <Select value={form.fuel} onValueChange={(v) => setForm({ ...form, fuel: v as FuelType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(fuelLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kilométrage</Label>
            <Input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Prochaine révision (km)</Label>
            <Input type="number" value={form.nextServiceKm} onChange={(e) => setForm({ ...form, nextServiceKm: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Conducteur</Label>
            <Select value={form.assignedDriverId} onValueChange={(v) => setForm({ ...form, assignedDriverId: v })}>
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
        </div>
        <DialogFooter>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Vehicles() {
  const { vehicles, drivers } = useFleet();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const filtered = vehicles.filter((v) =>
    `${v.plate} ${v.brand} ${v.model}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Véhicules" description={`${vehicles.length} véhicule(s) dans la flotte`} action={<AddVehicleDialog />} />
      <div className="mb-4 max-w-sm">
        <Input placeholder="Rechercher (plaque, marque, modèle)…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Immatriculation</TableHead>
              <TableHead>Véhicule</TableHead>
              <TableHead>Carburant</TableHead>
              <TableHead>Conducteur</TableHead>
              <TableHead className="text-right">Kilométrage</TableHead>
              <TableHead>État</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => (
              <TableRow key={v.id} className="cursor-pointer" onClick={() => navigate(`/vehicules/${v.id}`)}>
                <TableCell className="font-mono">{v.plate}</TableCell>
                <TableCell className="font-medium">
                  {v.brand} {v.model} <span className="text-muted-foreground">· {v.year}</span>
                </TableCell>
                <TableCell>{fuelLabel[v.fuel]}</TableCell>
                <TableCell>{driverName(drivers, v.assignedDriverId)}</TableCell>
                <TableCell className="text-right">{km(v.mileage)}</TableCell>
                <TableCell>
                  <VehicleStatusBadge status={v.status} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Aucun véhicule trouvé.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
