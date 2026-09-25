-- Sprint 4 - don hang online + giu hang, cong no NCC, thu chi, doi soat, bao cao PnL / doanh thu / COGS / chi phi
-- Nguon: SPEC 6.8 (orders), 6.9, 7.6, 7.7, 8.2 (F2.1-F2.3), 8.5, 8.6.
-- Quyet dinh P0: khoan chi do nhan vien tao vuot nguong tu duyet thi cho duyet (duyet don gian); hoan tra (P1) chua co.

------------------------------------------------------------
-- Don hang online
------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid not null references public.stores(id),
  channel public.sale_channel not null check (channel <> 'pos'),
  external_order_id text,
  customer_name text,
  customer_phone text,
  shipping_address text,
  status public.order_status not null default 'pending',
  subtotal bigint not null default 0,
  shipping_fee bigint not null default 0 check (shipping_fee >= 0),
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  total bigint not null default 0,
  payment_method public.payment_method not null default 'transfer',
  sale_id uuid references public.sales(id),
  note text,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  constraint orders_external_uq unique (channel, external_order_id)
);
create index orders_store_idx on public.orders(store_id, created_at desc);
create index orders_status_idx on public.orders(store_id, status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  qty numeric(12,3) not null check (qty > 0),
  unit_price bigint not null check (unit_price >= 0)
);
create index order_items_order_idx on public.order_items(order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles(id) default auth.uid(),
  changed_at timestamptz not null default now(),
  note text
);
create index order_status_history_order_idx on public.order_status_history(order_id);

alter table public.sales add constraint sales_order_fkey foreign key (order_id) references public.orders(id);
grant select (order_id) on public.sales to authenticated;

------------------------------------------------------------
-- Thu chi
------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.cash_kind not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, kind)
);

insert into public.expense_categories(name, kind) values
  ('Mặt bằng','expense'), ('Điện','expense'), ('Nước','expense'), ('Internet','expense'), ('Lương','expense'),
  ('Vận chuyển','expense'), ('Marketing','expense'), ('Bao bì','expense'), ('Sửa chữa','expense'), ('Khác','expense'),
  ('Thu khác','income')
on conflict do nothing;

create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid not null references public.stores(id),
  kind public.cash_kind not null,
  category_id uuid not null references public.expense_categories(id),
  occurred_on date not null,
  description text not null,
  amount bigint not null check (amount > 0),
  method public.payment_method not null,
  counterparty text,
  doc_no text,
  attachment_urls text[] not null default '{}',
  note text,
  payment_status text not null default 'paid' check (payment_status in ('paid','unpaid')),
  paid_on date,
  shift_id uuid references public.shifts(id),
  approval_status public.approval_status not null default 'approved',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index cash_transactions_store_idx on public.cash_transactions(store_id, occurred_on);

create table public.reconciliation_notes (
  store_id uuid not null references public.stores(id),
  day date not null,
  bank_amount bigint,
  note text,
  updated_by uuid references public.profiles(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (store_id, day)
);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger audit_orders after insert or update or delete on public.orders
  for each row execute function public.audit_row_change();
create trigger audit_cash_transactions after insert or update or delete on public.cash_transactions
  for each row execute function public.audit_row_change();
create trigger audit_reconciliation_notes after insert or update or delete on public.reconciliation_notes
  for each row execute function public.audit_row_change();
create trigger audit_expense_categories after insert or update or delete on public.expense_categories
  for each row execute function public.audit_row_change();

------------------------------------------------------------
-- RLS
------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.expense_categories enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.reconciliation_notes enable row level security;

create policy orders_select on public.orders for select to authenticated
  using ((select public.can_access_store(store_id)));
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (select public.can_access_store(o.store_id))));
create policy order_status_history_select on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (select public.can_access_store(o.store_id))));

create policy expense_categories_select on public.expense_categories for select to authenticated
  using ((select public.auth_role()) is not null);
create policy expense_categories_write on public.expense_categories for all to authenticated
  using ((select public.auth_role()) in ('sadmin','admin') and not is_system)
  with check ((select public.auth_role()) in ('sadmin','admin') and not is_system);

-- thu chi: quan ly, ke toan xem cua hang; nhan vien xem khoan minh tao
create policy cash_transactions_select on public.cash_transactions for select to authenticated
  using (((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(store_id)))
         or created_by = (select auth.uid()));

