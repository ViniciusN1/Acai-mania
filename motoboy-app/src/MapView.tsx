import { useEffect, useRef } from "react";
import L from "leaflet";

export type Pin = { id: string; lat: number; lng: number; kind: "loja" | "entrega" | "eu" | "cliente"; num?: number; label?: string; image?: string };

function icon(p: Pin) {
  const inner = p.kind === "eu"
    ? (p.image ? `<img src="${p.image}" alt=""/>` : "🛵")
    : p.kind === "loja" ? "🍧" : p.num != null ? `<b>${p.num}</b>` : "🏠";
  return L.divIcon({ className: "", html: `<div class="pin pin-${p.kind}">${inner}</div>`, iconSize: [38, 38], iconAnchor: [19, 36], popupAnchor: [0, -32] });
}

/** Mapa OpenStreetMap com pinos que se atualizam sem recriar o mapa */
export default function MapView({ pins, fitKey, follow }: { pins: Pin[]; fitKey: string; follow?: { lat: number; lng: number } | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marks = useRef(new Map<string, L.Marker>());
  const fitted = useRef("");

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: false }).setView([-20.4739, -55.7821], 14);
    L.control.zoom({ position: "bottomleft" }).addTo(map.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, subdomains: "abc", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    return () => { map.current?.remove(); map.current = null; marks.current.clear(); };
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    const seen = new Set<string>();
    for (const p of pins) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      seen.add(p.id);
      const key = `${p.kind}|${p.num ?? ""}|${p.image ?? ""}`;
      let mk = marks.current.get(p.id);
      if (mk && (mk as unknown as { _k?: string })._k !== key) { mk.remove(); marks.current.delete(p.id); mk = undefined; }
      if (!mk) {
        mk = L.marker([p.lat, p.lng], { icon: icon(p), zIndexOffset: p.kind === "eu" ? 1000 : 0 }).addTo(m);
        (mk as unknown as { _k?: string })._k = key;
        marks.current.set(p.id, mk);
      } else mk.setLatLng([p.lat, p.lng]);
      if (p.label) mk.bindPopup(p.label);
    }
    for (const [id, mk] of marks.current) if (!seen.has(id)) { mk.remove(); marks.current.delete(id); }
    if (fitted.current !== fitKey) {
      const pts = pins.filter((p) => Number.isFinite(p.lat)).map((p) => [p.lat, p.lng] as [number, number]);
      if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 16 });
      else if (pts.length === 1) m.setView(pts[0], 16);
      fitted.current = fitKey;
    }
  }, [pins, fitKey]);

  useEffect(() => { if (follow && map.current) map.current.panTo([follow.lat, follow.lng]); }, [follow?.lat, follow?.lng]); // eslint-disable-line

  useEffect(() => { const t = setTimeout(() => map.current?.invalidateSize(), 200); return () => clearTimeout(t); });

  return <div ref={el} className="mapfull" />;
}
