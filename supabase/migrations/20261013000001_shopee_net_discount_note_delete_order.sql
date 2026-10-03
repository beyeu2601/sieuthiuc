-- Gop y cua Giang 03/10/2026:
-- 1. Don Shopee nhap "Tien Shopee tra ve" (da tru phi san). Chenh lech voi tong don luu o orders.platform_fee,
--    khong ghi vao giam gia. Khi doi soat, phi san van ghi khoan chi "Phí sàn Shopee" nhu cu.
-- 2. Tao don co the ghi "Da giao" ngay (don gop nhieu san pham cho ca dot, khong can ma don san).
-- 3. Ly do giam gia: orders.discount_note, sales.discount_note (POS va don online).
-- 4. Xoa don da huy hoac da hoan va nhap lai kho, chua doi soat (sadmin/admin).

alter table public.orders
  add column platform_fee bigint not null default 0 check (platform_fee >= 0),
  add column discount_note text;
alter table public.sales add column discount_note text;
grant select (discount_note) on public.sales to authenticated;

------------------------------------------------------------
-- create_order: them payout_amount (tien san tra ve), discount_note, deliver_now
------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_id uuid := gen_random_uuid();
  v_code text;
  it jsonb;
  v_prod public.products;
  inv public.inventory;
  v_qty numeric;
  v_price bigint;
  v_sub bigint := 0;
  v_items jsonb;
  v_disc bigint := coalesce((p ->> 'discount_amount')::bigint, 0);
  v_payout bigint := (p ->> 'payout_amount')::bigint;
