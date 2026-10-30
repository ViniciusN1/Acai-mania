# Novo cliente: colocar uma açaiteria no ar em menos de 1 hora

Cada loja tem **o seu próprio projeto Supabase** (banco, logins e pedidos separados) e **o seu próprio projeto na Vercel** (site e domínio), usando o mesmo código deste repositório (branch `white-label`). Nada de uma loja aparece na outra.

> O banco que já vem no código (`lib/supabase.ts`) é **só da demonstração Açaí Mania**. Se você esquecer as variáveis do Supabase, os pedidos do cliente cairiam na demo. Sempre configure o passo 4.

## Antes de começar (pedir ao dono da loja)

- [ ] Nome da loja, slogan (opcional) e horário de funcionamento
- [ ] Logo (de preferência quadrada, PNG ou JPG, 512x512) e uma foto para o banner
- [ ] Cores da marca (se não souber, tire da logo)
- [ ] WhatsApp que recebe os pedidos, endereço da loja e cidade
- [ ] Chave Pix e nome do recebedor
- [ ] Instagram/Facebook (opcional)
- [ ] Bairros atendidos e a taxa de entrega de cada um; pedido mínimo (se tiver)
- [ ] Cardápio: produtos, descrições, preços, categorias e fotos; tamanhos do "Monte seu açaí" e acompanhamentos
- [ ] Motoboys: nome e WhatsApp de cada um
- [ ] E-mail do dono (vai ser o admin)
- [ ] Domínio próprio, se quiser (ex.: `pedidos.acaidobairro.com.br`)

Tempo estimado: ~10 min Supabase, ~10 min Vercel, ~5 min domínio, 20–30 min cardápio.

---

## 1. Criar o projeto no Supabase (≈5 min)

1. Entre em <https://supabase.com/dashboard> e clique em **New project**.
2. Nome: o da loja (ex.: `acai-do-bairro`). Região: **South America (São Paulo)**. Guarde a senha do banco num lugar seguro.
3. Espere o projeto terminar de criar.
4. Em **Authentication > Sign In / Providers > Email**: deixe o e-mail ativo. Para os clientes da loja conseguirem se cadastrar sem precisar confirmar e-mail, desligue **Confirm email** (ou mantenha ligado e configure o SMTP depois).
5. Em **Authentication > URL Configuration**, coloque em **Site URL** o endereço final da loja (pode ajustar depois do passo 5/6).

## 2. Rodar os scripts SQL, NESTA ORDEM (≈3 min)

No Supabase, abra **SQL Editor > New query**, cole o conteúdo de cada arquivo e clique em **Run**:

1. `supabase/schema.sql`: tabelas de pedidos, cardápio, cupons e frete, mais dados de exemplo.
2. `supabase/roles.sql`: papéis cliente/admin e regras de segurança.
   - A última linha tenta promover `EMAIL_DO_DONO@exemplo.com`. Pode rodar assim mesmo; o admin é feito no passo 3.
3. `supabase/entregas.sql`: confirmação de coleta/entrega pelo motoboy.

Rode cada um **uma vez só**, num projeto novo e vazio (o `schema.sql` não pode ser rodado duas vezes: as regras de segurança já existiriam). Se der erro, não siga para o próximo: anote a mensagem e corrija antes.

## 3. Criar e promover o admin (≈3 min)

1. Crie a conta do dono: **Authentication > Users > Add user > Create new user** (e-mail + senha, marque *Auto Confirm User*). Ou peça para ele se cadastrar em `/registrar` depois do deploy.
2. No **SQL Editor**, rode trocando o e-mail:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'dono@exemplo.com');
   ```

3. Confira: `select p.role, u.email from public.profiles p join auth.users u on u.id = p.id;` deve mostrar `admin` no e-mail do dono.

Admin só se cria pelo SQL; ninguém vira admin pelo site.

## 4. Pegar as chaves do Supabase (≈1 min)

**Project Settings > API** (ou **Data API / API Keys**):

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Chave **anon / publishable** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

⚠️ Nunca use a chave `service_role` / `secret` no site.

## 5. Deploy na Vercel (≈10 min)

1. Em <https://vercel.com/new>, importe o repositório `ViniciusN1/Acai-mania`.
2. **Project Name**: o da loja (ex.: `acai-do-bairro`).
3. **Production Branch**: depois de criar, em *Settings > Git*, defina `white-label` (ou a branch que estiver usando para clientes).
4. **Environment Variables**: copie de `.env.example` e preencha com os dados do cliente. No mínimo:

   | Variável | Exemplo |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://abcd.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` |
   | `NEXT_PUBLIC_LOJA_NOME` | `Açaí do Bairro` |
   | `NEXT_PUBLIC_LOJA_WHATSAPP` | `5567999990000` (DDI+DDD+número) |
   | `NEXT_PUBLIC_LOJA_CIDADE` | `Anastácio - MS` |
   | `NEXT_PUBLIC_LOJA_HORARIO` | `Seg–Sáb · 14h às 23h` |
   | `NEXT_PUBLIC_LOJA_PREFIXO_PEDIDO` | `AB` |
   | `NEXT_PUBLIC_LOJA_COR_PRIMARIA` / `_DESTAQUE` / `_FUNDO` | `#4A1259` / `#C2185B` / `#F6EEF8` |
   | `NEXT_PUBLIC_LOJA_LOGO` / `_BANNER` | URL https da imagem (veja abaixo) |
   | `NEXT_PUBLIC_LOJA_PIX_CHAVE` / `_PIX_NOME` | chave e nome do recebedor |

   Todas as opções estão comentadas em `.env.example`.
