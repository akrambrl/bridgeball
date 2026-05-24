import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleet, driverName } from "../store";
import { eur, dateFr } from "../format";
import { PageHeader } from "../components/PageHeader";
import { FineStatusBadge } from "../labels";
import type { FineStatus } from "../types";

function AddFineDialog() {
  const { addFine, vehicles } = useFleet();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const empty = { vehicleId: "", date: today, reason: "", amount: 0, location: "" };
  const [form, setForm] = useState(empty);

  const submit = () => {
    const v = vehicles.find((x) => x.id === form.vehicleId);
    if (!v || !form.reason) return;
    addFine({ ...form, driverId: v.assignedDriverId, status: "pending" });
    setForm(empty);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Enregistrer une amende
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle amende</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Véhicule</Label>
            <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un véhicule" />
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
            <Label>Motif</Label>
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Excès de vitesse…" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Montant (€)</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Lieu</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Fines() {
  const { fines, vehicles, drivers, setFineStatus } = useFleet();
  const [filter, setFilter] = useState<"all" | FineStatus>("all");

  const shown = fines.filter((f) => filter === "all" || f.status === filter);
  const pendingTotal = fines.filter((f) => f.status === "pending").reduce((s, f) => s + f.amount, 0);

  return (
    <div>
      <PageHeader title="Amendes" description={`${eur(pendingTotal)} à régler`} action={<AddFineDialog />} />

      <div className="mb-4 flex gap-2">
        {(["all", "pending", "paid", "contested"] as const).map((k) => (
          <Button key={k} variant={filter === k ? "default" : "outline"} size="sm" onClick={() => setFilter(k)}>
            {k === "all" ? "Toutes" : k === "pending" ? "À payer" : k === "paid" ? "Payées" : "Contestées"}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Conducteur</TableHead>
                <TableHead>Lieu</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((f) => {
                const v = vehicles.find((x) => x.id === f.vehicleId);
                return (
                  <TableRow key={f.id}>
                    <TableCell>{dateFr(f.date)}</TableCell>
                    <TableCell className="font-medium">{f.reason}</TableCell>
                    <TableCell>{v ? `${v.brand} ${v.model}` : "—"}</TableCell>
                    <TableCell>{driverName(drivers, f.driverId)}</TableCell>
                    <TableCell>{f.location}</TableCell>
                    <TableCell className="text-right font-semibold">{eur(f.amount)}</TableCell>
                    <TableCell><FineStatusBadge status={f.status} /></TableCell>
                    <TableCell className="text-right">
                      {f.status !== "paid" && (
                        <Button variant="outline" size="sm" onClick={() => setFineStatus(f.id, "paid")}>
                          Marquer payée
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Aucune amende.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
