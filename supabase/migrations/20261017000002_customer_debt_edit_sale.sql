-- Gop y 04/10/2026 va 09/10/2026:
-- (1) Khach chua tra tien (ghi no) tai quay: phan ghi no la mot dong thanh toan 'other' khong gan tai khoan
--     (giong phan coc don dat truoc) kem ban ghi customer_debts (ten, SDT khach). Doanh thu ghi ngay khi ban.
--     Thu no sau vao tai khoan chon (customer_debt_payments); tien mat vao ket can ca mo va cong vao ca.
-- (2) Sua giao dich ban tai quay (update_sale): giam gia don + ly do, thanh toan va tai khoan, ghi no, ghi chu.
--     Khong sua dong san pham (sai hang thi huy giao dich roi ban lai). Khoa khi ca da chot.

------------------------------------------------------------
-- Bang
------------------------------------------------------------
create table public.customer_debts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid not null references public.stores(id),
  sale_id uuid not null unique references public.sales(id),
  customer_name text not null,
  customer_phone text,
  amount bigint not null check (amount > 0),
  paid_amount bigint not null default 0,
  remaining bigint generated always as (amount - paid_amount) stored,
  status public.debt_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  constraint customer_debts_paid_ck check (paid_amount between 0 and amount)
);
create index customer_debts_store_idx on public.customer_debts(store_id, status, created_at desc);

create table public.customer_debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.customer_debts(id),
  amount bigint not null check (amount > 0),
  method public.payment_method not null,
  account_id uuid not null references public.money_accounts(id),
  paid_on date not null,
  shift_id uuid references public.shifts(id),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index customer_debt_payments_debt_idx on public.customer_debt_payments(debt_id);
create index customer_debt_payments_account_idx on public.customer_debt_payments(account_id);

create trigger customer_debts_updated_at before update on public.customer_debts
  for each row execute function public.set_updated_at();
create trigger audit_customer_debts after insert or update or delete on public.customer_debts
  for each row execute function public.audit_row_change();
create trigger audit_customer_debt_payments after insert or update or delete on public.customer_debt_payments
  for each row execute function public.audit_row_change();

alter table public.customer_debts enable row level security;
alter table public.customer_debt_payments enable row level security;
create policy customer_debts_select on public.customer_debts for select to authenticated
  using ((select public.can_access_store(store_id)));
create policy customer_debt_payments_select on public.customer_debt_payments for select to authenticated
  using (exists (select 1 from public.customer_debts d where d.id = debt_id and (select public.can_access_store(d.store_id))));

