import { createClient } from "@supabase/supabase-js";

/**
 * Banco de dados (Supabase).
 *
 * CADA CLIENTE (loja) TEM O SEU PRÓPRIO PROJETO SUPABASE. Configure na Vercel:
 *   NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja NOVO_CLIENTE.md)
 *
 * Os valores abaixo são SÓ do projeto de DEMONSTRAÇÃO (loja "Açaí Mania"). Eles
 * existem para o build e a demo funcionarem sem variáveis. Nunca deixe uma loja
 * de cliente em produção usando o banco da demonstração: os pedidos dela iriam
 * para a demo.
 */
const DEMO_URL = "https://kvajcnetaedsfptrwsut.supabase.co";
const DEMO_KEY = "sb_publishable_q14uUSbWkdqyVZY8X9rTXA_f-prZXsi";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEMO_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEMO_KEY;

/** true quando o site está usando o banco da demonstração */
export const isDemoDatabase = url === DEMO_URL;

if (isDemoDatabase && process.env.NEXT_PUBLIC_LOJA_NOME && typeof window !== "undefined") {
  console.warn("[white-label] Loja configurada, mas sem NEXT_PUBLIC_SUPABASE_URL: usando o banco de DEMONSTRAÇÃO.");
}

export const supabase = createClient(url, key);
