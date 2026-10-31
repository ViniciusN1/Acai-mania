"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brl, categories, fetchProducts, Product } from "@/lib/menu";
import { store, instagramUrl } from "@/lib/store";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [added, setAdded] = useState("");
  const [lastOrder, setLastOrder] = useState("");
  const { add, count, subtotal } = useCart();
  const router = useRouter();
  const { session } = useAuth();
  useEffect(() => {
    fetchProducts().then(setProducts).catch(console.error).finally(() => setLoaded(true));
    setLastOrder(localStorage.getItem("lastOrder") ?? "");
  }, []);

  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const tabs = cats.length ? cats : categories;
  const current = tabs.includes(cat) ? cat : tabs[0];
  const list = products.filter((p) => (q ? `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()) : p.category === current));
  const pick = (p: Product) => {
    if (p.build) return router.push("/monte");
    add({ name: p.name, details: p.description, unitPrice: p.price, image: p.image });
    setAdded(p.id); setTimeout(() => setAdded(""), 900);
  };

  return (
    <main className="wrap">
      <header className="appbar">
        <div className="brand"><img src={store.logo} alt={store.name} width={46} height={46} />
          <div style={{ minWidth: 0 }}><h1>{store.name}</h1><span className="open"><i />{store.hours}</span></div></div>
        <Link className="chip" href={session ? "/conta" : "/entrar"}>{session ? "Minha conta" : "Entrar"}</Link>
      </header>

      <section className="hero2">
        <div className="txt"><small>Delivery em {store.city.split(" - ")[0]}</small><h2>{store.tagline}</h2>
          <button className="btn" onClick={() => router.push("/monte")}>Monte seu açaí</button></div>
        <img src={store.heroImage} alt="" />
      </section>

      <div className="perks">
        <div className="perk"><b>🛵</b>Entrega rápida</div>
        <div className="perk"><b>📍</b>Acompanhe no mapa</div>
        <div className="perk"><b>💜</b>Pix, cartão ou dinheiro</div>
      </div>

      {lastOrder && <Link href={`/pedido/${lastOrder}`} className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>📦</span><div style={{ flex: 1 }}><b>Acompanhar meu último pedido</b><div className="mut">Veja o status e o motoboy no mapa</div></div><span>›</span></Link>}

      <div className="search"><span>🔎</span><input type="search" placeholder="Buscar açaí, combos, bebidas..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="cats"><div className="chips" style={{ margin: "8px 0" }}>{tabs.map((c) => <button key={c} className={`chip ${c === current && !q ? "on" : ""}`} onClick={() => { setCat(c); setQ(""); }}>{c}</button>)}</div></div>

      <div className="section-t"><h3>{q ? `Resultados para “${q}”` : current}</h3><span className="mut">{list.length} {list.length === 1 ? "item" : "itens"}</span></div>
      {!loaded && [0, 1, 2].map((i) => <div key={i} className="prodcard" style={{ height: 108, opacity: 0.5 }} />)}
      {loaded && list.length === 0 && <p className="mut">Nada aqui por enquanto.</p>}
      {list.map((p) => (
        <div key={p.id} className="prodcard" onClick={() => pick(p)} role="button">
          <img src={p.image} alt={p.name} />
          <div className="info">{p.build && <span className="badge">Do seu jeito</span>}<h3>{p.name}</h3><div className="mut clamp">{p.description}</div>
            <div className="price">{p.build ? `a partir de ${brl(p.price)}` : brl(p.price)}</div></div>
          <button className="plus" onClick={(e) => { e.stopPropagation(); pick(p); }} aria-label={`Adicionar ${p.name}`}>{added === p.id ? "✓" : "+"}</button>
        </div>
      ))}

      <footer className="foot mut"><b>{store.name}</b>{store.address && <div>{store.address}</div>}<div>{store.hours}</div>
        <div className="chips" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <a className="chip" href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
          {store.social.instagram && <a className="chip" href={instagramUrl(store.social.instagram)} target="_blank" rel="noreferrer">Instagram</a>}
          {store.social.facebook && <a className="chip" href={store.social.facebook} target="_blank" rel="noreferrer">Facebook</a>}
          {store.social.site && <a className="chip" href={store.social.site} target="_blank" rel="noreferrer">Site</a>}
        </div></footer>

      {count > 0 && <div className="bar"><Link href="/carrinho" className="btn full cartbtn"><span className="n">{count}</span><span>Ver carrinho</span><span>{brl(subtotal)}</span></Link></div>}
    </main>
  );
}
