-- Sprint 2 - phieu nhap, landed cost, gia von binh quan, lo, cong no NCC, chuyen kho, bao cao ton
-- Nguon: SPEC 6.5, 6.6, 6.9 (supplier_debts/payments), 7.1, 7.2, 7.3, 7.7, 8.4 (F4.1-F4.7, F4.11, F4.12).
-- Chua lam: dinh kem chung tu (Storage), ghi tien mat vao ca (Sprint 3 bo sung), thong bao (P1).

------------------------------------------------------------
-- Bang
------------------------------------------------------------
create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid not null references public.stores(id),
  supplier_id uuid not null references public.suppliers(id),
  receipt_date date not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  invoice_no text,
  status public.doc_status not null default 'draft' check (status in ('draft','confirmed','cancelled')),
  subtotal bigint not null default 0,
  extra_cost_total bigint not null default 0,
  total bigint not null default 0,
  paid_amount bigint not null default 0 check (paid_amount >= 0),
  payment_method public.payment_method,
  due_date date,
  note text,
  attachment_urls text[] not null default '{}',
  received_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid()
);
create index purchase_receipts_store_idx on public.purchase_receipts(store_id, receipt_date desc);
create index purchase_receipts_supplier_idx on public.purchase_receipts(supplier_id);

create table public.purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references public.products(id),
  goods_type public.goods_type not null,
  qty numeric(12,3) not null check (qty > 0),
  unit text not null,
  unit_cost bigint not null check (unit_cost >= 0),
  line_total bigint not null,
  allocated_cost bigint not null default 0,
  landed_unit_cost bigint,
  lot_no text,
  expiry_date date
);
create index purchase_receipt_items_receipt_idx on public.purchase_receipt_items(receipt_id);
create index purchase_receipt_items_product_idx on public.purchase_receipt_items(product_id);

create table public.purchase_receipt_costs (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id) on delete cascade,
  cost_type text not null check (cost_type in ('shipping','tax','customs','other')),
  amount bigint not null check (amount > 0),
  allocation text not null default 'by_value' check (allocation in ('by_value','by_qty')),
  note text
);
create index purchase_receipt_costs_receipt_idx on public.purchase_receipt_costs(receipt_id);

create table public.supplier_debts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid not null references public.stores(id),
  supplier_id uuid not null references public.suppliers(id),
  receipt_id uuid references public.purchase_receipts(id),
  issued_date date not null,
  due_date date,
  total_amount bigint not null check (total_amount > 0),
  paid_amount bigint not null default 0,
  remaining bigint generated always as (total_amount - paid_amount) stored,
  status public.debt_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint supplier_debts_paid_ck check (paid_amount between 0 and total_amount)
);
create index supplier_debts_supplier_idx on public.supplier_debts(supplier_id, status);
create index supplier_debts_store_idx on public.supplier_debts(store_id, due_date);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  supplier_id uuid not null references public.suppliers(id),
  store_id uuid not null references public.stores(id),
  payment_date date not null,
  amount bigint not null check (amount > 0),
  method public.payment_method not null,
  reference text,
  attachment_urls text[] not null default '{}',
  note text,
  receipt_id uuid references public.purchase_receipts(id),
  shift_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index supplier_payments_supplier_idx on public.supplier_payments(supplier_id, payment_date desc);
create index supplier_payments_store_idx on public.supplier_payments(store_id, created_at);

create table public.supplier_payment_allocations (
  payment_id uuid not null references public.supplier_payments(id),
  debt_id uuid not null references public.supplier_debts(id),
  amount bigint not null check (amount > 0),
  remaining_before bigint not null,
  remaining_after bigint not null,
  primary key (payment_id, debt_id)
);
create index supplier_payment_allocations_debt_idx on public.supplier_payment_allocations(debt_id);

create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  from_store_id uuid not null references public.stores(id),
  to_store_id uuid not null references public.stores(id),
  status text not null default 'draft' check (status in ('draft','sent','received','cancelled')),
  note text,
  sent_by uuid references public.profiles(id),
  sent_at timestamptz,
  received_by uuid references public.profiles(id),
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  constraint stock_transfers_stores_ck check (from_store_id <> to_store_id)
);
create index stock_transfers_from_idx on public.stock_transfers(from_store_id, created_at desc);
create index stock_transfers_to_idx on public.stock_transfers(to_store_id, created_at desc);

