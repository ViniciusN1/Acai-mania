import "leaflet/dist/leaflet.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/lib/cart";
import { store } from "@/lib/store";

export const metadata: Metadata = {
  title: `${store.name} · Delivery`,
  description: store.tagline,
  applicationName: store.name,
  appleWebApp: { capable: true, title: store.shortName, statusBarStyle: "default" },
  icons: { icon: store.logo, apple: store.logo },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: store.colors.primary };

// Cores da loja (lib/store.ts) aplicadas por cima das cores padrão do globals.css
const theme = { "--roxo": store.colors.primary, "--mag": store.colors.accent, "--bg": store.colors.background } as React.CSSProperties;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR" style={theme}><body><CartProvider>{children}</CartProvider></body></html>;
}
