"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/menu";
import { useAuth } from "@/lib/auth";
import dynamic from "next/dynamic";
import { store, waLink, mapsAddress, orderCode } from "@/lib/store";
import { haversineKm, km } from "@/lib/geo";
import type { MapPin } from "@/components/LiveMap";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false, loading: () => <div className="map" style={{ height: 420 }} /> });

type Tab = "pedidos" | "mapa" | "cardapio" | "cupons" | "motoboys" | "ranking" | "frete";
const tabs: [Tab, string][] = [["pedidos", "Pedidos"], ["mapa", "Mapa ao vivo"], ["cardapio", "Cardápio"], ["cupons", "Cupons"], ["motoboys", "Motoboys"], ["ranking", "Ranking e bônus"], ["frete", "Frete"]];

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
      {tab === "motoboys" && <Couriers />}
      {tab === "mapa" && <LiveCouriers />}
      {tab === "ranking" && <Ranking />}
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
  const [storePos, setStorePos] = useState({ lat: -20.4739, lng: -55.7821 });
  const load = () => supabase.from("orders").select("*").not("status", "in", "(entregue,cancelado)").order("created_at").then(({ data }) => setOrders(data ?? []));
  useEffect(() => {
    load();
    supabase.from("couriers").select("*").eq("active", true).order("name").then(({ data }) => setCouriers(data ?? []));
    supabase.from("settings").select("store_lat, store_lng").eq("id", 1).maybeSingle().then(({ data }) => data && setStorePos({ lat: data.store_lat, lng: data.store_lng }));
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

  /** Ordena as entregas pela mais próxima (a partir da loja), depois a mais próxima da anterior. Sem coordenadas: por bairro. */
  function routeOrder(sel: Row[]) {
    const withGeo = sel.filter((o) => o.lat != null && o.lng != null), noGeo = sel.filter((o) => o.lat == null || o.lng == null);
    const out: Row[] = []; let from = storePos; const left = [...withGeo];
    while (left.length) {
      let bi = 0, bd = Infinity;
      left.forEach((o, i) => { const d = haversineKm(from, { lat: o.lat, lng: o.lng }); if (d < bd) { bd = d; bi = i; } });
      const [nx] = left.splice(bi, 1); out.push(nx); from = { lat: nx.lat, lng: nx.lng };
    }
    return [...out, ...noGeo.sort((a, b) => String(a.neighborhood).localeCompare(String(b.neighborhood)))];
  }
  const mapLink = (o: Row) => o.lat != null && o.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsAddress(o.address, o.neighborhood))}`;

  async function dispatch() {
    const c = couriers.find((x) => x.id === courier); if (!c) return alert("Escolha o motoboy cadastrado");
    const phone = String(c.phone ?? "").replace(/\D/g, "");
    if (phone.length < 10) return alert(`O motoboy ${c.name} está sem WhatsApp no cadastro. Preencha na aba Motoboys.`);
    const sel = routeOrder(orders.filter((o) => picked.includes(o.id)));
    if (!sel.length) return alert("Selecione os pedidos");
    const lines = sel.map((o, i) => `${i + 1}. ${orderCode(o.code)} · ${o.customer_name} · ${o.neighborhood ?? ""}\n   ${o.address ?? ""}\n   ${o.payment === "pix" ? "PAGO (Pix)" : `COBRAR ${brl(Number(o.total))} (${o.payment})`} · Tel ${o.customer_phone}\n   ${mapLink(o)}\n   Confirmar: ${location.origin}/entrega/${o.id}`);
    const text = `Olá ${c.name}! Entregas em ordem de rota (no app do motoboy elas já aparecem para você; ou abra o link de cada uma e toque em "Peguei o pedido" e depois "Confirmar entrega"):\n\n${lines.join("\n\n")}`;
    // Abre o WhatsApp do motoboy CADASTRADO selecionado (número do cadastro dele)
    window.open(waLink(phone, text), "_blank");
    const now = new Date().toISOString();
    for (const o of sel) await supabase.from("orders").update({ status: "saiu", courier_id: c.id, status_times: { ...o.status_times, saiu: o.status_times?.saiu ?? now } }).eq("id", o.id);
    setPicked([]); load();
  }

  /** Só atribui (sem mudar o status): o pedido aparece no app do motoboy */
  async function assign(o: Row, courierId: string) {
    const { error } = await supabase.from("orders").update({ courier_id: courierId || null }).eq("id", o.id);
    if (error) alert(`Erro: ${error.message}`); load();
  }
  const courierOf = (o: Row) => couriers.find((c) => c.id === o.courier_id);

  return (
    <div>
      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b>Despachar selecionados ({picked.length}):</b>
        <select style={{ maxWidth: 260 }} value={courier} onChange={(e) => setCourier(e.target.value)}><option value="">Motoboy cadastrado</option>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : " · sem WhatsApp"}</option>)}</select>
        <button className="btn wa" onClick={dispatch} disabled={!courier}>Enviar no WhatsApp do motoboy</button>
        <span className="mut">A rota é ordenada pela entrega mais próxima da loja, depois a mais próxima da anterior.</span>
      </div>
      {orders.length === 0 && <p className="mut">Nenhum pedido em aberto.</p>}
      <div className="tablewrap"><table><thead><tr><th /><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th><th>Motoboy</th><th>Ações</th></tr></thead>
        <tbody>{orders.map((o) => (
          <tr key={o.id}>
            <td>{o.mode === "entrega" && <input type="checkbox" style={{ width: "auto" }} checked={picked.includes(o.id)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, o.id] : p.filter((x) => x !== o.id))} />}</td>
            <td>{orderCode(o.code)}<div className="mut">{new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div></td>
            <td>{o.customer_name}<div className="mut">{o.customer_phone}</div><div className="mut">{o.mode === "entrega" ? `${o.neighborhood} · ${o.address}` : "Retirada"}</div>{o.mode === "entrega" && <a className="mut" href={mapLink(o)} target="_blank" rel="noreferrer">{o.lat != null ? "📍 no mapa (GPS)" : "📍 mapa"}</a>}</td>
            <td>{(o.items as Row[]).map((i, n) => <div key={n}>{i.qty}x {i.name}<div className="mut">{i.details}</div></div>)}</td>
            <td>{brl(Number(o.total))}<div className="mut">{o.payment}{o.coupon_code ? ` · ${o.coupon_code}` : ""}</div></td>
            <td><span className="tag">{label[o.status]}</span>{o.status === "saiu" && <div className="mut">{o.status_times?.coletado ? `Coletado ${new Date(o.status_times.coletado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Aguardando coleta"}</div>}</td>
            <td>{o.mode === "entrega" && <>
              <select value={o.courier_id ?? ""} onChange={(e) => assign(o, e.target.value)} style={{ minWidth: 130 }}><option value="">Sem motoboy</option>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              {courierOf(o)?.phone && <a className="chip" style={{ marginTop: 4 }} target="_blank" rel="noreferrer"
                href={waLink(courierOf(o)!.phone, `Olá ${courierOf(o)!.name}! Pedido ${orderCode(o.code)} · ${o.customer_name} · ${o.address ?? ""} ${o.neighborhood ?? ""}\n${mapLink(o)}\nConfirmar: ${location.origin}/entrega/${o.id}`)}>WhatsApp do motoboy</a>}</>}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              {flow.indexOf(o.status) < 3 && (() => { const nx = flow[flow.indexOf(o.status) + 1] === "saiu" && o.mode === "retirada" ? "entregue" : flow[flow.indexOf(o.status) + 1];
                return <button className="btn" onClick={() => confirm(`Pedido ${orderCode(o.code)}: mudar para "${label[nx]}"?`) && setStatus(o, nx)}>{label[nx]}</button>; })()}{" "}
              <a className="chip" href={waLink(o.customer_phone)} target="_blank" rel="noreferrer">Cliente</a>{" "}
              <button className="chip" onClick={() => confirm("Cancelar pedido?") && setStatus(o, "cancelado")}>Cancelar</button>
            </td>
          </tr>))}</tbody></table></div>
    </div>
  );
}

