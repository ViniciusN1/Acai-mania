import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, SITE_URL } from "./supabase";
import { haversineKm, km, nearestNeighbor, type LatLng } from "./geo";
import { THEMES, applyTheme } from "./themes";
import MapView, { type Pin } from "./MapView";

/* ===================== Tipos ===================== */
type Courier = { id: string; name: string; phone: string; avatar_url: string; theme: string; theme_mode: string; active: boolean; user_id: string };
type Order = {
  id: string; code: string; created_at: string; status: string; status_times: Record<string, string>; courier_id: string | null;
  customer_name: string; customer_phone: string; address: string | null; neighborhood: string | null; total: number; payment: string;
  items: { name: string; qty: number; details?: string }[]; lat: number | null; lng: number | null;
  customer_live_lat: number | null; customer_live_lng: number | null;
};
type Stats = { today: number; week: number; month: number; total: number; bonus_today: number; bonus_week: number; bonus_month: number; bonus_total: number; bonus_per_delivery: number };
type RankRow = { courier_id: string; name: string; avatar_url: string; deliveries: number; bonus: number; is_me: boolean };

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PREFIX = import.meta.env.VITE_ORDER_PREFIX || "AM";
const code = (c: string) => `#${PREFIX}-${c}`;
const digits = (s: string) => String(s ?? "").replace(/\D/g, "");
const wa = (phone: string, text?: string) => `https://wa.me/55${digits(phone).replace(/^55/, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
const CITY = import.meta.env.VITE_CITY || "Aquidauana - MS";
const statusLabel: Record<string, string> = { recebido: "Na fila da loja", preparo: "Em preparo", saiu: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado" };
const destOf = (o: Order): LatLng | null =>
  o.customer_live_lat != null && o.customer_live_lng != null ? { lat: o.customer_live_lat, lng: o.customer_live_lng }
  : o.lat != null && o.lng != null ? { lat: o.lat, lng: o.lng } : null;
const addrText = (o: Order) => [o.address, o.neighborhood, CITY].filter(Boolean).join(", ");
const vibrate = (ms = 30) => { try { navigator.vibrate?.(ms); } catch { /* sem vibração */ } };

/* ===================== App ===================== */
export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Splash />;
  if (!session) return <Login />;
  return <Gate session={session} />;
}

function Splash() { return <div className="center"><img src="/logo.jpg" alt="" className="logo-big" /><p className="mut">Carregando...</p></div>; }

/* ===================== Login / cadastro ===================== */
function Login() {
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [f, setF] = useState({ email: "", pw: "", name: "", phone: "" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setMsg(null);
    if (mode === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.pw });
      if (error) setMsg({ ok: false, t: "E-mail ou senha incorretos." });
    } else {
      if (f.pw.length < 6) { setBusy(false); return setMsg({ ok: false, t: "A senha precisa ter pelo menos 6 caracteres." }); }
      const { data, error } = await supabase.auth.signUp({ email: f.email.trim(), password: f.pw, options: { data: { full_name: f.name.trim(), phone: digits(f.phone) } } });
      if (error) setMsg({ ok: false, t: error.message.includes("registered") ? "Este e-mail já tem conta. Entre com ele." : "Não foi possível criar a conta." });
      else setMsg({ ok: true, t: data.session ? "Conta criada! Agora peça ao dono da loja para liberar seu acesso de motoboy." : "Conta criada! Confirme pelo link enviado ao seu e-mail e peça ao dono da loja para liberar seu acesso." });
    }
    setBusy(false);
  }
  return (
    <main className="login">
      <img src="/logo.jpg" alt="Açaí Mania" className="logo-big" />
      <h1>App do Motoboy</h1>
      <p className="mut">Entregas, rota inteligente e ranking com bônus.</p>
      <div className="seg"><button className={mode === "entrar" ? "on" : ""} onClick={() => setMode("entrar")}>Entrar</button><button className={mode === "criar" ? "on" : ""} onClick={() => setMode("criar")}>Criar conta</button></div>
      <form className="card" onSubmit={(e) => { e.preventDefault(); go(); }}>
        {mode === "criar" && <><label>Nome</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
          <label>WhatsApp</label><input value={f.phone} inputMode="tel" placeholder="(67) 99999-0000" onChange={(e) => setF({ ...f, phone: e.target.value })} /></>}
        <label>E-mail</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required />
        <label>Senha</label><input type="password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} autoComplete={mode === "entrar" ? "current-password" : "new-password"} required />
        <button className="btn full" disabled={busy} style={{ marginTop: 16 }}>{busy ? "Aguarde..." : mode === "entrar" ? "Entrar" : "Criar conta"}</button>
        {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}
      </form>
    </main>
  );
}

/* ===================== Verifica se é motoboy ===================== */
function Gate({ session }: { session: Session }) {
  const [courier, setCourier] = useState<Courier | null | undefined>(undefined);
  const load = useCallback(async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle(),
      supabase.from("couriers").select("*").eq("user_id", session.user.id).maybeSingle(),
    ]);
    const ok = p && ["motoboy", "admin"].includes(p.role) && c && c.active;
    setCourier(ok ? (c as Courier) : null);
    if (ok) applyTheme(c.theme || "acai", c.theme_mode || "claro");
  }, [session.user.id]);
  useEffect(() => { load(); }, [load]);
  if (courier === undefined) return <Splash />;
  if (!courier) return (
    <main className="login">
      <img src="/logo.jpg" alt="" className="logo-big" />
      <h1>Aguardando liberação</h1>
      <p className="mut">Sua conta <b>{session.user.email}</b> ainda não está liberada como motoboy. Peça ao dono da loja para te liberar no painel (aba Motoboys).</p>
      <button className="btn full" onClick={load}>Já fui liberado, verificar</button>
      <button className="btn ghost full" style={{ marginTop: 10 }} onClick={() => supabase.auth.signOut()}>Sair</button>
    </main>
  );
  return <Main me={courier} setMe={setCourier as (c: Courier) => void} uid={session.user.id} />;
}

/* ===================== Tela principal ===================== */
function Main({ me, setMe, uid }: { me: Courier; setMe: (c: Courier) => void; uid: string }) {
  const [tab, setTab] = useState<"inicio" | "ranking" | "perfil">("inicio");
  const [orders, setOrders] = useState<Order[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [pos, setPos] = useState<(LatLng & { acc: number }) | null>(null);
  const [sharing, setSharing] = useState(false);
  const [gpsMsg, setGpsMsg] = useState("");
  const [store, setStore] = useState<LatLng>({ lat: -20.4739, lng: -55.7821 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [toast, setToast] = useState("");
  const watchId = useRef<number | null>(null);
  const lastPing = useRef(0);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const chans = useRef(new Map<string, ReturnType<typeof supabase.channel>>());
  const prevAvail = useRef<Set<string>>(new Set());
  const loadedOnce = useRef(false);

  const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2600); };

  const loadOrders = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").eq("mode", "entrega").in("status", ["recebido", "preparo", "saiu"]).order("created_at");
    const list = (data ?? []) as Order[];
    // aviso de pedido novo disponível
    const avail = new Set(list.filter((o) => !o.courier_id).map((o) => o.id));
    if (loadedOnce.current && [...avail].some((id) => !prevAvail.current.has(id))) { vibrate(200); say("Novo pedido disponível!"); }
    prevAvail.current = avail; loadedOnce.current = true;
    setOrders(list);
  }, []);
  const loadStats = useCallback(() => supabase.rpc("courier_my_stats").then(({ data }) => data?.[0] && setStats(data[0] as Stats)), []);

  useEffect(() => {
    loadOrders(); loadStats();
    supabase.from("settings").select("store_lat, store_lng").eq("id", 1).maybeSingle().then(({ data }) => data && setStore({ lat: data.store_lat, lng: data.store_lng }));
    const ch = supabase.channel("motoboy-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders()).subscribe();
    const t = setInterval(loadOrders, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [loadOrders, loadStats]);

  const mine = useMemo(() => orders.filter((o) => o.courier_id === me.id), [orders, me.id]);
  const available = useMemo(() => orders.filter((o) => !o.courier_id), [orders]);
  const route = useMemo(() => nearestNeighbor(pos ?? store, mine, destOf), [pos, store, mine]);
  const onTheWay = mine.filter((o) => o.status === "saiu");

  // Canais de broadcast para os clientes acompanharem (um por pedido a caminho)
  useEffect(() => {
    const want = new Set(onTheWay.map((o) => o.id));
    for (const id of want) if (!chans.current.has(id)) chans.current.set(id, supabase.channel(`pedido-${id}`).subscribe());
    for (const [id, ch] of chans.current) if (!want.has(id)) { supabase.removeChannel(ch); chans.current.delete(id); }
  }, [onTheWay.map((o) => o.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { for (const ch of chans.current.values()) supabase.removeChannel(ch); }, []);

  const send = useCallback(async (p: GeolocationPosition) => {
    const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
    setPos(c);
    if (Date.now() - lastPing.current < 7000) return; // throttle ~7s
    lastPing.current = Date.now();
    const at = new Date().toISOString();
    for (const ch of chans.current.values()) ch.send({ type: "broadcast", event: "motoboy", payload: { lat: c.lat, lng: c.lng, at } });
    const { error } = await supabase.rpc("courier_ping", { p_lat: c.lat, p_lng: c.lng, p_accuracy: c.acc, p_heading: p.coords.heading, p_speed: p.coords.speed });
    setGpsMsg(error ? "Sem conexão: tentando de novo..." : `Enviado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
  }, []);

  async function startGps() {
    if (!navigator.geolocation) return setGpsMsg("Este aparelho não tem GPS no navegador.");
    setGpsMsg("Ligando GPS...");
    watchId.current = navigator.geolocation.watchPosition((p) => { setSharing(true); send(p); },
      (e) => { setGpsMsg(e.code === 1 ? "Permissão de localização negada. Libere nas configurações." : "GPS sem sinal, tentando..."); if (e.code === 1) stopGps(); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
    try { wake.current = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* sem wake lock */ }
    localStorage.setItem("motoboy-gps", "1");
  }
  function stopGps(clear = true) {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null; setSharing(false); setGpsMsg("GPS desligado");
    wake.current?.release().catch(() => {}); wake.current = null;
    if (clear) { supabase.rpc("courier_stop_sharing"); localStorage.removeItem("motoboy-gps"); }
  }
  useEffect(() => {
    if (localStorage.getItem("motoboy-gps") === "1") startGps();
    // ao voltar para a tela, pede o wake lock de novo (o navegador solta quando a tela apaga)
    const vis = () => { if (document.visibilityState === "visible" && watchId.current != null && !wake.current) startWakeOnly(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); stopGps(false); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function startWakeOnly() { try { wake.current = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* */ } }

  async function step(o: Order, s: "coletado" | "entregue") {
    if (s === "entregue" && !confirm(`Confirmar que o pedido ${code(o.code)} foi entregue para ${o.customer_name}?`)) return;
    vibrate();
    const { data, error } = await supabase.rpc("courier_app_step", { order_id: o.id, p_step: s });
    if (error) return say("Erro de conexão. Tente de novo.");
    if (data !== "ok") return say(String(data));
    let ch = chans.current.get(o.id);
    if (!ch && s === "coletado") { ch = supabase.channel(`pedido-${o.id}`).subscribe(); chans.current.set(o.id, ch); }
    ch?.send({ type: "broadcast", event: "status", payload: { status: s } });
    say(s === "entregue" ? `Entregue! +${brl(stats?.bonus_per_delivery ?? 0.25)} de bônus 🎉` : "Coleta confirmada. Boa entrega!");
    if (s === "coletado" && !sharing) startGps();
    loadOrders(); loadStats();
  }
  async function claim(o: Order) {
    vibrate();
    const { data, error } = await supabase.rpc("courier_claim", { order_id: o.id });
    say(error ? "Erro de conexão." : data === "ok" ? `Pedido ${code(o.code)} é seu!` : String(data));
    loadOrders();
  }

  function googleRoute() {
    const stops = route.stops.map(({ item }) => { const d = destOf(item); return d ? `${d.lat},${d.lng}` : addrText(item); });
    if (!stops.length) return;
    const origin = pos ? `${pos.lat},${pos.lng}` : "";
    const dest = stops[stops.length - 1];
    const way = stops.slice(0, -1).slice(0, 9);
    const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving${origin ? `&origin=${encodeURIComponent(origin)}` : ""}&destination=${encodeURIComponent(dest)}${way.length ? `&waypoints=${encodeURIComponent(way.join("|"))}` : ""}`;
    window.open(url, "_blank");
  }

  const pins: Pin[] = [
    { id: "loja", kind: "loja", lat: store.lat, lng: store.lng, label: "Loja" },
    ...route.stops.flatMap(({ item }, i) => { const d = destOf(item); return d ? [{ id: item.id, kind: "entrega" as const, lat: d.lat, lng: d.lng, num: i + 1, label: `${i + 1}. ${code(item.code)} · ${item.customer_name}` }] : []; }),
    ...(pos ? [{ id: "eu", kind: "eu" as const, lat: pos.lat, lng: pos.lng, label: "Você", image: me.avatar_url || undefined }] : []),
  ];

  return (
    <div className="app">
      {tab === "inicio" && <>
        <header className="hdr">
          <button className="avatar-btn" onClick={() => setTab("perfil")} aria-label="Perfil">{me.avatar_url ? <img src={me.avatar_url} alt="" /> : <span>{me.name.slice(0, 1).toUpperCase()}</span>}</button>
          <div className="hdr-t"><b>Olá, {me.name.split(" ")[0]}!</b><span className={`gps ${sharing ? "on" : ""}`}><i />{sharing ? "GPS ligado · ao vivo" : "GPS desligado"}</span></div>
          <button className={`btn small ${sharing ? "ghost" : ""}`} onClick={() => (sharing ? stopGps() : startGps())}>{sharing ? "Pausar" : "Ligar GPS"}</button>
        </header>
        <div className="mapwrap">
          <MapView pins={pins} fitKey={`${route.stops.map((s) => s.item.id).join(",")}|${pos ? 1 : 0}`} />
          <div className="statstrip">
            <div><b>{stats?.today ?? 0}</b><span>hoje</span></div>
            <div><b>{stats?.week ?? 0}</b><span>semana</span></div>
            <div><b>{stats?.total ?? 0}</b><span>total</span></div>
            <div><b>{brl(stats?.bonus_week ?? 0)}</b><span>bônus semana</span></div>
          </div>
          <button className="fab" onClick={() => setDrawer(true)} aria-label="Abrir pedidos">
            📦 Pedidos <span className="pill">{mine.length}</span>{available.length > 0 && <span className="pill alt">+{available.length}</span>}
          </button>
          {gpsMsg && <div className="gpsmsg">{gpsMsg}</div>}
        </div>
        <Drawer open={drawer} onClose={() => setDrawer(false)} route={route} available={available} pos={pos} store={store}
          onStep={step} onClaim={claim} onGoogle={googleRoute} onRefresh={loadOrders} />
      </>}
      {tab === "ranking" && <Ranking stats={stats} />}
      {tab === "perfil" && <Profile me={me} uid={uid} onSaved={(c) => { setMe(c); say("Perfil salvo!"); }} />}

      <nav className="tabs">
        {([["inicio", "🗺️", "Entregas"], ["ranking", "🏆", "Ranking"], ["perfil", "👤", "Perfil"]] as const).map(([k, ic, l]) =>
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><span>{ic}</span>{l}</button>)}
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ===================== Painel lateral (direita) ===================== */
function Drawer({ open, onClose, route, available, pos, store, onStep, onClaim, onGoogle, onRefresh }: {
  open: boolean; onClose: () => void; route: { stops: { item: Order; leg: number | null }[]; total: number }; available: Order[];
  pos: LatLng | null; store: LatLng; onStep: (o: Order, s: "coletado" | "entregue") => void; onClaim: (o: Order) => void; onGoogle: () => void; onRefresh: () => void;
}) {
  const [view, setView] = useState<"minhas" | "disponiveis">("minhas");
  const [openId, setOpenId] = useState("");
  // Fecha arrastando para a direita
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const from = pos ?? store;
  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`} style={dx > 0 ? { transform: `translateX(${dx}px)`, transition: "none" } : undefined}
        onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
        onTouchMove={(e) => { if (startX.current != null) setDx(Math.max(0, e.touches[0].clientX - startX.current)); }}
        onTouchEnd={() => { if (dx > 90) onClose(); setDx(0); startX.current = null; }}
        aria-hidden={!open}>
        <div className="drawer-h">
          <b>Pedidos</b>
          <button className="icon" onClick={onRefresh} aria-label="Atualizar">⟳</button>
          <button className="icon" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="seg" style={{ margin: "0 14px 10px" }}>
          <button className={view === "minhas" ? "on" : ""} onClick={() => setView("minhas")}>Minha rota ({route.stops.length})</button>
          <button className={view === "disponiveis" ? "on" : ""} onClick={() => setView("disponiveis")}>Disponíveis ({available.length})</button>
        </div>
        <div className="drawer-b">
          {view === "minhas" && <>
            {route.stops.length === 0 && <p className="mut empty">Nenhuma entrega com você agora. Veja as disponíveis ou aguarde a loja atribuir.</p>}
            {route.stops.length > 0 && <div className="routesum">
              <div><b>{route.stops.length} {route.stops.length === 1 ? "parada" : "paradas"}</b><span className="mut"> · {km(route.total)} no total{pos ? " a partir de você" : " a partir da loja"}</span></div>
              <button className="btn small" onClick={onGoogle}>Abrir no Google Maps</button>
            </div>}
            {route.stops.map(({ item: o, leg }, i) => (
              <OrderCard key={o.id} o={o} n={i + 1} leg={leg} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? "" : o.id)}>
                {o.status !== "saiu" || !o.status_times?.coletado
                  ? <button className="btn full" onClick={() => onStep(o, "coletado")}>✋ Peguei o pedido</button>
                  : <button className="btn full okbtn" onClick={() => onStep(o, "entregue")}>✅ Confirmar entrega</button>}
                <div className="row3">
                  <a className="btn ghost small" target="_blank" rel="noreferrer" href={destOf(o) ? `https://www.google.com/maps/dir/?api=1&destination=${destOf(o)!.lat},${destOf(o)!.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addrText(o))}`}>Rota</a>
                  <a className="btn ghost small" href={`tel:${o.customer_phone}`}>Ligar</a>
                  <a className="btn ghost small" target="_blank" rel="noreferrer" href={wa(o.customer_phone, `Olá ${o.customer_name.split(" ")[0]}! Sou o motoboy do seu pedido ${code(o.code)}.`)}>WhatsApp</a>
                </div>
                <a className="mut tiny" href={`${SITE_URL}/entrega/${o.id}`} target="_blank" rel="noreferrer">Abrir página da entrega</a>
              </OrderCard>
            ))}
          </>}
          {view === "disponiveis" && <>
            {available.length === 0 && <p className="mut empty">Nenhum pedido sem motoboy agora.</p>}
            {available.map((o) => {
              const d = destOf(o);
              return <OrderCard key={o.id} o={o} leg={d ? haversineKm(from, d) : null} legLabel="de você" open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? "" : o.id)} hidePhone>
                <button className="btn full" onClick={() => onClaim(o)}>Pegar esta entrega</button>
              </OrderCard>;
            })}
          </>}
        </div>
      </aside>
    </>
  );
}

