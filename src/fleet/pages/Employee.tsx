import { useState } from "react";
import { Link } from "react-router-dom";
import { Car, MapPin, Play, Square, ShieldCheck, ReceiptText, Wrench, Gauge, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFleet } from "../store";
import { useGeoConsent } from "../consent";
import { useTripTracker } from "../tracker";
import { eur, km, dateFr, duration } from "../format";
import { FineStatusBadge, MaintenanceStatusBadge, VehicleStatusBadge, fuelLabel, maintenanceKindLabel } from "../labels";

const DRIVER_KEY = "fleet-current-driver";

export default function Employee() {
  const { drivers, vehicles, fines, maintenance, addTrip, updateVehicle } = useFleet();
  const [driverId, setDriverId] = useState<string>(() => localStorage.getItem(DRIVER_KEY) ?? "");
  const consent = useGeoConsent();
  const tracker = useTripTracker();
  const [consentOpen, setConsentOpen] = useState(false);

  const driver = drivers.find((d) => d.id === driverId);
  const vehicle = vehicles.find((v) => v.assignedDriverId === driverId);

  const selectDriver = (id: string) => {
    setDriverId(id);
    localStorage.setItem(DRIVER_KEY, id);
  };

  // Écran de connexion simplifié (pas d'authentification réelle dans ce MVP).
  if (!driver) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <div className="mb-6 flex items-center gap-2">
          <Car className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold">FleetView · Salarié</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qui êtes-vous ?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={driverId} onValueChange={selectDriver}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez votre nom" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Démo sans authentification. Une vraie connexion (email + mot de passe) viendra avec le back-end.
            </p>
          </CardContent>
        </Card>
        <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:underline">
          <Building2 className="mr-1 inline h-4 w-4" /> Accéder à l'espace employeur
        </Link>
      </div>
    );
  }

  const myFines = fines.filter((f) => f.driverId === driverId);
  const myMaint = vehicle ? maintenance.filter((m) => m.vehicleId === vehicle.id) : [];
  const serviceProgress = vehicle ? Math.min(100, Math.round((vehicle.mileage / vehicle.nextServiceKm) * 100)) : 0;

  const requestStart = () => {
    if (!consent.granted) {
      setConsentOpen(true);
      return;
    }
    tracker.start();
  };

  const confirmConsent = () => {
    consent.grant();
    setConsentOpen(false);
    tracker.start();
  };

  const finishTrip = () => {
    const result = tracker.stop();
    if (!vehicle || result.path.length < 2) return;
    const start = result.path[0];
    const end = result.path[result.path.length - 1];
    addTrip({
      vehicleId: vehicle.id,
      driverId,
      date: new Date().toISOString().slice(0, 10),
      from: `(${start[0].toFixed(3)}, ${start[1].toFixed(3)})`,
      to: `(${end[0].toFixed(3)}, ${end[1].toFixed(3)})`,
      distanceKm: result.distanceKm,
      durationMin: result.durationMin,
      source: "gps",
      path: result.path,
    });
    updateVehicle(vehicle.id, { mileage: vehicle.mileage + Math.round(result.distanceKm) });
  };

  return (
    <div className="mx-auto min-h-screen max-w-md p-4 pb-10">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-6 w-6 text-primary" />
          <div>
            <div className="text-sm font-bold leading-none">{driver.firstName} {driver.lastName}</div>
            <button className="text-xs text-muted-foreground hover:underline" onClick={() => selectDriver("")}>
              Changer de profil
            </button>
          </div>
        </div>
        <Link to="/confidentialite" aria-label="Confidentialité">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        </Link>
      </header>

      {/* Véhicule */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mon véhicule</CardTitle>
        </CardHeader>
        <CardContent>
          {vehicle ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{vehicle.brand} {vehicle.model}</div>
                  <div className="font-mono text-xs text-muted-foreground">{vehicle.plate} · {fuelLabel[vehicle.fuel]}</div>
                </div>
                <VehicleStatusBadge status={vehicle.status} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-muted-foreground" /> {km(vehicle.mileage)}
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Prochaine révision</span>
                  <span>{km(vehicle.nextServiceKm)}</span>
                </div>
                <Progress value={serviceProgress} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun véhicule ne vous est assigné.</p>
          )}
        </CardContent>
      </Card>

      {/* Tracker GPS */}
      {vehicle && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Suivi de trajet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tracker.tracking ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-md bg-muted p-3">
                    <div className="text-2xl font-bold">{tracker.distanceKm.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">km</div>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <div className="text-2xl font-bold">{duration(Math.round(tracker.elapsedSec / 60))}</div>
                    <div className="text-xs text-muted-foreground">{tracker.path.length} points GPS</div>
                  </div>
                </div>
                <Button variant="destructive" className="w-full" onClick={finishTrip}>
                  <Square className="h-4 w-4" /> Arrêter et enregistrer
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Enregistrement en cours…
                </p>
              </>
            ) : (
              <Button className="w-full" onClick={requestStart}>
                <Play className="h-4 w-4" /> Démarrer un trajet
              </Button>
            )}
            {tracker.error && <p className="text-xs text-destructive">{tracker.error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Amendes */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="h-4 w-4" /> Mes amendes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myFines.length === 0 && <p className="text-sm text-muted-foreground">Aucune amende. 🎉</p>}
          {myFines.map((f) => (
            <div key={f.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0">
              <div>
                <div className="font-medium">{f.reason}</div>
                <div className="text-xs text-muted-foreground">{dateFr(f.date)} · {f.location}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold">{eur(f.amount)}</span>
                <FineStatusBadge status={f.status} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Entretien */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4" /> Entretien du véhicule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myMaint.length === 0 && <p className="text-sm text-muted-foreground">Aucun entretien enregistré.</p>}
          {myMaint.map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0">
              <div>
                <div className="font-medium">{maintenanceKindLabel[m.kind]}</div>
                <div className="text-xs text-muted-foreground">{dateFr(m.date)}</div>
              </div>
              <MaintenanceStatusBadge status={m.status} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Consentement RGPD */}
      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Activer la géolocalisation
            </DialogTitle>
            <DialogDescription>
              Pour enregistrer vos trajets, l'application a besoin d'accéder à votre position GPS{" "}
              <strong>uniquement pendant un trajet que vous démarrez</strong>. Les données sont conservées 12 mois
              maximum et vous pouvez retirer votre consentement à tout moment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConsentOpen(false)}>Refuser</Button>
            <Button onClick={confirmConsent}>J'accepte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
