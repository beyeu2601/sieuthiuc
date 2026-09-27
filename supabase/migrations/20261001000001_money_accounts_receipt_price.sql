-- Workflow 26/09: (4) gia ban tren dong phieu nhap, cap nhat gia ban khi xac nhan;
-- (9) tai khoan giu tien (sadmin quan ly) cho Thu chi, Ban hang, Cong no.
-- account_id la tuy chon o RPC (validate active neu co), UI bat buoc chon. Balances chi tinh cac giao dich co account_id.

------------------------------------------------------------
-- (4) Gia ban tren dong phieu nhap
------------------------------------------------------------
alter table public.purchase_receipt_items add column if not exists sell_price bigint;

------------------------------------------------------------
-- (9) Tai khoan giu tien
------------------------------------------------------------
create table if not exists public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'cash' check (kind in ('cash','bank','ewallet','other')),
  opening_balance bigint not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

alter table public.cash_transactions add column if not exists account_id uuid references public.money_accounts(id);
alter table public.sale_payments add column if not exists account_id uuid references public.money_accounts(id);
alter table public.supplier_payments add column if not exists account_id uuid references public.money_accounts(id);

alter table public.money_accounts enable row level security;
drop policy if exists money_accounts_select on public.money_accounts;
create policy money_accounts_select on public.money_accounts for select to authenticated using (true);

