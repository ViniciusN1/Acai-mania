/**
 * Configuração da loja (white-label).
 *
 * TODA a identidade da loja fica aqui. Cada cliente (açaiteria) define as
 * variáveis NEXT_PUBLIC_LOJA_* na Vercel (veja .env.example e NOVO_CLIENTE.md).
 * Os valores padrão abaixo são os da loja de demonstração "Açaí Mania".
 *
 * Variáveis NEXT_PUBLIC_* são embutidas no build: depois de mudar na Vercel,
 * faça um novo deploy (Redeploy) para aparecer no site.
 */

const env = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);
const num = (v: string | undefined, fallback: number) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return v && v.trim() && Number.isFinite(n) ? n : fallback;
};
const digits = (v: string) => v.replace(/\D/g, "");

/** "Centro:4, Alto:5" -> { Centro: 4, Alto: 5 } */
function parsePairs(v: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of v.split(/[;,\n]/)) {
    const i = part.lastIndexOf(":");
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    const n = Number(part.slice(i + 1).trim().replace(",", "."));
    if (k && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function parseJson<T>(v: string | undefined, fallback: T): T {
  if (!v || !v.trim()) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

// ===== Padrões da loja de demonstração =====
const DEMO = {
  name: "Açaí Mania",
  tagline: "O melhor açaí de Aquidauana, na sua porta",
  city: "Aquidauana - MS",
  whatsapp: "5567993452339",
  hours: "Ter–Dom · 13h às 23h",
  orderPrefix: "AM",
  sizes: "330ml:10, 440ml:13, 550ml:16",
  zones: "Centro:4, Alto:5, Serraria:5, Vila Pinheiro:6, Guanandy:6, Outro:8",
};

const name = env(process.env.NEXT_PUBLIC_LOJA_NOME, DEMO.name);
const whatsappRaw = digits(env(process.env.NEXT_PUBLIC_LOJA_WHATSAPP || process.env.NEXT_PUBLIC_WHATSAPP_LOJA, DEMO.whatsapp));

export const store = {
  /** Nome que aparece no topo, no título da aba e no app instalado */
  name,
  /** Nome curto do app instalado (PWA), até ~12 letras */
  shortName: env(process.env.NEXT_PUBLIC_LOJA_NOME_CURTO, name.length <= 12 ? name : name.slice(0, 12)),
  tagline: env(process.env.NEXT_PUBLIC_LOJA_SLOGAN, name === DEMO.name ? DEMO.tagline : "Peça seu açaí online, direto da loja"),
  /** Logo e imagem do banner: caminho em /public ou URL completa */
  logo: env(process.env.NEXT_PUBLIC_LOJA_LOGO, "/logo.jpg"),
  heroImage: env(process.env.NEXT_PUBLIC_LOJA_BANNER, "/copo.jpg"),

  colors: {
    /** Cor principal (fundo do banner, botões de categoria) */
    primary: env(process.env.NEXT_PUBLIC_LOJA_COR_PRIMARIA, "#4A1259"),
    /** Cor de destaque (botões, preços) */
    accent: env(process.env.NEXT_PUBLIC_LOJA_COR_DESTAQUE, "#C2185B"),
    /** Cor de fundo das páginas */
    background: env(process.env.NEXT_PUBLIC_LOJA_COR_FUNDO, "#F6EEF8"),
  },

  /** WhatsApp da loja, só números com DDI 55 (ex.: 5567999990000) */
  whatsapp: whatsappRaw.startsWith("55") ? whatsappRaw : `55${whatsappRaw}`,
  /** Endereço da loja (aparece no rodapé) */
  address: env(process.env.NEXT_PUBLIC_LOJA_ENDERECO, ""),
  /** Cidade usada nas rotas do Google Maps do motoboy */
  city: env(process.env.NEXT_PUBLIC_LOJA_CIDADE, DEMO.city),
  hours: env(process.env.NEXT_PUBLIC_LOJA_HORARIO, DEMO.hours),

  /** Chave Pix mostrada no acompanhamento do pedido (vazio = não mostra) */
  pixKey: env(process.env.NEXT_PUBLIC_LOJA_PIX_CHAVE, ""),
  pixName: env(process.env.NEXT_PUBLIC_LOJA_PIX_NOME, ""),

  social: {
    instagram: env(process.env.NEXT_PUBLIC_LOJA_INSTAGRAM, ""),
    facebook: env(process.env.NEXT_PUBLIC_LOJA_FACEBOOK, ""),
    site: env(process.env.NEXT_PUBLIC_LOJA_SITE, ""),
  },

  /** Prefixo do número do pedido, ex.: AM -> #AM-1A2B */
  orderPrefix: env(process.env.NEXT_PUBLIC_LOJA_PREFIXO_PEDIDO, DEMO.orderPrefix).toUpperCase(),

  /**
   * Bairros e taxas de entrega. A fonte principal é a tabela delivery_zones
   * (editável no /admin > Frete). Esta lista só é usada se a tabela estiver vazia.
   * Formato: "Centro:4, Alto:5"
   */
  deliveryZonesFallback: parsePairs(env(process.env.NEXT_PUBLIC_LOJA_BAIRROS, DEMO.zones)),
  /** Pedido mínimo para entrega (0 = sem mínimo) */
  minOrder: num(process.env.NEXT_PUBLIC_LOJA_PEDIDO_MINIMO, 0),

  /** Tamanhos do "Monte seu açaí". Formato: "330ml:10, 440ml:13" */
  sizes: Object.entries(parsePairs(env(process.env.NEXT_PUBLIC_LOJA_TAMANHOS, DEMO.sizes))).map(([label, price]) => ({ id: label, label, price })),
  /** Acompanhamentos do "Monte seu açaí" (JSON opcional, veja .env.example) */
  groups: parseJson(process.env.NEXT_PUBLIC_LOJA_ACOMPANHAMENTOS, [
    { id: "frutas", label: "Frutas", max: 3, options: ["Banana", "Morango", "Kiwi", "Uva"] },
    { id: "coberturas", label: "Coberturas", max: 2, options: ["Leite condensado", "Calda de chocolate", "Mel", "Calda de morango"] },
    { id: "complementos", label: "Complementos", max: 4, options: ["Granola", "Leite em pó", "Paçoca", "Confete"] },
  ] as { id: string; label: string; max: number; options: string[] }[]),
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

/** Link do Instagram a partir de @usuario ou URL */
export const instagramUrl = (v: string) => (!v ? "" : v.startsWith("http") ? v : `https://instagram.com/${v.replace(/^@/, "")}`);
