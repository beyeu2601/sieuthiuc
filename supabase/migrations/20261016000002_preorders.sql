-- Don dat truoc (hang order), chot voi chu cua hang 06-07/10/2026:
-- 1. Khach dat truoc san pham trong danh muc: ngay dat, ngay hen tra, gia von (tham khao) va gia ban tung dong.
--    Gia tu dien tu san pham, sua duoc. Nhan vien tao don nhung khong thay gia von (gia von lay mac dinh).
-- 2. Coc theo % hoac so tien, ghi ngay coc va tai khoan nhan. Tai khoan tien mat (ket) thi vao ca dang mo.
--    Tien coc la tien giu ho khach: cong vao so du tai khoan, KHONG vao lai lo.
-- 3. Hang ve: giu hang trong kho cho don (quay khong ban vuot).
-- 4. Giao: tao giao dich ban kenh 'preorder' qua kho nhu ban thuong (FEFO, gia von binh quan). Phan coc ghi dong
--    thanh toan 'other' khong gan tai khoan (tien da vao tai khoan luc coc); phan con lai thu vao tai khoan chon.
-- 5. Huy: nguoi huy chon hoan coc (chi ra tu tai khoan) hoac giu coc (thu nhap khac). Don co coc chi quan ly huy.

------------------------------------------------------------
-- Bang
------------------------------------------------------------
create table public.preorders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid not null references public.stores(id),
  customer_name text not null,
  customer_phone text,
  ordered_on date not null,
  due_on date not null,
  status text not null default 'open' check (status in ('open','arrived','delivered','cancelled')),
  subtotal bigint not null default 0,
  deposit_type text check (deposit_type in ('percent','amount')),
  deposit_value numeric(14,2),
  note text,
  sale_id uuid references public.sales(id),
  cancel_reason text,
  cancel_deposit text check (cancel_deposit in ('refund','keep')),
  arrived_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  constraint preorders_due_check check (due_on >= ordered_on)
);
create index preorders_store_idx on public.preorders(store_id, status, due_on);

create table public.preorder_items (
  id uuid primary key default gen_random_uuid(),
  preorder_id uuid not null references public.preorders(id),
  product_id uuid not null references public.products(id),
  qty numeric(12,3) not null check (qty > 0),
  unit_price bigint not null check (unit_price >= 0),
  unit_cost bigint not null default 0 check (unit_cost >= 0)
);
create index preorder_items_preorder_idx on public.preorder_items(preorder_id);

-- Tien coc nhan va tien hoan coc. So du tai khoan: deposit cong, refund tru.
create table public.preorder_payments (
  id uuid primary key default gen_random_uuid(),
  preorder_id uuid not null references public.preorders(id),
  kind text not null check (kind in ('deposit','refund')),
  amount bigint not null check (amount > 0),
  method public.payment_method not null,
  account_id uuid not null references public.money_accounts(id),
  paid_on date not null,
  shift_id uuid references public.shifts(id),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index preorder_payments_preorder_idx on public.preorder_payments(preorder_id);
create index preorder_payments_account_idx on public.preorder_payments(account_id);

create trigger preorders_updated_at before update on public.preorders
  for each row execute function public.set_updated_at();
create trigger audit_preorders after insert or update or delete on public.preorders
  for each row execute function public.audit_row_change();
create trigger audit_preorder_payments after insert or update or delete on public.preorder_payments
  for each row execute function public.audit_row_change();

-- Giu coc khi huy: thu nhap khac, nhom he thong (khong sua/xoa o Cai dat)
insert into public.expense_categories(name, kind, is_system) values ('Giữ cọc đơn đặt trước', 'income', true);

------------------------------------------------------------
-- RLS: doc theo cua hang; gia von dong hang an voi moi nguoi, quan ly doc qua preorder_costs
------------------------------------------------------------
alter table public.preorders enable row level security;
alter table public.preorder_items enable row level security;
alter table public.preorder_payments enable row level security;

create policy preorders_select on public.preorders for select to authenticated
  using ((select public.can_access_store(store_id)));
create policy preorder_items_select on public.preorder_items for select to authenticated
  using (exists (select 1 from public.preorders o where o.id = preorder_id and (select public.can_access_store(o.store_id))));
create policy preorder_payments_select on public.preorder_payments for select to authenticated
  using (exists (select 1 from public.preorders o where o.id = preorder_id and (select public.can_access_store(o.store_id))));

revoke select on public.preorder_items from anon, authenticated;
grant select (id, preorder_id, product_id, qty, unit_price) on public.preorder_items to authenticated;

------------------------------------------------------------
-- Ham noi bo
------------------------------------------------------------
-- Tong coc con giu = coc - hoan
create or replace function public._preorder_deposit_net(p_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when kind = 'deposit' then amount else -amount end), 0)::bigint
  from public.preorder_payments where preorder_id = p_id