-- Kiem tra tai khoan hop le khi co truyen account_id
create or replace function public._check_money_account(p_account_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_account_id is null then return; end if;
  if not exists (select 1 from public.money_accounts where id = p_account_id and is_active) then
    perform public.raise_error('VALIDATION', 'Tài khoản giữ tiền không hợp lệ hoặc đã khóa');
  end if;
end $$;

-- Sadmin tao/sua tai khoan giu tien
create or replace function public.manage_money_account(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := nullif(trim(p ->> 'name'), '');
  v_kind text := coalesce(p ->> 'kind', 'cash');
  v_opening bigint := coalesce((p ->> 'opening_balance')::bigint, 0);
  v_active boolean := coalesce((p ->> 'is_active')::boolean, true);
  r public.money_accounts;
begin
  perform public.assert_role('sadmin');
  if v_name is null then perform public.raise_error('VALIDATION', 'Nhập tên tài khoản'); end if;
  if v_kind not in ('cash','bank','ewallet','other') then perform public.raise_error('VALIDATION', 'Loại tài khoản không hợp lệ'); end if;
  if v_id is null then
    insert into public.money_accounts(name, kind, opening_balance, is_active, note)
    values (v_name, v_kind, v_opening, v_active, nullif(trim(p ->> 'note'), ''))
    returning * into r;
  else
    update public.money_accounts set name = v_name, kind = v_kind, opening_balance = v_opening,
      is_active = v_active, note = nullif(trim(p ->> 'note'), '')
    where id = v_id returning * into r;
    if r.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy tài khoản'); end if;
  end if;
  return jsonb_build_object('id', r.id);
end $$;

-- So du tung tai khoan: dau ky + thu ban hang + thu chi (thu - chi) - tra NCC
create or replace function public.money_account_balances()
returns table(id uuid, name text, kind text, is_active boolean, opening_balance bigint, balance bigint)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, a.kind, a.is_active, a.opening_balance,
    a.opening_balance
    + coalesce((select sum(sp.amount) from public.sale_payments sp
                join public.sales s on s.id = sp.sale_id
                where sp.account_id = a.id and s.status = 'completed'), 0)
    + coalesce((select sum(case when ct.kind = 'income' then ct.amount else -ct.amount end)
                from public.cash_transactions ct
                where ct.account_id = a.id and ct.approval_status = 'approved' and ct.payment_status = 'paid'), 0)
    - coalesce((select sum(pp.amount) from public.supplier_payments pp where pp.account_id = a.id), 0) as balance
  from public.money_accounts a
  order by a.sort_order, a.name;
$$;

------------------------------------------------------------
-- (4) save_purchase_receipt: luu sell_price tung dong
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

  update public.purchase_receipts set subtotal = v_sub, extra_cost_total = v_extra, total = v_sub + v_extra
   where id = r.id;
  return jsonb_build_object('id', r.id, 'code', r.code);
end $$;

------------------------------------------------------------
-- (4)+(9) confirm_purchase_receipt: cap nhat gia ban, tai khoan giu tien khi thanh toan
------------------------------------------------------------
drop function if exists public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date, boolean);
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

------------------------------------------------------------
-- (9) _post_sale: sale_payments giu account_id
------------------------------------------------------------
create or replace function public._post_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_channel public.sale_channel := coalesce(p ->> 'channel', 'pos')::public.sale_channel;
  v_given_price boolean := coalesce((p ->> 'use_given_price')::boolean, false);
  v_sale_id uuid := gen_random_uuid();
  v_code text;
  v_today date := public._today();
  it jsonb;
  v_items jsonb := '[]'::jsonb;
  v_prod public.products;
  inv public.inventory;
  lot record;
  v_qty numeric;
  v_price bigint;
  v_left numeric;
  v_take numeric;
  v_allocs jsonb;
  v_line integer := 0;
  v_line_disc bigint;
  v_line_total bigint;
  v_subtotal bigint := 0;
  v_line_disc_total bigint := 0;
  v_order_disc bigint := coalesce((p ->> 'discount_amount')::bigint, 0);
  v_total bigint;
  v_cogs_total bigint := 0;
  v_pay_total bigint := 0;
  v_max_pct numeric;
  v_approver uuid;
  pay jsonb;
begin
  select coalesce(jsonb_agg(x order by x ->> 'product_id'), '[]'::jsonb) into v_items from (
    select jsonb_build_object('product_id', e ->> 'product_id',
             'qty', sum((e ->> 'qty')::numeric),
             'unit_price', max((e ->> 'unit_price')::bigint),
             'discount_amount', sum(coalesce((e ->> 'discount_amount')::bigint, 0))) as x
    from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) e
    group by e ->> 'product_id') q;
  if jsonb_array_length(v_items) = 0 then
    perform public.raise_error('VALIDATION', 'Giỏ hàng trống');
  end if;
  if v_order_disc < 0 then perform public.raise_error('VALIDATION', 'Giảm giá không hợp lệ'); end if;

  v_code := public.next_doc_code('HD', public._store_code(v_store));
  insert into public.sales(id, code, store_id, shift_id, channel, order_id, status, subtotal, total, note,
                           idempotency_key, completed_at)
  values (v_sale_id, v_code, v_store, nullif(p ->> 'shift_id', '')::uuid, v_channel, nullif(p ->> 'order_id', '')::uuid,
          'completed', 0, 0, nullif(trim(p ->> 'note'), ''), nullif(p ->> 'idempotency_key', ''), now());

  for it in select * from jsonb_array_elements(v_items) loop
    v_line := v_line + 1;
    v_qty := (it ->> 'qty')::numeric;
    select * into v_prod from public.products where id = (it ->> 'product_id')::uuid;
    if v_prod.id is null then perform public.raise_error('NOT_FOUND', 'Sản phẩm không tồn tại'); end if;
    if v_prod.status <> 'active' and not v_given_price then
      perform public.raise_error('VALIDATION', format('%s đã ngừng bán', v_prod.name));
    end if;
    if v_qty is null or v_qty <= 0 then
      perform public.raise_error('VALIDATION', format('%s: số lượng phải lớn hơn 0', v_prod.name));
    end if;
    v_price := case when v_given_price then coalesce((it ->> 'unit_price')::bigint, v_prod.sell_price) else v_prod.sell_price end;

    inv := public._lock_inventory(v_store, v_prod.id);
    if inv.qty_available < v_qty then
      perform public.raise_error('INSUFFICIENT_STOCK',
        format('%s: chỉ còn %s', v_prod.name, greatest(inv.qty_available, 0)::float8));
    end if;
    if v_prod.expiry_level = 'product' and v_prod.expiry_date < v_today then
      perform public.raise_error('EXPIRED_LOT', format('%s: hàng đã hết hạn', v_prod.name));
    end if;

    v_left := v_qty;
    v_allocs := '[]'::jsonb;
    for lot in select l.id, l.qty_on_hand from public.stock_lots l
                where l.store_id = v_store and l.product_id = v_prod.id and l.qty_on_hand > 0
                  and (l.expiry_date is null or l.expiry_date >= v_today)
                order by l.expiry_date nulls last, l.received_at, l.id
                for update loop
      exit when v_left <= 0;
      v_take := least(v_left, lot.qty_on_hand);
      perform public._apply_movement(v_store, v_prod.id, lot.id, 'sale', -v_take, inv.avg_cost, 'sale', v_sale_id);
      v_allocs := v_allocs || jsonb_build_object('lot_id', lot.id, 'qty', v_take);
      v_left := v_left - v_take;
    end loop;
    if v_left > 0 then
      if exists (select 1 from public.stock_lots l where l.store_id = v_store and l.product_id = v_prod.id
                 and l.qty_on_hand > 0 and l.expiry_date < v_today) then
        perform public.raise_error('EXPIRED_LOT', format('%s: phần còn lại đã hết hạn, không được bán', v_prod.name));
      end if;
      perform public.raise_error('INSUFFICIENT_STOCK', format('%s: không đủ hàng theo lô', v_prod.name));
    end if;

    v_line_disc := coalesce((it ->> 'discount_amount')::bigint, 0);
    if v_line_disc < 0 or v_line_disc > round(v_qty * v_price) then
      perform public.raise_error('VALIDATION', format('%s: giảm giá dòng không hợp lệ', v_prod.name));
    end if;
    v_line_total := round(v_qty * v_price) - v_line_disc;
    insert into public.sale_items(sale_id, line_no, product_id, goods_type, qty, unit_price, discount_amount,
      line_total, unit_cost, cogs, lot_allocations)
    values (v_sale_id, v_line, v_prod.id, v_prod.goods_type, v_qty, v_price, v_line_disc,
      v_line_total, inv.avg_cost, round(v_qty * inv.avg_cost), v_allocs);
    v_subtotal := v_subtotal + v_line_total;
    v_line_disc_total := v_line_disc_total + v_line_disc;
    v_cogs_total := v_cogs_total + round(v_qty * inv.avg_cost);
  end loop;

  if v_order_disc > v_subtotal then perform public.raise_error('VALIDATION', 'Giảm giá lớn hơn tiền hàng'); end if;
  if public.auth_role() = 'staff' and (v_line_disc_total + v_order_disc) > 0
     and not coalesce((p ->> 'skip_discount_limit')::boolean, false) then
    v_max_pct := coalesce((public.get_setting('pos.max_manual_discount_pct', v_store))::text::numeric, 10);
    if (v_line_disc_total + v_order_disc) > v_subtotal * v_max_pct / 100 then
      update public.discount_approvals set used_at = now()
       where id = nullif(p ->> 'approval_id', '')::uuid and store_id = v_store and requested_by = auth.uid()
         and used_at is null and expires_at > now()
      returning approved_by into v_approver;
      if v_approver is null then
        perform public.raise_error('DISCOUNT_LIMIT',
          format('Giảm giá vượt hạn mức %s%%. Cần quản lý nhập PIN.', v_max_pct));
      end if;
    end if;
  end if;

  v_total := v_subtotal - v_order_disc;
  for pay in select * from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) loop
    if coalesce((pay ->> 'amount')::bigint, 0) <= 0 then continue; end if;
    perform public._check_money_account(nullif(pay ->> 'account_id', '')::uuid);
    insert into public.sale_payments(sale_id, method, amount, reference, account_id)
    values (v_sale_id, (pay ->> 'method')::public.payment_method, (pay ->> 'amount')::bigint,
            nullif(trim(pay ->> 'reference'), ''), nullif(pay ->> 'account_id', '')::uuid);
    v_pay_total := v_pay_total + (pay ->> 'amount')::bigint;
  end loop;
  if v_pay_total <> v_total then
    perform public.raise_error('PAYMENT_MISMATCH',
      format('Tổng thanh toán %s khác tổng đơn %s', v_pay_total, v_total));
  end if;

  update public.sales set subtotal = v_subtotal + v_line_disc_total, discount_amount = v_line_disc_total + v_order_disc,
    total = v_total, cogs_total = v_cogs_total, discount_approved_by = v_approver
   where id = v_sale_id;

  if v_approver is not null then
    insert into public.audit_logs(user_id, action, entity, entity_id, store_id, after)
    values (auth.uid(), 'sale.discount_override', 'sales', v_sale_id, v_store,
            jsonb_build_object('approved_by', v_approver, 'discount', v_line_disc_total + v_order_disc));
  end if;

  return jsonb_build_object('id', v_sale_id, 'code', v_code, 'total', v_total);
