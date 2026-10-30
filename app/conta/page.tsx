"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { brl } from "@/lib/menu";
import { orderCode } from "@/lib/store";

type Order = { id: string; code: string; created_at: string; status: string; total: number };
const label: Record<string, string> = { recebido: "Recebido", preparo: "Em preparo", saiu: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado" };

export default function Conta() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => { if (session === null) router.replace("/entrar"); }, [session, router]);
  useEffect(() => {
    if (!session) return;
    supabase.from("orders").select("id, code, created_at, status, total").eq("user_id", session.user.id)
      .order("created_at", { ascending: false }).limit(20).then(({ data }) => setOrders((data as Order[]) ?? []));
  }, [session]);
  if (loading || !session) return null;
  return (
    <main className="wrap">
      <div className="top"><Link className="chip" href="/">‹</Link><h1>Minha conta</h1>
        <button className="chip" onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}>Sair</button></div>
      <div className="card"><b>{profile?.full_name || session.user.email}</b><div className="mut">{session.user.email}</div><div className="mut">{profile?.phone}</div>
        {profile?.role === "admin" && <><br /><Link className="btn" href="/admin">Abrir painel admin</Link></>}</div>
      <h3>Meus pedidos</h3>
      {orders.length === 0 && <p className="mut">Você ainda não fez pedidos logado.</p>}
      {orders.map((o) => (
        <Link key={o.id} href={`/pedido/${o.id}`} className="card" style={{ display: "flex", justifyContent: "space-between", color: "inherit", textDecoration: "none" }}>
          <div><b>{orderCode(o.code)}</b><div className="mut">{new Date(o.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div></div>
          <div style={{ textAlign: "right" }}>{brl(Number(o.total))}<div className="mut">{label[o.status]}</div></div>
        </Link>))}
    </main>
  );
}
