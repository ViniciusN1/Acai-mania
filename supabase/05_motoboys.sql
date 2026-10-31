-- =====================================================================
-- 05_motoboys.sql · App do motoboy: papel 'motoboy', perfil, pedidos, GPS ao vivo
-- Rode no SQL Editor DEPOIS de 04_localizacao.sql. Idempotente.
-- =====================================================================

-- 1) Novo papel 'motoboy'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('cliente','admin','motoboy'));
alter table public.profiles add column if not exists avatar_url text not null default '';

-- 2) Cadastro do motoboy (tabela couriers já existente) ligado à conta (auth.users)
alter table public.couriers add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists couriers_user_id_key on public.couriers(user_id) where user_id is not null;
alter table public.couriers add column if not exists avatar_url text not null default '';
alter table public.couriers add column if not exists theme text not null default 'acai';        -- tema de cor do app
alter table public.couriers add column if not exists theme_mode text not null default 'claro';  -- 'claro' | 'escuro'
alter table public.couriers add column if not exists created_at timestamptz not null default now();

-- Id do motoboy logado (null se não for motoboy ativo). Admin também pode ser motoboy se for vinculado.
create or replace function public.my_courier_id() returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.couriers c join public.profiles p on p.id = c.user_id
   where c.user_id = auth.uid() and c.active and p.role in ('motoboy','admin')
   limit 1;
$$;
create or replace function public.is_courier() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_courier_id() is not null;
$$;
grant execute on function public.my_courier_id() to authenticated;
grant execute on function public.is_courier() to authenticated;

-- Motoboy lê o próprio cadastro (admin já tem couriers_admin_all em roles.sql)
drop policy if exists "couriers_self_read" on public.couriers;
create policy "couriers_self_read" on public.couriers for select to authenticated using (user_id = auth.uid());

-- Motoboy edita o próprio perfil (nome, WhatsApp, foto, tema). Copia para profiles também.
create or replace function public.courier_update_profile(p_name text, p_phone text, p_avatar_url text, p_theme text, p_theme_mode text)
returns public.couriers language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_courier_id(); r public.couriers;
begin
  if cid is null then raise exception 'Acesso só para motoboys'; end if;
  update public.couriers set
    name = coalesce(nullif(trim(p_name), ''), name),
    phone = coalesce(nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), phone),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    theme = coalesce(nullif(trim(p_theme), ''), theme),
    theme_mode = case when p_theme_mode in ('claro','escuro') then p_theme_mode else theme_mode end
  where id = cid returning * into r;
  update public.profiles set full_name = r.name, phone = r.phone, avatar_url = r.avatar_url where id = auth.uid();
  return r;
end $$;
grant execute on function public.courier_update_profile(text, text, text, text, text) to authenticated;

-- 3) Pedidos que o motoboy enxerga: os atribuídos a ele + entregas ainda sem motoboy (disponíveis)
drop policy if exists "orders_courier_read" on public.orders;
create policy "orders_courier_read" on public.orders for select to authenticated using (
  public.is_courier() and mode = 'entrega' and (
    courier_id = public.my_courier_id()
    or (courier_id is null and status in ('recebido','preparo','saiu'))
  )
);

