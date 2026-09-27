-- Cho quan ly cua hang (sadmin/admin) sua phieu nhap DA XAC NHAN: mo lai ve nhap de sua SL/gia/HSD roi xac nhan lai.
-- An toan: chi mo lai duoc khi dao nguoc SACH SE, neu khong thi tu choi va yeu cau dung dieu chinh ton kho.
--   Rang buoc (tat ca phai dat):
--     1. Phieu chua thanh toan khi nhap (paid_amount = 0).
--     2. Cong no cua phieu (neu co) chua tra dong nao.
--     3. Moi dong hang: lo do phieu tao ra van con nguyen so luong, chi co dung 1 bien dong 'purchase',
--        va khong bi dung trong phieu chuyen kho.
--   Dao nguoc: xoa lo + bien dong nhap cua phieu, tinh lai ton va gia von binh quan tu cac lo con lai,
--   xoa cong no cua phieu, dua phieu ve trang thai nhap (giu nguyen dong hang, chi phi, NCC de sua tiep).

create or replace function public.reopen_purchase_receipt(p_receipt_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.purchase_receipts;
  it record;
  v_lot public.stock_lots;
  v_mv_count bigint;
  v_qty numeric;
  v_avg bigint;
begin
  -- Chi quan ly cua hang
  if public.auth_role() not in ('sadmin','admin') then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới mở lại được phiếu đã xác nhận');
  end if;
  select * into r from public.purchase_receipts where id = p_receipt_id for update;
  if r.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy phiếu nhập'); end if;
  if not public.can_access_store(r.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if r.status <> 'confirmed' then
    perform public.raise_error('INVALID_STATE', 'Chỉ mở lại được phiếu đã xác nhận');
  end if;

  -- Rang buoc 1: chua thanh toan khi nhap
  if r.paid_amount > 0 then
    perform public.raise_error('VALIDATION',
      'Phiếu đã có thanh toán khi nhập, không mở lại được. Hãy dùng điều chỉnh tồn kho.');
  end if;

  -- Rang buoc 2: cong no cua phieu chua tra dong nao
  if exists (select 1 from public.supplier_debts where receipt_id = r.id and paid_amount > 0) then
    perform public.raise_error('VALIDATION',
      'Công nợ của phiếu đã được thanh toán một phần, không mở lại được. Hãy dùng điều chỉnh tồn kho.');
  end if;

  -- Rang buoc 3: tung dong hang phai dao nguoc sach se
  for it in select * from public.purchase_receipt_items where receipt_id = r.id order by line_no loop
    select * into v_lot from public.stock_lots where receipt_item_id = it.id for update;
    if v_lot.id is null then
      perform public.raise_error('VALIDATION',
        format('Dòng %s: lô hàng đã gộp với lô khác, không tách để sửa được. Hãy dùng điều chỉnh tồn kho.', it.line_no));
    end if;
    if v_lot.qty_on_hand <> it.qty then
      perform public.raise_error('VALIDATION',
        format('Dòng %s: lô %s đã bán/chuyển bớt, không mở lại được. Hãy dùng điều chỉnh tồn kho.', it.line_no, v_lot.lot_no));
    end if;
    select count(*) into v_mv_count from public.stock_movements where lot_id = v_lot.id;
    if v_mv_count <> 1 then
      perform public.raise_error('VALIDATION',
        format('Dòng %s: lô %s đã phát sinh biến động khác, không mở lại được. Hãy dùng điều chỉnh tồn kho.', it.line_no, v_lot.lot_no));
    end if;
    if exists (select 1 from public.stock_transfer_items where lot_id = v_lot.id) then
      perform public.raise_error('VALIDATION',
        format('Dòng %s: lô %s đang nằm trong phiếu chuyển kho, không mở lại được.', it.line_no, v_lot.lot_no));
    end if;
  end loop;

  -- Dao nguoc: xoa bien dong nhap va lo cua phieu
  for it in select * from public.purchase_receipt_items where receipt_id = r.id loop
    select * into v_lot from public.stock_lots where receipt_item_id = it.id;
    delete from public.stock_movements where lot_id = v_lot.id;
    delete from public.stock_lots where id = v_lot.id;
  end loop;

  -- Tinh lai ton va gia von binh quan tu cac lo con lai cho tung san pham trong phieu
  for it in select distinct product_id from public.purchase_receipt_items where receipt_id = r.id loop
    -- khoa dong ton
    perform 1 from public.inventory where store_id = r.store_id and product_id = it.product_id for update;
    select coalesce(sum(qty_on_hand), 0),
           case when coalesce(sum(qty_on_hand), 0) > 0
                then round(sum(qty_on_hand * unit_cost) / sum(qty_on_hand)) else 0 end
      into v_qty, v_avg
      from public.stock_lots where store_id = r.store_id and product_id = it.product_id;
    update public.inventory set qty_on_hand = v_qty, avg_cost = v_avg, updated_at = now()
     where store_id = r.store_id and product_id = it.product_id;
    update public.products set cost_price_ref = v_avg where id = it.product_id;
  end loop;

  -- Xoa cong no cua phieu (da chac chan chua tra)
  delete from public.supplier_debts where receipt_id = r.id;

  -- Dua phieu ve nhap, xoa chi phi phan bo da tinh de xac nhan lai tinh lai tu dau
  update public.purchase_receipt_items set allocated_cost = 0, landed_unit_cost = null where receipt_id = r.id;
  update public.purchase_receipts set status = 'draft', confirmed_by = null, confirmed_at = null,
    paid_amount = 0, payment_method = null, due_date = null
   where id = r.id;

  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, before)
  values (auth.uid(), 'receipt.reopen', 'purchase_receipts', r.id, r.store_id,
          jsonb_build_object('total', r.total, 'confirmed_at', r.confirmed_at));

  return jsonb_build_object('id', r.id, 'code', r.code);
end $$;

revoke execute on function public.reopen_purchase_receipt(uuid) from public, anon;
grant execute on function public.reopen_purchase_receipt(uuid) to authenticated;