/* ===================== Motoboys (cadastro + conta do app) ===================== */
function Couriers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [nf, setNf] = useState({ email: "", name: "", phone: "" });
  const load = () => supabase.from("couriers").select("*").order("name").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);
  const edit = (i: number, k: string, v: unknown) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v, _dirty: true } : row)));
  async function save(row: Row) {
    const { _dirty, _new, ...d } = row;
    const data = { id: d.id, name: d.name, phone: String(d.phone ?? "").replace(/\D/g, ""), active: d.active };
    const { error } = d.id ? await supabase.from("couriers").update(data).eq("id", d.id) : await supabase.from("couriers").insert({ name: data.name, phone: data.phone, active: data.active });
    setMsg(error ? `Erro: ${error.message}` : "Salvo"); if (!error) load();
  }
  async function makeCourier() {
    if (!nf.email.includes("@")) return setMsg("Informe o e-mail da conta do motoboy.");
    const { data, error } = await supabase.rpc("admin_make_courier", { p_email: nf.email.trim(), p_name: nf.name.trim(), p_phone: nf.phone });
    setMsg(error ? `Erro: ${error.message} (rodou o 05_motoboys.sql?)` : data === "ok" ? `${nf.email} agora é motoboy e já pode entrar no app.` : String(data));
    if (!error && data === "ok") { setNf({ email: "", name: "", phone: "" }); load(); }
  }
  async function unlink(row: Row) {
    if (!confirm(`Tirar o acesso de ${row.name} ao app do motoboy? O histórico de entregas é mantido.`)) return;
    const { error } = await supabase.rpc("admin_unlink_courier", { p_courier_id: row.id });
    setMsg(error ? `Erro: ${error.message}` : "Acesso removido"); load();
  }
  async function remove(row: Row) {
    if (row._new) return setRows((r) => r.filter((x) => x !== row));
    if (!confirm(`Excluir ${row.name}? Prefira desmarcar "Ativo" para manter o histórico.`)) return;
    const { error } = await supabase.from("couriers").delete().eq("id", row.id);
    setMsg(error ? `Erro: ${error.message}` : "Excluído"); load();
  }
  return (
    <div>
      <div className="card">
        <b>Dar acesso ao app do motoboy</b>
        <div className="mut">1) O motoboy cria a conta no app do motoboy (ou em /registrar) com e-mail e senha. 2) Informe o e-mail abaixo. Se já houver um cadastro com o mesmo WhatsApp, ele é vinculado.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <input style={{ maxWidth: 260 }} placeholder="E-mail da conta" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} />
          <input style={{ maxWidth: 200 }} placeholder="Nome (opcional)" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
          <input style={{ maxWidth: 180 }} placeholder="WhatsApp (opcional)" value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} />
          <button className="btn" onClick={makeCourier}>Tornar motoboy</button>
        </div>
      </div>
      <button className="btn" onClick={() => setRows((r) => [{ name: "", phone: "", active: true, _new: true, _dirty: true }, ...r])}>+ Cadastro sem app</button> <span className="okmsg">{msg}</span>
      <div className="tablewrap"><table style={{ marginTop: 10 }}><thead><tr><th>Foto</th><th>Nome</th><th>WhatsApp</th><th>Ativo</th><th>App</th><th /></tr></thead>
        <tbody>{rows.map((row, i) => <tr key={row.id ?? `n${i}`}>
          <td>{row.avatar_url ? <img src={row.avatar_url} alt="" width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover" }} /> : "🛵"}</td>
          <td><input value={row.name ?? ""} onChange={(e) => edit(i, "name", e.target.value)} /></td>
          <td><input value={row.phone ?? ""} inputMode="tel" onChange={(e) => edit(i, "phone", e.target.value)} />{row.phone && <a className="mut" href={waLink(row.phone)} target="_blank" rel="noreferrer">abrir WhatsApp</a>}</td>
          <td><input type="checkbox" style={{ width: "auto", minHeight: 0 }} checked={!!row.active} onChange={(e) => edit(i, "active", e.target.checked)} /></td>
          <td>{row.user_id ? <><span className="tag">Com conta</span> <button className="chip" onClick={() => unlink(row)}>Tirar acesso</button></> : <span className="mut">Sem conta</span>}</td>
          <td style={{ whiteSpace: "nowrap" }}><button className="btn" disabled={!row._dirty} onClick={() => save(row)}>Salvar</button> <button className="chip" onClick={() => remove(row)}>Excluir</button></td>
        </tr>)}</tbody></table></div>
    </div>
  );
}

