"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Registrar() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", phone: "", email: "", pw: "", pw2: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const phone = f.phone.replace(/\D/g, "");
    if (f.name.trim().length < 2) return setMsg({ ok: false, text: "Digite seu nome." });
    if (phone.length < 10) return setMsg({ ok: false, text: "Telefone com DDD, por favor." });
    if (f.pw.length < 6) return setMsg({ ok: false, text: "A senha precisa ter pelo menos 6 caracteres." });
    if (f.pw !== f.pw2) return setMsg({ ok: false, text: "As senhas não conferem." });
    setBusy(true);
    // O papel é sempre "cliente": quem vira admin é definido só no Supabase.
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.pw,
      options: { data: { full_name: f.name.trim(), phone }, emailRedirectTo: `${location.origin}/conta` },
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message.includes("registered") ? "Este e-mail já tem conta. Faça login." : "Não foi possível cadastrar. Tente de novo." });
    if (data.session) return router.push("/conta");
    setMsg({ ok: true, text: "Conta criada! Enviamos um link para o seu e-mail. Confirme e depois faça login." });
  }

  return (
    <main className="wrap">
      <div className="top"><Link className="chip" href="/">‹</Link><h1>Criar conta</h1><span /></div>
      <form className="card" onSubmit={go}>
        <label>Nome</label><input autoComplete="name" value={f.name} onChange={set("name")} required />
        <label>Telefone (WhatsApp)</label><input inputMode="tel" placeholder="(67) 99999-0000" value={f.phone} onChange={set("phone")} required />
        <label>E-mail</label><input type="email" autoComplete="email" value={f.email} onChange={set("email")} required />
        <label>Senha</label><input type="password" autoComplete="new-password" value={f.pw} onChange={set("pw")} required />
        <label>Repita a senha</label><input type="password" autoComplete="new-password" value={f.pw2} onChange={set("pw2")} required />
        <br /><br /><button className="btn full" disabled={busy}>{busy ? "Criando..." : "Criar conta"}</button>
        {msg && <p className={msg.ok ? "okmsg" : "err"}>{msg.text}</p>}
      </form>
      <p className="mut" style={{ textAlign: "center" }}>Já tem conta? <Link href="/entrar">Entrar</Link></p>
    </main>
  );
}
