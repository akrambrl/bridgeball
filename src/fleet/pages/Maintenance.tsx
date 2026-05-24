import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleet } from "../store";
import { eur, km, dateFr } from "../format";
import { PageHeader } from "../components/PageHeader";
import { MaintenanceStatusBadge, maintenanceKindLabel } from "../labels";
import type { MaintenanceKind } from "../types";

function AddMaintenanceDialog() {
  const { addMaintenance, vehicles } = useFleet();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const empty = { vehicleId: "", date: today, kind: "revision" as MaintenanceKind, cost: 0, mileage: 0, notes: "" };
  const [form, setForm] = useState(empty);

  const submit = () => {
    if (!form.vehicleId) return;
    addMaintenance({ ...form, status: "scheduled" });
    setForm(empty);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Planifier un entretien
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel entretien</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Véhicule</Label>
              <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as MaintenanceKind })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(maintenanceKindLabel).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Coût (€)</Label>
              <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Kilométrage</Label>
              <Input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MaintenancePage() {
  const { maintenance, vehicles, completeMaintenance } = useFleet();
  const sorted = [...maintenance].sort((a, b) => b.date.localeCompare(a.date));
  const scheduledCost = maintenance.filter((m) => m.status === "scheduled").reduce((s, m) => s + m.cost, 0);

  return (
    <div>
      <PageHeader title="Entretien" description={`${eur(scheduledCost)} d'entretiens planifiés`} action={<AddMaintenanceDialog />} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => {
                const v = vehicles.find((x) => x.id === m.vehicleId);
                return (
                  <TableRow key={m.id}>
                    <TableCell>{dateFr(m.date)}</TableCell>
                    <TableCell className="font-medium">{v ? `${v.brand} ${v.model}` : "—"}</TableCell>
                    <TableCell>{maintenanceKindLabel[m.kind]}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{m.notes}</TableCell>
                    <TableCell className="text-right">{km(m.mileage)}</TableCell>
                    <TableCell className="text-right font-semibold">{eur(m.cost)}</TableCell>
                    <TableCell><MaintenanceStatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-right">
                      {m.status === "scheduled" && (
                        <Button variant="outline" size="sm" onClick={() => completeMaintenance(m.id)}>
                          <Check className="h-4 w-4" /> Terminé
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Aucun entretien.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
