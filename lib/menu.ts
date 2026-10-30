import { store } from "./store";

export type Product = { id: string; name: string; description: string; price: number; image: string; category: string; build?: boolean; available?: boolean };

/** Categorias padrão (usadas só se nenhum produto tiver categoria). As abas reais vêm dos produtos cadastrados. */
export const categories = ["Açaí no copo", "Marmitas", "Combos", "Bebidas"];

/** Categorias na ordem em que aparecem no cardápio */
export const categoriesOf = (products: Product[]) => {
  const list = [...new Set(products.map((p) => p.category).filter(Boolean))];
  return list.length ? list : categories;
};


// Tamanhos e acompanhamentos do "Monte seu açaí" vêm da configuração da loja (lib/store.ts)
export const sizes = store.sizes;
export const groups = store.groups;

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

import { supabase } from "./supabase";

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").eq("available", true).order("sort");
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, price: Number(p.price) }));
}

export async function fetchZones(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("delivery_zones").select("*").order("fee");
  if (error) throw error;
  const zones = Object.fromEntries((data ?? []).map((z) => [z.neighborhood, Number(z.fee)]));
  return Object.keys(zones).length ? zones : store.deliveryZonesFallback;
}
