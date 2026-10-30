-- Açaí Mania: pedidos
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null default upper(substr(md5(random()::text),1,4)),
  created_at timestamptz not null default now(),
  status text not null default 'recebido'
    check (status in ('recebido','preparo','saiu','entregue','cancelado')),
  status_times jsonb not null default '{}'::jsonb,
  mode text not null check (mode in ('entrega','retirada')),
  customer_name text not null,
  customer_phone text not null,
  address text,
  neighborhood text,
  items jsonb not null,
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  payment text not null check (payment in ('pix','cartao','dinheiro')),
  courier_id uuid
);

alter table public.orders enable row level security;

-- Cliente anônimo pode criar pedido
create policy "orders_insert_anon" on public.orders for insert to anon with check (status = 'recebido');

-- Cliente lê o próprio pedido só pelo id (uuid difícil de adivinhar)
create or replace function public.get_order(order_id uuid)
returns setof public.orders language sql security definer set search_path = public as $$
  select * from public.orders where id = order_id;
$$;
grant execute on function public.get_order(uuid) to anon;

-- Loja (usuário logado no Supabase Auth) vê e atualiza tudo
create policy "orders_staff_all" on public.orders for all to authenticated using (true) with check (true);

-- Tempo real para o painel e acompanhamento
alter publication supabase_realtime add table public.orders;

create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  active boolean not null default true
);
alter table public.couriers enable row level security;
create policy "couriers_staff_all" on public.couriers for all to authenticated using (true) with check (true);

-- ===== Cardápio, cupons e frete (editados no /admin) =====
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null,
  image text not null default '/copo.jpg',
  category text not null default 'Açaí no copo',
  build boolean not null default false,   -- abre o "Monte seu Açaí"
  available boolean not null default true,
  sort int not null default 0
);
create table if not exists public.coupons (
  code text primary key,
  kind text not null check (kind in ('percent','fixed','free_delivery')),
  value numeric(10,2) not null default 0,
  min_order numeric(10,2) not null default 0,
  max_uses int,                 -- null = ilimitado
  uses int not null default 0,
  one_per_phone boolean not null default true,
  expires_at timestamptz,
  active boolean not null default true
);
create table if not exists public.delivery_zones (
  neighborhood text primary key,
  fee numeric(10,2) not null
);
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount numeric(10,2) not null default 0;

alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.delivery_zones enable row level security;
create policy "products_read" on public.products for select to anon, authenticated using (true);
create policy "zones_read" on public.delivery_zones for select to anon, authenticated using (true);
create policy "products_staff" on public.products for all to authenticated using (true) with check (true);
create policy "coupons_staff" on public.coupons for all to authenticated using (true) with check (true);
create policy "zones_staff" on public.delivery_zones for all to authenticated using (true) with check (true);

-- Valida cupom sem expor a tabela ao público
create or replace function public.check_coupon(p_code text, p_subtotal numeric, p_phone text)
returns table (ok boolean, message text, kind text, value numeric)
language plpgsql security definer set search_path = public as $$
declare c public.coupons;
begin
  select * into c from public.coupons where code = upper(p_code) and active;
  if not found then return query select false, 'Cupom inválido', null::text, 0::numeric; return; end if;
  if c.expires_at is not null and c.expires_at < now() then return query select false, 'Cupom vencido', null::text, 0::numeric; return; end if;
  if c.max_uses is not null and c.uses >= c.max_uses then return query select false, 'Cupom esgotado', null::text, 0::numeric; return; end if;
  if p_subtotal < c.min_order then return query select false, 'Pedido mínimo de R$ ' || c.min_order, null::text, 0::numeric; return; end if;
  if c.one_per_phone and exists (select 1 from public.orders where coupon_code = c.code and customer_phone = p_phone) then
    return query select false, 'Cupom já usado neste telefone', null::text, 0::numeric; return; end if;
  return query select true, 'Cupom aplicado', c.kind, c.value;
end $$;
grant execute on function public.check_coupon(text, numeric, text) to anon;

-- Conta o uso quando o pedido entra
create or replace function public.count_coupon_use() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.coupon_code is not null then update public.coupons set uses = uses + 1 where code = new.coupon_code; end if;
  return new;
end $$;
drop trigger if exists orders_coupon_use on public.orders;
create trigger orders_coupon_use after insert on public.orders for each row execute function public.count_coupon_use();

-- Dados iniciais
insert into public.products (name, description, price, image, category, build, sort) values
 ('Monte seu Açaí','330, 440 ou 550 ml com frutas, coberturas e complementos.',10,'/copo.jpg','Açaí no copo',true,1),
 ('Açaí na Marmita','Marmita de 1 litro, perfeita para dividir.',44.90,'/marmita.jpg','Marmitas',false,2),
 ('Marmita Suprema','Marmita caprichada de 1.100 ml.',65,'/suprema.jpg','Marmitas',false,3),
 ('Tropical Doce','Combo 440 ml.',23,'/copo.jpg','Combos',false,4)
on conflict do nothing;
insert into public.delivery_zones values ('Centro',4),('Alto',5),('Serraria',5),('Vila Pinheiro',6),('Guanandy',6),('Outro',8) on conflict do nothing;
insert into public.coupons (code, kind, value, min_order) values ('PRIMEIRO10','percent',10,20),('FRETEGRATIS','free_delivery',0,40) on conflict do nothing;

-- Depois rode supabase/roles.sql (papéis cliente/admin). Admin só se define pelo SQL: update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'EMAIL');
