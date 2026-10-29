"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brl, categories, fetchProducts, Product } from "@/lib/menu";
import { useCart } from "@/lib/cart";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cat, setCat] = useState(categories[0]);
  const [q, setQ] = useState("");
  const { add, count, subtotal } = useCart();
  const router = useRouter();
  useEffect(() => { fetchProducts().then(setProducts).catch(console.error); }, []);

  const list = products.filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) : p.category === cat));
  const pick = (p: Product) => p.build ? router.push("/monte") : add({ name: p.name, details: p.description, unitPrice: p.price, image: p.image });

  return (
    <main className="wrap">
      <div className="top"><div style={{ display: "flex", gap: 10, alignItems: "center" }}><img src="/logo.jpg" alt="" width={44} height={44} style={{ borderRadius: 12 }} /><div><h1>Açaí Mania</h1><span className="mut">Ter–Dom · 13h às 23h</span></div></div></div>
      <section className="hero"><div><h2>O melhor açaí de Aquidauana, na sua porta</h2><button className="btn" style={{ background: "#fff", color: "var(--mag)" }} onClick={() => router.push("/monte")}>Pedir agora</button></div><img src="/copo.jpg" alt="" /></section>
      <input style={{ marginTop: 14 }} placeholder="Buscar açaí, combos, bebidas..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">{categories.map((c) => <button key={c} className={`chip ${c === cat ? "on" : ""}`} onClick={() => { setCat(c); setQ(""); }}>{c}</button>)}</div>
      {list.length === 0 && <p className="mut">Nada aqui por enquanto.</p>}
      {list.map((p) => (
        <div key={p.id} className="card prod">
          <img src={p.image} alt={p.name} />
          <div className="info"><h3>{p.name}</h3><div className="mut">{p.description}</div><div className="price">{p.build ? `a partir de ${brl(p.price)}` : brl(p.price)}</div></div>
          <button className="plus" onClick={() => pick(p)} aria-label={`Adicionar ${p.name}`}>+</button>
        </div>
      ))}
      {count > 0 && <div className="bar"><Link href="/carrinho" className="btn full" style={{ textAlign: "center" }}>{count} {count === 1 ? "item" : "itens"} · {brl(subtotal)} · Ver carrinho</Link></div>}
    </main>
  );
}
