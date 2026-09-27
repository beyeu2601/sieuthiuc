-- Tim san pham linh hoat: tach cau tim thanh cac tu, yeu cau tat ca cac tu deu co
-- trong search_key (khong can dung thu tu). Vi du "yen mach 500gr" khop
-- "Yen Mach Uncle 500gr". Van giu khop dung ma vach va SKU nhu truoc.
create or replace function public.catalog_search(
  p_store_id uuid, p_q text default null, p_limit integer default 30, p_include_inactive boolean default false)
returns table (product_id uuid, sku text, name text, unit text, goods_type public.goods_type,
               sell_price bigint, status public.product_status, expiry_level public.expiry_level,
               barcode text, pack_qty numeric, barcodes text[],
               qty_on_hand numeric, qty_reserved numeric, qty_available numeric, nearest_expiry date)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_norm text := public.search_text(v_q);
  v_like text[] := array(select '%' || t || '%' from unnest(regexp_split_to_array(coalesce(v_norm, ''), '\s+')) t where t <> '');
  v_hit_product uuid;
  v_hit_pack numeric;
begin
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem cửa hàng này');
  end if;

  -- khop dung ma vach (ke ca ma loc) truoc
  if v_q is not null then
    select b.product_id, b.pack_qty into v_hit_product, v_hit_pack
      from public.product_barcodes b where b.barcode = upper(v_q);
  end if;

  return query
  select p.id, p.sku, p.name, p.unit, p.goods_type, p.sell_price, p.status, p.expiry_level,
         case when p.id = v_hit_product then upper(v_q)
              else (select b.barcode from public.product_barcodes b where b.product_id = p.id and b.is_primary) end,
         case when p.id = v_hit_product then v_hit_pack else 1::numeric end,
         array(select b.barcode from public.product_barcodes b where b.product_id = p.id order by b.is_primary desc, b.barcode),
         coalesce(i.qty_on_hand, 0), coalesce(i.qty_reserved, 0), coalesce(i.qty_available, 0),
         (select min(l.expiry_date) from public.stock_lots l
           where l.store_id = p_store_id and l.product_id = p.id and l.qty_on_hand > 0
             and (l.expiry_date is null or l.expiry_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date))
  from public.products p
  left join public.inventory i on i.store_id = p_store_id and i.product_id = p.id
  where (p_include_inactive or p.status = 'active')
    and (v_q is null
         or p.id = v_hit_product
         or upper(p.sku) = upper(v_q)
         or (cardinality(v_like) > 0 and p.search_key ~~ all(v_like)))
  order by (p.id = v_hit_product) desc nulls last, p.name
  limit greatest(1, least(coalesce(p_limit, 30), 200));
end $$;