------------------------------------------------------------
-- complete_sale: nhan them p.debt = {amount, customer_name, customer_phone}
------------------------------------------------------------
create or replace function public.complete_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_existing public.sales;
  v_shift uuid;
  v_debt bigint := coalesce(nullif(p #>> '{debt,amount}', '')::bigint, 0);
  v_name text := nullif(trim(p #>> '{debt,customer_name}'), '');
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
  if v_debt < 0 then perform public.raise_error('VALIDATION', 'Số tiền ghi nợ không hợp lệ'); end if;
  if v_debt > 0 and v_name is null then perform public.raise_error('VALIDATION', 'Nhập tên khách ghi nợ'); end if;
  if v_debt > 0 then
    p := p || jsonb_build_object('payments', coalesce(p -> 'payments', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('method', 'other', 'amount', v_debt, 'reference', 'Ghi nợ')));
  end if;
  r := public._post_sale(p || jsonb_build_object('shift_id', v_shift, 'channel', 'pos', 'order_id', null));
  update public.sales set discount_note = nullif(trim(p ->> 'discount_note'), '')
   where id = (r ->> 'id')::uuid and discount_amount > 0;
  if v_debt > 0 then
    insert into public.customer_debts(code, store_id, sale_id, customer_name, customer_phone, amount)
    values (public.next_doc_code('KN', public._store_code(v_store)), v_store, (r ->> 'id')::uuid, v_name,
            nullif(trim(p #>> '{debt,customer_phone}'), ''), v_debt);
  end if;
  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, after)
  values (auth.uid(), 'sale.complete', 'sales', (r ->> 'id')::uuid, v_store, r);
  return r;
end $$;

------------------------------------------------------------
-- Thu no khach: vao tai khoan chon; tien mat can ca mo va cong vao ca
------------------------------------------------------------
create or replace function public.collect_customer_debt(p_debt_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.customer_debts;
  a public.money_accounts;
  v_amount bigint := nullif(p ->> 'amount', '')::bigint;
  v_account uuid := nullif(p ->> 'account_id', '')::uuid;
  v_method public.payment_method;
  v_shift uuid;
  v_id uuid;
begin
  perform public.assert_role('sadmin','admin','accountant','staff');
  select * into d from public.customer_debts where id = p_debt_id for update;
  if d.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy khoản nợ'); end if;
  if not public.can_access_store(d.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if coalesce(v_amount, 0) <= 0 then perform public.raise_error('VALIDATION', 'Số tiền phải lớn hơn 0'); end if;
  if v_amount > d.remaining then
    perform public.raise_error('DEBT_OVERPAY', format('Số tiền vượt số khách còn nợ (%s)', d.remaining));
  end if;
  if v_account is null then perform public.raise_error('VALIDATION', 'Chọn tài khoản nhận tiền'); end if;
  perform public._check_money_account(v_account);
  select * into a from public.money_accounts where id = v_account;
  v_method := case when a.kind = 'cash' then 'cash' else 'transfer' end;
  if v_method = 'cash' then
    v_shift := public._my_open_shift(d.store_id);
    if v_shift is null then perform public.raise_error('SHIFT_NOT_OPEN', 'Tiền mặt vào két cần có ca đang mở'); end if;
  end if;

  insert into public.customer_debt_payments(debt_id, amount, method, account_id, paid_on, shift_id, note)
  values (d.id, v_amount, v_method, v_account, coalesce(nullif(p ->> 'paid_on', '')::date, public._today()), v_shift,
          nullif(trim(p ->> 'note'), ''))
  returning id into v_id;
  if v_shift is not null then
    perform public._shift_cash(v_shift, 'income', v_amount, 'Thu nợ khách ' || d.code || ' - ' || d.customer_name,
      'customer_debt_payment', v_id);
  end if;
  update public.customer_debts set paid_amount = paid_amount + v_amount,
    status = case when paid_amount + v_amount = amount then 'paid'::public.debt_status else 'partial'::public.debt_status end
   where id = d.id;
end $$;

------------------------------------------------------------
-- cancel_sale: chan khi khach da tra mot phan no; xoa khoan no chua tra
------------------------------------------------------------
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.sales;
  it record;
  a jsonb;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into s from public.sales where id = p_sale_id for update;
  if s.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy giao dịch'); end if;
  if not public.can_access_store(s.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if s.status <> 'completed' then perform public.raise_error('INVALID_STATE', 'Giao dịch không ở trạng thái hoàn tất'); end if;
  if not public.is_store_manager(s.store_id) then
    if s.created_by is distinct from auth.uid() or s.shift_id is null
       or not exists (select 1 from public.shifts sh where sh.id = s.shift_id and sh.status = 'open') then
      perform public.raise_error('FORBIDDEN', 'Nhân viên chỉ hủy được giao dịch của mình trong ca đang mở');
    end if;
  end if;
  if nullif(trim(p_reason), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do hủy'); end if;
  if exists (select 1 from public.customer_debts where sale_id = s.id and paid_amount > 0) then
    perform public.raise_error('INVALID_STATE', 'Khách đã trả một phần nợ của giao dịch này, không hủy được');
  end if;

  -- hoan ton ve dung lo da phan bo, theo thu tu san pham
  for it in select * from public.sale_items where sale_id = s.id order by product_id loop
    for a in select * from jsonb_array_elements(it.lot_allocations) loop
      perform public._apply_movement(s.store_id, it.product_id, (a ->> 'lot_id')::uuid, 'sale_return',
        (a ->> 'qty')::numeric, it.unit_cost, 'sale', s.id, 'Hủy giao dịch ' || s.code);
    end loop;
  end loop;
  delete from public.customer_debts where sale_id = s.id;
  update public.sales set status = 'cancelled', cancel_reason = trim(p_reason), cancelled_by = auth.uid(),
    cancelled_at = now()
   where id = s.id;
end $$;

------------------------------------------------------------
-- update_sale: sua giao dich ban tai quay khi ca con mo
--   p = {discount_amount (giam ca don), discount_note, note, payments[{method, amount, account_id}],
--        debt {amount, customer_name, customer_phone}}
------------------------------------------------------------
create or replace function public.update_sale(p_sale_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.sales;
  d public.customer_debts;
  pay jsonb;
  v_line_disc bigint;
  v_order_disc bigint := coalesce(nullif(p ->> 'discount_amount', '')::bigint, 0);
  v_total bigint;
  v_pay_total bigint := 0;
  v_debt bigint := coalesce(nullif(p #>> '{debt,amount}', '')::bigint, 0);
  v_name text := nullif(trim(p #>> '{debt,customer_name}'), '');
  v_phone text := nullif(trim(p #>> '{debt,customer_phone}'), '');
  v_max_pct numeric;
  v_before jsonb;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into s from public.sales where id = p_sale_id for update;
  if s.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy giao dịch'); end if;
  if not public.can_access_store(s.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if s.channel <> 'pos' then
    perform public.raise_error('INVALID_STATE', 'Chỉ sửa được giao dịch bán tại quầy. Đơn online/đặt trước sửa ở màn đơn.');
  end if;
  if s.status <> 'completed' then perform public.raise_error('INVALID_STATE', 'Giao dịch không ở trạng thái hoàn tất'); end if;
  if s.shift_id is null or not exists (select 1 from public.shifts sh where sh.id = s.shift_id and sh.status = 'open') then
    perform public.raise_error('INVALID_STATE', 'Ca của giao dịch đã chốt, không sửa được');
  end if;
  if not public.is_store_manager(s.store_id) and s.created_by is distinct from auth.uid() then
    perform public.raise_error('FORBIDDEN', 'Nhân viên chỉ sửa được giao dịch của mình');
  end if;

  select coalesce(sum(discount_amount), 0) into v_line_disc from public.sale_items where sale_id = s.id;
  if v_order_disc < 0 or v_order_disc > s.subtotal - v_line_disc then
    perform public.raise_error('VALIDATION', 'Giảm giá lớn hơn tiền hàng');
  end if;
  -- nhan vien khong tu tang giam gia vuot han muc (giu nguyen muc da duyet thi duoc)
  if public.auth_role() = 'staff' and v_line_disc + v_order_disc > s.discount_amount then
    v_max_pct := coalesce((public.get_setting('pos.max_manual_discount_pct', s.store_id))::text::numeric, 10);
    if v_line_disc + v_order_disc > s.subtotal * v_max_pct / 100 then
      perform public.raise_error('DISCOUNT_LIMIT', format('Giảm giá vượt hạn mức %s%%. Nhờ quản lý sửa.', v_max_pct));
    end if;
  end if;
  v_total := s.subtotal - v_line_disc - v_order_disc;

  if v_debt < 0 then perform public.raise_error('VALIDATION', 'Số tiền ghi nợ không hợp lệ'); end if;
  if v_debt > 0 and v_name is null then perform public.raise_error('VALIDATION', 'Nhập tên khách ghi nợ'); end if;
  select * into d from public.customer_debts where sale_id = s.id for update;
  if d.id is not null and d.paid_amount > 0 and v_debt <> d.amount then
    perform public.raise_error('INVALID_STATE', 'Khách đã trả một phần nợ, không đổi được số tiền ghi nợ');
  end if;

  select jsonb_build_object('discount_amount', s.discount_amount, 'total', s.total, 'note', s.note,
           'discount_note', s.discount_note,
           'payments', (select coalesce(jsonb_agg(jsonb_build_object('method', method, 'amount', amount, 'account_id', account_id)), '[]'::jsonb)
                          from public.sale_payments where sale_id = s.id),
           'debt', case when d.id is not null then jsonb_build_object('amount', d.amount, 'customer_name', d.customer_name) end)
    into v_before;

  delete from public.sale_payments where sale_id = s.id;
  for pay in select * from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) loop
    if coalesce((pay ->> 'amount')::bigint, 0) <= 0 then continue; end if;
    perform public._check_money_account(nullif(pay ->> 'account_id', '')::uuid);
    insert into public.sale_payments(sale_id, method, amount, account_id)
    values (s.id, (pay ->> 'method')::public.payment_method, (pay ->> 'amount')::bigint, nullif(pay ->> 'account_id', '')::uuid);
    v_pay_total := v_pay_total + (pay ->> 'amount')::bigint;
  end loop;
  if v_debt > 0 then
    insert into public.sale_payments(sale_id, method, amount, reference) values (s.id, 'other', v_debt, 'Ghi nợ');
  end if;
  if v_pay_total + v_debt <> v_total then
    perform public.raise_error('PAYMENT_MISMATCH', format('Tổng thanh toán %s khác tổng đơn %s', v_pay_total + v_debt, v_total));
  end if;

  update public.sales set discount_amount = v_line_disc + v_order_disc, total = v_total,
    discount_note = case when v_line_disc + v_order_disc > 0 then nullif(trim(p ->> 'discount_note'), '') end,
    note = nullif(trim(p ->> 'note'), '')
   where id = s.id;

  if v_debt > 0 and d.id is not null then
    update public.customer_debts set amount = v_debt, customer_name = v_name, customer_phone = v_phone,
      status = case when paid_amount = 0 then 'unpaid'::public.debt_status
                    when paid_amount = v_debt then 'paid'::public.debt_status else 'partial'::public.debt_status end
     where id = d.id;
  elsif v_debt > 0 then
    insert into public.customer_debts(code, store_id, sale_id, customer_name, customer_phone, amount)
    values (public.next_doc_code('KN', public._store_code(s.store_id)), s.store_id, s.id, v_name, v_phone, v_debt);
  elsif d.id is not null then
    delete from public.customer_debts where id = d.id;
  end if;

  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, before, after)
  values (auth.uid(), 'sale.update', 'sales', s.id, s.store_id, v_before, p);
end $$;

------------------------------------------------------------
-- So du va so tai khoan: them thu no khach
------------------------------------------------------------
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
    - coalesce((select sum(pp.amount) from public.supplier_payments pp where pp.account_id = a.id), 0)
    + coalesce((select sum(case when op.kind = 'deposit' then op.amount else -op.amount end)
                from public.preorder_payments op where op.account_id = a.id), 0)
    + coalesce((select sum(cp.amount) from public.customer_debt_payments cp where cp.account_id = a.id), 0) as balance
  from public.money_accounts a
  order by a.sort_order, a.name;
$$;

create or replace function public.money_account_ledger(p_account_id uuid, p_from date default null, p_to date default null)
returns table(occurred_on date, ts timestamptz, source text, code text, description text, amount bigint, balance_after bigint)
language plpgsql stable security definer set search_path = '' as $$
declare a public.money_accounts;
begin
  select * into a from public.money_accounts m where m.id = p_account_id;
  if a.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy tài khoản'); end if;
  if not (public.auth_role() in ('sadmin','admin','accountant') or a.holder_id = auth.uid()) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem sổ tài khoản này');
  end if;
  return query
  with e as (
    select (s.completed_at at time zone 'Asia/Ho_Chi_Minh')::date as d, s.completed_at as t, 'sale'::text as src,
           s.code as c, 'Bán hàng'::text as ds, sp.amount as amt
      from public.sale_payments sp join public.sales s on s.id = sp.sale_id
     where sp.account_id = a.id and s.status = 'completed'
    union all
    select coalesce(ct.paid_on, ct.occurred_on), ct.created_at, 'cash', ct.code, ct.description,
           case when ct.kind = 'income' then ct.amount else -ct.amount end
      from public.cash_transactions ct
     where ct.account_id = a.id and ct.approval_status = 'approved' and ct.payment_status = 'paid'
    union all
    select pp.payment_date, pp.created_at, 'supplier', pp.code, 'Trả nhà cung cấp', -pp.amount
      from public.supplier_payments pp where pp.account_id = a.id
    union all
    select op.paid_on, op.created_at, 'preorder', o.code,
           case when op.kind = 'deposit' then 'Cọc đơn đặt trước - ' else 'Hoàn cọc đơn đặt trước - ' end || o.customer_name,
           case when op.kind = 'deposit' then op.amount else -op.amount end
      from public.preorder_payments op join public.preorders o on o.id = op.preorder_id
     where op.account_id = a.id
    union all
    select cp.paid_on, cp.created_at, 'customer_debt', cd.code, 'Thu nợ khách - ' || cd.customer_name, cp.amount
      from public.customer_debt_payments cp join public.customer_debts cd on cd.id = cp.debt_id
     where cp.account_id = a.id
  ), r as (
    select e.d, e.t, e.src, e.c, e.ds, e.amt,
           (a.opening_balance + sum(e.amt) over (order by e.d, e.t, e.c rows unbounded preceding))::bigint as bal
      from e
  )
  select r.d, r.t, r.src, r.c, r.ds, r.amt, r.bal from r
   where (p_from is null or r.d >= p_from) and (p_to is null or r.d <= p_to)
   order by r.d desc, r.t desc, r.c desc;
end $$;

revoke execute on function public.collect_customer_debt(uuid, jsonb) from public, anon;
revoke execute on function public.update_sale(uuid, jsonb) from public, anon;
grant execute on function public.collect_customer_debt(uuid, jsonb) to authenticated;
grant execute on function public.update_sale(uuid, jsonb) to authenticated;
