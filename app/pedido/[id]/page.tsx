"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { brl } from "@/lib/menu";
import { supabase } from "@/lib/supabase";
import { store, orderCode } from "@/lib/store";
import { haversineKm, km } from "@/lib/geo";
import type { MapPin } from "@/components/LiveMap";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false, loading: () => <div className="map" style={{ height: 280 }} /> });

const steps = [["recebido", "Recebido", "🧾"], ["preparo", "Em preparo", "🍧"], ["saiu", "Saiu para entrega", "🛵"], ["entregue", "Entregue", "🎉"]] as const;
const subs: Record<string, string> = {
  recebido: "A loja recebeu seu pedido e já vai começar.",
  preparo: "Seu açaí está sendo preparado com carinho.",
  saiu: "O motoboy está a caminho. Acompanhe no mapa.",
  entregue: "Bom apetite! Obrigado pela preferência.",
  cancelado: "Fale com a loja pelo WhatsApp se tiver dúvidas.",
};
type Order = { id: string; code: string; status: string; status_times: Record<string, string>; total: number; payment: string; mode: string;
  address?: string; neighborhood?: string; items: { name: string; qty: number; details?: string }[] };
type Track = { status: string; lat: number | null; lng: number | null; store_lat: number; store_lng: number;
  customer_live_lat: number | null; customer_live_lng: number | null;
  courier_name: string | null; courier_avatar: string | null; courier_lat: number | null; courier_lng: number | null; courier_at: string | null };
