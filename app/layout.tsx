import "./globals.css";
import { CartProvider } from "@/lib/cart";
export const metadata = { title: "Açaí Mania · Delivery", description: "O melhor açaí de Aquidauana, na sua porta" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body><CartProvider>{children}</CartProvider></body></html>;
}
