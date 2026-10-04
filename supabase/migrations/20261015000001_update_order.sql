-- Gop y 04/10/2026: sua thong tin don online (khong sua dong san pham).
-- Sua duoc: ma don san, khach, dien thoai, dia chi, ghi chu, thanh toan, phi ship, giam gia + ly do,
-- tien Shopee tra ve (tinh lai platform_fee). Don da giao thi cap nhat luon giao dich ban (giam gia, tong,
-- ly do, dong thanh toan). Khoa khi don da huy/hoan hoac da doi soat tien Shopee.

create or replace function public.update_order(p_order_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_ext text := nullif(trim(p ->> 'external_order_id'), '');
  v_ship bigint := coalesce((p ->> 'shipping_fee')::bigint, 0);
  v_disc bigint := coalesce((p ->> 'discount_amount')::bigint, 0);
  v_payout bigint := (p ->> 'payout_amount')::bigint;
  v_method public.payment_method := coalesce(p ->> 'payment_method', 'transfer')::public.payment_method;
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
  if v_ext is not null and exists (
       select 1 from public.orders where channel = o.channel and external_order_id = v_ext and id <> o.id) then
    perform public.raise_error('VALIDATION', 'Mã đơn trên sàn đã được nhập trước đó');
  end if;
  if v_ship < 0 then perform public.raise_error('VALIDATION', 'Phí ship không hợp lệ'); end if;
  if v_disc < 0 or v_disc > o.subtotal then
    perform public.raise_error('VALIDATION', 'Giảm giá lớn hơn tiền hàng');
  end if;
  if o.channel <> 'shopee' then v_payout := null; end if;
  if v_payout is not null and (v_payout < 0 or v_payout > o.subtotal - v_disc) then
    perform public.raise_error('VALIDATION', 'Tiền sàn trả về phải từ 0 đến tiền hàng sau giảm giá');
  end if;

  update public.orders set
    external_order_id = v_ext,
    customer_name = nullif(trim(p ->> 'customer_name'), ''),
    customer_phone = nullif(trim(p ->> 'customer_phone'), ''),
    shipping_address = nullif(trim(p ->> 'shipping_address'), ''),
    note = nullif(trim(p ->> 'note'), ''),
    payment_method = v_method,
    shipping_fee = v_ship,
    discount_amount = v_disc,
    discount_note = case when v_disc > 0 then nullif(trim(p ->> 'discount_note'), '') end,
    total = subtotal + v_ship - v_disc,
    platform_fee = coalesce(subtotal - v_disc - v_payout, 0),
    updated_at = now()
   where id = o.id;

  -- Don da giao: giao dich ban theo don (khong co giam gia dong) ghi lai giam gia va thanh toan
  if o.sale_id is not null then
    update public.sales set discount_amount = v_disc, total = subtotal - v_disc,
      discount_note = case when v_disc > 0 then nullif(trim(p ->> 'discount_note'), '') end
     where id = o.sale_id;
    delete from public.sale_payments where sale_id = o.sale_id;
    insert into public.sale_payments(sale_id, method, amount)
    select o.sale_id, v_method, o.subtotal - v_disc where o.subtotal - v_disc > 0;
  end if;

  perform public._order_log(o.id, o.status, o.status, 'Sửa thông tin đơn');
end $$;

revoke execute on function public.update_order(uuid, jsonb) from public, anon;
grant execute on function public.update_order(uuid, jsonb) to authenticated;
