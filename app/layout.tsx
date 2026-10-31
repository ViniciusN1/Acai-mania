import "leaflet/dist/leaflet.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/lib/cart";

export const metadata: Metadata = { title: "Açaí Mania · Delivery", description: "O melhor açaí de Aquidauana, na sua porta" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#4A1259" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body><CartProvider>{children}</CartProvider></body></html>;
}