const hhmm = (s?: string | null) => (s ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
const pay: Record<string, string> = { pix: "Pix", cartao: "Cartão na entrega", dinheiro: "Dinheiro na entrega" };

export default function Pedido() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Order | null>(null);
  const [t, setT] = useState<Track | null>(null);
  const [courierLive, setCourierLive] = useState<{ lat: number; lng: number; at: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = () => supabase.rpc("get_order", { order_id: id }).then(({ data }) => data?.[0] && setO(data[0]));
  const loadTrack = () => supabase.rpc("get_order_tracking", { order_id: id }).then(({ data, error }) => { if (!error && data) setT(data as Track); });

  useEffect(() => {
    load(); loadTrack();
    const a = setInterval(load, 15000);
    const b = setInterval(loadTrack, 8000);
    const c = setInterval(() => setNow(Date.now()), 15000);
    // Tempo real: o app do motoboy transmite a posição neste canal enquanto o pedido está a caminho
    const ch = supabase.channel(`pedido-${id}`)
      .on("broadcast", { event: "motoboy" }, ({ payload }) => {
        if (typeof payload?.lat === "number") setCourierLive({ lat: payload.lat, lng: payload.lng, at: payload.at ?? new Date().toISOString() });
      })
      .on("broadcast", { event: "status" }, () => { load(); loadTrack(); })
      .subscribe();
    chan.current = ch;
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); supabase.removeChannel(ch); stopShare(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Para de compartilhar sozinho quando o pedido termina
  useEffect(() => { if (sharing && o && !["recebido", "preparo", "saiu"].includes(o.status)) stopShare(true); }, [o?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function startShare() {
    if (!navigator.geolocation) return setShareMsg("Seu navegador não tem localização.");
    setShareMsg("Ativando...");
    watch.current = navigator.geolocation.watchPosition(async (pos) => {
      setSharing(true); setShareMsg("Compartilhando sua localização com o motoboy. Mantenha esta tela aberta.");
      if (Date.now() - lastSent.current < 10000) return;
      lastSent.current = Date.now();
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      chan.current?.send({ type: "broadcast", event: "cliente", payload: { ...p, at: new Date().toISOString() } });
      await supabase.rpc("share_customer_location", { order_id: id, p_lat: p.lat, p_lng: p.lng });
      loadTrack();
    }, (e) => { setShareMsg(e.code === 1 ? "Permissão de localização negada." : "Não foi possível obter sua localização."); stopShare(false); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  function stopShare(clear: boolean) {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null; setSharing(false);
    if (clear) { supabase.rpc("share_customer_location", { order_id: id, p_lat: null, p_lng: null }).then(() => loadTrack()); setShareMsg(""); }
  }

  if (!o) return <main className="wrap"><div className="status-hero" style={{ opacity: 0.6 }}><div className="big">⏳</div><h2>Carregando pedido...</h2></div></main>;

  const flow = steps.filter(([k]) => o.mode === "entrega" || k !== "saiu");
  const idx = flow.findIndex(([k]) => k === o.status);
  const cur = steps.find(([k]) => k === o.status);
  const text = encodeURIComponent(`Olá, ${store.name}! Sobre meu pedido ${orderCode(o.code)}`);
  const active = ["recebido", "preparo", "saiu"].includes(o.status);

  // Pinos do mapa
  const courierPos = courierLive && (!t?.courier_at || new Date(courierLive.at).getTime() >= new Date(t.courier_at).getTime()) ? courierLive
    : t?.courier_lat != null && t?.courier_lng != null ? { lat: t.courier_lat, lng: t.courier_lng, at: t.courier_at ?? "" } : null;
  const dest = t?.customer_live_lat != null && t?.customer_live_lng != null ? { lat: t.customer_live_lat, lng: t.customer_live_lng }
    : t?.lat != null && t?.lng != null ? { lat: t.lat, lng: t.lng } : null;
  const pins: MapPin[] = [];
  if (t) pins.push({ id: "loja", kind: "loja", lat: t.store_lat, lng: t.store_lng, label: store.name });
  if (dest) pins.push({ id: "cliente", kind: "cliente", lat: dest.lat, lng: dest.lng, label: "Você" });
  if (o.status === "saiu" && courierPos) pins.push({ id: "motoboy", kind: "motoboy", lat: courierPos.lat, lng: courierPos.lng, label: t?.courier_name ?? "Motoboy" });
  const showMap = o.mode === "entrega" && t && active && (dest || courierPos);
  const dist = courierPos && dest ? haversineKm(courierPos, dest) : null;
  const ageMin = courierPos?.at ? Math.round((now - new Date(courierPos.at).getTime()) / 60000) : null;

  return (
    <main className="wrap">
      <div className="top"><Link className="chip" href="/" aria-label="Voltar ao cardápio">‹ Cardápio</Link><span className="mut">Pedido {orderCode(o.code)}</span></div>

      <section className="status-hero">
        <div className="big">{o.status === "cancelado" ? "✖️" : cur?.[2]}</div>
        <h2>{o.status === "cancelado" ? "Pedido cancelado" : cur?.[1]}</h2>
        <div className="sub">{subs[o.status]}</div>
        {o.status !== "cancelado" && <div className="prog">{flow.map(([k], i) => <i key={k} className={i <= idx ? "on" : ""} />)}</div>}
      </section>

      {showMap && <div className="card" style={{ padding: 8, marginTop: 12 }}>
        <LiveMap pins={pins} height={280} fitKey={`${pins.map((p) => p.id).join(",")}`} />
        {o.status === "saiu" && <div style={{ padding: "10px 6px 2px" }}>
          {courierPos ? <div className="courier">
            {t?.courier_avatar ? <img src={t.courier_avatar} alt="" /> : <span className="av">🛵</span>}
            <div style={{ flex: 1 }}><b>{t?.courier_name ?? "Motoboy"} está a caminho</b>
              <div className="mut">{dist != null ? `A ${km(dist)} de você` : "Posição ao vivo"}{ageMin != null && ageMin > 1 ? ` · atualizado há ${ageMin} min` : ""}</div></div>
            {ageMin != null && ageMin <= 1 && <span className="live"><i />AO VIVO</span>}
          </div> : <div className="mut">Assim que o motoboy sair com seu pedido, ele aparece aqui no mapa.</div>}
        </div>}
      </div>}

      {o.mode === "entrega" && ["preparo", "saiu"].includes(o.status) && <div className="card">
        <b>Ajude o motoboy a te achar</b>
        <div className="mut" style={{ margin: "4px 0 10px" }}>Opcional: compartilhe sua localização ao vivo só enquanto o pedido está a caminho.</div>
        {sharing ? <button className="btn ghost full" onClick={() => stopShare(true)}>Parar de compartilhar</button>
          : <button className="btn soft full" onClick={startShare}>📍 Compartilhar minha localização</button>}
        {shareMsg && <div className="hint">{shareMsg}</div>}
      </div>}

      <div className="card timeline" style={{ marginTop: 12 }}>{flow.map(([k, l], i) => (
        <div key={k} className="step"><span className={`dot ${i < idx || o.status === "entregue" ? "done" : i === idx ? "now" : ""}`} />
          <span style={{ flex: 1, fontWeight: i === idx ? 700 : 400 }}>{l}</span><span className="mut">{hhmm(o.status_times?.[k])}</span></div>))}
        {o.status_times?.coletado && o.status === "saiu" && <div className="mut" style={{ paddingLeft: 26 }}>Motoboy pegou o pedido às {hhmm(o.status_times.coletado)}</div>}
      </div>

      <div className="card">
        <b>Seu pedido</b>
        {o.items.map((i, n) => <div key={n} className="row"><span>{i.qty}x {i.name}{i.details && <div className="mut">{i.details}</div>}</span></div>)}
        <div className="row total"><span>Total</span><span className="price">{brl(Number(o.total))}</span></div>
        <div className="mut">Pagamento: {pay[o.payment] ?? o.payment}{o.mode === "entrega" && o.address ? ` · ${o.address}${o.neighborhood ? `, ${o.neighborhood}` : ""}` : o.mode === "retirada" ? " · Retirada na loja" : ""}</div>
      </div>

      <div className="bar"><a className="btn full wa" href={`https://wa.me/${store.whatsapp}?text=${text}`} target="_blank" rel="noreferrer">💬 Falar com a loja no WhatsApp</a></div>
    </main>
  );
}