/* ===================== Mapa ao vivo dos motoboys ===================== */
function LiveCouriers() {
  const [locs, setLocs] = useState<Row[]>([]);
  const [couriers, setCouriers] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [st, setSt] = useState({ lat: -20.4739, lng: -55.7821 });
  const [now, setNow] = useState(Date.now());
  const load = () => {
    supabase.from("courier_locations").select("*").then(({ data }) => setLocs(data ?? []));
    supabase.from("orders").select("id, code, customer_name, lat, lng, status, courier_id").eq("status", "saiu").then(({ data }) => setOrders(data ?? []));
  };
  useEffect(() => {
    load();
    supabase.from("couriers").select("id, name, phone, avatar_url").then(({ data }) => setCouriers(data ?? []));
    supabase.from("settings").select("store_lat, store_lng").eq("id", 1).maybeSingle().then(({ data }) => data && setSt({ lat: data.store_lat, lng: data.store_lng }));
    const ch = supabase.channel("admin-locs").on("postgres_changes", { event: "*", schema: "public", table: "courier_locations" }, load).subscribe();
    const t = setInterval(() => { load(); setNow(Date.now()); }, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, []);
  const name = (id: string) => couriers.find((c) => c.id === id)?.name ?? "Motoboy";
  const pins: MapPin[] = [{ id: "loja", kind: "loja", lat: st.lat, lng: st.lng, label: "Loja" },
    ...locs.map((l) => ({ id: `m-${l.courier_id}`, kind: "motoboy" as const, lat: l.lat, lng: l.lng, label: name(l.courier_id), image: couriers.find((c) => c.id === l.courier_id)?.avatar_url || undefined })),
    ...orders.filter((o) => o.lat != null).map((o) => ({ id: `o-${o.id}`, kind: "cliente" as const, lat: o.lat, lng: o.lng, label: `${orderCode(o.code)} · ${o.customer_name}` }))];
  return (
    <div>
      <div className="card" style={{ padding: 8 }}><LiveMap pins={pins} height={420} fitKey={String(locs.length + orders.length)} /></div>
      {locs.length === 0 && <p className="mut">Nenhum motoboy compartilhando localização agora. A posição aparece quando o motoboy está com o app aberto e o GPS ligado.</p>}
      {locs.map((l) => { const min = Math.round((now - new Date(l.updated_at).getTime()) / 60000); const o = orders.find((x) => x.id === l.order_id);
        return <div key={l.courier_id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div><b>{name(l.courier_id)}</b><div className="mut">{o ? `Levando ${orderCode(o.code)} · ${o.customer_name}${o.lat != null ? ` · faltam ${km(haversineKm({ lat: l.lat, lng: l.lng }, { lat: o.lat, lng: o.lng }))}` : ""}` : "Sem pedido a caminho"}</div></div>
          <span className="mut">{min <= 1 ? "agora" : `há ${min} min`}</span></div>; })}
    </div>
  );
}

/* ===================== Ranking e bônus ===================== */
function Ranking() {
  const [period, setPeriod] = useState("semana");
  const [rows, setRows] = useState<Row[]>([]);
  const [cfg, setCfg] = useState<Row | null>(null);
  const [msg, setMsg] = useState("");
  const load = () => supabase.rpc("courier_ranking", { p_period: period }).then(({ data, error }) => { setRows(data ?? []); if (error) setMsg(`Erro: ${error.message} (rodou o 06_ranking_bonus.sql?)`); });
  useEffect(() => { load(); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { supabase.from("settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setCfg(data)); }, []);
  async function saveCfg() {
    if (!cfg) return;
    const { error } = await supabase.from("settings").update({ bonus_per_delivery: Number(cfg.bonus_per_delivery), store_lat: Number(cfg.store_lat), store_lng: Number(cfg.store_lng), store_address: cfg.store_address ?? "", updated_at: new Date().toISOString() }).eq("id", 1);
    setMsg(error ? `Erro: ${error.message}` : "Configuração salva. O novo valor vale para as próximas entregas."); load();
  }
  const total = rows.reduce((s, r) => s + Number(r.bonus), 0);
  return (
    <div>
      <div className="card">
        <b>Configuração</b>
        {!cfg ? <p className="mut">Rode o arquivo supabase/04_localizacao.sql para criar as configurações.</p> :
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 6 }}>
            <div><label>Bônus por entrega (R$)</label><input type="number" step="0.05" min="0" style={{ width: 130 }} value={cfg.bonus_per_delivery ?? 0.25} onChange={(e) => setCfg({ ...cfg, bonus_per_delivery: e.target.value })} /></div>
            <div><label>Loja · latitude</label><input type="number" step="0.000001" style={{ width: 150 }} value={cfg.store_lat ?? ""} onChange={(e) => setCfg({ ...cfg, store_lat: e.target.value })} /></div>
            <div><label>Loja · longitude</label><input type="number" step="0.000001" style={{ width: 150 }} value={cfg.store_lng ?? ""} onChange={(e) => setCfg({ ...cfg, store_lng: e.target.value })} /></div>
            <button className="chip" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setCfg({ ...cfg, store_lat: p.coords.latitude.toFixed(6), store_lng: p.coords.longitude.toFixed(6) }))}>📍 Usar minha posição (estando na loja)</button>
            <button className="btn" onClick={saveCfg}>Salvar</button>
          </div>}
        {msg && <div className="okmsg">{msg}</div>}
      </div>
      <div className="chips">{[["hoje", "Hoje"], ["semana", "Semana"], ["mes", "Mês"], ["total", "Total"]].map(([k, l]) => <button key={k} className={`chip ${period === k ? "on" : ""}`} onClick={() => setPeriod(k)}>{l}</button>)}</div>
      <div className="tablewrap"><table><thead><tr><th>#</th><th>Motoboy</th><th>Entregas</th><th>Bônus a pagar</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.courier_id}><td>{i === 0 && Number(r.deliveries) > 0 ? "🥇" : i === 1 && Number(r.deliveries) > 0 ? "🥈" : i === 2 && Number(r.deliveries) > 0 ? "🥉" : i + 1}</td>
          <td>{r.name}</td><td>{r.deliveries}</td><td>{brl(Number(r.bonus))}</td></tr>)}
          <tr><td /><td><b>Total</b></td><td><b>{rows.reduce((s, r) => s + Number(r.deliveries), 0)}</b></td><td><b>{brl(total)}</b></td></tr></tbody></table></div>
      <p className="mut">O bônus de cada entrega fica gravado no momento em que ela é concluída; mudar o valor não altera entregas passadas.</p>
    </div>
  );
}
