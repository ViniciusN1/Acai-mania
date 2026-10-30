-- Açaí Mania: papéis (admin só pelo Supabase, clientes se cadastram no site)
-- Rode este arquivo inteiro no SQL Editor do Supabase.

-- 1) Perfis
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'cliente' check (role in ('cliente','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Cria o perfil (sempre como cliente) quando alguém se cadastra
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.raw_user_meta_data->>'phone',''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Usuários que já existiam ganham perfil
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- É admin?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles_own_read" on public.profiles;
drop policy if exists "profiles_own_update" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_own_read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles_own_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Cliente só pode mudar nome e telefone, nunca o papel
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- 2) Pedidos ligados ao cliente
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 3) Trocar "qualquer logado" por "só admin"
drop policy if exists "orders_staff_all" on public.orders;
drop policy if exists "couriers_staff_all" on public.couriers;
drop policy if exists "products_staff" on public.products;
drop policy if exists "coupons_staff" on public.coupons;
drop policy if exists "zones_staff" on public.delivery_zones;
drop policy if exists "orders_admin_all" on public.orders;
drop policy if exists "couriers_admin_all" on public.couriers;
drop policy if exists "products_admin" on public.products;
drop policy if exists "coupons_admin" on public.coupons;
drop policy if exists "zones_admin" on public.delivery_zones;
create policy "orders_admin_all" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "couriers_admin_all" on public.couriers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products_admin" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "coupons_admin" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "zones_admin" on public.delivery_zones for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Cliente logado cria e vê os próprios pedidos
drop policy if exists "orders_insert_user" on public.orders;
drop policy if exists "orders_own_read" on public.orders;
create policy "orders_insert_user" on public.orders for insert to authenticated
  with check (status = 'recebido' and (user_id is null or user_id = auth.uid()));
create policy "orders_own_read" on public.orders for select to authenticated using (user_id = auth.uid());

-- 4) Torne-se admin (troque o e-mail se precisar). Só dá pra fazer por aqui.
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'nunes6479@gmail.com');
