-- =====================================================================
-- 06_ranking_bonus.sql · Contador de entregas, ranking e bônus por corrida
-- Rode no SQL Editor DEPOIS de 05_motoboys.sql. Idempotente.
-- O valor do bônus fica em settings.bonus_per_delivery (padrão R$ 0,25), editável no /admin.
-- =====================================================================

-- 1) Cada entrega guarda o bônus vigente no momento em que foi concluída
--    (mudar o valor depois não altera o que já foi feito). Entregas antigas usam o valor atual.
alter table public.orders add column if not exists courier_bonus numeric(10,2);

create or replace function public.set_courier_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'entregue' and old.status is distinct from 'entregue' and new.courier_id is not null and new.courier_bonus is null then
    new.courier_bonus := coalesce((select bonus_per_delivery from public.settings where id = 1), 0.25);
  end if;
  return new;
end $$;
drop trigger if exists orders_courier_bonus on public.orders;
create trigger orders_courier_bonus before update on public.orders for each row execute function public.set_courier_bonus();

-- Momento da entrega (status_times.entregue; se faltar, a criação do pedido)
create or replace function public.delivered_at(o public.orders) returns timestamptz
language sql stable as $$
  select coalesce((o.status_times->>'entregue')::timestamptz, o.created_at);
$$;

-- Início do período no fuso da loja (America/Campo_Grande). Semana começa na segunda.
create or replace function public.period_start(p_period text) returns timestamptz
language sql stable as $$
  select case p_period
    when 'hoje'   then date_trunc('day',   now() at time zone 'America/Campo_Grande') at time zone 'America/Campo_Grande'
    when 'semana' then date_trunc('week',  now() at time zone 'America/Campo_Grande') at time zone 'America/Campo_Grande'
    when 'mes'    then date_trunc('month', now() at time zone 'America/Campo_Grande') at time zone 'America/Campo_Grande'
    else '-infinity'::timestamptz end;
$$;

-- 2) Ranking entre motoboys: só nome (primeiro), foto, contagem e bônus. Sem telefone/e-mail dos outros.
--    Período: 'hoje' | 'semana' | 'mes' | 'total'. Só motoboys e admin podem ver.
create or replace function public.courier_ranking(p_period text default 'semana')
returns table (courier_id uuid, name text, avatar_url text, deliveries bigint, bonus numeric, is_me boolean)
language sql stable security definer set search_path = public as $$
  with b as (select coalesce((select bonus_per_delivery from public.settings where id = 1), 0.25) as v)
  select c.id,
         case when public.is_admin() then c.name else split_part(c.name, ' ', 1) end,
         c.avatar_url,
         count(o.id),
         coalesce(sum(coalesce(o.courier_bonus, b.v)) filter (where o.id is not null), 0)::numeric(10,2),
         c.user_id is not distinct from auth.uid()
    from public.couriers c
    cross join b
    left join public.orders o
      on o.courier_id = c.id and o.status = 'entregue' and public.delivered_at(o) >= public.period_start(p_period)
   where c.active and (public.is_courier() or public.is_admin())
   group by c.id, c.name, c.avatar_url, c.user_id
   order by 4 desc, 2;
$$;
grant execute on function public.courier_ranking(text) to authenticated;

-- 3) Números do próprio motoboy
create or replace function public.courier_my_stats()
returns table (today bigint, week bigint, month bigint, total bigint,
               bonus_today numeric, bonus_week numeric, bonus_month numeric, bonus_total numeric, bonus_per_delivery numeric)
language sql stable security definer set search_path = public as $$
  with b as (select coalesce((select s.bonus_per_delivery from public.settings s where s.id = 1), 0.25) as v),
  d as (select public.delivered_at(o) as t, coalesce(o.courier_bonus, (select v from b)) as bonus
          from public.orders o where o.courier_id = public.my_courier_id() and o.status = 'entregue')
  select count(*) filter (where t >= public.period_start('hoje')),
         count(*) filter (where t >= public.period_start('semana')),
         count(*) filter (where t >= public.period_start('mes')),
         count(*),
         coalesce(sum(bonus) filter (where t >= public.period_start('hoje')), 0),
         coalesce(sum(bonus) filter (where t >= public.period_start('semana')), 0),
         coalesce(sum(bonus) filter (where t >= public.period_start('mes')), 0),
         coalesce(sum(bonus), 0),
         (select v from b)
    from d;
$$;
grant execute on function public.courier_my_stats() to authenticated;
