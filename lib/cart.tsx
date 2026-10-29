"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type CartItem = { key: string; name: string; details: string; unitPrice: number; qty: number; image: string };
type Ctx = { items: CartItem[]; add: (i: Omit<CartItem, "key" | "qty">, qty?: number) => void; setQty: (key: string, qty: number) => void; clear: () => void; subtotal: number; count: number };

const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => { const s = localStorage.getItem("cart"); if (s) setItems(JSON.parse(s)); }, []);
  useEffect(() => { localStorage.setItem("cart", JSON.stringify(items)); }, [items]);

  const add: Ctx["add"] = (i, qty = 1) => setItems((prev) => {
    const key = `${i.name}|${i.details}`;
    const found = prev.find((p) => p.key === key);
    return found ? prev.map((p) => (p.key === key ? { ...p, qty: p.qty + qty } : p)) : [...prev, { ...i, key, qty }];
  });
  const setQty = (key: string, qty: number) => setItems((prev) => qty <= 0 ? prev.filter((p) => p.key !== key) : prev.map((p) => (p.key === key ? { ...p, qty } : p)));
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  return <CartContext.Provider value={{ items, add, setQty, clear: () => setItems([]), subtotal, count }}>{children}</CartContext.Provider>;
}

export const useCart = () => { const c = useContext(CartContext); if (!c) throw new Error("CartProvider ausente"); return c; };
