"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { brl, groups, sizes } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import { store } from "@/lib/store";

export default function Monte() {
  const [size, setSize] = useState(sizes[sizes.length - 1]);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const router = useRouter();

  const toggle = (g: string, o: string, max: number) => setSel((s) => {
    const cur = s[g] ?? [];
    if (cur.includes(o)) return { ...s, [g]: cur.filter((x) => x !== o) };
    if (cur.length >= max) return s;
    return { ...s, [g]: [...cur, o] };
  });

  const details = Object.values(sel).flat().join(", ") || "Sem acompanhamentos";
  return (
    <main className="wrap">
      <div className="top"><button className="chip" onClick={() => router.back()}>‹ Voltar</button></div>
      <img src="/copo.jpg" alt="" style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 20 }} />
      <h2>Monte seu Açaí</h2><p className="mut">Escolha o tamanho e os acompanhamentos</p>
      <h3>Tamanho</h3>
      <div className="grid3">{sizes.map((s) => <button key={s.id} className={`opt ${s.id === size.id ? "on" : ""}`} onClick={() => setSize(s)}><b>{s.label}</b><div className="mut">{brl(s.price)}</div></button>)}</div>
      {groups.map((g) => (
        <section key={g.id}>
          <h3 style={{ display: "flex", justifyContent: "space-between" }}>{g.label}<span className="mut">Até {g.max}</span></h3>
          <div className="grid2">{g.options.map((o) => <button key={o} className={`opt ${(sel[g.id] ?? []).includes(o) ? "on" : ""}`} onClick={() => toggle(g.id, o, g.max)}>{o}</button>)}</div>
        </section>
      ))}
      <div className="bar"><div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="plus" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><b>{qty}</b><button className="plus" onClick={() => setQty(qty + 1)}>+</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => { add({ name: `Monte seu Açaí ${size.label}`, details, unitPrice: size.price, image: store.heroImage }, qty); router.push("/carrinho"); }}>Adicionar · {brl(size.price * qty)}</button>
      </div></div>
    </main>
  );
}
