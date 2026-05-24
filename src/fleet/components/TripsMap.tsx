import { Fragment, useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cityCoords } from "../geo";
import { km, dateFr } from "../format";
import type { Trip, Vehicle } from "../types";

type LatLng = [number, number];

interface DrawnTrip {
  id: string;
  label: string;
  date: string;
  distanceKm: number;
  source: "manual" | "gps";
  path: LatLng[];
}

function buildPath(trip: Trip): LatLng[] | null {
  if (trip.path && trip.path.length >= 2) return trip.path;
  const a = cityCoords(trip.from);
  const b = cityCoords(trip.to);
  return a && b ? [a, b] : null;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      const lats = points.map((p) => p[0]);
      const lngs = points.map((p) => p[1]);
      map.fitBounds(
        [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
        { padding: [40, 40] },
      );
    }
  }, [map, points]);
  return null;
}

export default function TripsMap({ trips, vehicles }: { trips: Trip[]; vehicles: Vehicle[] }) {
  const drawn = useMemo<DrawnTrip[]>(() => {
    return trips
      .map((t) => {
        const path = buildPath(t);
        if (!path) return null;
        const v = vehicles.find((x) => x.id === t.vehicleId);
        return {
          id: t.id,
          label: v ? `${v.brand} ${v.model}` : "Véhicule",
          date: t.date,
          distanceKm: t.distanceKm,
          source: t.source ?? "manual",
          path,
        } satisfies DrawnTrip;
      })
      .filter((x): x is DrawnTrip => x !== null);
  }, [trips, vehicles]);

  const allPoints = drawn.flatMap((d) => d.path);

  if (drawn.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-md border text-sm text-muted-foreground">
        Aucun trajet localisable (ville inconnue ou tracé GPS absent).
      </div>
    );
  }

  return (
    <div className="h-[420px] overflow-hidden rounded-md border">
      <MapContainer center={[46.6, 2.5]} zoom={6} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />
        {drawn.map((d) => {
          const color = d.source === "gps" ? "#2563eb" : "#16a34a";
          const start = d.path[0];
          const end = d.path[d.path.length - 1];
          return (
            <Fragment key={d.id}>
              <Polyline positions={d.path} pathOptions={{ color, weight: 4, opacity: 0.7 }} />
              <CircleMarker center={start} radius={5} pathOptions={{ color, fillColor: color, fillOpacity: 1 }} />
              <CircleMarker center={end} radius={6} pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1 }}>
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold">{d.label}</div>
                    <div>{dateFr(d.date)}</div>
                    <div>{km(d.distanceKm)}</div>
                    <div className="text-muted-foreground">{d.source === "gps" ? "Tracé GPS" : "Saisi manuellement"}</div>
                  </div>
                </Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
