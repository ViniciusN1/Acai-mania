/**
 * Dados da loja usados nas telas (nome, logo, WhatsApp, cidade).
 * Na branch white-label este arquivo é substituído pela versão completa configurável por variáveis de ambiente.
 */
const digits = (v: string) => v.replace(/\D/g, "");
const wa = digits(process.env.NEXT_PUBLIC_WHATSAPP_LOJA || "5567993452339");

export const store = {
  name: "Açaí Mania",
  shortName: "Açaí Mania",
  tagline: "O melhor açaí de Aquidauana, na sua porta",
  logo: "/logo.jpg",
  heroImage: "/copo.jpg",
  colors: { primary: "#4A1259", accent: "#C2185B", background: "#F6EEF8" },
  whatsapp: wa.startsWith("55") ? wa : `55${wa}`,
  address: "",
  city: "Aquidauana - MS",
  hours: "Ter–Dom · 13h às 23h",
  pixKey: "",
  pixName: "",
  orderPrefix: "AM",
  minOrder: 0,
};

/** Número do pedido com o prefixo da loja: #AM-1A2B */
export const orderCode = (code: string) => `#${store.orderPrefix}-${code}`;

/** Endereço completo para o Google Maps (rua + bairro + cidade da loja) */
export const mapsAddress = (address?: string | null, neighborhood?: string | null) =>
  [address, neighborhood, store.city].filter(Boolean).join(", ");

/** Link de WhatsApp para um telefone brasileiro qualquer (cliente, motoboy) */
export const waLink = (phone: string, text?: string) => {
  const d = digits(String(phone)).replace(/^55/, "");
  return `https://wa.me/55${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};
