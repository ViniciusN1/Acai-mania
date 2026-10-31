export type LatLng = { lat: number; lng: number };

/** Distância em km (haversine) */
export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const km = (v: number) => (v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1).replace(".", ",")} km`);

/**
 * Rota por vizinho mais próximo: começa pela entrega mais perto da posição atual,
 * depois a mais perto da anterior, e assim por diante. Itens sem coordenadas vão no fim.
 */
export function nearestNeighbor<T>(start: LatLng, items: T[], pos: (t: T) => LatLng | null) {
  const left = items.filter((i) => pos(i));
  const noGeo = items.filter((i) => !pos(i));
  const out: { item: T; leg: number | null }[] = [];
  let from = start, total = 0;
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((it, i) => { const d = haversineKm(from, pos(it)!); if (d < bd) { bd = d; bi = i; } });
    const [it] = left.splice(bi, 1);
    out.push({ item: it, leg: bd }); total += bd; from = pos(it)!;
  }
  for (const it of noGeo) out.push({ item: it, leg: null });
  return { stops: out, total };
}
