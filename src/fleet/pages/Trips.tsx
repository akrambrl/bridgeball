import { useState } from "react";
import { Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleet, driverName } from "../store";
import { km, dateFr, duration } from "../format";
import { PageHeader } from "../components/PageHeader";
import TripsMap from "../components/TripsMap";

function AddTripDialog() {
  const { addTrip, vehicles } = useFleet();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const empty = { vehicleId: "", date: today, from: "", to: "", distanceKm: 0, durationMin: 0 };
  const [form, setForm] = useState(empty);

  const submit = () => {
    const v = vehicles.find((x) => x.id === form.vehicleId);
    if (!v || !form.from || !form.to) return;
    addTrip({ ...form, driverId: v.assignedDriverId });
    setForm(empty);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Ajouter un trajet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau trajet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Départ</Label>
              <Input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Arrivée</Label>
              <Input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Distance (km)</Label>
              <Input type="number" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Durée (minutes)</Label>
              <Input type="number" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
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

export default function Trips() {
  const { trips, vehicles, drivers } = useFleet();
  const sorted = [...trips].sort((a, b) => b.date.localeCompare(a.date));
  const totalKm = trips.reduce((s, t) => s + t.distanceKm, 0);

  return (
    <div>
      <PageHeader title="Trajets" description={`${km(totalKm)} parcourus au total`} action={<AddTripDialog />} />

      <div className="mb-4 flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-50/50 p-3 text-sm text-muted-foreground dark:bg-blue-950/20">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <span>
          Les trajets sont saisis manuellement pour l'instant. L'intégration d'un <strong>tracker GPS</strong>{" "}
          (boîtier OBD-II ou application mobile du conducteur) permettra de les remonter automatiquement — prévu pour une prochaine étape.
        </span>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="map">Carte</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Véhicule</TableHead>
                    <TableHead>Conducteur</TableHead>
                    <TableHead>Trajet</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((t) => {
                    const v = vehicles.find((x) => x.id === t.vehicleId);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>{dateFr(t.date)}</TableCell>
                        <TableCell className="font-medium">{v ? `${v.brand} ${v.model}` : "—"}</TableCell>
                        <TableCell>{driverName(drivers, t.driverId)}</TableCell>
                        <TableCell>{t.from} → {t.to}</TableCell>
                        <TableCell className="text-right">{km(t.distanceKm)}</TableCell>
                        <TableCell className="text-right">{duration(t.durationMin)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {sorted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucun trajet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <TripsMap trips={sorted} vehicles={vehicles} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
