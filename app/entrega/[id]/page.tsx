"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { brl } from "@/lib/menu";
import { supabase } from "@/lib/supabase";
import { orderCode, mapsAddress, waLink } from "@/lib/store";

type Order = { id: string; code: string; status: string; status_times: Record<string, string>; total: number; payment: string;
  customer_name: string; customer_phone: string; address: string; neighborhood: string; items: { name: string; qty: number; details?: string }[] };
const hhmm = (s?: string) => (s ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

/** Página do motoboy: aberta pelo link que o admin manda no WhatsApp. */
export default function Entrega() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Order | null>(null);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const load = () => supabase.rpc("get_order", { order_id: id }).then(({ data }) => data?.[0] && setO(data[0]));
  useEffect(() => { load(); }, [id]);

  async function step(p: "coletado" | "entregue") {
    if (p === "entregue" && !confirm("Confirmar que o pedido foi entregue ao cliente?")) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("courier_step", { order_id: id, p_step: p });
    setBusy(false);
    setMsg(error ? "Erro de conexão. Tente de novo." : data === "ok" ? (p === "entregue" ? "Entrega confirmada. Obrigado!" : "Coleta confirmada.") : String(data));
    load();
  }

  if (!o) return <main className="wrap"><p className="mut">Carregando entrega...</p></main>;
  const map = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsAddress(o.address, o.neighborhood))}`;
  const pago = o.payment === "pix";
  const coletado = !!o.status_times?.coletado;
  return (
    <main className="wrap">
      <h1>Entrega {orderCode(o.code)}</h1>
      <section className="hero" style={{ display: "block" }}>
        <h2>{o.status === "entregue" ? "Entregue ✓" : o.status === "cancelado" ? "Cancelado" : o.status === "saiu" ? (coletado ? "A caminho do cliente" : "Pronto para coletar") : "Ainda na loja"}</h2>
        <div style={{ color: "#fff", fontWeight: 700 }}>{pago ? "JÁ PAGO (Pix) · não cobrar" : `COBRAR ${brl(Number(o.total))} · ${o.payment}`}</div>
      </section>
      <div className="card"><b>{o.customer_name}</b><div>{o.address}</div><div className="mut">{o.neighborhood}</div><br />
        <a className="btn" href={map} target="_blank">Abrir rota</a>{" "}
        <a className="chip" href={`tel:${o.customer_phone}`}>Ligar</a>{" "}
        <a className="chip" href={waLink(o.customer_phone)} target="_blank">WhatsApp</a></div>
      <div className="card">{o.items.map((i, n) => <div key={n}>{i.qty}x {i.name}{i.details && <div className="mut">{i.details}</div>}</div>)}</div>
      <div className="card">
        <div className="step"><span className={`dot ${o.status_times?.saiu ? "done" : ""}`} /><span style={{ flex: 1 }}>Despachado pela loja</span><span className="mut">{hhmm(o.status_times?.saiu)}</span></div>
        <div className="step"><span className={`dot ${coletado ? "done" : ""}`} /><span style={{ flex: 1 }}>Coletado pelo motoboy</span><span className="mut">{hhmm(o.status_times?.coletado)}</span></div>
        <div className="step"><span className={`dot ${o.status === "entregue" ? "done" : ""}`} /><span style={{ flex: 1 }}>Entregue ao cliente</span><span className="mut">{hhmm(o.status_times?.entregue)}</span></div>
      </div>
      {o.status === "saiu" && !coletado && <button className="btn full" disabled={busy} onClick={() => step("coletado")}>Peguei o pedido</button>}
      {o.status === "saiu" && coletado && <button className="btn full wa" disabled={busy} onClick={() => step("entregue")}>Confirmar entrega</button>}
      {msg && <p className="okmsg" style={{ textAlign: "center" }}>{msg}</p>}
    </main>
  );
}
