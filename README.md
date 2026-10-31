# Delivery de açaí (white-label) · demo "Açaí Mania"

> **Branch white-label.** Toda a identidade da loja (nome, logo, cores, WhatsApp, endereço, horário, Pix, redes sociais, bairros/frete padrão, tamanhos do "monte seu açaí") fica em **`lib/store.ts`**, lida de variáveis `NEXT_PUBLIC_LOJA_*` (lista em **`.env.example`**; passo a passo em **`NOVO_CLIENTE.md`**). Cada cliente precisa do **seu próprio projeto Supabase**: o banco embutido em `lib/supabase.ts` é só da demonstração. No app do motoboy, use `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` do projeto do cliente, `VITE_ORDER_PREFIX` e `VITE_CITY`.

Monorepo simples com dois apps no mesmo projeto Supabase:

| Pasta | App | Tecnologia | Para quem |
|---|---|---|---|
| `/` (raiz) | Site de pedidos + painel `/admin` | Next.js 15 + React 19 | Clientes e dono da loja |
| `motoboy-app/` | App do motoboy (PWA instalável) | React + Vite + TypeScript | Motoboys |

Funções: cardápio, monte seu açaí, carrinho com cupom e frete por bairro, endereço com GPS/mapa, acompanhamento do pedido com mapa ao vivo, painel admin (pedidos, mapa ao vivo, cardápio, cupons, motoboys, ranking e bônus, frete) e app do motoboy (rota inteligente, GPS ao vivo, coleta/entrega, ranking com bônus, perfil com tema).

---

## 1. Banco de dados: SQLs na ordem

Rode no **Supabase › SQL Editor**, um arquivo por vez, **nesta ordem**. Os arquivos novos (04, 05, 06) podem ser rodados mais de uma vez sem problema.

| # | Arquivo | O que faz |
|---|---|---|
| 1 | `supabase/schema.sql` | Pedidos, motoboys, cardápio, cupons, frete *(já rodado)* |
| 2 | `supabase/roles.sql` | Perfis e papéis cliente/admin *(já rodado)* |
| 3 | `supabase/entregas.sql` | RPC `courier_step` da página `/entrega/[id]` *(já rodado)* |
| 4 | `supabase/04_localizacao.sql` | `lat/lng` no pedido, localização ao vivo do cliente, tabela `settings` (bônus por corrida e posição da loja) |
| 5 | `supabase/05_motoboys.sql` | Papel `motoboy`, vínculo `couriers.user_id`, perfil/tema/foto, `courier_locations` (GPS ao vivo + RLS + Realtime), RPCs do app, bucket `avatars` |
| 6 | `supabase/06_ranking_bonus.sql` | Bônus gravado por entrega, contador e ranking (`courier_my_stats`, `courier_ranking`) |

> Se o site novo for publicado antes dos SQLs 04–06, ele continua funcionando: o pedido é enviado sem coordenadas e o mapa simplesmente não aparece. Rode os SQLs para ativar tudo.

Depois do 04, abra **/admin › Ranking e bônus** e ajuste a **posição da loja** (latitude/longitude; dá para usar o botão "Usar minha posição" estando na loja) e o **bônus por entrega** (padrão R$ 0,25).

### Segurança (RLS) da localização
- Motoboy grava/lê só a **própria** posição (`courier_ping`).
- Cliente logado lê só a posição do motoboy do **seu** pedido a caminho; o acompanhamento sem login usa a RPC `get_order_tracking(id)`, que só devolve nome (primeiro nome), foto e posição do motoboy **enquanto o pedido está "saiu"**.
- Admin lê tudo.
- O ranking expõe apenas primeiro nome, foto, contagem e bônus dos outros motoboys.

---

## 2. Transformar um usuário em motoboy

**Pelo painel (recomendado):**
1. O motoboy abre o app do motoboy e toca em **Criar conta** (nome, WhatsApp, e-mail, senha).
2. No `/admin › Motoboys`, digite o e-mail em **Dar acesso ao app do motoboy** e toque em **Tornar motoboy**. Se já existir um cadastro antigo com o mesmo WhatsApp, ele é vinculado (mantém histórico).

**Pelo SQL Editor:**
```sql
-- 1) papel
update public.profiles set role = 'motoboy'
 where id = (select id from auth.users where email = 'motoboy@exemplo.com');

-- 2a) vincular a um cadastro de motoboy que já existe
update public.couriers set user_id = (select id from auth.users where email = 'motoboy@exemplo.com'), active = true
 where id = 'ID_DO_MOTOBOY_NA_TABELA_COURIERS';

-- 2b) ou criar o cadastro já vinculado
insert into public.couriers (name, phone, active, user_id)
select 'Nome do Motoboy', '67999990000', true, id from auth.users where email = 'motoboy@exemplo.com';
```
Para tirar o acesso: `/admin › Motoboys › Tirar acesso` (o histórico de entregas fica).

