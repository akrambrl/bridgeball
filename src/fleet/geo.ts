// Coordonnées approximatives [lat, lng] de villes françaises, pour situer les
// trajets saisis manuellement (sans géocodage en ligne).
export const CITY_COORDS: Record<string, [number, number]> = {
  paris: [48.8566, 2.3522],
  lyon: [45.764, 4.8357],
  marseille: [43.2965, 5.3698],
  lille: [50.6292, 3.0573],
  reims: [49.2583, 4.0317],
  grenoble: [45.1885, 5.7245],
  nantes: [47.2184, -1.5536],
  rennes: [48.1173, -1.6778],
  bordeaux: [44.8378, -0.5792],
  toulouse: [43.6047, 1.4442],
  nice: [43.7102, 7.262],
  strasbourg: [48.5734, 7.7521],
  montpellier: [43.6108, 3.8767],
};

export function cityCoords(name: string): [number, number] | null {
  const key = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return CITY_COORDS[key] ?? null;
}

const R = 6371; // rayon terrestre en km

/** Distance en km entre deux points GPS (formule de haversine). */
export function haversineKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Longueur totale d'un tracé GPS, en km. */
export function pathLengthKm(path: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineKm(path[i - 1], path[i]);
  return total;
}
