"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { brl } from "@/lib/menu";
import { supabase } from "@/lib/supabase";
import { store, orderCode } from "@/lib/store";

const steps = [["recebido", "Recebido"], ["preparo", "Em preparo"], ["saiu", "Saiu para entrega"], ["entregue", "Entregue"]] as const;
type Order = { id: string; code: string; status: string; status_times: Record<string, string>; total: number; payment: string; mode: string; items: { name: string; qty: number }[] };
const hhmm = (s?: string) => (s ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

export default function Pedido() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Order | null>(null);
  const load = () => supabase.rpc("get_order", { order_id: id }).then(({ data }) => data?.[0] && setO(data[0]));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [id]);

  if (!o) return <main className="wrap"><p className="mut">Carregando pedido...</p></main>;
  const idx = steps.findIndex(([k]) => k === o.status);
  const text = encodeURIComponent(`Olá, ${store.name}! Sobre meu pedido ${orderCode(o.code)}`);
  return (
    <main className="wrap">
      <h1>Acompanhar pedido</h1>
      <section className="hero" style={{ display: "block" }}><div className="mut" style={{ color: "#fff" }}>Pedido {orderCode(o.code)}</div><h2>{o.status === "cancelado" ? "Pedido cancelado" : steps[idx]?.[1]}</h2></section>
      <div className="card">{steps.filter(([k]) => o.mode === "entrega" || k !== "saiu").map(([k, l], i) => (
        <div key={k} className="step"><span className={`dot ${i < idx ? "done" : i === idx ? "now" : ""}`} /><span style={{ flex: 1 }}>{l}</span><span className="mut">{hhmm(o.status_times?.[k])}</span></div>))}</div>
      <div className="card">{o.items.map((i, n) => <div key={n} className="row"><span>{i.qty}x {i.name}</span></div>)}<div className="row total"><span>Total</span><span className="price">{brl(Number(o.total))}</span></div><div className="mut">Pagamento: {o.payment}</div></div>
      {o.payment === "pix" && store.pixKey && o.status !== "cancelado" && (
        <div className="card"><b>Pague com Pix</b><div className="mut">Chave Pix{store.pixName ? ` · ${store.pixName}` : ""}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}><code style={{ flex: 1, wordBreak: "break-all" }}>{store.pixKey}</code>
            <button className="chip" onClick={() => navigator.clipboard?.writeText(store.pixKey)}>Copiar</button></div>
          <div className="mut">Valor: {brl(Number(o.total))}. Envie o comprovante pelo WhatsApp.</div></div>)}
      <a className="btn full wa" style={{ display: "block", textAlign: "center" }} href={`https://wa.me/${store.whatsapp}?text=${text}`} target="_blank">Falar no WhatsApp</a>
    </main>
  );
}
