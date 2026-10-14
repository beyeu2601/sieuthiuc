-- Gop y 14/10/2026 (lan 2): don da giao doi duoc ca san pham va so luong, tu cap nhat so lieu lien quan.
-- Thay update_order cua 20261018000001. Don da giao:
-- - Cung san pham va so luong: chi doi gia ban nhu truoc (khong dong kho).
-- - Khac san pham hoac so luong: tra hang cu ve dung lo da xuat (bien dong sale_return), xuat lai theo dong moi
--   theo FEFO (bien dong sale) voi gia von binh quan hien tai, ghi lai dong giao dich ban, gia von, tien hang,
--   tong va thanh toan. Giao dich ban giu nguyen ma va ngay giao.

create or replace function public.update_order(p_order_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_ext text := nullif(trim(p ->> 'external_order_id'), '');
  v_ship bigint := coalesce((p ->> 'shipping_fee')::bigint, 0);
  v_disc bigint := coalesce((p ->> 'discount_amount')::bigint, 0);
  v_payout bigint := (p ->> 'payout_amount')::bigint;
  v_method public.payment_method := coalesce(p ->> 'payment_method', 'transfer')::public.payment_method;
  v_channel public.sale_channel;
  v_items jsonb;
  v_before jsonb;
  v_sub bigint;
  it jsonb;
  v_prod public.products;
  inv public.inventory;
  v_qty numeric;
  v_price bigint;
  v_today date := public._today();
  r record;
  a jsonb;
  lot record;
  v_left numeric;
  v_take numeric;
  v_allocs jsonb;
  v_line integer := 0;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy đơn'); end if;
  if not public.can_access_store(o.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if o.status not in ('pending','shipped','delivered') then
    perform public.raise_error('INVALID_STATE', 'Đơn đã hủy hoặc đã hoàn, không sửa được');
  end if;
  if o.payout_id is not null then
    perform public.raise_error('INVALID_STATE', 'Đơn đã đối soát nhận tiền, không sửa được');
  end if;

  v_channel := coalesce(nullif(p ->> 'channel', ''), o.channel::text)::public.sale_channel;
  if v_channel not in ('shopee','facebook','other') then
    perform public.raise_error('VALIDATION', 'Chọn kênh bán online');
  end if;
  if v_ext is not null and exists (
       select 1 from public.orders where channel = v_channel and external_order_id = v_ext and id <> o.id) then
    perform public.raise_error('VALIDATION', 'Mã đơn trên sàn đã được nhập trước đó');
  end if;
  if v_ship < 0 then perform public.raise_error('VALIDATION', 'Phí ship không hợp lệ'); end if;

  select jsonb_build_object('order', to_jsonb(o), 'items', coalesce(jsonb_agg(jsonb_build_object(
           'product_id', product_id, 'qty', qty, 'unit_price', unit_price) order by product_id), '[]'::jsonb))
    into v_before from public.order_items where order_id = o.id;

  if p ? 'items' then
    -- Gop dong trung san pham nhu create_order
    select coalesce(jsonb_agg(x order by x ->> 'product_id'), '[]'::jsonb) into v_items from (
      select jsonb_build_object('product_id', e ->> 'product_id', 'qty', sum((e ->> 'qty')::numeric),
               'unit_price', max((e ->> 'unit_price')::bigint)) as x
      from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) e group by e ->> 'product_id') q;
    if jsonb_array_length(v_items) = 0 then perform public.raise_error('VALIDATION', 'Đơn chưa có sản phẩm'); end if;
    if exists (select 1 from jsonb_array_elements(v_items) e
                where (e ->> 'unit_price') is null or (e ->> 'unit_price')::bigint < 0) then
      perform public.raise_error('VALIDATION', 'Giá bán không hợp lệ');
    end if;

    if o.status = 'delivered' and jsonb_array_length(v_items) = (select count(*) from public.order_items where order_id = o.id)
       and not exists (
         select 1 from jsonb_array_elements(v_items) e
          where not exists (select 1 from public.order_items oi where oi.order_id = o.id
                              and oi.product_id = (e ->> 'product_id')::uuid and oi.qty = (e ->> 'qty')::numeric)) then
      -- Cung san pham va so luong: chi doi gia ban
      update public.order_items oi set unit_price = (e ->> 'unit_price')::bigint
        from jsonb_array_elements(v_items) e
       where oi.order_id = o.id and oi.product_id = (e ->> 'product_id')::uuid;
      update public.sale_items si set unit_price = oi.unit_price,
             line_total = round(si.qty * oi.unit_price) - si.discount_amount
        from public.order_items oi
       where si.sale_id = o.sale_id and oi.order_id = o.id and oi.product_id = si.product_id;
      if exists (select 1 from public.sale_items where sale_id = o.sale_id and line_total < 0) then
        perform public.raise_error('VALIDATION', 'Giá bán nhỏ hơn giảm giá của dòng');
      end if;
    elsif o.status = 'delivered' then
      -- Tra hang cu ve dung lo da xuat khi giao
      for r in select si.* from public.sale_items si where si.sale_id = o.sale_id order by si.product_id loop
        for a in select * from jsonb_array_elements(r.lot_allocations) loop
          perform public._apply_movement(o.store_id, r.product_id, (a ->> 'lot_id')::uuid, 'sale_return',
            (a ->> 'qty')::numeric, r.unit_cost, 'sale', o.sale_id, 'Sửa đơn ' || o.code || ': trả lại kho');
        end loop;
      end loop;
      delete from public.sale_items where sale_id = o.sale_id;
      delete from public.order_items where order_id = o.id;
      -- Xuat lai theo dong moi (FEFO, gia von binh quan hien tai) nhu _post_sale
      for it in select * from jsonb_array_elements(v_items) loop
        v_line := v_line + 1;
        select * into v_prod from public.products where id = (it ->> 'product_id')::uuid;
        if v_prod.id is null or (v_prod.status <> 'active'
             and not (v_before -> 'items') @> jsonb_build_array(jsonb_build_object('product_id', v_prod.id))) then
          perform public.raise_error('VALIDATION', 'Sản phẩm không tồn tại hoặc đã ngừng bán');
        end if;
        v_qty := (it ->> 'qty')::numeric;
        if v_qty is null or v_qty <= 0 then
          perform public.raise_error('VALIDATION', format('%s: số lượng phải lớn hơn 0', v_prod.name));
        end if;
        v_price := (it ->> 'unit_price')::bigint;
        inv := public._lock_inventory(o.store_id, v_prod.id);
        if inv.qty_available < v_qty then
          perform public.raise_error('INSUFFICIENT_STOCK', format('%s: chỉ còn %s', v_prod.name, greatest(inv.qty_available, 0)::float8));
        end if;
        if v_prod.expiry_level = 'product' and v_prod.expiry_date < v_today then
          perform public.raise_error('EXPIRED_LOT', format('%s: hàng đã hết hạn', v_prod.name));
        end if;
        v_left := v_qty;
        v_allocs := '[]'::jsonb;
        for lot in select l.id, l.qty_on_hand from public.stock_lots l
                    where l.store_id = o.store_id and l.product_id = v_prod.id and l.qty_on_hand > 0
                      and (l.expiry_date is null or l.expiry_date >= v_today)
                    order by l.expiry_date nulls last, l.received_at, l.id
                    for update loop
          exit when v_left <= 0;
          v_take := least(v_left, lot.qty_on_hand);
          perform public._apply_movement(o.store_id, v_prod.id, lot.id, 'sale', -v_take, inv.avg_cost, 'sale', o.sale_id,
            'Sửa đơn ' || o.code);
          v_allocs := v_allocs || jsonb_build_object('lot_id', lot.id, 'qty', v_take);
          v_left := v_left - v_take;
        end loop;
        if v_left > 0 then
          perform public.raise_error('INSUFFICIENT_STOCK', format('%s: không đủ hàng còn hạn theo lô', v_prod.name));
        end if;
        insert into public.sale_items(sale_id, line_no, product_id, goods_type, qty, unit_price, discount_amount,
          line_total, unit_cost, cogs, lot_allocations)
        values (o.sale_id, v_line, v_prod.id, v_prod.goods_type, v_qty, v_price, 0,
          round(v_qty * v_price), inv.avg_cost, round(v_qty * inv.avg_cost), v_allocs);
        insert into public.order_items(order_id, product_id, qty, unit_price) values (o.id, v_prod.id, v_qty, v_price);
      end loop;
    else
      -- Bo giu hang theo dong cu, thay dong, giu lai theo dong moi
      perform public._release_order(o, 'sửa đơn');
      delete from public.order_items where order_id = o.id;
      for it in select * from jsonb_array_elements(v_items) loop
        select * into v_prod from public.products where id = (it ->> 'product_id')::uuid;
        -- San pham da co trong don van giu duoc du sau do chuyen ngung ban
        if v_prod.id is null or (v_prod.status <> 'active'
             and not (v_before -> 'items') @> jsonb_build_array(jsonb_build_object('product_id', v_prod.id))) then
          perform public.raise_error('VALIDATION', 'Sản phẩm không tồn tại hoặc đã ngừng bán');
        end if;
        v_qty := (it ->> 'qty')::numeric;
        if v_qty is null or v_qty <= 0 then
          perform public.raise_error('VALIDATION', format('%s: số lượng phải lớn hơn 0', v_prod.name));
        end if;
        v_price := (it ->> 'unit_price')::bigint;
        inv := public._lock_inventory(o.store_id, v_prod.id);
        if inv.qty_available < v_qty then
          perform public.raise_error('INSUFFICIENT_STOCK', format('%s: chỉ còn %s', v_prod.name, greatest(inv.qty_available, 0)::float8));
        end if;
        update public.inventory set qty_reserved = qty_reserved + v_qty, updated_at = now()
         where store_id = o.store_id and product_id = v_prod.id;
        insert into public.stock_movements(store_id, product_id, movement_type, qty_delta, qty_before, qty_after,
          unit_cost, ref_type, ref_id, note)
        values (o.store_id, v_prod.id, 'order_reserve', 0, inv.qty_on_hand, inv.qty_on_hand, 0, 'order', o.id,
          format('Giữ %s cho đơn %s (sửa đơn)', v_qty::float8, o.code));
        insert into public.order_items(order_id, product_id, qty, unit_price) values (o.id, v_prod.id, v_qty, v_price);
      end loop;
    end if;
  end if;

  select coalesce(sum(round(qty * unit_price)), 0) into v_sub from public.order_items where order_id = o.id;
  if v_disc < 0 or v_disc > v_sub then
    perform public.raise_error('VALIDATION', 'Giảm giá lớn hơn tiền hàng');
  end if;
  if v_channel <> 'shopee' then v_payout := null; end if;
  if v_payout is not null and (v_payout < 0 or v_payout > v_sub - v_disc) then
    perform public.raise_error('VALIDATION', 'Tiền sàn trả về phải từ 0 đến tiền hàng sau giảm giá');
  end if;

  update public.orders set
    channel = v_channel,
    external_order_id = v_ext,
    customer_name = nullif(trim(p ->> 'customer_name'), ''),
    customer_phone = nullif(trim(p ->> 'customer_phone'), ''),
    shipping_address = nullif(trim(p ->> 'shipping_address'), ''),
    note = nullif(trim(p ->> 'note'), ''),
    payment_method = v_method,
    subtotal = v_sub,
    shipping_fee = v_ship,
    discount_amount = v_disc,
    discount_note = case when v_disc > 0 then nullif(trim(p ->> 'discount_note'), '') end,
    total = v_sub + v_ship - v_disc,
    platform_fee = coalesce(v_sub - v_disc - v_payout, 0),
    updated_at = now()
   where id = o.id;

  -- Don da giao: giao dich ban theo don (khong co giam gia dong) ghi lai kenh, tien hang, gia von, giam gia va thanh toan
  if o.sale_id is not null then
    update public.sales set channel = v_channel, subtotal = v_sub, discount_amount = v_disc, total = v_sub - v_disc,
      cogs_total = (select coalesce(sum(cogs), 0) from public.sale_items where sale_id = o.sale_id),
      discount_note = case when v_disc > 0 then nullif(trim(p ->> 'discount_note'), '') end
     where id = o.sale_id;
    delete from public.sale_payments where sale_id = o.sale_id;
    insert into public.sale_payments(sale_id, method, amount)
    select o.sale_id, v_method, v_sub - v_disc where v_sub - v_disc > 0;
  end if;

  perform public._order_log(o.id, o.status, o.status, 'Sửa thông tin đơn');
  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, before, after)
  values (auth.uid(), 'order.update', 'orders', o.id, o.store_id, v_before, p);
end $$;

revoke execute on function public.update_order(uuid, jsonb) from public, anon;
grant execute on function public.update_order(uuid, jsonb) to authenticated;
