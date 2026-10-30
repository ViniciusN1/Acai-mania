"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) return setErr(error.message.includes("confirm") ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos.");
    router.push("/conta");
  }
  return (
    <main className="wrap">
      <div className="top"><Link className="chip" href="/">‹</Link><h1>Entrar</h1><span /></div>
      <form className="card" onSubmit={go}>
        <label>E-mail</label><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Senha</label><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <br /><br /><button className="btn full" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
        {err && <p className="err">{err}</p>}
      </form>
      <p className="mut" style={{ textAlign: "center" }}>Ainda não tem conta? <Link href="/registrar">Cadastre-se</Link></p>
    </main>
  );
}
