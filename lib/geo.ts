export type LatLng = { lat: number; lng: number };

/** Distância em km entre dois pontos (fórmula de haversine) */
export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const km = (v: number) => (v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1).replace(".", ",")} km`);

/** Posição atual pelo GPS do aparelho */
export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("Seu navegador não tem localização."));
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(
      e.code === 1 ? "Permissão de localização negada. Ative nas configurações do navegador." :
      e.code === 3 ? "O GPS demorou para responder. Tente de novo perto de uma janela." : "Não foi possível obter sua localização.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  });
}

/** Endereço a partir das coordenadas (via /api/geo, que chama o Nominatim/OpenStreetMap) */
export async function reverseGeocode(p: LatLng): Promise<{ address: string; neighborhood: string } | null> {
  const r = await fetch(`/api/geo?lat=${p.lat}&lng=${p.lng}`);
  if (!r.ok) return null;
  return r.json();
}

/** Coordenadas a partir do endereço digitado (restrito à cidade da loja) */
export async function geocode(q: string): Promise<LatLng | null> {
  const r = await fetch(`/api/geo?q=${encodeURIComponent(q)}`);
  if (!r.ok) return null;
  const d = await r.json();
  return d && typeof d.lat === "number" ? d : null;
}