function OrderCard({ o, n, leg, legLabel = "do anterior", open, onToggle, hidePhone, children }: {
  o: Order; n?: number; leg: number | null; legLabel?: string; open: boolean; onToggle: () => void; hidePhone?: boolean; children: React.ReactNode;
}) {
  const pago = o.payment === "pix";
  return (
    <div className="ocard">
      <button className="ocard-h" onClick={onToggle}>
        {n != null && <span className="num">{n}</span>}
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div className="oline"><b>{o.customer_name}</b><span className="mut">{code(o.code)}</span></div>
          <div className="mut ell">{o.address || "Sem endereço"}{o.neighborhood ? ` · ${o.neighborhood}` : ""}</div>
          <div className="chips2">
            <span className={`tagx ${pago ? "ok" : "warn"}`}>{pago ? "Pago (Pix)" : `Cobrar ${brl(o.total)} · ${o.payment}`}</span>
            <span className="tagx">{leg != null ? `${km(leg)} ${legLabel}` : "sem localização"}</span>
            <span className="tagx">{o.status === "saiu" && o.status_times?.coletado ? "A caminho" : statusLabel[o.status]}</span>
            {o.customer_live_lat != null && <span className="tagx ok">Cliente ao vivo</span>}
          </div>
        </div>
        <span className="chev">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="ocard-b">
        <div className="items">{o.items.map((i, k) => <div key={k}>{i.qty}x {i.name}{i.details && <span className="mut"> · {i.details}</span>}</div>)}</div>
        {!hidePhone && <div className="mut tiny">Tel: {o.customer_phone}</div>}
        {children}
      </div>}
    </div>
  );
}