create table public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  product_id uuid not null references public.products(id),
  lot_id uuid not null references public.stock_lots(id),
  qty numeric(12,3) not null check (qty > 0),
  unit_cost bigint
);
create index stock_transfer_items_transfer_idx on public.stock_transfer_items(transfer_id);

alter table public.stock_movements add constraint stock_movements_performed_by_fkey
  foreign key (performed_by) references public.profiles(id);

create trigger purchase_receipts_updated_at before update on public.purchase_receipts
  for each row execute function public.set_updated_at();
create trigger supplier_debts_updated_at before update on public.supplier_debts
  for each row execute function public.set_updated_at();
create trigger stock_transfers_updated_at before update on public.stock_transfers
  for each row execute function public.set_updated_at();

create trigger audit_purchase_receipts after insert or update or delete on public.purchase_receipts
  for each row execute function public.audit_row_change();
create trigger audit_supplier_debts after insert or update or delete on public.supplier_debts
  for each row execute function public.audit_row_change();
create trigger audit_supplier_payments after insert or update or delete on public.supplier_payments
  for each row execute function public.audit_row_change();
create trigger audit_stock_transfers after insert or update or delete on public.stock_transfers
  for each row execute function public.audit_row_change();

------------------------------------------------------------
-- RLS: doc theo cua hang; ghi qua RPC
------------------------------------------------------------
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;
alter table public.purchase_receipt_costs enable row level security;
alter table public.supplier_debts enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.supplier_payment_allocations enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;

create policy purchase_receipts_select on public.purchase_receipts for select to authenticated
  using ((select public.can_access_store(store_id)));
create policy purchase_receipt_items_select on public.purchase_receipt_items for select to authenticated
  using (exists (select 1 from public.purchase_receipts r
                 where r.id = receipt_id and (select public.can_access_store(r.store_id))));
create policy purchase_receipt_costs_select on public.purchase_receipt_costs for select to authenticated
  using (exists (select 1 from public.purchase_receipts r
                 where r.id = receipt_id and (select public.can_access_store(r.store_id))));

-- cong no: nhan vien khong xem (SPEC 4.2)
create policy supplier_debts_select on public.supplier_debts for select to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(store_id)));
create policy supplier_payments_select on public.supplier_payments for select to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(store_id)));
create policy supplier_payment_allocations_select on public.supplier_payment_allocations for select to authenticated
  using (exists (select 1 from public.supplier_payments p where p.id = payment_id
                 and (select public.auth_role()) in ('sadmin','admin','accountant')
                 and (select public.can_access_store(p.store_id))));

create policy stock_transfers_select on public.stock_transfers for select to authenticated
  using ((select public.can_access_store(from_store_id)) or (select public.can_access_store(to_store_id)));
create policy stock_transfer_items_select on public.stock_transfer_items for select to authenticated
  using (exists (select 1 from public.stock_transfers t where t.id = transfer_id
                 and ((select public.can_access_store(t.from_store_id)) or (select public.can_access_store(t.to_store_id)))));

