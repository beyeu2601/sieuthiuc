-- Cho phep 1 san pham xuat hien nhieu dong trong cung phieu nhap (nhieu HSD khac nhau).
-- Khi xac nhan, cac dong cung san pham de trong so lo se duoc dat so lo khac nhau
-- ({ma phieu}-1, {ma phieu}-2, ...) de moi HSD thanh mot lo rieng, tranh dung chung ma phieu.
-- Dong don le van giu so lo mac dinh = ma phieu (khong doi hanh vi cu).

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
  update public.purchase_receipt_items set landed_unit_cost = round(unit_cost + allocated_cost / qty)
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

revoke execute on function public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date, boolean, uuid) from public, anon;
grant execute on function public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date, boolean, uuid) to authenticated;