end $$;

------------------------------------------------------------
-- (9) record_supplier_payment + create_cash_transaction: giu account_id
------------------------------------------------------------
create or replace function public.record_supplier_payment(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_supplier uuid := (p ->> 'supplier_id')::uuid;
  v_amount bigint := (p ->> 'amount')::bigint;
  v_owed bigint;
  v_id uuid;
  v_code text;
  v_shift uuid;
begin
  perform public.assert_role('sadmin','admin','accountant');
  if not public.can_access_store(v_store) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if coalesce(v_amount, 0) <= 0 then perform public.raise_error('VALIDATION', 'Số tiền phải lớn hơn 0'); end if;
  if nullif(p ->> 'method', '') is null then perform public.raise_error('VALIDATION', 'Chọn phương thức'); end if;
  perform public._check_money_account(nullif(p ->> 'account_id', '')::uuid);
  select coalesce(sum(remaining), 0) into v_owed from public.supplier_debts
   where supplier_id = v_supplier and store_id = v_store and remaining > 0;
  if v_amount > v_owed then
    perform public.raise_error('DEBT_OVERPAY', format('Số tiền vượt tổng còn nợ (%s)', v_owed));
  end if;
  if coalesce((p ->> 'record_in_shift')::boolean, false) and p ->> 'method' = 'cash' then
    v_shift := public._my_open_shift(v_store);
    if v_shift is null then perform public.raise_error('SHIFT_NOT_OPEN', 'Bạn chưa mở ca để ghi tiền mặt chi ra'); end if;
  end if;

  v_code := public.next_doc_code('TT', public._store_code(v_store));
  insert into public.supplier_payments(code, supplier_id, store_id, payment_date, amount, method, reference, note, shift_id, account_id)
  values (v_code, v_supplier, v_store, coalesce((p ->> 'payment_date')::date, public._today()), v_amount,
          (p ->> 'method')::public.payment_method, nullif(trim(p ->> 'reference'), ''), nullif(trim(p ->> 'note'), ''),
          v_shift, nullif(p ->> 'account_id', '')::uuid)
  returning id into v_id;
  perform public._allocate_supplier_payment(v_id, p -> 'allocations');
  if v_shift is not null then
    perform public._shift_cash(v_shift, 'expense', v_amount, 'Trả công nợ NCC ' || v_code, 'supplier_payment', v_id);
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function public.create_cash_transaction(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_kind public.cash_kind := (p ->> 'kind')::public.cash_kind;
  v_amount bigint := (p ->> 'amount')::bigint;
  v_role public.app_role := public.auth_role();
  v_shift uuid;
  v_status public.approval_status := 'approved';
  v_cat public.expense_categories;
  v_id uuid;
  v_code text;
begin
  perform public.assert_role('sadmin','admin','accountant','staff');
  if not public.can_access_store(v_store) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  select * into v_cat from public.expense_categories where id = (p ->> 'category_id')::uuid and is_active;
  if v_cat.id is null or v_cat.kind <> v_kind then perform public.raise_error('VALIDATION', 'Chọn nhóm thu chi phù hợp'); end if;
  if coalesce(v_amount, 0) <= 0 then perform public.raise_error('VALIDATION', 'Số tiền phải lớn hơn 0'); end if;
  if nullif(trim(p ->> 'description'), '') is null then perform public.raise_error('VALIDATION', 'Nhập nội dung'); end if;
  perform public._check_money_account(nullif(p ->> 'account_id', '')::uuid);

  if v_role = 'staff' then
    if v_kind <> 'expense' or p ->> 'method' <> 'cash' then
      perform public.raise_error('FORBIDDEN', 'Nhân viên chỉ ghi được khoản chi tiền mặt trong ca');
    end if;
    v_shift := public._my_open_shift(v_store);
    if v_shift is null then perform public.raise_error('SHIFT_NOT_OPEN', 'Bạn chưa mở ca'); end if;
    if v_amount > coalesce((public.get_setting('expense.auto_approve_below', v_store))::text::bigint, 500000) then
      v_status := 'pending';
    end if;
  elsif coalesce((p ->> 'record_in_shift')::boolean, false) and p ->> 'method' = 'cash' then
    v_shift := public._my_open_shift(v_store);
    if v_shift is null then perform public.raise_error('SHIFT_NOT_OPEN', 'Bạn chưa mở ca'); end if;
  end if;

  v_code := public.next_doc_code('TC', public._store_code(v_store));
  insert into public.cash_transactions(code, store_id, kind, category_id, occurred_on, description, amount, method,
    counterparty, doc_no, note, payment_status, paid_on, shift_id, approval_status, approved_by, approved_at, account_id)
  values (v_code, v_store, v_kind, v_cat.id, coalesce((p ->> 'occurred_on')::date, public._today()),
    trim(p ->> 'description'), v_amount, (p ->> 'method')::public.payment_method,
    nullif(trim(p ->> 'counterparty'), ''), nullif(trim(p ->> 'doc_no'), ''), nullif(trim(p ->> 'note'), ''),
    case when v_shift is not null then 'paid' else coalesce(p ->> 'payment_status', 'paid') end,
    case when coalesce(p ->> 'payment_status', 'paid') = 'paid' or v_shift is not null
         then coalesce((p ->> 'occurred_on')::date, public._today()) end,
    v_shift, v_status,
    case when v_status = 'approved' then auth.uid() end, case when v_status = 'approved' then now() end,
    nullif(p ->> 'account_id', '')::uuid)
  returning id into v_id;

  if v_shift is not null then
    perform public._shift_cash(v_shift, v_kind, v_amount, trim(p ->> 'description'), 'cash_transaction', v_id);
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code, 'approval_status', v_status);
end $$;

------------------------------------------------------------
-- Quyen
------------------------------------------------------------
revoke execute on function public._check_money_account(uuid) from public, anon, authenticated;
revoke execute on function public.manage_money_account(jsonb) from public, anon;
revoke execute on function public.money_account_balances() from public, anon;
revoke execute on function public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date, boolean, uuid) from public, anon;
grant execute on function public.manage_money_account(jsonb) to authenticated;
grant execute on function public.money_account_balances() to authenticated;
grant execute on function public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date, boolean, uuid) to authenticated;

------------------------------------------------------------
-- Tai khoan mac dinh
------------------------------------------------------------
insert into public.money_accounts(name, kind, sort_order)
select 'Tiền mặt', 'cash', 1 where not exists (select 1 from public.money_accounts);
insert into public.money_accounts(name, kind, sort_order)
select 'Chuyển khoản', 'bank', 2 where not exists (select 1 from public.money_accounts where kind = 'bank');
