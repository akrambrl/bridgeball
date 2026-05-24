import { useCallback, useEffect, useRef, useState } from "react";
import { pathLengthKm } from "./geo";

type LatLng = [number, number];

export interface TripResult {
  path: LatLng[];
  distanceKm: number;
  durationMin: number;
}

interface TrackerState {
  tracking: boolean;
  path: LatLng[];
  distanceKm: number;
  elapsedSec: number;
  error: string | null;
}

const initial: TrackerState = { tracking: false, path: [], distanceKm: 0, elapsedSec: 0, error: null };

/** Suivi GPS d'un trajet via l'API Geolocation du navigateur (tracker smartphone). */
export function useTripTracker() {
  const [state, setState] = useState<TrackerState>(initial);
  const watchId = useRef<number | null>(null);
  const startedAt = useRef<number>(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathRef = useRef<LatLng[]>([]);

  const cleanup = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    if (timer.current) clearInterval(timer.current);
    watchId.current = null;
    timer.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState((s) => ({ ...s, error: "La géolocalisation n'est pas disponible sur cet appareil." }));
      return;
    }
    startedAt.current = Date.now();
    pathRef.current = [];
    setState({ ...initial, tracking: true });

    timer.current = setInterval(() => {
      setState((s) => ({ ...s, elapsedSec: Math.round((Date.now() - startedAt.current) / 1000) }));
    }, 1000);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: LatLng = [pos.coords.latitude, pos.coords.longitude];
        pathRef.current = [...pathRef.current, point];
        setState((s) => ({ ...s, path: pathRef.current, distanceKm: pathLengthKm(pathRef.current), error: null }));
      },
      (err) => setState((s) => ({ ...s, error: err.message })),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, []);

  const stop = useCallback((): TripResult => {
    cleanup();
    const path = pathRef.current;
    const result: TripResult = {
      path,
      distanceKm: Number(pathLengthKm(path).toFixed(1)),
      durationMin: Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)),
    };
    setState({ ...initial });
    return result;
  }, [cleanup]);

  return { ...state, start, stop };
}
