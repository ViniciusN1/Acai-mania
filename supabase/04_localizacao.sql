-- =====================================================================
-- 04_localizacao.sql · Localização do cliente no pedido + configurações da loja
-- Rode no SQL Editor do Supabase DEPOIS de schema.sql, roles.sql e entregas.sql.
-- Pode rodar mais de uma vez (idempotente).
-- =====================================================================

-- 1) Coordenadas do endereço de entrega (GPS do cliente ou endereço geocodificado)
alter table public.orders add column if not exists lat double precision;
alter table public.orders add column if not exists lng double precision;
alter table public.orders add column if not exists geo_source text;            -- 'gps' | 'endereco' | 'mapa'

-- Localização ao vivo do cliente (opcional, ele liga no acompanhamento enquanto o pedido está a caminho)
alter table public.orders add column if not exists customer_live_lat double precision;
alter table public.orders add column if not exists customer_live_lng double precision;
alter table public.orders add column if not exists customer_live_at timestamptz;

-- 2) Configurações da loja (uma linha só, id = 1). Editável no /admin.
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  bonus_per_delivery numeric(10,2) not null default 0.25,   -- bônus pago ao motoboy por entrega concluída
  store_lat double precision not null default -20.4739,      -- posição da loja no mapa (padrão: centro de Aquidauana)
  store_lng double precision not null default -55.7821,
  store_address text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

alter table public.settings enable row level security;
drop policy if exists "settings_read" on public.settings;
drop policy if exists "settings_admin" on public.settings;
create policy "settings_read" on public.settings for select to anon, authenticated using (true);
create policy "settings_admin" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3) get_order passa a devolver as colunas novas (recriada por garantia)
create or replace function public.get_order(order_id uuid)
returns setof public.orders language sql security definer set search_path = public as $$
  select * from public.orders where id = order_id;
$$;
grant execute on function public.get_order(uuid) to anon, authenticated;

-- 4) Cliente compartilha (ou para de compartilhar) a localização ao vivo pelo link do pedido.
--    Passe p_lat/p_lng nulos para parar. Só vale enquanto o pedido está em andamento.
create or replace function public.share_customer_location(order_id uuid, p_lat double precision, p_lng double precision)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = order_id;
  if not found then return 'Pedido não encontrado'; end if;
  if o.status not in ('recebido','preparo','saiu') then
    update public.orders set customer_live_lat = null, customer_live_lng = null, customer_live_at = null where id = order_id;
    return 'Pedido já finalizado';
  end if;
  update public.orders
     set customer_live_lat = p_lat, customer_live_lng = p_lng,
         customer_live_at = case when p_lat is null then null else now() end
   where id = order_id;
  return 'ok';
end $$;
grant execute on function public.share_customer_location(uuid, double precision, double precision) to anon, authenticated;