begin
  perform public.assert_role('sadmin','admin','staff');
  if not public.can_access_store(v_store) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if coalesce(p ->> 'channel', 'pos') = 'pos' then
    perform public.raise_error('VALIDATION', 'Chọn kênh bán online');
  end if;
  if nullif(trim(p ->> 'external_order_id'), '') is not null and exists (
       select 1 from public.orders where channel = (p ->> 'channel')::public.sale_channel
         and external_order_id = trim(p ->> 'external_order_id')) then
    perform public.raise_error('VALIDATION', 'Mã đơn trên sàn đã được nhập trước đó');
  end if;

  select coalesce(jsonb_agg(x order by x ->> 'product_id'), '[]'::jsonb) into v_items from (
    select jsonb_build_object('product_id', e ->> 'product_id', 'qty', sum((e ->> 'qty')::numeric),
             'unit_price', max((e ->> 'unit_price')::bigint)) as x
    from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) e group by e ->> 'product_id') q;
  if jsonb_array_length(v_items) = 0 then perform public.raise_error('VALIDATION', 'Đơn chưa có sản phẩm'); end if;

  v_code := public.next_doc_code('DH', public._store_code(v_store));
  insert into public.orders(id, code, store_id, channel, external_order_id, customer_name, customer_phone,
    shipping_address, shipping_fee, discount_amount, discount_note, payment_method, note)
  values (v_id, v_code, v_store, (p ->> 'channel')::public.sale_channel, nullif(trim(p ->> 'external_order_id'), ''),
    nullif(trim(p ->> 'customer_name'), ''), nullif(trim(p ->> 'customer_phone'), ''),
    nullif(trim(p ->> 'shipping_address'), ''), coalesce((p ->> 'shipping_fee')::bigint, 0),
    v_disc, case when v_disc > 0 then nullif(trim(p ->> 'discount_note'), '') end,
    coalesce(p ->> 'payment_method', 'transfer')::public.payment_method,
    nullif(trim(p ->> 'note'), ''));

  for it in select * from jsonb_array_elements(v_items) loop
    select * into v_prod from public.products where id = (it ->> 'product_id')::uuid;
    if v_prod.id is null or v_prod.status <> 'active' then
      perform public.raise_error('VALIDATION', 'Sản phẩm không tồn tại hoặc đã ngừng bán');
    end if;
    v_qty := (it ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then perform public.raise_error('VALIDATION', format('%s: số lượng phải lớn hơn 0', v_prod.name)); end if;
    v_price := coalesce((it ->> 'unit_price')::bigint, v_prod.sell_price);
    if v_price < 0 then perform public.raise_error('VALIDATION', format('%s: giá không hợp lệ', v_prod.name)); end if;

    inv := public._lock_inventory(v_store, v_prod.id);
    if inv.qty_available < v_qty then
      perform public.raise_error('INSUFFICIENT_STOCK', format('%s: chỉ còn %s', v_prod.name, greatest(inv.qty_available, 0)::float8));
    end if;
    update public.inventory set qty_reserved = qty_reserved + v_qty, updated_at = now()
     where store_id = v_store and product_id = v_prod.id;
    insert into public.stock_movements(store_id, product_id, movement_type, qty_delta, qty_before, qty_after,
      unit_cost, ref_type, ref_id, note)
    values (v_store, v_prod.id, 'order_reserve', 0, inv.qty_on_hand, inv.qty_on_hand, 0, 'order', v_id,
      format('Giữ %s cho đơn %s', v_qty::float8, v_code));
    insert into public.order_items(order_id, product_id, qty, unit_price) values (v_id, v_prod.id, v_qty, v_price);
    v_sub := v_sub + round(v_qty * v_price);
  end loop;

  if v_disc > v_sub then
    perform public.raise_error('VALIDATION', 'Giảm giá lớn hơn tiền hàng');
  end if;
  -- tien san tra ve so voi tien hang sau giam gia (cung co so voi doi soat: sales.total)
  if v_payout is not null and (v_payout < 0 or v_payout > v_sub - v_disc) then
    perform public.raise_error('VALIDATION', 'Tiền sàn trả về phải từ 0 đến tiền hàng sau giảm giá');
  end if;
  update public.orders set subtotal = v_sub, total = v_sub + shipping_fee - discount_amount,
    platform_fee = coalesce(v_sub - v_disc - v_payout, 0)
   where id = v_id;
  perform public._order_log(v_id, null, 'pending', 'Tạo đơn');
  if coalesce((p ->> 'deliver_now')::boolean, false) then
    perform public.update_order_status(v_id, 'delivered', 'Tạo đơn đã giao');
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

------------------------------------------------------------
-- update_order_status: chep ly do giam gia sang giao dich ban
------------------------------------------------------------
create or replace function public.update_order_status(p_order_id uuid, p_to public.order_status, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_sale jsonb;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy đơn'); end if;
  if not public.can_access_store(o.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;

  if p_to = 'shipped' and o.status = 'pending' then
    update public.orders set status = 'shipped' where id = o.id;
  elsif p_to = 'cancelled' and o.status in ('pending','shipped') then
    if nullif(trim(p_note), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do hủy đơn'); end if;
    perform public._release_order(o, 'hủy đơn');
    update public.orders set status = 'cancelled', cancel_reason = trim(p_note) where id = o.id;
  elsif p_to = 'delivered' and o.status in ('pending','shipped') then
    -- bo giu hang roi ghi nhan ban nhu giao dich binh thuong (FEFO, COGS, doanh thu theo kenh)
    perform public._release_order(o, 'giao thành công');
    v_sale := public._post_sale(jsonb_build_object(
      'store_id', o.store_id, 'channel', o.channel, 'order_id', o.id,
      'note', 'Đơn ' || o.code || coalesce(' / ' || o.external_order_id, ''),
      'use_given_price', true, 'skip_discount_limit', true,
      'discount_amount', o.discount_amount,
      'items', (select jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty, 'unit_price', unit_price))
                from public.order_items where order_id = o.id),
      'payments', jsonb_build_array(jsonb_build_object('method', o.payment_method, 'amount', o.subtotal - o.discount_amount))));
    update public.sales set discount_note = o.discount_note where id = (v_sale ->> 'id')::uuid;
    update public.orders set status = 'delivered', sale_id = (v_sale ->> 'id')::uuid where id = o.id;
  else
    perform public.raise_error('INVALID_STATE', 'Không chuyển được trạng thái đơn như vậy');
  end if;
  perform public._order_log(o.id, o.status, p_to, p_note);
  return jsonb_build_object('id', o.id, 'status', p_to, 'sale_id', v_sale ->> 'id');
end $$;

------------------------------------------------------------
-- complete_sale: luu ly do giam gia
------------------------------------------------------------
create or replace function public.complete_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_existing public.sales;
  v_shift uuid;
  r jsonb;
begin
  perform public.assert_role('sadmin','admin','staff');
  if not public.can_access_store(v_store) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if nullif(p ->> 'idempotency_key', '') is not null then
    select * into v_existing from public.sales where idempotency_key = p ->> 'idempotency_key';
    if v_existing.id is not null then
      return jsonb_build_object('id', v_existing.id, 'code', v_existing.code, 'total', v_existing.total, 'duplicate', true);
    end if;
  end if;
  v_shift := public._my_open_shift(v_store);
  if v_shift is null or v_shift <> coalesce(nullif(p ->> 'shift_id', '')::uuid, v_shift) then
    perform public.raise_error('SHIFT_NOT_OPEN', 'Bạn chưa mở ca tại cửa hàng này');
  end if;
  r := public._post_sale(p || jsonb_build_object('shift_id', v_shift, 'channel', 'pos', 'order_id', null));
  update public.sales set discount_note = nullif(trim(p ->> 'discount_note'), '')
   where id = (r ->> 'id')::uuid and discount_amount > 0;
  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, after)
  values (auth.uid(), 'sale.complete', 'sales', (r ->> 'id')::uuid, v_store, r);
  return r;
end $$;

------------------------------------------------------------
-- delete_order: xoa don da huy, hoac da hoan va nhap lai kho, chua doi soat.
-- Tong bien dong kho cua cac don nay bang 0 nen xoa kem bien dong giu/ban/nhap lai.
-- Vet con trong audit_logs (trigger audit_orders, audit_sales).
------------------------------------------------------------
create or replace function public.delete_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy đơn'); end if;
  if not public.is_store_manager(o.store_id) then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới xóa được đơn');
  end if;
  if not (o.status = 'cancelled' or (o.status = 'returned' and o.return_status = 'restocked')) then
    perform public.raise_error('INVALID_STATE', 'Chỉ xóa được đơn đã hủy hoặc đã hoàn và nhập lại kho');
  end if;
  if o.payout_id is not null then
    perform public.raise_error('INVALID_STATE', 'Đơn đã đối soát nhận tiền, không xóa được');
  end if;

  delete from public.stock_movements
   where (ref_type = 'order' and ref_id = o.id) or (o.sale_id is not null and ref_type = 'sale' and ref_id = o.sale_id);
  update public.orders set sale_id = null where id = o.id;
  if o.sale_id is not null then
    delete from public.sale_payments where sale_id = o.sale_id;
    delete from public.sale_items where sale_id = o.sale_id;
    delete from public.sales where id = o.sale_id;
  end if;
  delete from public.order_items where order_id = o.id;
  delete from public.order_status_history where order_id = o.id;
  delete from public.orders where id = o.id;
end $$;

revoke execute on function public.create_order(jsonb) from public, anon;
revoke execute on function public.update_order_status(uuid, public.order_status, text) from public, anon;
revoke execute on function public.complete_sale(jsonb) from public, anon;
revoke execute on function public.delete_order(uuid) from public, anon;
grant execute on function public.create_order(jsonb) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.complete_sale(jsonb) to authenticated;
grant execute on function public.delete_order(uuid) to authenticated;