-- Motoboy pega uma entrega disponível
create or replace function public.courier_claim(order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_courier_id(); o public.orders;
begin
  if cid is null then return 'Acesso só para motoboys'; end if;
  select * into o from public.orders where id = order_id for update;
  if not found then return 'Pedido não encontrado'; end if;
  if o.mode <> 'entrega' or o.status not in ('recebido','preparo','saiu') then return 'Pedido indisponível'; end if;
  if o.courier_id is not null and o.courier_id <> cid then return 'Outro motoboy já pegou este pedido'; end if;
  update public.orders set courier_id = cid where id = order_id;
  return 'ok';
end $$;
grant execute on function public.courier_claim(uuid) to authenticated;

-- Etapas pelo app (com login): equivalente ao courier_step, mas só no pedido do próprio motoboy.
--   'coletado': saiu da loja com o pedido (pedido precisa estar em preparo ou já despachado)
--   'entregue': entregue ao cliente
create or replace function public.courier_app_step(order_id uuid, p_step text)
returns text language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_courier_id(); o public.orders;
begin
  if cid is null then return 'Acesso só para motoboys'; end if;
  select * into o from public.orders where id = order_id for update;
  if not found then return 'Pedido não encontrado'; end if;
  if o.courier_id is distinct from cid then return 'Este pedido não está com você'; end if;
  if o.status = 'cancelado' then return 'Pedido cancelado pela loja'; end if;
  if p_step = 'coletado' then
    if o.status = 'recebido' then return 'A loja ainda não começou o preparo'; end if;
    if o.status not in ('preparo','saiu') then return 'Etapa não permitida agora'; end if;
    update public.orders set status = 'saiu',
      status_times = status_times
        || case when status_times ? 'saiu' then '{}'::jsonb else jsonb_build_object('saiu', now()) end
        || jsonb_build_object('coletado', now())
    where id = order_id;
    return 'ok';
  elsif p_step = 'entregue' then
    if o.status <> 'saiu' then return 'Confirme a coleta primeiro'; end if;
    update public.orders set status = 'entregue',
      status_times = status_times
        || case when status_times ? 'coletado' then '{}'::jsonb else jsonb_build_object('coletado', now()) end
        || jsonb_build_object('entregue', now()),
      customer_live_lat = null, customer_live_lng = null, customer_live_at = null
    where id = order_id;
    return 'ok';
  end if;
  return 'Etapa desconhecida';
end $$;
grant execute on function public.courier_app_step(uuid, text) to authenticated;

-- 4) Localização ao vivo do motoboy (uma linha por motoboy)
create table if not exists public.courier_locations (
  courier_id uuid primary key references public.couriers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,   -- pedido ativo (a caminho) no momento
  lat double precision not null,
  lng double precision not null,
  accuracy real,
  heading real,
  speed real,
  updated_at timestamptz not null default now()
);
alter table public.courier_locations enable row level security;
drop policy if exists "loc_courier_own" on public.courier_locations;
drop policy if exists "loc_admin_read" on public.courier_locations;
drop policy if exists "loc_client_read" on public.courier_locations;
-- Motoboy escreve/lê só a própria posição
create policy "loc_courier_own" on public.courier_locations for all to authenticated
  using (courier_id = public.my_courier_id()) with check (courier_id = public.my_courier_id());
-- Admin vê todos
create policy "loc_admin_read" on public.courier_locations for select to authenticated using (public.is_admin());
-- Cliente logado vê só o motoboy do pedido dele que está a caminho
create policy "loc_client_read" on public.courier_locations for select to authenticated using (
  exists (select 1 from public.orders o
           where o.courier_id = courier_locations.courier_id and o.user_id = auth.uid() and o.status = 'saiu')
);

-- Tempo real (sem erro se já estiver na publicação)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'courier_locations') then
    alter publication supabase_realtime add table public.courier_locations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- App do motoboy envia a posição (upsert). Descobre sozinho o pedido ativo.
create or replace function public.courier_ping(p_lat double precision, p_lng double precision,
  p_accuracy real default null, p_heading real default null, p_speed real default null)
returns text language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_courier_id(); active uuid;
begin
  if cid is null then return 'Acesso só para motoboys'; end if;
  select id into active from public.orders
   where courier_id = cid and status = 'saiu'
   order by (status_times->>'coletado') nulls last, created_at limit 1;
  insert into public.courier_locations (courier_id, order_id, lat, lng, accuracy, heading, speed, updated_at)
  values (cid, active, p_lat, p_lng, p_accuracy, p_heading, p_speed, now())
  on conflict (courier_id) do update set order_id = excluded.order_id, lat = excluded.lat, lng = excluded.lng,
    accuracy = excluded.accuracy, heading = excluded.heading, speed = excluded.speed, updated_at = now();
  return 'ok';
end $$;
grant execute on function public.courier_ping(double precision, double precision, real, real, real) to authenticated;

-- Para de compartilhar (apaga a posição)
create or replace function public.courier_stop_sharing() returns void
language sql security definer set search_path = public as $$
  delete from public.courier_locations where courier_id = public.my_courier_id();