create policy reconciliation_notes_select on public.reconciliation_notes for select to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(store_id)));

------------------------------------------------------------
-- Don hang (F2.1 - F2.3)
------------------------------------------------------------
create or replace function public._order_log(p_order_id uuid, p_from public.order_status, p_to public.order_status, p_note text)
returns void language sql security definer set search_path = '' as $$
  insert into public.order_status_history(order_id, from_status, to_status, note)
  values (p_order_id, p_from, p_to, nullif(trim(p_note), ''));
$$;

-- p: {store_id, channel, external_order_id, customer_name, customer_phone, shipping_address,
--     shipping_fee, discount_amount, payment_method, note, items:[{product_id, qty, unit_price}]}
create or replace function public.create_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_id uuid := gen_random_uuid();
  v_code text;
  it jsonb;
  v_prod public.products;
  inv public.inventory;
  v_qty numeric;
  v_price bigint;
  v_sub bigint := 0;
  v_items jsonb;
begin
  perform public.assert_role('sadmin','admin','staff');
  if not public.can_access_store(v_store) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if coalesce(p ->> 'channel', 'pos') = 'pos' then
    perform public.raise_error('VALIDATION', 'Chọn kênh bán online');
  end if;
  if nullif(trim(p ->> 'external_order_id'), '') is not null and exists (
       select 1 from public.orders where channel = (p ->> 'channel')::public.sale_channel
         and external_order_id = trim(p ->> 'external_order_id')) then
    perform public.raise_error('VALIDATION', 'Mã đơn trên sàn đã được nhập trước đó');
  end if;

  select coalesce(jsonb_agg(x order by x ->> 'product_id'), '[]'::jsonb) into v_items from (
    select jsonb_build_object('product_id', e ->> 'product_id', 'qty', sum((e ->> 'qty')::numeric),
             'unit_price', max((e ->> 'unit_price')::bigint)) as x
    from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) e group by e ->> 'product_id') q;
  if jsonb_array_length(v_items) = 0 then perform public.raise_error('VALIDATION', 'Đơn chưa có sản phẩm'); end if;

  v_code := public.next_doc_code('DH', public._store_code(v_store));
  insert into public.orders(id, code, store_id, channel, external_order_id, customer_name, customer_phone,
    shipping_address, shipping_fee, discount_amount, payment_method, note)
  values (v_id, v_code, v_store, (p ->> 'channel')::public.sale_channel, nullif(trim(p ->> 'external_order_id'), ''),
    nullif(trim(p ->> 'customer_name'), ''), nullif(trim(p ->> 'customer_phone'), ''),
    nullif(trim(p ->> 'shipping_address'), ''), coalesce((p ->> 'shipping_fee')::bigint, 0),
    coalesce((p ->> 'discount_amount')::bigint, 0), coalesce(p ->> 'payment_method', 'transfer')::public.payment_method,
    nullif(trim(p ->> 'note'), ''));

  for it in select * from jsonb_array_elements(v_items) loop
    select * into v_prod from public.products where id = (it ->> 'product_id')::uuid;
    if v_prod.id is null or v_prod.status <> 'active' then
      perform public.raise_error('VALIDATION', 'Sản phẩm không tồn tại hoặc đã ngừng bán');
    end if;
    v_qty := (it ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then perform public.raise_error('VALIDATION', format('%s: số lượng phải lớn hơn 0', v_prod.name)); end if;
    v_price := coalesce((it ->> 'unit_price')::bigint, v_prod.sell_price);
    if v_price < 0 then perform public.raise_error('VALIDATION', format('%s: giá không hợp lệ', v_prod.name)); end if;

    inv := public._lock_inventory(v_store, v_prod.id);
    if inv.qty_available < v_qty then
      perform public.raise_error('INSUFFICIENT_STOCK', format('%s: chỉ còn %s', v_prod.name, greatest(inv.qty_available, 0)::float8));
    end if;
    update public.inventory set qty_reserved = qty_reserved + v_qty, updated_at = now()
     where store_id = v_store and product_id = v_prod.id;
    insert into public.stock_movements(store_id, product_id, movement_type, qty_delta, qty_before, qty_after,
      unit_cost, ref_type, ref_id, note)
    values (v_store, v_prod.id, 'order_reserve', 0, inv.qty_on_hand, inv.qty_on_hand, 0, 'order', v_id,
      format('Giữ %s cho đơn %s', v_qty::float8, v_code));
    insert into public.order_items(order_id, product_id, qty, unit_price) values (v_id, v_prod.id, v_qty, v_price);
    v_sub := v_sub + round(v_qty * v_price);
  end loop;

  if coalesce((p ->> 'discount_amount')::bigint, 0) > v_sub then
    perform public.raise_error('VALIDATION', 'Giảm giá lớn hơn tiền hàng');
  end if;
  update public.orders set subtotal = v_sub, total = v_sub + shipping_fee - discount_amount where id = v_id;
  perform public._order_log(v_id, null, 'pending', 'Tạo đơn');
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function public._release_order(o public.orders, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare it record; inv public.inventory;
begin
  for it in select * from public.order_items where order_id = o.id order by product_id loop
    inv := public._lock_inventory(o.store_id, it.product_id);
    update public.inventory set qty_reserved = greatest(0, qty_reserved - it.qty), updated_at = now()
     where store_id = o.store_id and product_id = it.product_id;
    insert into public.stock_movements(store_id, product_id, movement_type, qty_delta, qty_before, qty_after,
      unit_cost, ref_type, ref_id, note)
    values (o.store_id, it.product_id, 'order_release', 0, inv.qty_on_hand, inv.qty_on_hand, 0, 'order', o.id,
      format('Bỏ giữ %s (%s)', it.qty::float8, p_reason));
  end loop;
end $$;

-- pending -> shipped; pending/shipped -> cancelled; shipped -> delivered (tao giao dich ban)
create or replace function public.update_order_status(p_order_id uuid, p_to public.order_status, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_sale jsonb;
  v_disc_left bigint;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy đơn'); end if;
  if not public.can_access_store(o.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;

  if p_to = 'shipped' and o.status = 'pending' then
    update public.orders set status = 'shipped' where id = o.id;
  elsif p_to = 'cancelled' and o.status in ('pending','shipped') then
    if nullif(trim(p_note), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do hủy đơn'); end if;
    perform public._release_order(o, 'hủy đơn');
    update public.orders set status = 'cancelled', cancel_reason = trim(p_note) where id = o.id;
  elsif p_to = 'delivered' and o.status in ('pending','shipped') then
    -- bo giu hang roi ghi nhan ban nhu giao dich binh thuong (FEFO, COGS, doanh thu theo kenh)
    perform public._release_order(o, 'giao thành công');
    v_sale := public._post_sale(jsonb_build_object(
      'store_id', o.store_id, 'channel', o.channel, 'order_id', o.id,
      'note', 'Đơn ' || o.code || coalesce(' / ' || o.external_order_id, ''),
      'use_given_price', true, 'skip_discount_limit', true,
      'discount_amount', o.discount_amount,
      'items', (select jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty, 'unit_price', unit_price))
                from public.order_items where order_id = o.id),
      'payments', jsonb_build_array(jsonb_build_object('method', o.payment_method, 'amount', o.subtotal - o.discount_amount))));
    update public.orders set status = 'delivered', sale_id = (v_sale ->> 'id')::uuid where id = o.id;
  else
    perform public.raise_error('INVALID_STATE', 'Không chuyển được trạng thái đơn như vậy');
  end if;
  perform public._order_log(o.id, o.status, p_to, p_note);
  return jsonb_build_object('id', o.id, 'status', p_to, 'sale_id', v_sale ->> 'id');
end $$;

------------------------------------------------------------
-- _post_sale: ho tro gia theo don online va bo qua gioi han giam gia thu cong
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
    insert into public.sale_payments(sale_id, method, amount, reference)
    values (v_sale_id, (pay ->> 'method')::public.payment_method, (pay ->> 'amount')::bigint,
            nullif(trim(pay ->> 'reference'), ''));
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

-- Doi chieu giu hang (F2.2 AC): tong so luong don pending/shipped = qty_reserved
create or replace function public.reconcile_reservations(p_store_id uuid)
returns table (product_id uuid, name text, reserved numeric, open_orders_qty numeric)
language sql stable security definer set search_path = '' as $$
  select i.product_id, p.name, i.qty_reserved,
         coalesce((select sum(oi.qty) from public.order_items oi join public.orders o on o.id = oi.order_id
                   where o.store_id = i.store_id and o.status in ('pending','shipped') and oi.product_id = i.product_id), 0)
  from public.inventory i join public.products p on p.id = i.product_id
  where i.store_id = p_store_id and public.can_access_store(p_store_id)
    and i.qty_reserved <> coalesce((select sum(oi.qty) from public.order_items oi join public.orders o on o.id = oi.order_id
                   where o.store_id = i.store_id and o.status in ('pending','shipped') and oi.product_id = i.product_id), 0)
$$;

------------------------------------------------------------
-- Cong no NCC (F5.2 - F5.5)
------------------------------------------------------------
create or replace function public.debt_due_status(p_due date, p_remaining bigint, p_store_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when p_remaining <= 0 then 'paid'
              when p_due is null then 'not_due'
              when public._today() > p_due then 'overdue'
              when p_due - public._today() <= coalesce((public.get_setting('debt.due_soon_days', p_store_id))::text::integer, 3) then 'due_soon'
              else 'not_due' end
$$;

-- p: {supplier_id, store_id, amount, method, payment_date, reference, note, allocations:[{debt_id, amount}], record_in_shift}
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
  insert into public.supplier_payments(code, supplier_id, store_id, payment_date, amount, method, reference, note, shift_id)
  values (v_code, v_supplier, v_store, coalesce((p ->> 'payment_date')::date, public._today()), v_amount,
          (p ->> 'method')::public.payment_method, nullif(trim(p ->> 'reference'), ''), nullif(trim(p ->> 'note'), ''), v_shift)
  returning id into v_id;
  perform public._allocate_supplier_payment(v_id, p -> 'allocations');
  if v_shift is not null then
    perform public._shift_cash(v_shift, 'expense', v_amount, 'Trả công nợ NCC ' || v_code, 'supplier_payment', v_id);
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function public.debt_overview(p_store_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.assert_role('sadmin','admin','accountant');
  if exists (select 1 from unnest(p_store_ids) s where not public.can_access_store(s)) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng đã chọn');
  end if;
  select jsonb_build_object(
    'total_amount', coalesce(sum(d.total_amount), 0),
    'paid_amount', coalesce(sum(d.paid_amount), 0),
    'remaining', coalesce(sum(d.remaining), 0),
    'count_unpaid', count(*) filter (where d.status = 'unpaid'),
    'count_partial', count(*) filter (where d.status = 'partial'),
    'count_paid', count(*) filter (where d.status = 'paid'),
    'due_soon_amount', coalesce(sum(d.remaining) filter (where public.debt_due_status(d.due_date, d.remaining, d.store_id) = 'due_soon'), 0),
    'due_soon_count', count(*) filter (where public.debt_due_status(d.due_date, d.remaining, d.store_id) = 'due_soon'),
    'overdue_amount', coalesce(sum(d.remaining) filter (where public.debt_due_status(d.due_date, d.remaining, d.store_id) = 'overdue'), 0),
    'overdue_count', count(*) filter (where public.debt_due_status(d.due_date, d.remaining, d.store_id) = 'overdue'),
    'top_suppliers', coalesce((select jsonb_agg(t) from (
        select s.id, s.name, sum(x.remaining) as remaining from public.supplier_debts x join public.suppliers s on s.id = x.supplier_id
        where x.store_id = any(p_store_ids) and x.remaining > 0 group by s.id, s.name order by 3 desc limit 5) t), '[]'::jsonb)
  ) into r
  from public.supplier_debts d where d.store_id = any(p_store_ids);
  return r;
end $$;

------------------------------------------------------------
-- Thu chi (F6.1 - F6.3)
-- p: {store_id, kind, category_id, occurred_on, description, amount, method, counterparty, doc_no, note, payment_status}
------------------------------------------------------------
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

  if v_role = 'staff' then
    -- nhan vien: chi khoan chi tien mat trong ca dang mo cua minh (SPEC 4.2, F6.1)
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
    counterparty, doc_no, note, payment_status, paid_on, shift_id, approval_status, approved_by, approved_at)
  values (v_code, v_store, v_kind, v_cat.id, coalesce((p ->> 'occurred_on')::date, public._today()),
    trim(p ->> 'description'), v_amount, (p ->> 'method')::public.payment_method,
    nullif(trim(p ->> 'counterparty'), ''), nullif(trim(p ->> 'doc_no'), ''), nullif(trim(p ->> 'note'), ''),
    case when v_shift is not null then 'paid' else coalesce(p ->> 'payment_status', 'paid') end,
    case when coalesce(p ->> 'payment_status', 'paid') = 'paid' or v_shift is not null
         then coalesce((p ->> 'occurred_on')::date, public._today()) end,
    v_shift, v_status,
    case when v_status = 'approved' then auth.uid() end, case when v_status = 'approved' then now() end)
  returning id into v_id;

  if v_shift is not null then
    perform public._shift_cash(v_shift, v_kind, v_amount, trim(p ->> 'description'), 'cash_transaction', v_id);
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code, 'approval_status', v_status);
end $$;

create or replace function public.review_cash_transaction(p_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.cash_transactions;
begin
  select * into t from public.cash_transactions where id = p_id for update;
  if t.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy khoản thu chi'); end if;
  if not public.is_store_manager(t.store_id) then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới duyệt được');
  end if;
  if t.approval_status <> 'pending' then perform public.raise_error('INVALID_STATE', 'Khoản này đã được xử lý'); end if;
  if not p_approve and nullif(trim(p_reason), '') is null then
    perform public.raise_error('VALIDATION', 'Nhập lý do từ chối');
  end if;
  update public.cash_transactions set approval_status = case when p_approve then 'approved'::public.approval_status else 'rejected'::public.approval_status end,
    approved_by = auth.uid(), approved_at = now(), reject_reason = case when p_approve then null else trim(p_reason) end
   where id = t.id;
end $$;

create or replace function public.mark_cash_transaction_paid(p_id uuid, p_paid_on date)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.cash_transactions;
begin
  perform public.assert_role('sadmin','admin','accountant');
  select * into t from public.cash_transactions where id = p_id for update;
  if t.id is null or not public.can_access_store(t.store_id) then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy khoản thu chi');
  end if;
  if t.payment_status = 'paid' then perform public.raise_error('INVALID_STATE', 'Khoản này đã thanh toán'); end if;
  update public.cash_transactions set payment_status = 'paid', paid_on = coalesce(p_paid_on, public._today()) where id = t.id;
end $$;

------------------------------------------------------------
-- Doi soat doanh thu (F6.4)
------------------------------------------------------------
create or replace function public.reconcile_report(p_store_id uuid, p_from date, p_to date)
returns table (day date, sales_count bigint, revenue bigint, cash_sales bigint, transfer_sales bigint, other_sales bigint,
  shift_cash bigint, cash_diff bigint, bank_amount bigint, transfer_diff bigint, note text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_role('sadmin','admin','accountant');
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  return query
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as d),
  s as (
    select (x.completed_at at time zone 'Asia/Ho_Chi_Minh')::date as d, count(*) as cnt, sum(x.total) as rev
    from public.sales x where x.store_id = p_store_id and x.status = 'completed'
      and (x.completed_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
    group by 1
  ), pm as (
    select (x.completed_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
           sum(sp.amount) filter (where sp.method = 'cash') as cash,
           sum(sp.amount) filter (where sp.method = 'transfer') as tr,
           sum(sp.amount) filter (where sp.method = 'other') as oth
    from public.sales x join public.sale_payments sp on sp.sale_id = x.id
    where x.store_id = p_store_id and x.status = 'completed'
      and (x.completed_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
    group by 1
  ), sh as (
    -- tien mat ban hang theo ca = dem thuc te - dau ca - thu khac + chi trong ca (ca da chot, theo ngay mo ca)
    select (h.opened_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
           sum(h.counted_cash - h.opening_cash
               - coalesce((select sum(m.amount) from public.shift_cash_movements m where m.shift_id = h.id and m.kind = 'income'), 0)
               + coalesce((select sum(m.amount) from public.shift_cash_movements m where m.shift_id = h.id and m.kind = 'expense'), 0)) as cash
    from public.shifts h
    where h.store_id = p_store_id and h.status <> 'open'
      and (h.opened_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
    group by 1
  )
  select days.d, coalesce(s.cnt, 0), coalesce(s.rev, 0)::bigint, coalesce(pm.cash, 0)::bigint, coalesce(pm.tr, 0)::bigint,
         coalesce(pm.oth, 0)::bigint, sh.cash::bigint, (sh.cash - coalesce(pm.cash, 0))::bigint,
         rn.bank_amount, (rn.bank_amount - coalesce(pm.tr, 0))::bigint, rn.note
  from days
  left join s on s.d = days.d
  left join pm on pm.d = days.d
  left join sh on sh.d = days.d
  left join public.reconciliation_notes rn on rn.store_id = p_store_id and rn.day = days.d
  order by days.d desc;
end $$;

create or replace function public.save_reconciliation_note(p_store_id uuid, p_day date, p_bank_amount bigint, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_role('sadmin','admin','accountant');
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  insert into public.reconciliation_notes(store_id, day, bank_amount, note, updated_by, updated_at)
  values (p_store_id, p_day, p_bank_amount, nullif(trim(p_note), ''), auth.uid(), now())
  on conflict (store_id, day) do update set bank_amount = excluded.bank_amount, note = excluded.note,
    updated_by = excluded.updated_by, updated_at = now();
end $$;

------------------------------------------------------------
-- Bao cao (SPEC 7.6, F6.5 - F6.9). Chi sadmin, admin, ke toan; chi tinh cac cua hang duoc truy cap.
------------------------------------------------------------
create or replace function public._assert_report_access(p_store_ids uuid[])
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_role('sadmin','admin','accountant');
  if p_store_ids is null or cardinality(p_store_ids) = 0 then
    perform public.raise_error('VALIDATION', 'Chọn ít nhất một cửa hàng');
  end if;
  if exists (select 1 from unnest(p_store_ids) s where not public.can_access_store(s)) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng đã chọn');
  end if;
end $$;

create or replace function public.pnl_report(p_store_ids uuid[], p_from date, p_to date, p_channel public.sale_channel default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_gross bigint; v_disc bigint; v_returns bigint := 0; v_cogs bigint; v_opex bigint; v_shrink bigint := 0; v_other bigint;
  v_net_rev bigint; v_gp bigint; v_np bigint;
begin
  perform public._assert_report_access(p_store_ids);
  select coalesce(sum(subtotal), 0), coalesce(sum(discount_amount + loyalty_amount), 0), coalesce(sum(cogs_total), 0)
    into v_gross, v_disc, v_cogs
  from public.sales
  where store_id = any(p_store_ids) and status in ('completed','partially_refunded','refunded')
    and (completed_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
    and (p_channel is null or channel = p_channel);

  select coalesce(sum(t.amount) filter (where t.kind = 'expense' and not c.is_system), 0),
         coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)
    into v_opex, v_other
  from public.cash_transactions t join public.expense_categories c on c.id = t.category_id
  where t.store_id = any(p_store_ids) and t.approval_status = 'approved' and t.occurred_on between p_from and p_to;
  if p_channel is not null then v_opex := 0; v_other := 0; end if;

  v_net_rev := v_gross - v_disc - v_returns;
  v_gp := v_net_rev - v_cogs;
  v_np := v_gp - v_opex - v_shrink + v_other;
  return jsonb_build_object(
    'gross_revenue', v_gross, 'discounts', v_disc, 'returns', v_returns, 'net_revenue', v_net_rev,
    'cogs', v_cogs, 'gross_profit', v_gp, 'operating_expenses', v_opex, 'shrinkage', v_shrink,
    'other_income', v_other, 'net_profit', v_np,
    'gross_margin', case when v_net_rev = 0 then null else round(v_gp::numeric / v_net_rev * 100, 2) end,
    'net_margin', case when v_net_rev = 0 then null else round(v_np::numeric / v_net_rev * 100, 2) end);
end $$;

create or replace function public.pnl_daily(p_store_ids uuid[], p_from date, p_to date, p_channel public.sale_channel default null)
returns table (day date, net_revenue bigint, cogs bigint, gross_profit bigint, sales_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._assert_report_access(p_store_ids);
  return query
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as d),
  s as (
    select (completed_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
           sum(subtotal - discount_amount - loyalty_amount) as nr, sum(cogs_total) as cg, count(*) as cnt
    from public.sales
    where store_id = any(p_store_ids) and status in ('completed','partially_refunded','refunded')
      and (completed_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
      and (p_channel is null or channel = p_channel)
    group by 1)
  select days.d, coalesce(s.nr, 0)::bigint, coalesce(s.cg, 0)::bigint, (coalesce(s.nr, 0) - coalesce(s.cg, 0))::bigint,
         coalesce(s.cnt, 0)
  from days left join s on s.d = days.d order by days.d;
end $$;

create or replace function public.revenue_breakdown(p_store_ids uuid[], p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public._assert_report_access(p_store_ids);
  with s as (
    select * from public.sales
    where store_id = any(p_store_ids) and status in ('completed','partially_refunded','refunded')
      and (completed_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to)
  select jsonb_build_object(
    'by_channel', (select coalesce(jsonb_object_agg(channel, amt), '{}'::jsonb) from (select channel, sum(total) amt from s group by channel) a),
    'by_method', (select coalesce(jsonb_object_agg(method, amt), '{}'::jsonb) from (
        select sp.method, sum(sp.amount) amt from public.sale_payments sp join s on s.id = sp.sale_id group by sp.method) b),
    'by_goods_type', (select coalesce(jsonb_object_agg(goods_type, amt), '{}'::jsonb) from (
        select si.goods_type, sum(si.line_total) amt from public.sale_items si join s on s.id = si.sale_id group by si.goods_type) c),
    'count', (select count(*) from s),
    'total', (select coalesce(sum(total), 0) from s)
  ) into r;
  return r;
end $$;

-- COGS theo san pham / nhom hang / kenh / loai hang (F6.7). Doanh thu dong = line_total (chua tru giam gia don).
create or replace function public.cogs_report(p_store_ids uuid[], p_from date, p_to date, p_group text default 'product')
returns table (group_key text, group_label text, qty numeric, revenue bigint, cogs bigint, gross_profit bigint, margin numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._assert_report_access(p_store_ids);
  return query
  select g.k, g.lbl, sum(g.qty), sum(g.rev)::bigint, sum(g.cogs)::bigint, (sum(g.rev) - sum(g.cogs))::bigint,
         case when sum(g.rev) = 0 then null else round((sum(g.rev) - sum(g.cogs)) / sum(g.rev) * 100, 2) end
  from (
    select case p_group when 'category' then coalesce(c.id::text, '-')
                        when 'channel' then s.channel::text
                        when 'goods_type' then si.goods_type::text
                        else p.id::text end as k,
           case p_group when 'category' then coalesce(c.name, 'Chưa phân nhóm')
                        when 'channel' then s.channel::text
                        when 'goods_type' then si.goods_type::text
                        else p.name || ' (' || p.sku || ')' end as lbl,
           si.qty, si.line_total::numeric as rev, si.cogs::numeric as cogs
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    join public.products p on p.id = si.product_id
    left join public.categories c on c.id = p.category_id
    where s.store_id = any(p_store_ids) and s.status in ('completed','partially_refunded','refunded')
      and (s.completed_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
  ) g
  group by g.k, g.lbl
  order by sum(g.rev) - sum(g.cogs) desc;
end $$;

create or replace function public.expense_report(p_store_ids uuid[], p_from date, p_to date)
returns table (category_id uuid, category text, kind public.cash_kind, amount bigint, unpaid bigint, tx_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._assert_report_access(p_store_ids);
  return query
  select c.id, c.name, c.kind, sum(t.amount)::bigint,
         coalesce(sum(t.amount) filter (where t.payment_status = 'unpaid'), 0)::bigint, count(*)
  from public.cash_transactions t join public.expense_categories c on c.id = t.category_id
  where t.store_id = any(p_store_ids) and t.approval_status = 'approved' and t.occurred_on between p_from and p_to
  group by c.id, c.name, c.kind
  order by c.kind desc, sum(t.amount) desc;
end $$;

-- Best seller (F3.8, P1 nhung dung chung du lieu; tieu chi theo setting)
create or replace function public.best_sellers(p_store_ids uuid[], p_from date, p_to date, p_order text default 'by_qty', p_limit integer default 20)
returns table (product_id uuid, sku text, name text, qty numeric, revenue bigint, gross_profit bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_show_profit boolean := public.auth_role() in ('sadmin','admin','accountant');
begin
  perform public.assert_role('sadmin','admin','accountant','staff');
  if exists (select 1 from unnest(p_store_ids) s where not public.can_access_store(s)) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng đã chọn');
  end if;
  return query
  select p.id, p.sku, p.name, sum(si.qty), sum(si.line_total)::bigint,
         case when v_show_profit then sum(si.line_total - si.cogs)::bigint end
  from public.sale_items si join public.sales s on s.id = si.sale_id join public.products p on p.id = si.product_id
  where s.store_id = any(p_store_ids) and s.status in ('completed','partially_refunded','refunded')
    and (s.completed_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
  group by p.id, p.sku, p.name
  order by case p_order when 'by_revenue' then sum(si.line_total)
                        when 'by_gross_profit' then case when v_show_profit then sum(si.line_total - si.cogs) else sum(si.line_total) end
                        else sum(si.qty) end desc
  limit greatest(1, least(coalesce(p_limit, 20), 200));
end $$;

------------------------------------------------------------
-- Quyen thuc thi
------------------------------------------------------------
revoke execute on function public._order_log(uuid, public.order_status, public.order_status, text) from public, anon, authenticated;
revoke execute on function public._release_order(public.orders, text) from public, anon, authenticated;
revoke execute on function public._post_sale(jsonb) from public, anon, authenticated;
revoke execute on function public._assert_report_access(uuid[]) from public, anon, authenticated;
revoke execute on function public.create_order(jsonb) from public, anon;
revoke execute on function public.update_order_status(uuid, public.order_status, text) from public, anon;
revoke execute on function public.reconcile_reservations(uuid) from public, anon;
revoke execute on function public.debt_due_status(date, bigint, uuid) from public, anon;
revoke execute on function public.record_supplier_payment(jsonb) from public, anon;
revoke execute on function public.debt_overview(uuid[]) from public, anon;
revoke execute on function public.create_cash_transaction(jsonb) from public, anon;
revoke execute on function public.review_cash_transaction(uuid, boolean, text) from public, anon;
revoke execute on function public.mark_cash_transaction_paid(uuid, date) from public, anon;
revoke execute on function public.reconcile_report(uuid, date, date) from public, anon;
revoke execute on function public.save_reconciliation_note(uuid, date, bigint, text) from public, anon;
revoke execute on function public.pnl_report(uuid[], date, date, public.sale_channel) from public, anon;
revoke execute on function public.pnl_daily(uuid[], date, date, public.sale_channel) from public, anon;
revoke execute on function public.revenue_breakdown(uuid[], date, date) from public, anon;
revoke execute on function public.cogs_report(uuid[], date, date, text) from public, anon;
revoke execute on function public.expense_report(uuid[], date, date) from public, anon;
revoke execute on function public.best_sellers(uuid[], date, date, text, integer) from public, anon;

grant execute on function public.create_order(jsonb) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.reconcile_reservations(uuid) to authenticated;
grant execute on function public.debt_due_status(date, bigint, uuid) to authenticated;
grant execute on function public.record_supplier_payment(jsonb) to authenticated;
grant execute on function public.debt_overview(uuid[]) to authenticated;
grant execute on function public.create_cash_transaction(jsonb) to authenticated;
grant execute on function public.review_cash_transaction(uuid, boolean, text) to authenticated;
grant execute on function public.mark_cash_transaction_paid(uuid, date) to authenticated;
grant execute on function public.reconcile_report(uuid, date, date) to authenticated;
grant execute on function public.save_reconciliation_note(uuid, date, bigint, text) to authenticated;
grant execute on function public.pnl_report(uuid[], date, date, public.sale_channel) to authenticated;
grant execute on function public.pnl_daily(uuid[], date, date, public.sale_channel) to authenticated;
grant execute on function public.revenue_breakdown(uuid[], date, date) to authenticated;
grant execute on function public.cogs_report(uuid[], date, date, text) to authenticated;
grant execute on function public.expense_report(uuid[], date, date) to authenticated;
grant execute on function public.best_sellers(uuid[], date, date, text, integer) to authenticated;