5. Clique em **Deploy**. Quando terminar, abra o site e confira nome, cores, logo e WhatsApp.

**Logo e banner:** o jeito mais simples é subir as imagens no Supabase do cliente (**Storage > New bucket** público, ex.: `loja`, e fazer upload) e colar a URL pública em `NEXT_PUBLIC_LOJA_LOGO` e `NEXT_PUBLIC_LOJA_BANNER`. Sem isso, o site usa a logo da demonstração.

**Mudou alguma variável?** Vá em *Deployments > ... > Redeploy*. As variáveis `NEXT_PUBLIC_*` só entram no site num novo deploy.

## 6. Domínio próprio (≈5 min + propagação)

1. Na Vercel: *Settings > Domains > Add* → digite o domínio (ex.: `pedidos.acaidobairro.com.br`).
2. No painel onde o domínio foi comprado (Registro.br, Hostinger etc.), crie o registro que a Vercel mostrar:
   - subdomínio (`pedidos.`): **CNAME** apontando para `cname.vercel-dns.com`
   - domínio raiz: **A** para o IP que a Vercel indicar
3. Espere ficar "Valid Configuration" (minutos a algumas horas). O HTTPS é automático.
4. Atualize o **Site URL** no Supabase (passo 1.5) para o domínio final.

Sem domínio próprio, a loja funciona em `nome-do-projeto.vercel.app`.

## 7. Cadastrar cardápio, frete, cupons e motoboys (20–30 min)

Entre em `https://SITE/admin` com o e-mail do dono:

1. **Cardápio**: apague/edite os produtos de exemplo e cadastre os da loja. A coluna *Categoria* vira as abas do cardápio (na ordem do campo *Ordem*). Fotos: URL pública (Supabase Storage) ou caminho em `/public`. O produto com **Monte seu** marcado abre a tela de montar; o preço dele aparece como "a partir de", então use o preço do menor tamanho.
2. **Frete**: apague os bairros de exemplo (são de Aquidauana) e cadastre os bairros e taxas da loja.
3. **Cupons**: apague `PRIMEIRO10` e `FRETEGRATIS` se a loja não quiser.
4. **Motoboys**: nome e WhatsApp de cada um.

Tamanhos e acompanhamentos do "Monte seu açaí" ficam nas variáveis `NEXT_PUBLIC_LOJA_TAMANHOS` e `NEXT_PUBLIC_LOJA_ACOMPANHAMENTOS` (passo 5) e precisam de Redeploy.

## 8. Teste final com o dono (≈5 min)

- [ ] Fazer um pedido de teste pelo celular (entrega, Pix) e ver se aparece no `/admin > Pedidos`
- [ ] A chave Pix aparece no acompanhamento do pedido
- [ ] Botão "Falar no WhatsApp" abre o número da loja
- [ ] Despachar o pedido para um motoboy: chega no WhatsApp dele com o link `/entrega/...`, e "Peguei o pedido" / "Confirmar entrega" atualizam o admin
- [ ] Criar uma conta em `/registrar` e ver o pedido em `/conta`
- [ ] No celular, "Adicionar à tela inicial" mostra o nome e a logo da loja
- [ ] Apagar o pedido de teste

## Atualizações de código

Todas as lojas usam o mesmo repositório. Um `git push` na branch de produção redeploya todas as lojas ligadas a ela. Se alguma mudança precisar de SQL novo, rode o script no Supabase **de cada cliente**.
