# Delivery de açaí (white-label) · demo "Açaí Mania"

Site de pedidos (PWA) para açaiterias: cardápio, monte seu açaí, carrinho com cupom e frete por bairro, pedido pelo WhatsApp, acompanhamento do pedido, contas de cliente (`/registrar`, `/entrar`, `/conta`), painel admin (`/admin`: pedidos, cardápio, cupons, motoboys e frete) e página do motoboy (`/entrega/[id]`). Next.js 15 + Supabase.

## White-label

Toda a identidade da loja (nome, logo, cores, WhatsApp, endereço, horário, Pix, redes sociais, bairros/frete padrão, tamanhos do "monte seu açaí") fica em **`lib/store.ts`** e é lida de variáveis de ambiente `NEXT_PUBLIC_LOJA_*`. Sem variáveis, o site mostra a demo "Açaí Mania".

- Lista de variáveis: **`.env.example`**
- Passo a passo para colocar um cliente novo no ar: **`NOVO_CLIENTE.md`**
- Cada cliente precisa do **seu próprio projeto Supabase**. O banco embutido em `lib/supabase.ts` é só da demonstração.

## Rodar localmente
1. `cp .env.example .env.local` e preencha (ou deixe vazio para usar a demo).
2. `npm install` e `npm run dev`. Cliente em `/`, admin em `/admin`.
3. Banco novo: rode no SQL Editor do Supabase, nesta ordem, `supabase/schema.sql`, `supabase/roles.sql`, `supabase/entregas.sql`.

## Próximos passos
- Pix automático (Mercado Pago)
- Localização no mapa para rota por distância real
- Imagens enviadas pelo admin (Supabase Storage)
- Configurações da loja editáveis pelo admin (hoje via variáveis + redeploy)