---

## 3. Site (Next.js) – rodar e publicar

```bash
npm install
npm run dev        # http://localhost:3000  (cliente em /, admin em /admin)
npm run build
```
Variáveis (Vercel › Settings › Environment Variables), todas opcionais (há fallback público):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_WHATSAPP_LOJA`
- `NOMINATIM_EMAIL` – e-mail de contato enviado ao Nominatim (OpenStreetMap), recomendado pelas regras de uso.

O endereço do carrinho usa a rota `/api/geo` (proxy do Nominatim, com cache e limite de 1 req/s).

---

## 4. App do motoboy – rodar e publicar

```bash
cd motoboy-app
npm install
npm run dev        # http://localhost:5174
npm run build      # gera motoboy-app/dist
```

### Deploy na Vercel (novo projeto, mesmo repositório)
1. Vercel › **Add New… › Project** › importe `ViniciusN1/Acai-mania` de novo.
2. **Root Directory:** `motoboy-app`  ·  **Framework Preset:** `Vite`  ·  Build: `npm run build`  ·  Output: `dist`.
3. **Environment Variables** (opcionais, há fallback para o projeto atual):
   - `VITE_SUPABASE_URL` = `https://kvajcnetaedsfptrwsut.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = a mesma publishable/anon key do site
   - `VITE_SITE_URL` = `https://acai-mania-iota.vercel.app` (link "página da entrega")
   - `VITE_ORDER_PREFIX` = `AM` (opcional) · `VITE_CITY` = `Aquidauana - MS` (opcional)
4. Deploy. Abra no celular e use **Adicionar à tela inicial** para instalar (PWA).
5. Supabase › Authentication › URL Configuration: adicione a URL do app do motoboy em **Redirect URLs** (para o link de confirmação de e-mail, se estiver ligado).

### O que o app faz
- Login e-mail/senha; só entra quem tem `profiles.role = 'motoboy'` (ou admin) com cadastro ativo em `couriers`.
- Mapa (OpenStreetMap) com loja, você e as entregas numeradas.
- **Painel lateral à direita** (botão "Pedidos", fecha arrastando para a direita): *Minha rota* e *Disponíveis* (pegar entrega).
- **Rota inteligente**: vizinho mais próximo (haversine) a partir do seu GPS; mostra a distância de cada trecho e o total; botão abre a rota com várias paradas no Google Maps (até 10 paradas).
- **GPS ao vivo**: `watchPosition` + envio a cada ~7 s (`courier_ping`) e broadcast em tempo real para a tela do cliente; mantém a tela ligada (Wake Lock) quando o navegador permite.
- **Peguei o pedido / Confirmar entrega** (`courier_app_step`, com login, só nos pedidos do próprio motoboy).
- Contador (hoje, semana, total), **ranking** (hoje/semana/mês/total) e **bônus** acumulado.
- **Perfil**: nome, WhatsApp, foto (upload no bucket `avatars` ou link) e tema (7 cores + claro/escuro), salvos no perfil.

---

## 5. Admin – novidades
- **Pedidos**: coluna Motoboy para **atribuir** o pedido a um motoboy cadastrado (aparece no app dele) e botão **WhatsApp do motoboy** com o número do cadastro dele. O despacho em lote abre o WhatsApp **do motoboy selecionado** e ordena a rota pela entrega mais próxima da loja.
- **Mapa ao vivo**: posição dos motoboys e destinos dos pedidos a caminho.
- **Motoboys**: cadastro, WhatsApp, ativo, dar/tirar acesso ao app.
- **Ranking e bônus**: valor por corrida, posição da loja, ranking e bônus a pagar por período.

## Limitações conhecidas
- **GPS em segundo plano**: navegador/PWA para de enviar a posição quando a tela apaga ou o app vai para segundo plano (principalmente no iPhone). O app pede para manter a tela ligada (Wake Lock) e retoma ao voltar. GPS contínuo com tela apagada exige app nativo.
- **Nominatim** (busca de endereço): limite de 1 requisição/segundo e precisão variável em ruas pequenas; por isso o cliente pode arrastar o pino.
- Google Maps aceita até ~10 paradas por link.
- Motoboy logado consegue ler os pedidos *disponíveis* (sem motoboy) para poder pegá-los; o telefone do cliente só aparece na tela depois de pegar.
