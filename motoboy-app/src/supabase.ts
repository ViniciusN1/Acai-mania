import { createClient } from "@supabase/supabase-js";

// Mesmo projeto Supabase do site. Sem variáveis, usa os valores públicos que o site já usa como padrão.
const url = import.meta.env.VITE_SUPABASE_URL || "https://kvajcnetaedsfptrwsut.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_q14uUSbWkdqyVZY8X9rTXA_f-prZXsi";

export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "motoboy-auth" } });
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://acai-mania-iota.vercel.app").replace(/\/$/, "");
