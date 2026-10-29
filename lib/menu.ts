export type Product = { id: string; name: string; description: string; price: number; image: string; category: string; build?: boolean; available?: boolean };

export const categories = ["Açaí no copo", "Marmitas", "Combos", "Bebidas"];


export const sizes = [
  { id: "330", label: "330ml", price: 10 },
  { id: "440", label: "440ml", price: 13 },
  { id: "550", label: "550ml", price: 16 },
];

export const groups = [
  { id: "frutas", label: "Frutas", max: 3, options: ["Banana", "Morango", "Kiwi", "Uva"] },
  { id: "coberturas", label: "Coberturas", max: 2, options: ["Leite condensado", "Calda de chocolate", "Mel", "Calda de morango"] },
  { id: "complementos", label: "Complementos", max: 4, options: ["Granola", "Leite em pó", "Paçoca", "Confete"] },
];


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
  return Object.fromEntries((data ?? []).map((z) => [z.neighborhood, Number(z.fee)]));
}
