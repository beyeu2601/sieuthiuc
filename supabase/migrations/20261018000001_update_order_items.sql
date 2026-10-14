-- Gop y 14/10/2026: sua don online duoc ca kenh ban va dong san pham (gia ban).
-- - p.channel (shopee/facebook/other): khong gui thi giu nguyen. Don da giao doi luon kenh cua giao dich ban.
-- - p.items [{product_id, qty, unit_price}]: khong gui thi giu nguyen dong.
--   Don cho giao/dang giao: thay toan bo dong, bo giu hang cu roi giu lai theo dong moi (kiem tra kha dung).
--   Don da giao: chi doi gia ban; san pham va so luong phai giu nguyen vi kho da xuat theo lo va da ghi gia von
--   (doi hang thi hoan hang roi tao don moi). Giao dich ban cap nhat gia, thanh tien, tien hang, tong.
-- Truoc/sau ghi vao audit_logs (order.update).

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

    if o.status = 'delivered' then
      if jsonb_array_length(v_items) <> (select count(*) from public.order_items where order_id = o.id)
         or exists (
           select 1 from jsonb_array_elements(v_items) e
            where not exists (select 1 from public.order_items oi where oi.order_id = o.id
                                and oi.product_id = (e ->> 'product_id')::uuid and oi.qty = (e ->> 'qty')::numeric)) then
        perform public.raise_error('VALIDATION',
          'Đơn đã giao chỉ sửa được giá bán. Đổi sản phẩm hoặc số lượng thì hoàn hàng và tạo đơn mới');
      end if;
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

  -- Don da giao: giao dich ban theo don (khong co giam gia dong) ghi lai kenh, tien hang, giam gia va thanh toan
  if o.sale_id is not null then
    update public.sales set channel = v_channel, subtotal = v_sub, discount_amount = v_disc, total = v_sub - v_disc,
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