/* ===================== Ranking ===================== */
function Ranking({ stats }: { stats: Stats | null }) {
  const [period, setPeriod] = useState("semana");
  const [rows, setRows] = useState<RankRow[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => { supabase.rpc("courier_ranking", { p_period: period }).then(({ data, error }) => { setRows((data ?? []) as RankRow[]); setErr(error ? "Ranking indisponível no momento." : ""); }); }, [period]);
  const myBonus = period === "hoje" ? stats?.bonus_today : period === "semana" ? stats?.bonus_week : period === "mes" ? stats?.bonus_month : stats?.bonus_total;
  const myCount = period === "hoje" ? stats?.today : period === "semana" ? stats?.week : period === "mes" ? stats?.month : stats?.total;
  return (
    <main className="page">
      <h1>Ranking</h1>
      <div className="hero">
        <div><span>Suas entregas</span><b>{myCount ?? 0}</b></div>
        <div><span>Seu bônus</span><b>{brl(myBonus ?? 0)}</b></div>
        <small>{brl(stats?.bonus_per_delivery ?? 0.25)} por entrega concluída</small>
      </div>
      <div className="seg">{[["hoje", "Hoje"], ["semana", "Semana"], ["mes", "Mês"], ["total", "Total"]].map(([k, l]) => <button key={k} className={period === k ? "on" : ""} onClick={() => setPeriod(k)}>{l}</button>)}</div>
      {err && <p className="err">{err}</p>}
      <div className="card" style={{ padding: 6 }}>
        {rows.map((r, i) => (
          <div key={r.courier_id} className={`rank ${r.is_me ? "me" : ""}`}>
            <span className="pos">{Number(r.deliveries) > 0 && i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
            {r.avatar_url ? <img src={r.avatar_url} alt="" /> : <span className="av">{r.name.slice(0, 1)}</span>}
            <div style={{ flex: 1, minWidth: 0 }}><b>{r.name}{r.is_me ? " (você)" : ""}</b><div className="mut tiny">{brl(Number(r.bonus))} de bônus</div></div>
            <b className="cnt">{r.deliveries}</b>
          </div>))}
        {rows.length === 0 && !err && <p className="mut empty">Sem entregas no período.</p>}
      </div>
    </main>
  );
}

/* ===================== Perfil ===================== */
function Profile({ me, uid, onSaved }: { me: Courier; uid: string; onSaved: (c: Courier) => void }) {
  const [f, setF] = useState({ name: me.name, phone: me.phone, avatar_url: me.avatar_url || "", theme: me.theme || "acai", theme_mode: me.theme_mode || "claro" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { applyTheme(f.theme, f.theme_mode); }, [f.theme, f.theme_mode]);

  async function upload(file: File) {
    setBusy(true); setMsg("Enviando foto...");
    const blob = await shrink(file).catch(() => file);
    const path = `${uid}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    setBusy(false);
    if (error) return setMsg("Não deu para enviar a foto. Você pode colar o link de uma imagem.");
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setF((x) => ({ ...x, avatar_url: data.publicUrl })); setMsg("Foto pronta. Toque em Salvar.");
  }
  async function save() {
    setBusy(true);
    const { data, error } = await supabase.rpc("courier_update_profile", { p_name: f.name, p_phone: f.phone, p_avatar_url: f.avatar_url, p_theme: f.theme, p_theme_mode: f.theme_mode });
    setBusy(false);
    if (error) return setMsg("Erro ao salvar. Tente de novo.");
    setMsg(""); onSaved(data as Courier);
  }
  return (
    <main className="page">
      <h1>Meu perfil</h1>
      <div className="card prof">
        <label className="avatar-up">
          {f.avatar_url ? <img src={f.avatar_url} alt="" /> : <span>{f.name.slice(0, 1).toUpperCase() || "🛵"}</span>}
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <em>Trocar foto</em>
        </label>
        <label>Nome</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label>WhatsApp</label><input value={f.phone} inputMode="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <label>Ou link da foto</label><input value={f.avatar_url} placeholder="https://..." onChange={(e) => setF({ ...f, avatar_url: e.target.value })} />
      </div>
      <h3>Tema</h3>
      <div className="themes">{THEMES.map((t) => (
        <button key={t.id} className={`theme ${f.theme === t.id ? "on" : ""}`} onClick={() => setF({ ...f, theme: t.id })}>
          <span style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.accent})` }} />{t.name}</button>))}</div>
      <div className="seg" style={{ marginTop: 12 }}>
        <button className={f.theme_mode === "claro" ? "on" : ""} onClick={() => setF({ ...f, theme_mode: "claro" })}>☀️ Claro</button>
        <button className={f.theme_mode === "escuro" ? "on" : ""} onClick={() => setF({ ...f, theme_mode: "escuro" })}>🌙 Escuro</button>
      </div>
      <button className="btn full" style={{ marginTop: 16 }} disabled={busy} onClick={save}>{busy ? "Salvando..." : "Salvar perfil"}</button>
      {msg && <p className="mut" style={{ textAlign: "center" }}>{msg}</p>}
      <button className="btn ghost full" style={{ marginTop: 10 }} onClick={() => { supabase.rpc("courier_stop_sharing").then(() => supabase.auth.signOut()); }}>Sair</button>
      <p className="mut tiny" style={{ textAlign: "center", marginTop: 16 }}>Dica: instale este app na tela inicial (menu do navegador › Adicionar à tela inicial) e mantenha a tela ligada durante as entregas para o GPS continuar enviando.</p>
    </main>
  );
}

/** Reduz a foto para no máximo 512px antes de enviar */
function shrink(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 512 / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("falha"))), "image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
