"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brl, categoriesOf, fetchProducts, Product } from "@/lib/menu";
import { store, instagramUrl } from "@/lib/store";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const { add, count, subtotal } = useCart();
  const router = useRouter();
  const { session } = useAuth();
  useEffect(() => { fetchProducts().then(setProducts).catch(console.error); }, []);

  const categories = categoriesOf(products);
  const current = categories.includes(cat) ? cat : categories[0];
  const list = products.filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) : p.category === current));
  const pick = (p: Product) => p.build ? router.push("/monte") : add({ name: p.name, details: p.description, unitPrice: p.price, image: p.image });

  return (
    <main className="wrap">
      <div className="top"><div style={{ display: "flex", gap: 10, alignItems: "center" }}><img src={store.logo} alt={store.name} width={44} height={44} style={{ borderRadius: 12, objectFit: "cover" }} /><div><h1>{store.name}</h1><span className="mut">{store.hours}</span></div></div>
        <Link className="chip" href={session ? "/conta" : "/entrar"}>{session ? "Minha conta" : "Entrar"}</Link></div>
      <section className="hero"><div><h2>{store.tagline}</h2><button className="btn" style={{ background: "#fff", color: "var(--mag)" }} onClick={() => router.push("/monte")}>Pedir agora</button></div><img src={store.heroImage} alt="" /></section>
      <input style={{ marginTop: 14 }} placeholder="Buscar açaí, combos, bebidas..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">{categories.map((c) => <button key={c} className={`chip ${c === current ? "on" : ""}`} onClick={() => { setCat(c); setQ(""); }}>{c}</button>)}</div>
      {list.length === 0 && <p className="mut">Nada aqui por enquanto.</p>}
      {list.map((p) => (
        <div key={p.id} className="card prod">
          <img src={p.image} alt={p.name} />
          <div className="info"><h3>{p.name}</h3><div className="mut">{p.description}</div><div className="price">{p.build ? `a partir de ${brl(p.price)}` : brl(p.price)}</div></div>
          <button className="plus" onClick={() => pick(p)} aria-label={`Adicionar ${p.name}`}>+</button>
        </div>
      ))}
      <footer className="foot mut">
        <b>{store.name}</b>{store.address && <div>{store.address}</div>}<div>{store.hours}</div>
        <div className="chips" style={{ justifyContent: "center" }}>
          <a className="chip" href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>
          {store.social.instagram && <a className="chip" href={instagramUrl(store.social.instagram)} target="_blank" rel="noreferrer">Instagram</a>}
          {store.social.facebook && <a className="chip" href={store.social.facebook} target="_blank" rel="noreferrer">Facebook</a>}
          {store.social.site && <a className="chip" href={store.social.site} target="_blank" rel="noreferrer">Site</a>}
        </div>
      </footer>
      {count > 0 && <div className="bar"><Link href="/carrinho" className="btn full" style={{ textAlign: "center" }}>{count} {count === 1 ? "item" : "itens"} · {brl(subtotal)} · Ver carrinho</Link></div>}
    </main>
  );
}