$$;
grant execute on function public.courier_stop_sharing() to authenticated;

-- 5) Acompanhamento do cliente (funciona sem login, só com o id do pedido):
--    devolve loja, destino, cliente ao vivo e o motoboy (nome, foto e posição) SÓ enquanto o pedido está a caminho.
create or replace function public.get_order_tracking(order_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'status', o.status,
    'lat', o.lat, 'lng', o.lng,
    'customer_live_lat', o.customer_live_lat, 'customer_live_lng', o.customer_live_lng, 'customer_live_at', o.customer_live_at,
    'store_lat', coalesce(s.store_lat, -20.4739), 'store_lng', coalesce(s.store_lng, -55.7821),
    'courier_name', case when o.status = 'saiu' then split_part(c.name, ' ', 1) end,
    'courier_avatar', case when o.status = 'saiu' then c.avatar_url end,
    'courier_lat', case when o.status = 'saiu' then l.lat end,
    'courier_lng', case when o.status = 'saiu' then l.lng end,
    'courier_at', case when o.status = 'saiu' then l.updated_at end
  )
  from public.orders o
  left join public.couriers c on c.id = o.courier_id
  left join public.courier_locations l on l.courier_id = o.courier_id
  left join public.settings s on s.id = 1
  where o.id = get_order_tracking.order_id;
$$;
grant execute on function public.get_order_tracking(uuid) to anon, authenticated;

-- 6) Admin transforma uma conta em motoboy (a pessoa cria a conta antes, no app do motoboy ou no site).
--    Se já existir um motoboy cadastrado com o mesmo WhatsApp e sem conta, ele é vinculado; senão é criado.
create or replace function public.admin_make_courier(p_email text, p_name text default '', p_phone text default '')
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid; cid uuid; d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'); pname text; pphone text;
begin
  if not public.is_admin() then raise exception 'Só o admin pode fazer isso'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return 'Conta não encontrada. Peça para o motoboy criar a conta no app com esse e-mail.'; end if;
  insert into public.profiles (id) values (uid) on conflict (id) do nothing;
  update public.profiles set role = 'motoboy' where id = uid and role <> 'admin';
  select full_name, phone into pname, pphone from public.profiles where id = uid;
  if d = '' then d := regexp_replace(coalesce(pphone, ''), '\D', '', 'g'); end if;
  select id into cid from public.couriers where user_id = uid;
  if cid is null and d <> '' then
    select id into cid from public.couriers
     where user_id is null and regexp_replace(phone, '\D', '', 'g') in (d, '55' || d, regexp_replace(d, '^55', '')) limit 1;
  end if;
  if cid is null then
    insert into public.couriers (name, phone, active, user_id)
    values (coalesce(nullif(trim(p_name), ''), nullif(pname, ''), split_part(p_email, '@', 1)), d, true, uid);
  else
    update public.couriers set user_id = uid, active = true,
      name = coalesce(nullif(trim(p_name), ''), name),
      phone = case when d <> '' then d else phone end
    where id = cid;
  end if;
  return 'ok';
end $$;
grant execute on function public.admin_make_courier(text, text, text) to authenticated;

-- Admin desfaz: a conta volta a ser cliente e o cadastro fica sem login (histórico mantido)
create or replace function public.admin_unlink_courier(p_courier_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Só o admin pode fazer isso'; end if;
  select user_id into uid from public.couriers where id = p_courier_id;
  update public.couriers set user_id = null where id = p_courier_id;
  if uid is not null then update public.profiles set role = 'cliente' where id = uid and role = 'motoboy'; end if;
  delete from public.courier_locations where courier_id = p_courier_id;
  return 'ok';
end $$;
grant execute on function public.admin_unlink_courier(uuid) to authenticated;

-- 7) Fotos de perfil (Storage, bucket público 'avatars'; cada um grava na pasta com o próprio id)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "avatars_read" on storage.objects;
drop policy if exists "avatars_own_insert" on storage.objects;
drop policy if exists "avatars_own_update" on storage.objects;
drop policy if exists "avatars_own_delete" on storage.objects;
create policy "avatars_read" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars_own_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_own_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
