"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Profile = { id: string; full_name: string; phone: string; role: "cliente" | "admin" | "motoboy" };

/** Sessão + perfil do usuário logado. undefined = carregando. */
export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setProfile(null); setReady(session === null); return; }
    setReady(false);
    supabase.from("profiles").select("id, full_name, phone, role").eq("id", session.user.id).maybeSingle()
      .then(({ data }) => { setProfile((data as Profile) ?? null); setReady(true); });
  }, [session]);
  return { session, profile, loading: !ready };
}
