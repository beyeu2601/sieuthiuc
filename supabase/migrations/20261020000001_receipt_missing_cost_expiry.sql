-- Gop y 17/10/2026: nhap hang khi chua co gia von / han su dung.
-- (1) Dong phieu nhap de trong don gia (purchase_receipt_items.unit_cost null) hoac HSD van luu nhap va xac nhan nhap kho.
--     Dong chua co gia: thanh tien 0, hang vao kho voi gia von chi gom chi phi phan bo (thuong la 0).
-- (2) complete_receipt_item (sadmin/admin): bo sung gia von va/hoac HSD cho dong cua phieu da xac nhan.
--     Gia von: cong tien hang vao phieu va cong no NCC (chua co no thi tao khoan no moi); gia von lo va gia von
--     binh quan kho tinh lai cho phan hang cua dong con ton. Hang da ban truoc do giu gia von cu.
--     HSD: ghi vao dong va lo cua dong.

alter table public.purchase_receipt_items alter column unit_cost drop not null;

------------------------------------------------------------
-- save_purchase_receipt: cho phep don gia trong (chua co gia von)
------------------------------------------------------------
create or replace function public.save_purchase_receipt(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_store uuid := (p ->> 'store_id')::uuid;
  r public.purchase_receipts;
  it jsonb;
  c jsonb;
  v_prod public.products;
  v_line integer := 0;
  v_qty numeric;
  v_cost bigint;
  v_sub bigint := 0;
  v_extra bigint := 0;
  v_disc bigint := coalesce(nullif(p ->> 'discount_amount', '')::bigint, 0);
begin
  perform public.assert_role('sadmin','admin','staff');
  if v_id is not null then
    select * into r from public.purchase_receipts where id = v_id for update;
    if r.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy phiếu nhập'); end if;
    if r.status <> 'draft' then
      perform public.raise_error('INVALID_STATE', 'Chỉ sửa được phiếu nháp. Phiếu đã xác nhận phải dùng phiếu điều chỉnh.');
    end if;
    v_store := r.store_id;
  end if;
  if not public.can_access_store(v_store) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if not exists (select 1 from public.suppliers where id = (p ->> 'supplier_id')::uuid) then
    perform public.raise_error('VALIDATION', 'Chọn nhà cung cấp');
  end if;

  if v_id is null then
    insert into public.purchase_receipts(code, store_id, supplier_id, receipt_date, invoice_no, note, due_date, received_by)
    values (public.next_doc_code('PN', public._store_code(v_store)), v_store, (p ->> 'supplier_id')::uuid,
            coalesce((p ->> 'receipt_date')::date, public._today()), nullif(trim(p ->> 'invoice_no'), ''),
            nullif(trim(p ->> 'note'), ''), (p ->> 'due_date')::date, auth.uid())
    returning * into r;
  else
    update public.purchase_receipts set
      supplier_id = (p ->> 'supplier_id')::uuid,
      receipt_date = coalesce((p ->> 'receipt_date')::date, receipt_date),
      invoice_no = nullif(trim(p ->> 'invoice_no'), ''),
      note = nullif(trim(p ->> 'note'), ''),
      due_date = (p ->> 'due_date')::date
    where id = r.id returning * into r;
    delete from public.purchase_receipt_items where receipt_id = r.id;
    delete from public.purchase_receipt_costs where receipt_id = r.id;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    v_line := v_line + 1;
    select * into v_prod from public.products where id = (it ->> 'product_id')::uuid;
    if v_prod.id is null then perform public.raise_error('VALIDATION', format('Dòng %s: sản phẩm không tồn tại', v_line)); end if;
    v_qty := (it ->> 'qty')::numeric;
    v_cost := nullif(it ->> 'unit_cost', '')::bigint;
    if v_qty is null or v_qty <= 0 then
      perform public.raise_error('VALIDATION', format('Dòng %s (%s): số lượng phải lớn hơn 0', v_line, v_prod.name));
    end if;
    if v_cost < 0 then
      perform public.raise_error('VALIDATION', format('Dòng %s (%s): đơn giá không hợp lệ', v_line, v_prod.name));
    end if;
    insert into public.purchase_receipt_items(receipt_id, line_no, product_id, goods_type, qty, unit, unit_cost,
      line_total, lot_no, expiry_date, sell_price)
    values (r.id, v_line, v_prod.id, v_prod.goods_type, v_qty, v_prod.unit, v_cost, round(v_qty * coalesce(v_cost, 0)),
      nullif(trim(it ->> 'lot_no'), ''), (it ->> 'expiry_date')::date,
      case when nullif(it ->> 'sell_price', '') is null then null else (it ->> 'sell_price')::bigint end);
    v_sub := v_sub + round(v_qty * coalesce(v_cost, 0));
  end loop;

  for c in select * from jsonb_array_elements(coalesce(p -> 'costs', '[]'::jsonb)) loop
    if coalesce((c ->> 'amount')::bigint, 0) <= 0 then continue; end if;
    insert into public.purchase_receipt_costs(receipt_id, cost_type, amount, allocation, note)
    values (r.id, coalesce(c ->> 'cost_type', 'other'), (c ->> 'amount')::bigint,
            coalesce(c ->> 'allocation', 'by_value'), nullif(trim(c ->> 'note'), ''));
    v_extra := v_extra + (c ->> 'amount')::bigint;
  end loop;

  if v_disc < 0 or v_disc > v_sub then
    perform public.raise_error('VALIDATION', 'Chiết khấu phải từ 0 đến tiền hàng');
  end if;

  update public.purchase_receipts set subtotal = v_sub, extra_cost_total = v_extra, discount_amount = v_disc,
    discount_note = case when v_disc > 0 then nullif(trim(p ->> 'discount_note'), '') end,
    total = v_sub + v_extra - v_disc
   where id = r.id;
  return jsonb_build_object('id', r.id, 'code', r.code);
end $$;

------------------------------------------------------------
-- confirm_purchase_receipt: khong bat buoc HSD; dong chua co gia von nhap kho voi gia 0 + chi phi phan bo
------------------------------------------------------------
create or replace function public.confirm_purchase_receipt(
  p_receipt_id uuid, p_paid_amount bigint default 0, p_payment_method public.payment_method default null,
  p_due_date date default null, p_record_in_shift boolean default false, p_account_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.purchase_receipts;
  it record;
  c record;
  v_weight_total numeric;
  v_alloc bigint;
  v_given bigint;
  v_last uuid;
  v_sup public.suppliers;
  v_due date;
  v_debt uuid;
  v_pay uuid;
  v_remaining bigint;
  v_shift uuid;
begin
  if not (public.auth_role() in ('sadmin','admin')
          or (public.auth_role() = 'staff' and public.auth_has_perm('confirm_receipt'))) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xác nhận phiếu nhập');
  end if;
  select * into r from public.purchase_receipts where id = p_receipt_id for update;
  if r.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy phiếu nhập'); end if;
  if not public.can_access_store(r.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if r.status = 'confirmed' then perform public.raise_error('ALREADY_CONFIRMED', 'Phiếu đã được xác nhận'); end if;
  if r.status <> 'draft' then perform public.raise_error('INVALID_STATE', 'Phiếu đã hủy'); end if;
  if not exists (select 1 from public.purchase_receipt_items where receipt_id = r.id) then
    perform public.raise_error('VALIDATION', 'Phiếu chưa có dòng hàng');
  end if;
  p_paid_amount := coalesce(p_paid_amount, 0);
  if p_paid_amount < 0 or p_paid_amount > r.total then
    perform public.raise_error('VALIDATION', 'Số tiền đã trả phải từ 0 đến tổng tiền phiếu');
  end if;
  if p_paid_amount > 0 and p_payment_method is null then
    perform public.raise_error('VALIDATION', 'Chọn phương thức thanh toán');
  end if;
  perform public._check_money_account(p_account_id);
  if p_record_in_shift and p_paid_amount > 0 and p_payment_method = 'cash' then
    v_shift := public._my_open_shift(r.store_id);
    if v_shift is null then
      perform public.raise_error('SHIFT_NOT_OPEN', 'Bạn chưa mở ca để ghi tiền mặt chi ra');
    end if;
  end if;

  -- 0. San pham co nhieu dong de trong so lo (nhieu HSD): dat so lo khac nhau cho tung dong
  update public.purchase_receipt_items i
     set lot_no = r.code || '-' || x.rn
  from (
    select id,
           row_number() over (partition by product_id order by line_no) as rn,
           count(*) over (partition by product_id) as cnt
    from public.purchase_receipt_items
    where receipt_id = r.id and lot_no is null
  ) x
  where i.id = x.id and x.cnt > 1;

  -- 1. Phan bo chi phi kem theo, phan du don vao dong cuoi
  update public.purchase_receipt_items set allocated_cost = 0 where receipt_id = r.id;
  select id into v_last from public.purchase_receipt_items where receipt_id = r.id order by line_no desc limit 1;
  for c in select * from public.purchase_receipt_costs where receipt_id = r.id loop
    select sum(case when c.allocation = 'by_qty' then qty else line_total end) into v_weight_total
      from public.purchase_receipt_items where receipt_id = r.id;
    v_given := 0;
    for it in select * from public.purchase_receipt_items where receipt_id = r.id order by line_no loop
      if it.id = v_last then
        v_alloc := c.amount - v_given;
      elsif v_weight_total > 0 then
        v_alloc := floor(c.amount * (case when c.allocation = 'by_qty' then it.qty else it.line_total end) / v_weight_total);
      else
        v_alloc := 0;
      end if;
      update public.purchase_receipt_items set allocated_cost = allocated_cost + v_alloc where id = it.id;
      v_given := v_given + v_alloc;
    end loop;
  end loop;
  -- 1b. Chiet khau / thuong NCC: tru vao gia von theo gia tri dong hang
  if r.discount_amount > 0 then
    select sum(line_total) into v_weight_total from public.purchase_receipt_items where receipt_id = r.id;
    v_given := 0;
    for it in select * from public.purchase_receipt_items where receipt_id = r.id order by line_no loop
      if it.id = v_last then
        v_alloc := r.discount_amount - v_given;
      elsif v_weight_total > 0 then
        v_alloc := floor(r.discount_amount * it.line_total / v_weight_total);
      else
        v_alloc := 0;
      end if;
      update public.purchase_receipt_items set allocated_cost = allocated_cost - v_alloc where id = it.id;
      v_given := v_given + v_alloc;
    end loop;
  end if;
  update public.purchase_receipt_items set landed_unit_cost = greatest(0, round(coalesce(unit_cost, 0) + allocated_cost / qty))
   where receipt_id = r.id;

  -- 2. Nhap kho theo lo, WAVG, bien dong; cap nhat gia von TC va gia ban (neu co nhap gia ban tren dong)
  for it in select * from public.purchase_receipt_items where receipt_id = r.id order by line_no loop
    perform public._receive_stock(r.store_id, it.product_id, it.qty, it.landed_unit_cost,
      coalesce(it.lot_no, r.code), it.expiry_date, 'purchase', 'purchase_receipt', r.id, it.id);
    update public.products p set cost_price_ref = i.avg_cost
      from public.inventory i
     where p.id = it.product_id and i.store_id = r.store_id and i.product_id = it.product_id;
    if it.sell_price is not null and it.sell_price >= 0 then
      update public.products
        set sell_price = it.sell_price, pricing_method = 'manual'
       where id = it.product_id and (sell_price <> it.sell_price or pricing_method <> 'manual');
    end if;
  end loop;

  -- 3. Cong no va thanh toan (SPEC 7.7)
  select * into v_sup from public.suppliers where id = r.supplier_id;
  v_due := coalesce(p_due_date, r.due_date, r.receipt_date + v_sup.payment_terms_days);
  v_remaining := r.total - p_paid_amount;

  if v_remaining > 0 then
    insert into public.supplier_debts(code, store_id, supplier_id, receipt_id, issued_date, due_date, total_amount)
    values (public.next_doc_code('CN', public._store_code(r.store_id)), r.store_id, r.supplier_id, r.id,
            r.receipt_date, v_due, r.total)
    returning id into v_debt;
  end if;

  if p_paid_amount > 0 then
    insert into public.supplier_payments(code, supplier_id, store_id, payment_date, amount, method, receipt_id, note, shift_id, account_id)
    values (public.next_doc_code('TT', public._store_code(r.store_id)), r.supplier_id, r.store_id,
            r.receipt_date, p_paid_amount, p_payment_method, r.id, 'Thanh toán khi nhập hàng ' || r.code, v_shift, p_account_id)
    returning id into v_pay;
    if v_debt is not null then
      perform public._allocate_supplier_payment(v_pay,
        jsonb_build_array(jsonb_build_object('debt_id', v_debt, 'amount', p_paid_amount)));
    end if;
    if v_shift is not null then
      perform public._shift_cash(v_shift, 'expense', p_paid_amount, 'Trả NCC khi nhập hàng ' || r.code,
        'supplier_payment', v_pay);
    end if;
  end if;

  update public.purchase_receipts set status = 'confirmed', paid_amount = p_paid_amount,
    payment_method = p_payment_method, due_date = case when v_remaining > 0 then v_due end,
    confirmed_by = auth.uid(), confirmed_at = now()
   where id = r.id;

  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, after)
  values (auth.uid(), 'receipt.confirm', 'purchase_receipts', r.id, r.store_id,
          jsonb_build_object('total', r.total, 'paid', p_paid_amount, 'debt_id', v_debt));

  return jsonb_build_object('id', r.id, 'code', r.code, 'debt_id', v_debt, 'payment_id', v_pay);
end $$;

------------------------------------------------------------
-- complete_receipt_item: bo sung gia von / HSD cho dong con thieu cua phieu da xac nhan (sadmin/admin)
--   p = {unit_cost, expiry_date}; chi nhan truong dong dang thieu.
------------------------------------------------------------
create or replace function public.complete_receipt_item(p_item_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  it public.purchase_receipt_items;
  r public.purchase_receipts;
  v_lot public.stock_lots;
  inv public.inventory;
  d public.supplier_debts;
  v_sup public.suppliers;
  v_cost bigint := nullif(p ->> 'unit_cost', '')::bigint;
  v_exp date := nullif(p ->> 'expiry_date', '')::date;
  v_delta bigint;
  v_rem numeric;
  v_due date;
begin
  if public.auth_role() not in ('sadmin','admin') then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới bổ sung được giá vốn và hạn sử dụng');
  end if;
  select * into it from public.purchase_receipt_items where id = p_item_id for update;
  if it.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy dòng phiếu nhập'); end if;
  select * into r from public.purchase_receipts where id = it.receipt_id for update;
  if not public.can_access_store(r.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if r.status <> 'confirmed' then
    perform public.raise_error('INVALID_STATE', 'Phiếu chưa nhập kho: sửa trực tiếp trên phiếu nháp');
  end if;
  if v_cost is null and v_exp is null then perform public.raise_error('VALIDATION', 'Nhập giá vốn hoặc hạn sử dụng'); end if;
  if v_cost is not null and it.unit_cost is not null then
    perform public.raise_error('INVALID_STATE', 'Dòng đã có giá vốn');
  end if;
  if v_exp is not null and it.expiry_date is not null then
    perform public.raise_error('INVALID_STATE', 'Dòng đã có hạn sử dụng');
  end if;
  if v_cost < 0 then perform public.raise_error('VALIDATION', 'Giá vốn không hợp lệ'); end if;

  select * into v_lot from public.stock_lots
   where store_id = r.store_id and product_id = it.product_id and lot_no = coalesce(it.lot_no, r.code) for update;

  if v_exp is not null then
    update public.purchase_receipt_items set expiry_date = v_exp where id = it.id;
    if v_lot.id is not null and v_lot.expiry_date is null then
      update public.stock_lots set expiry_date = v_exp where id = v_lot.id;
    end if;
  end if;

  if v_cost is not null then
    v_delta := round(it.qty * v_cost);
    update public.purchase_receipt_items set unit_cost = v_cost, line_total = v_delta,
      landed_unit_cost = coalesce(landed_unit_cost, 0) + v_cost
     where id = it.id;

    -- Gia von: phan hang cua dong con nam trong lo (lo gop voi dong khac thi tinh theo ty le)
    v_rem := 0;
    if v_lot.id is not null then
      v_rem := least(it.qty, v_lot.qty_on_hand);
      update public.stock_lots set unit_cost = case
          when qty_on_hand > 0 then round(unit_cost + v_cost * v_rem / qty_on_hand)
          when receipt_item_id = it.id then unit_cost + v_cost
          else unit_cost end
       where id = v_lot.id;
    end if;
    inv := public._lock_inventory(r.store_id, it.product_id);
    if inv.qty_on_hand > 0 and v_rem > 0 then
      update public.inventory set avg_cost = round((avg_cost * qty_on_hand + v_cost * v_rem) / qty_on_hand), updated_at = now()
       where store_id = r.store_id and product_id = it.product_id;
      update public.products p set cost_price_ref = i.avg_cost
        from public.inventory i
       where p.id = it.product_id and i.store_id = r.store_id and i.product_id = it.product_id;
    end if;

    -- Tien hang: cong vao phieu va cong no NCC
    if v_delta > 0 then
      update public.purchase_receipts set subtotal = subtotal + v_delta, total = total + v_delta where id = r.id;
      select * into d from public.supplier_debts where receipt_id = r.id for update;
      if d.id is not null then
        update public.supplier_debts set total_amount = total_amount + v_delta,
          status = case when paid_amount > 0 then 'partial'::public.debt_status else 'unpaid'::public.debt_status end
         where id = d.id;
      else
        select * into v_sup from public.suppliers where id = r.supplier_id;
        v_due := coalesce(r.due_date, r.receipt_date + v_sup.payment_terms_days);
        insert into public.supplier_debts(code, store_id, supplier_id, receipt_id, issued_date, due_date, total_amount, note)
        values (public.next_doc_code('CN', public._store_code(r.store_id)), r.store_id, r.supplier_id, r.id,
                r.receipt_date, v_due, v_delta, 'Bổ sung giá vốn sau khi nhập kho');
        update public.purchase_receipts set due_date = v_due where id = r.id;
      end if;
    end if;
  end if;

  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, before, after)
  values (auth.uid(), 'receipt.complete_item', 'purchase_receipts', r.id, r.store_id,
          jsonb_build_object('item_id', it.id, 'unit_cost', it.unit_cost, 'expiry_date', it.expiry_date),
          jsonb_build_object('unit_cost', v_cost, 'expiry_date', v_exp));
end $$;

revoke execute on function public.complete_receipt_item(uuid, jsonb) from public, anon;
grant execute on function public.complete_receipt_item(uuid, jsonb) to authenticated;