------------------------------------------------------------
-- Ham noi bo ve ton kho
------------------------------------------------------------
create or replace function public._store_code(p_store_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select code from public.stores where id = p_store_id
$$;

create or replace function public._today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date
$$;

-- Khoa dong ton (tao neu chua co) va tra ve ton hien tai
create or replace function public._lock_inventory(p_store_id uuid, p_product_id uuid)
returns public.inventory language plpgsql security definer set search_path = '' as $$
declare r public.inventory;
begin
  insert into public.inventory(store_id, product_id) values (p_store_id, p_product_id)
  on conflict (store_id, product_id) do nothing;
  select * into r from public.inventory
   where store_id = p_store_id and product_id = p_product_id for update;
  return r;
end $$;

-- Tru / cong ton khong doi gia von binh quan (ban, huy ban, dieu chinh, chuyen di).
-- Ghi dung 1 dong stock_movements (SPEC 7.1).
create or replace function public._apply_movement(
  p_store_id uuid, p_product_id uuid, p_lot_id uuid, p_type public.movement_type,
  p_qty_delta numeric, p_unit_cost bigint, p_ref_type text, p_ref_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.inventory;
  v_lot_qty numeric;
  v_id uuid;
begin
  inv := public._lock_inventory(p_store_id, p_product_id);
  if inv.qty_on_hand + p_qty_delta < 0 then
    perform public.raise_error('INSUFFICIENT_STOCK',
      format('Không đủ tồn: %s (còn %s)',
             (select name from public.products where id = p_product_id), inv.qty_on_hand::float8));
  end if;
  if p_lot_id is not null then
    select qty_on_hand into v_lot_qty from public.stock_lots where id = p_lot_id for update;
    if v_lot_qty is null or v_lot_qty + p_qty_delta < 0 then
      perform public.raise_error('INSUFFICIENT_STOCK', 'Không đủ tồn trong lô');
    end if;
    update public.stock_lots set qty_on_hand = qty_on_hand + p_qty_delta where id = p_lot_id;
  end if;
  update public.inventory set qty_on_hand = qty_on_hand + p_qty_delta, updated_at = now()
   where store_id = p_store_id and product_id = p_product_id;
  insert into public.stock_movements(store_id, product_id, lot_id, movement_type, qty_delta,
    qty_before, qty_after, unit_cost, ref_type, ref_id, note)
  values (p_store_id, p_product_id, p_lot_id, p_type, p_qty_delta,
    inv.qty_on_hand, inv.qty_on_hand + p_qty_delta, coalesce(p_unit_cost, 0), p_ref_type, p_ref_id, p_note)
  returning id into v_id;
  return v_id;
end $$;

-- Nhap hang vao lo va tinh lai gia von binh quan gia quyen (SPEC 7.3)
create or replace function public._receive_stock(
  p_store_id uuid, p_product_id uuid, p_qty numeric, p_unit_cost bigint,
  p_lot_no text, p_expiry date, p_type public.movement_type, p_ref_type text, p_ref_id uuid,
  p_receipt_item_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.inventory;
  v_lot public.stock_lots;
  v_avg bigint;
begin
  if p_qty <= 0 then
    perform public.raise_error('VALIDATION', 'Số lượng nhập phải lớn hơn 0');
  end if;
  inv := public._lock_inventory(p_store_id, p_product_id);
  v_avg := round((inv.qty_on_hand * inv.avg_cost + p_qty * p_unit_cost) / (inv.qty_on_hand + p_qty));

  select * into v_lot from public.stock_lots
   where store_id = p_store_id and product_id = p_product_id and lot_no = p_lot_no for update;
  if v_lot.id is null then
    insert into public.stock_lots(store_id, product_id, lot_no, expiry_date, qty_on_hand, unit_cost, receipt_item_id)
    values (p_store_id, p_product_id, p_lot_no, p_expiry, p_qty, p_unit_cost, p_receipt_item_id)
    returning * into v_lot;
  else
    if v_lot.expiry_date is distinct from p_expiry then
      perform public.raise_error('VALIDATION',
        format('Lô %s đã có với hạn sử dụng khác. Đặt số lô khác.', p_lot_no));
    end if;
    update public.stock_lots
       set unit_cost = round((qty_on_hand * unit_cost + p_qty * p_unit_cost) / (qty_on_hand + p_qty)),
           qty_on_hand = qty_on_hand + p_qty
     where id = v_lot.id;
  end if;

  update public.inventory set qty_on_hand = qty_on_hand + p_qty, avg_cost = v_avg, updated_at = now()
   where store_id = p_store_id and product_id = p_product_id;

  insert into public.stock_movements(store_id, product_id, lot_id, movement_type, qty_delta,
    qty_before, qty_after, unit_cost, ref_type, ref_id)
  values (p_store_id, p_product_id, v_lot.id, p_type, p_qty,
    inv.qty_on_hand, inv.qty_on_hand + p_qty, p_unit_cost, p_ref_type, p_ref_id);
  return v_lot.id;
end $$;

-- Phan bo 1 khoan thanh toan vao cac khoan no (SPEC 7.7). p_allocs: [{debt_id, amount}] hoac null = cu nhat truoc.
create or replace function public._allocate_supplier_payment(p_payment_id uuid, p_allocs jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pay public.supplier_payments;
  d public.supplier_debts;
  a jsonb;
  v_left bigint;
  v_amt bigint;
begin
  select * into pay from public.supplier_payments where id = p_payment_id;
  v_left := pay.amount;

  if p_allocs is null or jsonb_typeof(p_allocs) <> 'array' or jsonb_array_length(p_allocs) = 0 then
    for d in select * from public.supplier_debts
              where supplier_id = pay.supplier_id and store_id = pay.store_id and remaining > 0
              order by due_date nulls last, issued_date, code for update loop
      exit when v_left = 0;
      v_amt := least(v_left, d.remaining);
      insert into public.supplier_payment_allocations(payment_id, debt_id, amount, remaining_before, remaining_after)
      values (pay.id, d.id, v_amt, d.remaining, d.remaining - v_amt);
      update public.supplier_debts set paid_amount = paid_amount + v_amt,
        status = case when paid_amount + v_amt = total_amount then 'paid'::public.debt_status else 'partial'::public.debt_status end
       where id = d.id;
      v_left := v_left - v_amt;
    end loop;
  else
    for a in select * from jsonb_array_elements(p_allocs) loop
      v_amt := (a ->> 'amount')::bigint;
      continue when coalesce(v_amt, 0) = 0;
      select * into d from public.supplier_debts where id = (a ->> 'debt_id')::uuid for update;
      if d.id is null or d.supplier_id <> pay.supplier_id or d.store_id <> pay.store_id then
        perform public.raise_error('VALIDATION', 'Khoản nợ không thuộc nhà cung cấp / cửa hàng này');
      end if;
      if v_amt < 0 or v_amt > d.remaining then
        perform public.raise_error('DEBT_OVERPAY', format('Số tiền phân bổ cho %s vượt số còn nợ', d.code));
      end if;
      insert into public.supplier_payment_allocations(payment_id, debt_id, amount, remaining_before, remaining_after)
      values (pay.id, d.id, v_amt, d.remaining, d.remaining - v_amt);
      update public.supplier_debts set paid_amount = paid_amount + v_amt,
        status = case when paid_amount + v_amt = total_amount then 'paid'::public.debt_status else 'partial'::public.debt_status end
       where id = d.id;
      v_left := v_left - v_amt;
    end loop;
  end if;

  if v_left <> 0 then
    perform public.raise_error('DEBT_OVERPAY', 'Tổng phân bổ phải bằng số tiền thanh toán và không vượt tổng còn nợ');
  end if;
end $$;

------------------------------------------------------------
-- Phieu nhap: luu nhap (F4.1, F4.2)
-- p: {id?, store_id, supplier_id, receipt_date, invoice_no, note, due_date,
--     items:[{product_id, qty, unit_cost, lot_no, expiry_date}], costs:[{cost_type, amount, allocation, note}]}
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
      line_total, lot_no, expiry_date)
    values (r.id, v_line, v_prod.id, v_prod.goods_type, v_qty, v_prod.unit, v_cost, round(v_qty * v_cost),
      nullif(trim(it ->> 'lot_no'), ''), (it ->> 'expiry_date')::date);
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
-- Xac nhan phieu nhap (F4.3, F4.4): landed cost -> lo/ton/WAVG -> movements -> gia von TC -> cong no -> thanh toan
------------------------------------------------------------
create or replace function public.confirm_purchase_receipt(
  p_receipt_id uuid, p_paid_amount bigint default 0, p_payment_method public.payment_method default null,
  p_due_date date default null)
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

  -- 2. Nhap kho theo lo, WAVG, bien dong; cap nhat gia von tham chieu
  for it in select * from public.purchase_receipt_items where receipt_id = r.id order by line_no loop
    perform public._receive_stock(r.store_id, it.product_id, it.qty, it.landed_unit_cost,
      coalesce(it.lot_no, r.code), it.expiry_date, 'purchase', 'purchase_receipt', r.id, it.id);
    update public.products p set cost_price_ref = i.avg_cost
      from public.inventory i
     where p.id = it.product_id and i.store_id = r.store_id and i.product_id = it.product_id;
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
    insert into public.supplier_payments(code, supplier_id, store_id, payment_date, amount, method, receipt_id, note)
    values (public.next_doc_code('TT', public._store_code(r.store_id)), r.supplier_id, r.store_id,
            r.receipt_date, p_paid_amount, p_payment_method, r.id, 'Thanh toán khi nhập hàng ' || r.code)
    returning id into v_pay;
    if v_debt is not null then
      perform public._allocate_supplier_payment(v_pay,
        jsonb_build_array(jsonb_build_object('debt_id', v_debt, 'amount', p_paid_amount)));
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

create or replace function public.cancel_purchase_receipt(p_receipt_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.purchase_receipts;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into r from public.purchase_receipts where id = p_receipt_id for update;
  if r.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy phiếu nhập'); end if;
  if not public.can_access_store(r.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if r.status <> 'draft' then
    perform public.raise_error('INVALID_STATE', 'Chỉ hủy được phiếu nháp. Phiếu đã xác nhận phải dùng phiếu điều chỉnh.');
  end if;
  if nullif(trim(p_reason), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do hủy'); end if;
  update public.purchase_receipts set status = 'cancelled', cancel_reason = trim(p_reason) where id = r.id;
end $$;

------------------------------------------------------------
-- Chuyen kho (F4.11). Hang dang chuyen khong thuoc ton cua hang nao (A8).
-- p: {id?, from_store_id, to_store_id, note, items:[{lot_id, qty}]}
------------------------------------------------------------
create or replace function public.save_transfer(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  t public.stock_transfers;
  it jsonb;
  v_lot public.stock_lots;
begin
  perform public.assert_role('sadmin','admin','staff');
  if v_id is not null then
    select * into t from public.stock_transfers where id = v_id for update;
    if t.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy phiếu chuyển'); end if;
    if t.status <> 'draft' then perform public.raise_error('INVALID_STATE', 'Chỉ sửa được phiếu nháp'); end if;
  end if;
  if not public.can_access_store((p ->> 'from_store_id')::uuid) then
    perform public.raise_error('FORBIDDEN', 'Bạn chỉ chuyển được hàng từ cửa hàng của mình');
  end if;
  if (p ->> 'from_store_id') = (p ->> 'to_store_id') or
     not exists (select 1 from public.stores where id = (p ->> 'to_store_id')::uuid and is_active) then
    perform public.raise_error('VALIDATION', 'Chọn cửa hàng nhận khác cửa hàng gửi');
  end if;

  if v_id is null then
    insert into public.stock_transfers(code, from_store_id, to_store_id, note)
    values (public.next_doc_code('PC', public._store_code((p ->> 'from_store_id')::uuid)),
            (p ->> 'from_store_id')::uuid, (p ->> 'to_store_id')::uuid, nullif(trim(p ->> 'note'), ''))
    returning * into t;
  else
    update public.stock_transfers set from_store_id = (p ->> 'from_store_id')::uuid,
      to_store_id = (p ->> 'to_store_id')::uuid, note = nullif(trim(p ->> 'note'), '')
     where id = t.id returning * into t;
    delete from public.stock_transfer_items where transfer_id = t.id;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    select * into v_lot from public.stock_lots where id = (it ->> 'lot_id')::uuid;
    if v_lot.id is null or v_lot.store_id <> t.from_store_id then
      perform public.raise_error('VALIDATION', 'Lô không thuộc cửa hàng gửi');
    end if;
    if coalesce((it ->> 'qty')::numeric, 0) <= 0 then
      perform public.raise_error('VALIDATION', 'Số lượng chuyển phải lớn hơn 0');
    end if;
    insert into public.stock_transfer_items(transfer_id, product_id, lot_id, qty)
    values (t.id, v_lot.product_id, v_lot.id, (it ->> 'qty')::numeric);
  end loop;
  return jsonb_build_object('id', t.id, 'code', t.code);
end $$;

create or replace function public.send_transfer(p_transfer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.stock_transfers;
  it record;
  v_avg bigint;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into t from public.stock_transfers where id = p_transfer_id for update;
  if t.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy phiếu chuyển'); end if;
  if not public.can_access_store(t.from_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng gửi');
  end if;
  if t.status <> 'draft' then perform public.raise_error('INVALID_STATE', 'Phiếu không ở trạng thái nháp'); end if;
  if not exists (select 1 from public.stock_transfer_items where transfer_id = t.id) then
    perform public.raise_error('VALIDATION', 'Phiếu chưa có dòng hàng');
  end if;
  for it in select * from public.stock_transfer_items where transfer_id = t.id loop
    select avg_cost into v_avg from public.inventory where store_id = t.from_store_id and product_id = it.product_id;
    perform public._apply_movement(t.from_store_id, it.product_id, it.lot_id, 'transfer_out', -it.qty,
      coalesce(v_avg, 0), 'stock_transfer', t.id);
    update public.stock_transfer_items set unit_cost = coalesce(v_avg, 0) where id = it.id;
  end loop;
  update public.stock_transfers set status = 'sent', sent_by = auth.uid(), sent_at = now() where id = t.id;
end $$;

-- p_return = true: cua hang gui nhan lai hang dang chuyen (huy phieu da gui)
create or replace function public.receive_transfer(p_transfer_id uuid, p_return boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.stock_transfers;
  it record;
  v_target uuid;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into t from public.stock_transfers where id = p_transfer_id for update;
  if t.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy phiếu chuyển'); end if;
  v_target := case when p_return then t.from_store_id else t.to_store_id end;
  if not public.can_access_store(v_target) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền nhận hàng vào cửa hàng này');
  end if;
  if t.status <> 'sent' then perform public.raise_error('INVALID_STATE', 'Phiếu chưa gửi hoặc đã nhận'); end if;
  for it in select i.*, l.lot_no, l.expiry_date from public.stock_transfer_items i
              join public.stock_lots l on l.id = i.lot_id where i.transfer_id = t.id loop
    perform public._receive_stock(v_target, it.product_id, it.qty, it.unit_cost, it.lot_no, it.expiry_date,
      'transfer_in', 'stock_transfer', t.id);
  end loop;
  update public.stock_transfers
     set status = case when p_return then 'cancelled' else 'received' end,
         received_by = auth.uid(), received_at = now()
   where id = t.id;
end $$;

create or replace function public.cancel_transfer(p_transfer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.stock_transfers;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into t from public.stock_transfers where id = p_transfer_id for update;
  if t.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy phiếu chuyển'); end if;
  if not public.can_access_store(t.from_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng gửi');
  end if;
  if t.status <> 'draft' then
    perform public.raise_error('INVALID_STATE', 'Phiếu đã gửi: dùng "Nhận lại" để hủy');
  end if;
  update public.stock_transfers set status = 'cancelled' where id = t.id;
end $$;

------------------------------------------------------------
-- Doc ton kho (F4.5, F4.6). Nhan vien: an gia von.
------------------------------------------------------------
create or replace function public.inventory_status(
  p_store_id uuid, p_q text default null, p_status text default null, p_category uuid default null,
  p_goods_type public.goods_type default null, p_limit integer default 50, p_offset integer default 0)
returns table (product_id uuid, sku text, name text, unit text, goods_type public.goods_type, category text,
  barcode text, qty_on_hand numeric, qty_reserved numeric, qty_available numeric, min_stock numeric,
  stock_status text, suggest_qty numeric, avg_cost bigint, stock_value bigint, nearest_expiry date, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_default_min numeric := coalesce((public.get_setting('inventory.default_min_stock', p_store_id))::text::numeric, 5);
  v_show_cost boolean := public.auth_role() in ('sadmin','admin','accountant');
  v_norm text := nullif(public.search_text(p_q), '');
begin
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem cửa hàng này');
  end if;
  return query
  with base as (
    select p.id, p.sku, p.name, p.unit, p.goods_type, c.name as cat,
           (select b.barcode from public.product_barcodes b where b.product_id = p.id and b.is_primary) as bc,
           coalesce(i.qty_on_hand, 0) as on_hand, coalesce(i.qty_reserved, 0) as reserved,
           coalesce(i.qty_available, 0) as available,
           coalesce(p.min_stock, v_default_min) as min_s,
           coalesce(p.max_stock, coalesce(p.min_stock, v_default_min) * 3) as max_s,
           coalesce(i.avg_cost, 0) as avg_c,
           (select min(l.expiry_date) from public.stock_lots l
             where l.store_id = p_store_id and l.product_id = p.id and l.qty_on_hand > 0) as near_exp
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.inventory i on i.store_id = p_store_id and i.product_id = p.id
    where p.status = 'active'
      and (v_norm is null or p.search_key like '%' || v_norm || '%'
           or exists (select 1 from public.product_barcodes b where b.product_id = p.id and b.barcode = upper(trim(p_q))))
      and (p_category is null or p.category_id = p_category)
      and (p_goods_type is null or p.goods_type = p_goods_type)
  ), st as (
    select *, case when available <= 0 then 'out' when available <= min_s then 'low' else 'in_stock' end as s
    from base
  ), f as (
    select * from st
    where p_status is null
       or (p_status = 'low_out' and s in ('low','out'))
       or s = p_status
  )
  select f.id, f.sku, f.name, f.unit, f.goods_type, f.cat, f.bc, f.on_hand, f.reserved, f.available, f.min_s,
         f.s, greatest(0, f.max_s - f.available),
         case when v_show_cost then f.avg_c end,
         case when v_show_cost then round(f.on_hand * f.avg_c)::bigint end,
         f.near_exp, count(*) over ()
  from f
  order by case f.s when 'out' then 0 when 'low' then 1 else 2 end, f.name
  limit greatest(1, least(coalesce(p_limit, 50), 500)) offset greatest(0, coalesce(p_offset, 0));
end $$;

-- Lo theo han (F3.6, F3.7). p_status: near | expired | null (tat ca lo con hang)
create or replace function public.lot_expiry(p_store_id uuid, p_status text default null, p_product_id uuid default null)
returns table (lot_id uuid, product_id uuid, sku text, name text, unit text, goods_type public.goods_type,
  lot_no text, expiry_date date, qty_on_hand numeric, days_left integer, expiry_status text, unit_cost bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_near integer := coalesce((public.get_setting('inventory.near_expiry_days', p_store_id))::text::integer, 30);
  v_show_cost boolean := public.auth_role() in ('sadmin','admin','accountant');
  v_today date := public._today();
begin
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem cửa hàng này');
  end if;
  return query
  select l.id, p.id, p.sku, p.name, p.unit, p.goods_type, l.lot_no, l.expiry_date, l.qty_on_hand,
         (l.expiry_date - v_today)::integer,
         case when l.expiry_date is null then 'none'
              when l.expiry_date < v_today then 'expired'
              when l.expiry_date - v_today <= v_near then 'near'
              else 'normal' end,
         case when v_show_cost then l.unit_cost end
  from public.stock_lots l join public.products p on p.id = l.product_id
  where l.store_id = p_store_id and l.qty_on_hand > 0
    and (p_product_id is null or l.product_id = p_product_id)
    and (p_status is null
         or (p_status = 'expired' and l.expiry_date < v_today)
         or (p_status = 'near' and l.expiry_date >= v_today and l.expiry_date - v_today <= v_near))
  order by l.expiry_date nulls last, l.received_at;
end $$;

-- Lich su bien dong (F4.7). Nhan vien: an gia von.
create or replace function public.stock_movement_list(
  p_store_id uuid, p_from date default null, p_to date default null, p_product_id uuid default null,
  p_type public.movement_type default null, p_limit integer default 100, p_offset integer default 0)
returns table (id uuid, created_at timestamptz, product_id uuid, sku text, name text, movement_type public.movement_type,
  qty_delta numeric, qty_before numeric, qty_after numeric, unit_cost bigint, lot_no text, ref_type text, ref_id uuid,
  ref_code text, note text, performed_by_name text, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_show_cost boolean := public.auth_role() in ('sadmin','admin','accountant');
begin
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem cửa hàng này');
  end if;
  return query
  select m.id, m.created_at, p.id, p.sku, p.name, m.movement_type, m.qty_delta, m.qty_before, m.qty_after,
         case when v_show_cost then m.unit_cost end, l.lot_no, m.ref_type, m.ref_id,
         case m.ref_type
           when 'purchase_receipt' then (select r.code from public.purchase_receipts r where r.id = m.ref_id)
           when 'stock_transfer' then (select t.code from public.stock_transfers t where t.id = m.ref_id)
         end,
         m.note, pr.full_name, count(*) over ()
  from public.stock_movements m
  join public.products p on p.id = m.product_id
  left join public.stock_lots l on l.id = m.lot_id
  left join public.profiles pr on pr.id = m.performed_by
  where m.store_id = p_store_id
    and (p_from is null or (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_from)
    and (p_to is null or (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= p_to)
    and (p_product_id is null or m.product_id = p_product_id)
    and (p_type is null or m.movement_type = p_type)
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500)) offset greatest(0, coalesce(p_offset, 0));
end $$;

-- Ton theo ky (F4.5): dau ky + nhap - xuat + dieu chinh = cuoi ky, tinh tu stock_movements
create or replace function public.inventory_period(p_store_id uuid, p_from date, p_to date)
returns table (product_id uuid, sku text, name text, unit text, goods_type public.goods_type,
  opening numeric, qty_in numeric, qty_out numeric, qty_adjust numeric, closing numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem cửa hàng này');
  end if;
  return query
  with m as (
    select sm.product_id, sm.movement_type, sm.qty_delta,
           (sm.created_at at time zone 'Asia/Ho_Chi_Minh')::date as d
    from public.stock_movements sm where sm.store_id = p_store_id
  ), agg as (
    select m.product_id,
      coalesce(sum(m.qty_delta) filter (where m.d < p_from), 0) as opening,
      coalesce(sum(m.qty_delta) filter (where m.d between p_from and p_to
        and m.movement_type in ('opening','purchase','transfer_in','sale_return')), 0) as qin,
      coalesce(-sum(m.qty_delta) filter (where m.d between p_from and p_to
        and m.movement_type in ('sale','transfer_out')), 0) as qout,
      coalesce(sum(m.qty_delta) filter (where m.d between p_from and p_to
        and m.movement_type in ('adjustment','writeoff','count')), 0) as qadj
    from m where m.d <= p_to group by m.product_id
  )
  select p.id, p.sku, p.name, p.unit, p.goods_type, a.opening, a.qin, a.qout, a.qadj,
         a.opening + a.qin - a.qout + a.qadj
  from agg a join public.products p on p.id = a.product_id
  where a.opening <> 0 or a.qin <> 0 or a.qout <> 0 or a.qadj <> 0
  order by p.name;
end $$;

------------------------------------------------------------
-- Quyen thuc thi
------------------------------------------------------------
revoke execute on function public._store_code(uuid) from public, anon, authenticated;
revoke execute on function public._today() from public, anon;
revoke execute on function public._lock_inventory(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._apply_movement(uuid, uuid, uuid, public.movement_type, numeric, bigint, text, uuid, text) from public, anon, authenticated;
revoke execute on function public._receive_stock(uuid, uuid, numeric, bigint, text, date, public.movement_type, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._allocate_supplier_payment(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.save_purchase_receipt(jsonb) from public, anon;
revoke execute on function public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date) from public, anon;
revoke execute on function public.cancel_purchase_receipt(uuid, text) from public, anon;
revoke execute on function public.save_transfer(jsonb) from public, anon;
revoke execute on function public.send_transfer(uuid) from public, anon;
revoke execute on function public.receive_transfer(uuid, boolean) from public, anon;
revoke execute on function public.cancel_transfer(uuid) from public, anon;
revoke execute on function public.inventory_status(uuid, text, text, uuid, public.goods_type, integer, integer) from public, anon;
revoke execute on function public.lot_expiry(uuid, text, uuid) from public, anon;
revoke execute on function public.stock_movement_list(uuid, date, date, uuid, public.movement_type, integer, integer) from public, anon;
revoke execute on function public.inventory_period(uuid, date, date) from public, anon;

grant execute on function public._today() to authenticated;
grant execute on function public.save_purchase_receipt(jsonb) to authenticated;
grant execute on function public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date) to authenticated;
grant execute on function public.cancel_purchase_receipt(uuid, text) to authenticated;
grant execute on function public.save_transfer(jsonb) to authenticated;
grant execute on function public.send_transfer(uuid) to authenticated;
grant execute on function public.receive_transfer(uuid, boolean) to authenticated;
grant execute on function public.cancel_transfer(uuid) to authenticated;
grant execute on function public.inventory_status(uuid, text, text, uuid, public.goods_type, integer, integer) to authenticated;
grant execute on function public.lot_expiry(uuid, text, uuid) to authenticated;
grant execute on function public.stock_movement_list(uuid, date, date, uuid, public.movement_type, integer, integer) to authenticated;
grant execute on function public.inventory_period(uuid, date, date) to authenticated;

-- Thong tin co ban cua danh sach san pham (dien san phieu nhap tu danh sach ton thap). Khong co gia von.
create or replace function public.catalog_by_ids(p_ids uuid[])
returns table (product_id uuid, sku text, name text, unit text, goods_type public.goods_type,
               expiry_level public.expiry_level)
language sql stable security definer set search_path = '' as $$
  select p.id, p.sku, p.name, p.unit, p.goods_type, p.expiry_level
  from public.products p
  where public.auth_role() is not null and p.id = any(p_ids)
  order by p.name
$$;
revoke execute on function public.catalog_by_ids(uuid[]) from public, anon;
grant execute on function public.catalog_by_ids(uuid[]) to authenticated;

-- Danh sach cua hang dang hoat dong (chi ma, ten) de chon cua hang nhan khi chuyen kho
create or replace function public.active_store_options()
returns table (id uuid, code text, name text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.code, s.name from public.stores s
  where s.is_active and public.auth_role() is not null
  order by s.code
$$;
revoke execute on function public.active_store_options() from public, anon;
grant execute on function public.active_store_options() to authenticated;
