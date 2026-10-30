import { createClient } from "@supabase/supabase-js";

// Valores públicos (URL + publishable key) como padrão, para o build nunca quebrar
// se as variáveis de ambiente não estiverem configuradas na Vercel.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kvajcnetaedsfptrwsut.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_q14uUSbWkdqyVZY8X9rTXA_f-prZXsi";

export const supabase = createClient(url, key);
