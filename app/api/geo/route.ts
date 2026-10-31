import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy de geocodificação para o Nominatim (OpenStreetMap), grátis e sem chave.
 * Regras de uso do Nominatim: no máximo 1 requisição por segundo e um User-Agent que identifique o app.
 *   GET /api/geo?lat=-20.47&lng=-55.78  -> { address, neighborhood }
 *   GET /api/geo?q=Rua X, 123           -> { lat, lng, label }  (restrito à área urbana de Aquidauana-MS)
 */
export const dynamic = "force-dynamic";

const BASE = "https://nominatim.openstreetmap.org";
const UA = `AcaiMania-Delivery/1.0 (${process.env.NOMINATIM_EMAIL || "contato via site"}; +https://acai-mania-iota.vercel.app)`;
// Caixa da área urbana de Aquidauana/Anastácio (lng_min, lat_max, lng_max, lat_min)
const VIEWBOX = process.env.GEO_VIEWBOX || "-55.85,-20.42,-55.72,-20.53";
const CITY = process.env.GEO_CITY || "Aquidauana, MS, Brasil";

const cache = new Map<string, { t: number; v: unknown }>();
let last = 0;

async function nominatim(path: string) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.t < 1000 * 60 * 60 * 6) return hit.v;
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const email = process.env.NOMINATIM_EMAIL ? `&email=${encodeURIComponent(process.env.NOMINATIM_EMAIL)}` : "";
  const r = await fetch(`${BASE}${path}${email}`, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" }, cache: "no-store" });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const v = await r.json();
  cache.set(path, { t: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return v;
}

const cors = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const lat = Number(sp.get("lat")), lng = Number(sp.get("lng"));
    if (sp.get("lat") && Number.isFinite(lat) && Number.isFinite(lng)) {
      const d = (await nominatim(`/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`)) as {
        address?: Record<string, string>; display_name?: string };
      const a = d.address ?? {};
      const street = a.road || a.pedestrian || a.footway || a.residential || "";
      const address = [street, a.house_number].filter(Boolean).join(", ") || (d.display_name ?? "").split(",").slice(0, 2).join(",");
      const neighborhood = a.suburb || a.neighbourhood || a.quarter || a.city_district || "";
      return NextResponse.json({ address, neighborhood }, { headers: cors });
    }
    const q = (sp.get("q") ?? "").trim();
    if (q.length < 3) return NextResponse.json({ error: "Endereço muito curto" }, { status: 400, headers: cors });
    const query = encodeURIComponent(`${q}, ${CITY}`);
    const list = (await nominatim(`/search?format=jsonv2&limit=1&countrycodes=br&bounded=1&viewbox=${VIEWBOX}&q=${query}`)) as
      { lat: string; lon: string; display_name: string }[];
    if (!list.length) return NextResponse.json(null, { headers: cors });
    return NextResponse.json({ lat: Number(list[0].lat), lng: Number(list[0].lon), label: list[0].display_name }, { headers: cors });
  } catch {
    return NextResponse.json({ error: "Serviço de mapas indisponível" }, { status: 502, headers: cors });
  }
}
