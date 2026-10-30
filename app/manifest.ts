import type { MetadataRoute } from "next";
import { store } from "@/lib/store";

/** Manifesto do app instalável (PWA), gerado a partir da configuração da loja */
export default function manifest(): MetadataRoute.Manifest {
  const type = store.logo.endsWith(".png") ? "image/png" : store.logo.endsWith(".svg") ? "image/svg+xml" : "image/jpeg";
  return {
    name: `${store.name} · Delivery`,
    short_name: store.shortName,
    description: store.tagline,
    start_url: "/",
    display: "standalone",
    background_color: store.colors.background,
    theme_color: store.colors.primary,
    lang: "pt-BR",
    icons: [{ src: store.logo, sizes: "512x512", type, purpose: "any" }],
  };
}
