-- Ton hien tai: cho phep loc nhieu gia tri cung luc (trang thai, nhom hang, loai hang).
-- Doi p_status/p_category/p_goods_type sang mang; bo case dac biet 'low_out'
-- (nay truyen mang array['low','out']). Rong hoac null = khong loc theo tieu chi do.

drop function if exists public.inventory_status(uuid, text, text, uuid, public.goods_type, integer, integer);

create or replace function public.inventory_status(
  p_store_id uuid, p_q text default null, p_status text[] default null, p_category uuid[] default null,
  p_goods_type public.goods_type[] default null, p_limit integer default 50, p_offset integer default 0)
returns table (product_id uuid, sku text, name text, unit text, goods_type public.goods_type, category text,
  barcode text, qty_on_hand numeric, qty_reserved numeric, qty_available numeric, min_stock numeric,
  stock_status text, suggest_qty numeric, avg_cost bigint, stock_value bigint, nearest_expiry date, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_default_min numeric := coalesce((public.get_setting('inventory.default_min_stock', p_store_id))::text::numeric, 5);
  v_show_cost boolean := public.auth_role() in ('sadmin','admin','accountant');
  v_norm text := nullif(public.search_text(p_q), '');
begin
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem cửa hàng này');
  end if;
  return query
  with base as (
    select p.id, p.sku, p.name, p.unit, p.goods_type, c.name as cat,
           (select b.barcode from public.product_barcodes b where b.product_id = p.id and b.is_primary) as bc,
           coalesce(i.qty_on_hand, 0) as on_hand, coalesce(i.qty_reserved, 0) as reserved,
           coalesce(i.qty_available, 0) as available,
           coalesce(p.min_stock, v_default_min) as min_s,
           coalesce(p.max_stock, coalesce(p.min_stock, v_default_min) * 3) as max_s,
           coalesce(i.avg_cost, 0) as avg_c,
           (select min(l.expiry_date) from public.stock_lots l
             where l.store_id = p_store_id and l.product_id = p.id and l.qty_on_hand > 0) as near_exp
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.inventory i on i.store_id = p_store_id and i.product_id = p.id
    where p.status = 'active'
      and (v_norm is null or p.search_key like '%' || v_norm || '%'
           or exists (select 1 from public.product_barcodes b where b.product_id = p.id and b.barcode = upper(trim(p_q))))
      and (p_category is null or cardinality(p_category) = 0 or p.category_id = any(p_category))
      and (p_goods_type is null or cardinality(p_goods_type) = 0 or p.goods_type = any(p_goods_type))
  ), st as (
    select *, case when available <= 0 then 'out' when available <= min_s then 'low' else 'in_stock' end as s
    from base
  ), f as (
    select * from st
    where p_status is null or cardinality(p_status) = 0 or s = any(p_status)
  )
  select f.id, f.sku, f.name, f.unit, f.goods_type, f.cat, f.bc, f.on_hand, f.reserved, f.available, f.min_s,
         f.s, greatest(0, f.max_s - f.available),
         case when v_show_cost then f.avg_c end,
         case when v_show_cost then round(f.on_hand * f.avg_c)::bigint end,
         f.near_exp, count(*) over ()
  from f
  order by case f.s when 'out' then 0 when 'low' then 1 else 2 end, f.name
  limit greatest(1, least(coalesce(p_limit, 50), 500)) offset greatest(0, coalesce(p_offset, 0));
end $$;

revoke execute on function public.inventory_status(uuid, text, text[], uuid[], public.goods_type[], integer, integer) from public, anon;
grant execute on function public.inventory_status(uuid, text, text[], uuid[], public.goods_type[], integer, integer) to authenticated;
