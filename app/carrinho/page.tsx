"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { brl, fetchZones } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Coupon = { code: string; kind: string; value: number } | null;

export default function Carrinho() {
  const { items, setQty, clear, subtotal } = useCart();
  const router = useRouter();
  const [zones, setZones] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<"entrega" | "retirada">("entrega");
  const [f, setF] = useState({ name: "", phone: "", neighborhood: "", address: "" });
  const [payment, setPayment] = useState<"pix" | "cartao" | "dinheiro">("pix");
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const { session, profile } = useAuth();
  useEffect(() => { fetchZones().then(setZones).catch(console.error); }, []);
  // Cliente logado: preenche nome e telefone do cadastro
  useEffect(() => { if (profile) setF((x) => ({ ...x, name: x.name || profile.full_name, phone: x.phone || profile.phone })); }, [profile]);

  const baseFee = mode === "entrega" ? zones[f.neighborhood] ?? 0 : 0;
  const discount = !coupon ? 0 : coupon.kind === "percent" ? subtotal * (coupon.value / 100) : coupon.kind === "fixed" ? Math.min(coupon.value, subtotal) : 0;
  const fee = coupon?.kind === "free_delivery" ? 0 : baseFee;
  const total = Math.max(0, subtotal - discount + fee);
  const phone = f.phone.replace(/\D/g, "");

  async function applyCoupon() {
    if (!code.trim()) return;
    if (phone.length < 10) return setMsg({ ok: false, text: "Preencha seu telefone antes do cupom." });
    const { data, error } = await supabase.rpc("check_coupon", { p_code: code.trim(), p_subtotal: subtotal, p_phone: phone });
    const r = data?.[0];
    if (error || !r?.ok) { setCoupon(null); return setMsg({ ok: false, text: r?.message ?? "Erro ao validar cupom" }); }
    setCoupon({ code: code.trim().toUpperCase(), kind: r.kind, value: Number(r.value) });
    setMsg({ ok: true, text: r.message });
  }

  const valid = items.length > 0 && f.name.trim() && phone.length >= 10 && (mode === "retirada" || (f.neighborhood && f.address.trim()));

  async function finish() {
    if (!valid) return;
    setSending(true);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("orders").insert({
      id, user_id: session?.user.id ?? null, mode, customer_name: f.name.trim(), customer_phone: phone,
      neighborhood: mode === "entrega" ? f.neighborhood : null, address: mode === "entrega" ? f.address.trim() : null,
      items: items.map(({ name, details, unitPrice, qty }) => ({ name, details, unitPrice, qty })),
      subtotal, delivery_fee: fee, discount: Number(discount.toFixed(2)), total: Number(total.toFixed(2)), payment,
      coupon_code: coupon?.code ?? null, status_times: { recebido: new Date().toISOString() },
    });
    setSending(false);
    if (error) return setMsg({ ok: false, text: "Não foi possível enviar o pedido. Tente de novo." });
    clear();
    localStorage.setItem("lastOrder", id);
    router.push(`/pedido/${id}`);
  }

  if (items.length === 0) return <main className="wrap"><h1>Carrinho</h1><p className="mut">Seu carrinho está vazio.</p><Link className="btn" href="/">Ver cardápio</Link></main>;

  return (
    <main className="wrap">
      <div className="top"><button className="chip" onClick={() => router.back()}>‹</button><h1>Finalizar pedido</h1><button className="chip" onClick={clear}>Limpar</button></div>
      {items.map((i) => (
        <div key={i.key} className="card prod"><img src={i.image} alt="" /><div className="info"><h3>{i.name}</h3><div className="mut">{i.details}</div><div className="price">{brl(i.unitPrice * i.qty)}</div></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}><button className="plus" onClick={() => setQty(i.key, i.qty - 1)}>−</button>{i.qty}<button className="plus" onClick={() => setQty(i.key, i.qty + 1)}>+</button></div></div>
      ))}
      <div className="grid2" style={{ margin: "12px 0" }}>{(["entrega", "retirada"] as const).map((m) => <button key={m} className={`opt ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>{m === "entrega" ? "Entrega" : "Retirada"}</button>)}</div>
      <div className="card">
        <label>Nome</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label>Telefone (WhatsApp)</label><input inputMode="tel" placeholder="(67) 99999-0000" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        {mode === "entrega" && <>
          <label>Bairro</label><select value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })}><option value="">Selecione</option>{Object.entries(zones).map(([n, v]) => <option key={n} value={n}>{n} · {brl(v)}</option>)}</select>
          <label>Rua, número e referência</label><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </>}
      </div>
      <div className="card"><div style={{ display: "flex", gap: 8 }}><input placeholder="Cupom de desconto" value={code} onChange={(e) => setCode(e.target.value)} /><button className="btn ghost" onClick={applyCoupon}>Aplicar</button></div>
        {msg && <div className={msg.ok ? "okmsg" : "err"}>{msg.text}</div>}</div>
      <h3>Pagamento</h3>
      <div className="grid3">{([["pix", "Pix"], ["cartao", "Cartão"], ["dinheiro", "Dinheiro"]] as const).map(([k, l]) => <button key={k} className={`opt ${payment === k ? "on" : ""}`} onClick={() => setPayment(k)}>{l}</button>)}</div>
      <p className="mut">{payment === "pix" ? "A chave Pix é enviada no acompanhamento do pedido." : "Pago na entrega."}</p>
      <div className="card">
        <div className="row"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
        <div className="row"><span>Frete</span><span>{mode === "retirada" ? "Retirada" : brl(fee)}</span></div>
        {discount > 0 && <div className="row okmsg"><span>Desconto</span><span>−{brl(discount)}</span></div>}
        <div className="row total"><span>Total</span><span className="price">{brl(total)}</span></div>
      </div>
      <div className="bar"><button className="btn full" disabled={!valid || sending} onClick={finish}>{sending ? "Enviando..." : `Finalizar pedido · ${brl(total)}`}</button></div>
    </main>
  );
}
