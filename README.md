# Açaí Mania · Delivery

Cardápio, monte seu açaí, carrinho com cupom e frete por bairro, acompanhamento do pedido e painel admin (pedidos, cardápio, cupons, motoboys e frete). Next.js + Supabase.

## Como rodar
1. Crie um projeto no Supabase e rode `supabase/schema.sql` no SQL Editor.
2. Em Authentication > Users, crie o usuário da loja (e-mail e senha).
3. Copie `.env.example` para `.env.local` e preencha.
4. `npm install` e `npm run dev`. Cliente em `/`, admin em `/admin`.
5. Deploy grátis na Vercel com as mesmas variáveis.

## Próximos passos
- Pix automático (Mercado Pago) e chave Pix no acompanhamento
- Localização no mapa para rota por distância real
- Imagens enviadas pelo admin (Supabase Storage)
