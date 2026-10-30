-- Açaí Mania: motoboy confirma as etapas da entrega pelo link do WhatsApp
-- Rode no SQL Editor do Supabase (depois de schema.sql e roles.sql).

-- Etapas extras registradas em status_times: 'coletado' (motoboy pegou) e 'entregue'
create or replace function public.courier_step(order_id uuid, p_step text)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = order_id;
  if not found then return 'Pedido não encontrado'; end if;
  if o.status = 'cancelado' then return 'Pedido cancelado pela loja'; end if;
  if p_step = 'coletado' and o.status = 'saiu' then
    update public.orders set status_times = status_times || jsonb_build_object('coletado', now()) where id = order_id;
    return 'ok';
  elsif p_step = 'entregue' and o.status = 'saiu' then
    update public.orders set status = 'entregue', status_times = status_times || jsonb_build_object('entregue', now()) where id = order_id;
    return 'ok';
  end if;
  return 'Etapa não permitida agora';
end $$;
grant execute on function public.courier_step(uuid, text) to anon, authenticated;
