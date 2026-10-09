-- Gop y 04-05/10/2026:
-- (1) Chiet khau / thuong chuong trinh cua NCC tren phieu nhap (vd tien hang 3.120.000, thuong 165.000 => tra 2.955.000):
--     purchase_receipts.discount_amount tru vao tong phieu, khi xac nhan phan bo giam gia von theo gia tri dong hang.
-- (2) Ghi chiet khau cho phieu DA xac nhan (phieu Anh Anh Vu da ban/dieu chinh hang nen khong mo lai duoc):
--     add_receipt_discount giam tong phieu; con no thi giam no, da tra ngay khi nhap thi giam khoan tra do.
--     Gia von cac lo da nhap giu nguyen (hang co the da ban), sua bang chinh gia von o trang san pham neu can.
-- (3) No dau ky NCC (khoan no co tu truoc khi dung app): supplier_debts khong gan phieu nhap, co ghi chu.

alter table public.purchase_receipts
  add column discount_amount bigint not null default 0 check (discount_amount >= 0),
  add column discount_note text;

alter table public.supplier_debts add column note text;

------------------------------------------------------------
-- save_purchase_receipt: nhan them discount_amount, discount_note
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
    v_cost := (it ->> 'unit_cost')::bigint;
    if v_qty is null or v_qty <= 0 then
      perform public.raise_error('VALIDATION', format('Dòng %s (%s): số lượng phải lớn hơn 0', v_line, v_prod.name));
    end if;
    if v_cost is null or v_cost < 0 then
      perform public.raise_error('VALIDATION', format('Dòng %s (%s): đơn giá không hợp lệ', v_line, v_prod.name));
    end if;
    insert into public.purchase_receipt_items(receipt_id, line_no, product_id, goods_type, qty, unit, unit_cost,
      line_total, lot_no, expiry_date, sell_price)
    values (r.id, v_line, v_prod.id, v_prod.goods_type, v_qty, v_prod.unit, v_cost, round(v_qty * v_cost),
      nullif(trim(it ->> 'lot_no'), ''), (it ->> 'expiry_date')::date,
      case when nullif(it ->> 'sell_price', '') is null then null else (it ->> 'sell_price')::bigint end);
    v_sub := v_sub + round(v_qty * v_cost);
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
-- confirm_purchase_receipt: phan bo chiet khau giam gia von (theo gia tri dong hang, du don vao dong cuoi)
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
  for it in select i.line_no, p.name from public.purchase_receipt_items i join public.products p on p.id = i.product_id
             where i.receipt_id = r.id and p.expiry_level = 'lot' and i.expiry_date is null loop
    perform public.raise_error('VALIDATION', format('Dòng %s (%s): nhập hạn sử dụng', it.line_no, it.name));
  end loop;
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
  update public.purchase_receipt_items set landed_unit_cost = greatest(0, round(unit_cost + allocated_cost / qty))
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
-- add_receipt_discount: ghi chiet khau cho phieu da xac nhan (sadmin/admin)
--   Con no cua phieu: giam no (khong qua so con no). Khong con no va co khoan tra khi nhap: giam khoan tra do.
------------------------------------------------------------
create or replace function public.add_receipt_discount(p_receipt_id uuid, p_amount bigint, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.purchase_receipts;
  d public.supplier_debts;
  pay public.supplier_payments;
begin
  if public.auth_role() not in ('sadmin','admin') then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới ghi được chiết khấu cho phiếu đã xác nhận');
  end if;
  select * into r from public.purchase_receipts where id = p_receipt_id for update;
  if r.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy phiếu nhập'); end if;
  if not public.can_access_store(r.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if r.status <> 'confirmed' then
    perform public.raise_error('INVALID_STATE', 'Chỉ ghi chiết khấu sau cho phiếu đã xác nhận. Phiếu nháp nhập ở bước Chi phí.');
  end if;
  if coalesce(p_amount, 0) <= 0 then perform public.raise_error('VALIDATION', 'Số tiền chiết khấu phải lớn hơn 0'); end if;
  if nullif(trim(p_note), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do chiết khấu'); end if;

  select * into d from public.supplier_debts where receipt_id = r.id for update;
  if d.id is not null and d.remaining > 0 then
    if p_amount > d.remaining then
      perform public.raise_error('VALIDATION', format('Chiết khấu vượt số còn nợ của phiếu (%s)', d.remaining));
    end if;
    if p_amount = d.total_amount then
      -- chua tra dong nao va chiet khau het: bo khoan no
      delete from public.supplier_debts where id = d.id;
    else
      update public.supplier_debts set total_amount = total_amount - p_amount,
        status = case when paid_amount = total_amount - p_amount then 'paid'::public.debt_status
                      when paid_amount > 0 then 'partial'::public.debt_status else 'unpaid'::public.debt_status end
       where id = d.id;
    end if;
  else
    select * into pay from public.supplier_payments where receipt_id = r.id order by created_at limit 1 for update;
    if pay.id is null or d.id is not null then
      perform public.raise_error('VALIDATION', 'Phiếu đã trả hết qua công nợ, không trừ chiết khấu tự động được');
    end if;
    if p_amount >= pay.amount then
      perform public.raise_error('VALIDATION', format('Chiết khấu phải nhỏ hơn số đã trả khi nhập (%s)', pay.amount));
    end if;
    if pay.shift_id is not null then
      if not exists (select 1 from public.shifts where id = pay.shift_id and status = 'open') then
        perform public.raise_error('INVALID_STATE', 'Khoản trả tiền mặt thuộc ca đã chốt, không sửa được');
      end if;
      update public.shift_cash_movements set amount = amount - p_amount
       where ref_type = 'supplier_payment' and ref_id = pay.id;
    end if;
    update public.supplier_payments set amount = amount - p_amount where id = pay.id;
    update public.purchase_receipts set paid_amount = paid_amount - p_amount where id = r.id;
  end if;

  update public.purchase_receipts set discount_amount = discount_amount + p_amount, total = total - p_amount,
    discount_note = concat_ws('; ', discount_note, trim(p_note))
   where id = r.id;

  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, before, after)
  values (auth.uid(), 'receipt.discount', 'purchase_receipts', r.id, r.store_id,
          jsonb_build_object('total', r.total, 'paid', r.paid_amount, 'discount', r.discount_amount),
          jsonb_build_object('amount', p_amount, 'note', trim(p_note), 'debt_id', d.id, 'payment_id', pay.id));
end $$;

------------------------------------------------------------
-- No dau ky NCC (sadmin/admin/ke toan)
------------------------------------------------------------
create or replace function public.create_supplier_opening_debt(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_sup public.suppliers;
  v_amount bigint := nullif(p ->> 'amount', '')::bigint;
  v_issued date := coalesce(nullif(p ->> 'issued_date', '')::date, public._today());
  v_due date;
  v_id uuid;
  v_code text;
begin
  perform public.assert_role('sadmin','admin','accountant');
  if not public.can_access_store(v_store) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  select * into v_sup from public.suppliers where id = (p ->> 'supplier_id')::uuid;
  if v_sup.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy nhà cung cấp'); end if;
  if coalesce(v_amount, 0) <= 0 then perform public.raise_error('VALIDATION', 'Số tiền nợ phải lớn hơn 0'); end if;
  v_due := coalesce(nullif(p ->> 'due_date', '')::date, v_issued + v_sup.payment_terms_days);
  if v_due < v_issued then perform public.raise_error('VALIDATION', 'Hạn trả phải từ ngày ghi nợ trở đi'); end if;

  v_code := public.next_doc_code('CN', public._store_code(v_store));
  insert into public.supplier_debts(code, store_id, supplier_id, issued_date, due_date, total_amount, note)
  values (v_code, v_store, v_sup.id, v_issued, v_due, v_amount, coalesce(nullif(trim(p ->> 'note'), ''), 'Nợ đầu kỳ'))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- Xoa no dau ky nhap sai: chi khoan khong gan phieu nhap va chua tra dong nao
create or replace function public.delete_supplier_opening_debt(p_debt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.supplier_debts;
begin
  perform public.assert_role('sadmin','admin','accountant');
  select * into d from public.supplier_debts where id = p_debt_id for update;
  if d.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy khoản nợ'); end if;
  if not public.can_access_store(d.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if d.receipt_id is not null then
    perform public.raise_error('INVALID_STATE', 'Khoản nợ sinh từ phiếu nhập, không xóa được');
  end if;
  if d.paid_amount > 0 then
    perform public.raise_error('INVALID_STATE', 'Khoản nợ đã có thanh toán, không xóa được');
  end if;
  delete from public.supplier_debts where id = d.id;
end $$;

revoke execute on function public.add_receipt_discount(uuid, bigint, text) from public, anon;
revoke execute on function public.create_supplier_opening_debt(jsonb) from public, anon;
revoke execute on function public.delete_supplier_opening_debt(uuid) from public, anon;
grant execute on function public.add_receipt_discount(uuid, bigint, text) to authenticated;
grant execute on function public.create_supplier_opening_debt(jsonb) to authenticated;
grant execute on function public.delete_supplier_opening_debt(uuid) to authenticated;
