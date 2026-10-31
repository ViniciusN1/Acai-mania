"use client";
import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  kind: "loja" | "cliente" | "motoboy" | "eu";
  label?: string;
  /** foto (motoboy) */
  image?: string;
  draggable?: boolean;
  onDragEnd?: (p: { lat: number; lng: number }) => void;
};

const EMOJI: Record<MapPin["kind"], string> = { loja: "🍧", cliente: "🏠", motoboy: "🛵", eu: "📍" };

function icon(L: typeof Leaflet, p: MapPin) {
  const inner = p.image
    ? `<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
    : `<span>${EMOJI[p.kind]}</span>`;
  return L.divIcon({
    className: "",
    html: `<div class="pin pin-${p.kind}">${inner}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 38],
    popupAnchor: [0, -34],
  });
}

/**
 * Mapa OpenStreetMap (Leaflet, sem chave). Carregado só no navegador.
 * `fitKey`: quando muda, o mapa reenquadra todos os pinos.
 */
export default function LiveMap({ pins, height = 260, fitKey, center, zoom = 15 }: {
  pins: MapPin[]; height?: number; fitKey?: string; center?: { lat: number; lng: number }; zoom?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const markers = useRef(new Map<string, Leaflet.Marker>());
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const lastFit = useRef<string | undefined>(undefined);

  // Cria o mapa uma vez
  useEffect(() => {
    let dead = false;
    import("leaflet").then((mod) => {
      if (dead || !el.current || map.current) return;
      const lib = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      L.current = lib;
      const start = center ?? pinsRef.current[0] ?? { lat: -20.4739, lng: -55.7821 };
      map.current = lib.map(el.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], zoom);
      lib.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, subdomains: "abc",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      sync();
    });
    return () => { dead = true; map.current?.remove(); map.current = null; markers.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    const lib = L.current, m = map.current;
    if (!lib || !m) return;
    const seen = new Set<string>();
    for (const p of pinsRef.current) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      seen.add(p.id);
      let mk = markers.current.get(p.id);
      if (!mk) {
        mk = lib.marker([p.lat, p.lng], { icon: icon(lib, p), draggable: !!p.draggable }).addTo(m);
        if (p.label) mk.bindPopup(p.label);
        mk.on("dragend", () => {
          const ll = mk!.getLatLng();
          pinsRef.current.find((x) => x.id === p.id)?.onDragEnd?.({ lat: ll.lat, lng: ll.lng });
        });
        markers.current.set(p.id, mk);
      } else {
        const cur = mk.getLatLng();
        if (cur.lat !== p.lat || cur.lng !== p.lng) mk.setLatLng([p.lat, p.lng]);
        if (p.label) mk.setPopupContent(p.label);
      }
    }
    for (const [id, mk] of markers.current) if (!seen.has(id)) { mk.remove(); markers.current.delete(id); }
    const key = fitKey ?? "inicial";
    if (lastFit.current !== key) {
      const pts = pinsRef.current.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => [p.lat, p.lng] as [number, number]);
      if (pts.length > 1) { m.fitBounds(lib.latLngBounds(pts), { padding: [36, 36], maxZoom: 16 }); lastFit.current = key; }
      else if (pts.length === 1) { m.setView(pts[0], Math.max(m.getZoom(), zoom)); lastFit.current = key; }
    }
  }

  useEffect(() => { sync(); });

  return <div ref={el} className="map" style={{ height }} role="application" aria-label="Mapa" />;
}
