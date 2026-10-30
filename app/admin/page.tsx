"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/menu";
import { useAuth } from "@/lib/auth";
import { store, orderCode, mapsAddress, waLink } from "@/lib/store";

type Tab = "pedidos" | "cardapio" | "cupons" | "motoboys" | "frete";
const tabs: [Tab, string][] = [["pedidos", "Pedidos"], ["cardapio", "Cardápio"], ["cupons", "Cupons"], ["motoboys", "Motoboys"], ["frete", "Frete"]];

export default function Admin() {
  const { session, profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("pedidos");
  if (session === undefined) return null;
  if (!session) return <Login />;
  if (loading) return null;
  if (profile?.role !== "admin") return (
    <main className="wrap"><h1>Acesso restrito</h1><p className="mut">Esta área é só para a equipe da loja. Você entrou como {session.user.email}.</p>
      <button className="btn" onClick={() => supabase.auth.signOut()}>Sair</button> <a className="chip" href="/">Voltar ao cardápio</a></main>
  );
  return (
    <main className="admin">
      <div className="top"><h1>{store.name} · Admin</h1><button className="chip" onClick={() => supabase.auth.signOut()}>Sair</button></div>
      <div className="chips">{tabs.map(([k, l]) => <button key={k} className={`chip ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === "pedidos" && <Orders />}
      {tab === "cardapio" && <Crud table="products" pk="id" order="sort" fields={[["name", "Nome", "text"], ["description", "Descrição", "text"], ["price", "Preço", "number"], ["category", "Categoria", "text"], ["image", "Imagem (URL)", "text"], ["sort", "Ordem", "number"], ["build", "Monte seu", "bool"], ["available", "Disponível", "bool"]]} blank={{ name: "", description: "", price: 0, category: "Açaí no copo", image: "/copo.jpg", sort: 99, build: false, available: true }} />}
      {tab === "cupons" && <Crud table="coupons" pk="code" order="code" fields={[["code", "Código", "text"], ["kind", "Tipo (percent/fixed/free_delivery)", "kind"], ["value", "Valor", "number"], ["min_order", "Pedido mínimo", "number"], ["max_uses", "Limite de usos", "number"], ["uses", "Usado", "readonly"], ["one_per_phone", "1 por telefone", "bool"], ["expires_at", "Vence em", "date"], ["active", "Ativo", "bool"]]} blank={{ code: "NOVO", kind: "percent", value: 10, min_order: 0, max_uses: null, one_per_phone: true, expires_at: null, active: true }} />}
      {tab === "motoboys" && <Crud table="couriers" pk="id" order="name" fields={[["name", "Nome", "text"], ["phone", "WhatsApp", "text"], ["active", "Ativo", "bool"]]} blank={{ name: "", phone: "", active: true }} />}
      {tab === "frete" && <Crud table="delivery_zones" pk="neighborhood" order="fee" fields={[["neighborhood", "Bairro", "text"], ["fee", "Taxa", "number"]]} blank={{ neighborhood: "Novo bairro", fee: 5 }} />}
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  return (
    <main className="wrap"><h1>Entrar no admin</h1>
      <input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} /><br /><br />
      <input type="password" placeholder="Senha" value={pw} onChange={(e) => setPw(e.target.value)} /><br /><br />
      <button className="btn full" onClick={async () => { const { error } = await supabase.auth.signInWithPassword({ email, password: pw }); setErr(error ? "E-mail ou senha incorretos" : ""); }}>Entrar</button>
      {err && <p className="err">{err}</p>}
    </main>
  );
}

type Field = [string, string, "text" | "number" | "bool" | "date" | "kind" | "readonly"];
type Row = Record<string, any>;

function Crud({ table, pk, order, fields, blank }: { table: string; pk: string; order: string; fields: Field[]; blank: Row }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => supabase.from(table).select("*").order(order).then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, [table]);
  const edit = (i: number, k: string, v: any) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v, _dirty: true } : row)));
  async function save(row: Row) {
    const { _dirty, _new, ...data } = row;
    if (table === "coupons") data.code = String(data.code).toUpperCase();
    const { error } = await supabase.from(table).upsert(data);
    setMsg(error ? `Erro: ${error.message}` : "Salvo"); if (!error) load();
  }
  async function remove(row: Row) {
    if (row._new) return setRows((r) => r.filter((x) => x !== row));
    if (!confirm("Excluir?")) return;
    const { error } = await supabase.from(table).delete().eq(pk, row[pk]);
    setMsg(error ? `Erro: ${error.message}` : "Excluído"); load();
  }
  const input = (row: Row, i: number, [k, , t]: Field) => {
    if (t === "readonly") return row[k] ?? 0;
    if (t === "bool") return <input type="checkbox" style={{ width: "auto" }} checked={!!row[k]} onChange={(e) => edit(i, k, e.target.checked)} />;
    if (t === "kind") return <select value={row[k]} onChange={(e) => edit(i, k, e.target.value)}><option value="percent">% desconto</option><option value="fixed">R$ desconto</option><option value="free_delivery">Frete grátis</option></select>;
    if (t === "date") return <input type="date" value={row[k] ? String(row[k]).slice(0, 10) : ""} onChange={(e) => edit(i, k, e.target.value ? `${e.target.value}T23:59:59-04:00` : null)} />;
    if (t === "number") return <input type="number" step="0.01" value={row[k] ?? ""} onChange={(e) => edit(i, k, e.target.value === "" ? null : Number(e.target.value))} />;
    return <input value={row[k] ?? ""} disabled={k === pk && !row._new && pk !== "id"} onChange={(e) => edit(i, k, e.target.value)} />;
  };
  return (
    <div>
      <button className="btn" onClick={() => setRows((r) => [{ ...blank, _new: true, _dirty: true }, ...r])}>+ Adicionar</button> <span className="okmsg">{msg}</span>
      <table style={{ marginTop: 10 }}><thead><tr>{fields.map(([, l]) => <th key={l}>{l}</th>)}<th /></tr></thead>
        <tbody>{rows.map((row, i) => <tr key={row[pk] ?? `n${i}`}>{fields.map((f) => <td key={f[0]}>{input(row, i, f)}</td>)}
          <td style={{ whiteSpace: "nowrap" }}><button className="btn" disabled={!row._dirty} onClick={() => save(row)}>Salvar</button> <button className="chip" onClick={() => remove(row)}>Excluir</button></td></tr>)}</tbody></table>
    </div>
  );
}

const flow = ["recebido", "preparo", "saiu", "entregue"];
const label: Record<string, string> = { recebido: "Recebido", preparo: "Em preparo", saiu: "Saiu", entregue: "Entregue", cancelado: "Cancelado" };

function Orders() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [couriers, setCouriers] = useState<Row[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [courier, setCourier] = useState("");
  const load = () => supabase.from("orders").select("*").not("status", "in", "(entregue,cancelado)").order("created_at").then(({ data }) => setOrders(data ?? []));
  useEffect(() => {
    load();
    supabase.from("couriers").select("*").eq("active", true).then(({ data }) => setCouriers(data ?? []));
    const ch = supabase.channel("orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
      if (p.eventType === "INSERT") new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(() => {});
      load();
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function setStatus(o: Row, status: string) {
    await supabase.from("orders").update({ status, status_times: { ...o.status_times, [status]: new Date().toISOString() } }).eq("id", o.id);
    load();
  }

  async function dispatch() {
    const c = couriers.find((x) => x.id === courier); if (!c) return alert("Escolha o motoboy");
    // Ordena por bairro (agrupa entregas próximas). Com lat/lng, troque por rota mais próxima.
    const sel = orders.filter((o) => picked.includes(o.id)).sort((a, b) => String(a.neighborhood).localeCompare(String(b.neighborhood)));
    if (!sel.length) return alert("Selecione os pedidos");
    const map = (o: Row) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsAddress(o.address, o.neighborhood))}`;
    const lines = sel.map((o, i) => `${i + 1}. ${orderCode(o.code)} · ${o.customer_name} · ${o.neighborhood}\n   ${o.address}\n   ${o.payment === "pix" ? "PAGO (Pix)" : `COBRAR ${brl(Number(o.total))} (${o.payment})`} · Tel ${o.customer_phone}\n   ${map(o)}\n   Confirmar: ${location.origin}/entrega/${o.id}`);
    const text = `Olá ${c.name}! Entregas (abra o link de cada uma e toque em "Peguei o pedido" e depois "Confirmar entrega"):\n\n${lines.join("\n\n")}`;
    window.open(waLink(c.phone, text), "_blank");
    const now = new Date().toISOString();
    for (const o of sel) await supabase.from("orders").update({ status: "saiu", courier_id: c.id, status_times: { ...o.status_times, saiu: now } }).eq("id", o.id);
    setPicked([]); load();
  }

  return (
    <div>
      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <b>Despachar selecionados:</b>
        <select style={{ maxWidth: 220 }} value={courier} onChange={(e) => setCourier(e.target.value)}><option value="">Motoboy</option>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="btn wa" onClick={dispatch}>Enviar no WhatsApp</button>
      </div>
      {orders.length === 0 && <p className="mut">Nenhum pedido em aberto.</p>}
      <table><thead><tr><th /><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{orders.map((o) => (
          <tr key={o.id}>
            <td>{o.mode === "entrega" && <input type="checkbox" style={{ width: "auto" }} checked={picked.includes(o.id)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, o.id] : p.filter((x) => x !== o.id))} />}</td>
            <td>{orderCode(o.code)}<div className="mut">{new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div></td>
            <td>{o.customer_name}<div className="mut">{o.customer_phone}</div><div className="mut">{o.mode === "entrega" ? `${o.neighborhood} · ${o.address}` : "Retirada"}</div></td>
            <td>{(o.items as Row[]).map((i, n) => <div key={n}>{i.qty}x {i.name}<div className="mut">{i.details}</div></div>)}</td>
            <td>{brl(Number(o.total))}<div className="mut">{o.payment}{o.coupon_code ? ` · ${o.coupon_code}` : ""}</div></td>
            <td><span className="tag">{label[o.status]}</span>{o.status === "saiu" && <div className="mut">{o.status_times?.coletado ? `Coletado ${new Date(o.status_times.coletado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Aguardando coleta"}</div>}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              {flow.indexOf(o.status) < 3 && (() => { const nx = flow[flow.indexOf(o.status) + 1] === "saiu" && o.mode === "retirada" ? "entregue" : flow[flow.indexOf(o.status) + 1];
                return <button className="btn" onClick={() => confirm(`Pedido ${orderCode(o.code)}: mudar para "${label[nx]}"?`) && setStatus(o, nx)}>{label[nx]}</button>; })()}{" "}
              <a className="chip" href={waLink(o.customer_phone)} target="_blank">Cliente</a>{" "}
              <button className="chip" onClick={() => confirm("Cancelar pedido?") && setStatus(o, "cancelado")}>Cancelar</button>
            </td>
          </tr>))}</tbody></table>
    </div>
  );
}