$$;

-- Ghi mot dong coc / hoan coc. Tai khoan tien mat thi bat buoc co ca mo va ghi vao ca.
create or replace function public._preorder_pay(o public.preorders, p_kind text, p_amount bigint, p_account uuid,
  p_on date, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.money_accounts;
  v_method public.payment_method;
  v_shift uuid;
  v_id uuid;
begin
  if coalesce(p_amount, 0) <= 0 then perform public.raise_error('VALIDATION', 'Số tiền phải lớn hơn 0'); end if;
  if p_account is null then perform public.raise_error('VALIDATION', 'Chọn tài khoản'); end if;
  perform public._check_money_account(p_account);
  select * into a from public.money_accounts where id = p_account;
  v_method := case when a.kind = 'cash' then 'cash' else 'transfer' end;
  if v_method = 'cash' then
    v_shift := public._my_open_shift(o.store_id);
    if v_shift is null then
      perform public.raise_error('SHIFT_NOT_OPEN', 'Tiền mặt vào két cần có ca đang mở');
    end if;
  end if;
  insert into public.preorder_payments(preorder_id, kind, amount, method, account_id, paid_on, shift_id, note)
  values (o.id, p_kind, p_amount, v_method, p_account, coalesce(p_on, public._today()), v_shift, nullif(trim(p_note), ''))
  returning id into v_id;
  if v_shift is not null then
    perform public._shift_cash(v_shift, case when p_kind = 'deposit' then 'income' else 'expense' end::public.cash_kind,
      p_amount, case when p_kind = 'deposit' then 'Cọc đơn đặt trước ' else 'Hoàn cọc đơn đặt trước ' end || o.code,
      'preorder_payment', v_id);
  end if;
end $$;

-- Giu / bo giu hang trong kho cho don (hang da ve)
create or replace function public._preorder_reserve(o public.preorders, p_reserve boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare it record; inv public.inventory; v_name text;
begin
  for it in select product_id, sum(qty) as qty from public.preorder_items where preorder_id = o.id
            group by product_id order by product_id loop
    inv := public._lock_inventory(o.store_id, it.product_id);
    if p_reserve then
      if inv.qty_available < it.qty then
        select name into v_name from public.products where id = it.product_id;
        perform public.raise_error('INSUFFICIENT_STOCK',
          format('%s: kho chỉ còn %s, cần %s', v_name, greatest(inv.qty_available, 0)::float8, it.qty::float8));
      end if;
      update public.inventory set qty_reserved = qty_reserved + it.qty, updated_at = now()
       where store_id = o.store_id and product_id = it.product_id;
    else
      update public.inventory set qty_reserved = greatest(0, qty_reserved - it.qty), updated_at = now()
       where store_id = o.store_id and product_id = it.product_id;
    end if;
    insert into public.stock_movements(store_id, product_id, movement_type, qty_delta, qty_before, qty_after,
      unit_cost, ref_type, ref_id, note)
    values (o.store_id, it.product_id, case when p_reserve then 'order_reserve' else 'order_release' end::public.movement_type,
      0, inv.qty_on_hand, inv.qty_on_hand, 0, 'preorder', o.id,
      format('%s %s cho đơn đặt trước %s (%s)', case when p_reserve then 'Giữ' else 'Bỏ giữ' end, it.qty::float8, o.code, p_reason));
  end loop;
end $$;

create or replace function public._preorder_lock(p_id uuid)
returns public.preorders language plpgsql security definer set search_path = '' as $$
declare o public.preorders;
begin
  select * into o from public.preorders where id = p_id for update;
  if o.id is null or not public.can_access_store(o.store_id) then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy đơn đặt trước');
  end if;
  return o;
end $$;

------------------------------------------------------------
-- Tao don
------------------------------------------------------------
create or replace function public.create_preorder(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_id uuid := gen_random_uuid();
  v_code text;
  v_items jsonb;
  it jsonb;
  v_prod public.products;
  v_qty numeric;
  v_price bigint;
  v_cost bigint;
  v_default_cost bigint;
  v_sub bigint := 0;
  v_ordered date := coalesce(nullif(p ->> 'ordered_on', '')::date, public._today());
  v_due date := nullif(p ->> 'due_on', '')::date;
  v_dtype text := nullif(p ->> 'deposit_type', '');
  v_dvalue numeric := coalesce(nullif(p ->> 'deposit_value', '')::numeric, 0);
  v_deposit bigint := 0;
  v_staff boolean := public.auth_role() = 'staff';
  o public.preorders;
begin
  perform public.assert_role('sadmin','admin','staff');
  if not public.can_access_store(v_store) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if nullif(trim(p ->> 'customer_name'), '') is null then perform public.raise_error('VALIDATION', 'Nhập tên khách'); end if;
  if v_due is null then perform public.raise_error('VALIDATION', 'Chọn ngày hẹn trả hàng'); end if;
  if v_due < v_ordered then perform public.raise_error('VALIDATION', 'Ngày hẹn trả phải từ ngày đặt trở đi'); end if;
  if v_dtype is not null and v_dtype not in ('percent','amount') then
    perform public.raise_error('VALIDATION', 'Cách tính cọc không hợp lệ');
  end if;
  if v_dvalue < 0 or (v_dtype = 'percent' and v_dvalue > 100) then
    perform public.raise_error('VALIDATION', 'Tiền cọc không hợp lệ');
  end if;

  -- gop dong trung san pham
  select coalesce(jsonb_agg(x order by x ->> 'product_id'), '[]'::jsonb) into v_items from (
    select jsonb_build_object('product_id', e ->> 'product_id', 'qty', sum((e ->> 'qty')::numeric),
             'unit_price', max((e ->> 'unit_price')::bigint), 'unit_cost', max((e ->> 'unit_cost')::bigint)) as x
    from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) e group by e ->> 'product_id') q;
  if jsonb_array_length(v_items) = 0 then perform public.raise_error('VALIDATION', 'Đơn chưa có sản phẩm'); end if;

  v_code := public.next_doc_code('DT', public._store_code(v_store));
  insert into public.preorders(id, code, store_id, customer_name, customer_phone, ordered_on, due_on,
    deposit_type, deposit_value, note)
  values (v_id, v_code, v_store, trim(p ->> 'customer_name'), nullif(trim(p ->> 'customer_phone'), ''), v_ordered, v_due,
    case when v_dvalue > 0 then v_dtype end, case when v_dvalue > 0 then v_dvalue end, nullif(trim(p ->> 'note'), ''));

  for it in select * from jsonb_array_elements(v_items) loop
    select * into v_prod from public.products where id = (it ->> 'product_id')::uuid;
    if v_prod.id is null or v_prod.status <> 'active' then
      perform public.raise_error('VALIDATION', 'Sản phẩm không tồn tại hoặc đã ngừng bán');
    end if;
    v_qty := (it ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then
      perform public.raise_error('VALIDATION', format('%s: số lượng phải lớn hơn 0', v_prod.name));
    end if;
    v_price := coalesce((it ->> 'unit_price')::bigint, v_prod.sell_price);
    select coalesce(nullif(i.avg_cost, 0), v_prod.cost_price_ref) into v_default_cost
      from public.inventory i where i.store_id = v_store and i.product_id = v_prod.id;
    v_default_cost := coalesce(v_default_cost, v_prod.cost_price_ref);
    -- nhan vien khong thay gia von nen luon dung gia von mac dinh
    v_cost := case when v_staff then v_default_cost else coalesce((it ->> 'unit_cost')::bigint, v_default_cost) end;
    if v_price < 0 or v_cost < 0 then perform public.raise_error('VALIDATION', format('%s: giá không hợp lệ', v_prod.name)); end if;
    insert into public.preorder_items(preorder_id, product_id, qty, unit_price, unit_cost)
    values (v_id, v_prod.id, v_qty, v_price, v_cost);
    v_sub := v_sub + round(v_qty * v_price);
  end loop;

  update public.preorders set subtotal = v_sub where id = v_id returning * into o;

  v_deposit := case v_dtype when 'percent' then round(v_sub * v_dvalue / 100) when 'amount' then v_dvalue else 0 end;
  if v_deposit > v_sub then perform public.raise_error('VALIDATION', 'Tiền cọc lớn hơn tiền hàng'); end if;
  if v_deposit > 0 then
    perform public._preorder_pay(o, 'deposit', v_deposit, nullif(p ->> 'account_id', '')::uuid,
      nullif(p ->> 'paid_on', '')::date, null);
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code, 'deposit', v_deposit);
end $$;

------------------------------------------------------------
-- Thu them coc
------------------------------------------------------------
create or replace function public.add_preorder_deposit(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.preorders; v_amount bigint := (p ->> 'amount')::bigint;
begin
  perform public.assert_role('sadmin','admin','staff');
  o := public._preorder_lock(p_id);
  if o.status not in ('open','arrived') then
    perform public.raise_error('INVALID_STATE', 'Đơn đã giao hoặc đã hủy');
  end if;
  if public._preorder_deposit_net(o.id) + coalesce(v_amount, 0) > o.subtotal then
    perform public.raise_error('VALIDATION', 'Tổng cọc lớn hơn tiền hàng');
  end if;
  perform public._preorder_pay(o, 'deposit', v_amount, nullif(p ->> 'account_id', '')::uuid,
    nullif(p ->> 'paid_on', '')::date, p ->> 'note');
end $$;

------------------------------------------------------------
-- Hang ve: giu hang trong kho cho don
------------------------------------------------------------
create or replace function public.mark_preorder_arrived(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.preorders;
begin
  perform public.assert_role('sadmin','admin','staff');
  o := public._preorder_lock(p_id);
  if o.status <> 'open' then perform public.raise_error('INVALID_STATE', 'Chỉ đơn đang chờ hàng mới ghi hàng về'); end if;
  perform public._preorder_reserve(o, true, 'hàng về');
  update public.preorders set status = 'arrived', arrived_at = now() where id = o.id;
end $$;

------------------------------------------------------------
-- Giao hang: ghi giao dich ban kenh preorder
------------------------------------------------------------
create or replace function public.deliver_preorder(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.preorders;
  a public.money_accounts;
  v_paid bigint;
  v_rest bigint;
  v_account uuid := nullif(p ->> 'account_id', '')::uuid;
  v_method public.payment_method;
  v_shift uuid;
  v_payments jsonb := '[]'::jsonb;
  v_sale jsonb;
begin
  perform public.assert_role('sadmin','admin','staff');
  o := public._preorder_lock(p_id);
  if o.status not in ('open','arrived') then perform public.raise_error('INVALID_STATE', 'Đơn đã giao hoặc đã hủy'); end if;
  if o.status = 'arrived' then perform public._preorder_reserve(o, false, 'giao hàng'); end if;

  v_paid := public._preorder_deposit_net(o.id);
  v_rest := o.subtotal - v_paid;
  if v_paid > 0 then
    v_payments := v_payments || jsonb_build_object('method', 'other', 'amount', v_paid, 'reference', 'Trừ cọc ' || o.code);
  end if;
  if v_rest > 0 then
    if v_account is null then perform public.raise_error('VALIDATION', 'Chọn tài khoản nhận tiền còn lại'); end if;
    perform public._check_money_account(v_account);
    select * into a from public.money_accounts where id = v_account;
    v_method := case when a.kind = 'cash' then 'cash' else 'transfer' end;
    if v_method = 'cash' then
      v_shift := public._my_open_shift(o.store_id);
      if v_shift is null then perform public.raise_error('SHIFT_NOT_OPEN', 'Thu tiền mặt cần có ca đang mở'); end if;
    end if;
    v_payments := v_payments || jsonb_build_object('method', v_method, 'amount', v_rest, 'account_id', v_account);
  end if;

  v_sale := public._post_sale(jsonb_build_object(
    'store_id', o.store_id, 'channel', 'preorder', 'shift_id', v_shift,
    'note', 'Đơn đặt trước ' || o.code || ' - ' || o.customer_name,
    'use_given_price', true, 'skip_discount_limit', true,
    'items', (select jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty, 'unit_price', unit_price))
              from public.preorder_items where preorder_id = o.id),
    'payments', v_payments));
  update public.preorders set status = 'delivered', delivered_at = now(), sale_id = (v_sale ->> 'id')::uuid where id = o.id;
  return jsonb_build_object('sale_id', v_sale ->> 'id', 'sale_code', v_sale ->> 'code');
end $$;

------------------------------------------------------------
-- Huy don: hoan coc hoac giu coc
------------------------------------------------------------
create or replace function public.cancel_preorder(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.preorders;
  v_net bigint;
  v_choice text := nullif(p ->> 'deposit', '');
  v_on date := coalesce(nullif(p ->> 'on', '')::date, public._today());
begin
  perform public.assert_role('sadmin','admin','staff');
  o := public._preorder_lock(p_id);
  if o.status not in ('open','arrived') then perform public.raise_error('INVALID_STATE', 'Đơn đã giao hoặc đã hủy'); end if;
  if nullif(trim(p ->> 'reason'), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do hủy'); end if;
  v_net := public._preorder_deposit_net(o.id);

  if v_net > 0 then
    if not public.is_store_manager(o.store_id) then
      perform public.raise_error('FORBIDDEN', 'Đơn đã có cọc, chỉ quản lý cửa hàng mới hủy được');
    end if;
    if v_choice = 'refund' then
      perform public._preorder_pay(o, 'refund', v_net, nullif(p ->> 'account_id', '')::uuid, v_on, 'Hoàn cọc khi hủy');
    elsif v_choice = 'keep' then
      -- tien da nam trong tai khoan tu luc coc: chi ghi thu nhap khac, khong gan tai khoan de khong cong so du lan nua
      insert into public.cash_transactions(code, store_id, kind, category_id, occurred_on, description, amount, method,
        counterparty, payment_status, paid_on, approval_status, approved_by, approved_at)
      values (public.next_doc_code('TC', public._store_code(o.store_id)), o.store_id, 'income',
        (select id from public.expense_categories where name = 'Giữ cọc đơn đặt trước' and kind = 'income'),
        v_on, 'Giữ cọc đơn đặt trước ' || o.code, v_net, 'other', o.customer_name, 'paid', v_on,
        'approved', auth.uid(), now());
    else
      perform public.raise_error('VALIDATION', 'Chọn hoàn cọc hoặc giữ cọc');
    end if;
  end if;

  if o.status = 'arrived' then perform public._preorder_reserve(o, false, 'hủy đơn'); end if;
  update public.preorders set status = 'cancelled', cancelled_at = now(), cancel_reason = trim(p ->> 'reason'),
    cancel_deposit = case when v_net > 0 then v_choice end
   where id = o.id;
end $$;

------------------------------------------------------------
-- Gia von dong hang cho quan ly, ke toan
------------------------------------------------------------
create or replace function public.preorder_costs(p_id uuid)
returns table(item_id uuid, unit_cost bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_role('sadmin','admin','accountant');
  if not exists (select 1 from public.preorders where id = p_id and public.can_access_store(store_id)) then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy đơn đặt trước');
  end if;
  return query select i.id, i.unit_cost from public.preorder_items i where i.preorder_id = p_id;
end $$;

-- Gia von mac dinh khi tao don (quan ly): binh quan kho, chua nhap lan nao thi gia von tham chieu
create or replace function public.product_default_costs(p_store_id uuid, p_ids uuid[])
returns table(product_id uuid, unit_cost bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_role('sadmin','admin','accountant');
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  return query
  select p.id, coalesce(nullif(i.avg_cost, 0), p.cost_price_ref)
    from public.products p
    left join public.inventory i on i.product_id = p.id and i.store_id = p_store_id
   where p.id = any(p_ids);
end $$;

------------------------------------------------------------
-- So du va so tai khoan: them coc / hoan coc don dat truoc
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
                from public.preorder_payments op where op.account_id = a.id), 0) as balance
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
  ), r as (
    select e.d, e.t, e.src, e.c, e.ds, e.amt,
           (a.opening_balance + sum(e.amt) over (order by e.d, e.t, e.c rows unbounded preceding))::bigint as bal
      from e
  )
  select r.d, r.t, r.src, r.c, r.ds, r.amt, r.bal from r
   where (p_from is null or r.d >= p_from) and (p_to is null or r.d <= p_to)
   order by r.d desc, r.t desc, r.c desc;
end $$;

------------------------------------------------------------
-- Quyen thuc thi
------------------------------------------------------------
revoke execute on function public._preorder_deposit_net(uuid) from public, anon, authenticated;
revoke execute on function public._preorder_pay(public.preorders, text, bigint, uuid, date, text) from public, anon, authenticated;
revoke execute on function public._preorder_reserve(public.preorders, boolean, text) from public, anon, authenticated;
revoke execute on function public._preorder_lock(uuid) from public, anon, authenticated;
revoke execute on function public.create_preorder(jsonb) from public, anon;
revoke execute on function public.add_preorder_deposit(uuid, jsonb) from public, anon;
revoke execute on function public.mark_preorder_arrived(uuid) from public, anon;
revoke execute on function public.deliver_preorder(uuid, jsonb) from public, anon;
revoke execute on function public.cancel_preorder(uuid, jsonb) from public, anon;
revoke execute on function public.preorder_costs(uuid) from public, anon;
revoke execute on function public.product_default_costs(uuid, uuid[]) from public, anon;
grant execute on function public.create_preorder(jsonb) to authenticated;
grant execute on function public.add_preorder_deposit(uuid, jsonb) to authenticated;
grant execute on function public.mark_preorder_arrived(uuid) to authenticated;
grant execute on function public.deliver_preorder(uuid, jsonb) to authenticated;
grant execute on function public.cancel_preorder(uuid, jsonb) to authenticated;
grant execute on function public.preorder_costs(uuid) to authenticated;
grant execute on function public.product_default_costs(uuid, uuid[]) to authenticated;
