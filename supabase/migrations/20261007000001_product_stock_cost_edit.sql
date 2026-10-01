-- Chinh truc tiep ton kho va gia von cua san pham tai man San pham (sadmin/admin cua cua hang).
-- Gia von: ghi de gia von binh quan cua cua hang (inventory.avg_cost), gia von cac lo con hang
--   (stock_lots.unit_cost) va gia von tham chieu (products.cost_price_ref). Giao dich ban da ghi giu nguyen.
-- Ton kho: nhap so ton thuc te. Tang -> tao lo moi 'DC-yymmddhh24miss' theo gia von hien tai (HSD tuy chon);
--   giam -> tru cac lo theo FEFO. Bien dong ghi loai 'adjustment'. Khong cho xuong duoi so dang giu cho don online.

create or replace function public.adjust_product_stock(
  p_store_id uuid, p_product_id uuid, p_qty numeric, p_cost bigint,
  p_expiry date default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inv public.inventory;
  v_delta numeric;
  v_left numeric;
  v_take numeric;
  v_lot_id uuid;
  v_old_cost bigint;
  v_note text := coalesce(nullif(trim(p_note), ''), 'Điều chỉnh tại màn sản phẩm');
  lot record;
begin
  if not public.is_store_manager(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới chỉnh được tồn kho và giá vốn');
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy sản phẩm');
  end if;
  if p_qty is null or p_qty < 0 then
    perform public.raise_error('VALIDATION', 'Tồn kho không được âm');
  end if;
  if p_cost is not null and p_cost < 0 then
    perform public.raise_error('VALIDATION', 'Giá vốn không được âm');
  end if;

  inv := public._lock_inventory(p_store_id, p_product_id);
  v_old_cost := inv.avg_cost;
  if p_qty < inv.qty_reserved then
    perform public.raise_error('VALIDATION',
      format('Đang giữ %s cho đơn online, tồn không được thấp hơn số này', inv.qty_reserved::float8));
  end if;

  -- Gia von truoc, de lo tang them (neu co) nhan gia von moi
  if p_cost is not null and p_cost <> inv.avg_cost then
    update public.inventory set avg_cost = p_cost, updated_at = now()
     where store_id = p_store_id and product_id = p_product_id;
    update public.stock_lots set unit_cost = p_cost
     where store_id = p_store_id and product_id = p_product_id and qty_on_hand > 0;
    update public.products set cost_price_ref = p_cost where id = p_product_id;
    inv.avg_cost := p_cost;
  end if;

  v_delta := p_qty - inv.qty_on_hand;
  if v_delta > 0 then
    v_lot_id := public._receive_stock(p_store_id, p_product_id, v_delta, inv.avg_cost,
      'DC-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDDHH24MISS'), p_expiry,
      'adjustment', 'stock_adjust', null);
    update public.stock_movements set note = v_note
     where lot_id = v_lot_id and ref_type = 'stock_adjust' and note is null;
  elsif v_delta < 0 then
    v_left := -v_delta;
    for lot in select id, qty_on_hand from public.stock_lots
                where store_id = p_store_id and product_id = p_product_id and qty_on_hand > 0
                order by expiry_date nulls last, received_at loop
      exit when v_left = 0;
      v_take := least(v_left, lot.qty_on_hand);
      perform public._apply_movement(p_store_id, p_product_id, lot.id, 'adjustment', -v_take,
        inv.avg_cost, 'stock_adjust', null, v_note);
      v_left := v_left - v_take;
    end loop;
    if v_left > 0 then
      perform public._apply_movement(p_store_id, p_product_id, null, 'adjustment', -v_left,
        inv.avg_cost, 'stock_adjust', null, v_note);
    end if;
  end if;

  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, before, after)
  values (auth.uid(), 'inventory.adjust', 'inventory', p_product_id, p_store_id,
          jsonb_build_object('qty', inv.qty_on_hand, 'avg_cost', v_old_cost),
          jsonb_build_object('qty', p_qty, 'avg_cost', inv.avg_cost, 'note', v_note));

  return jsonb_build_object('qty', p_qty, 'avg_cost', inv.avg_cost);
end $$;

revoke execute on function public.adjust_product_stock(uuid, uuid, numeric, bigint, date, text) from public, anon;
grant execute on function public.adjust_product_stock(uuid, uuid, numeric, bigint, date, text) to authenticated;
