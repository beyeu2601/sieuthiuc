-- Sprint 3 - ca lam viec, ban hang tai quay, huy giao dich, PIN duyet giam gia
-- Nguon: SPEC 6.7, 6.8, 7.2, 7.5, 7.8, 8.1 (F1.1-F1.4, F1.6, F1.7), 8.7 (F7.1, F7.3, F7.4).
-- Chua lam: tich/dung diem thanh vien (P1), hoan tra (P1), thu chi tien mat trong ca do nguoi dung nhap (P1).

create extension if not exists pgcrypto with schema extensions;

------------------------------------------------------------
-- Ca lam viec
------------------------------------------------------------
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid not null references public.stores(id),
  user_id uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash bigint not null check (opening_cash >= 0),
  expected_cash bigint,
  counted_cash bigint check (counted_cash >= 0),
  cash_diff bigint,
  status public.shift_status not null default 'open',
  close_note text,
  closed_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create unique index shifts_one_open_per_user_uq on public.shifts(store_id, user_id) where status = 'open';
create index shifts_store_idx on public.shifts(store_id, opened_at desc);

create table public.shift_cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  kind public.cash_kind not null,
  amount bigint not null check (amount > 0),
  reason text not null,
  ref_type text,
  ref_id uuid,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index shift_cash_movements_shift_idx on public.shift_cash_movements(shift_id);

alter table public.supplier_payments add constraint supplier_payments_shift_fkey
  foreign key (shift_id) references public.shifts(id);

------------------------------------------------------------
-- Ban hang
------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid not null references public.stores(id),
  shift_id uuid references public.shifts(id),
  channel public.sale_channel not null default 'pos',
  order_id uuid,
  member_id uuid,
  status public.sale_status not null default 'completed',
  subtotal bigint not null,
  discount_amount bigint not null default 0,
  loyalty_points_redeemed integer not null default 0,
  loyalty_amount bigint not null default 0,
  total bigint not null check (total >= 0),
  cogs_total bigint not null default 0,
  points_earned integer not null default 0,
  discount_approved_by uuid references public.profiles(id),
  cancel_reason text,
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  completed_at timestamptz not null default now(),
  note text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index sales_store_created_idx on public.sales(store_id, created_at);
create index sales_store_completed_idx on public.sales(store_id, completed_at);
create index sales_shift_idx on public.sales(shift_id);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  line_no integer not null,
  product_id uuid not null references public.products(id),
  goods_type public.goods_type not null,
  qty numeric(12,3) not null check (qty > 0),
  unit_price bigint not null check (unit_price >= 0),
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  line_total bigint not null,
  unit_cost bigint not null default 0,
  cogs bigint not null default 0,
  lot_allocations jsonb not null default '[]'::jsonb
);
create index sale_items_sale_idx on public.sale_items(sale_id);
create index sale_items_product_idx on public.sale_items(product_id);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  method public.payment_method not null,
  amount bigint not null check (amount > 0),
  reference text
);
create index sale_payments_sale_idx on public.sale_payments(sale_id);

------------------------------------------------------------
-- PIN quan ly duyet giam gia vuot han muc (F1.2)
------------------------------------------------------------
alter table public.profiles add column pos_pin_hash text;

create table public.pin_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index pin_attempts_user_idx on public.pin_attempts(user_id, created_at desc);

create or replace function public.set_my_pin(p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_role('sadmin','admin');
  if p_pin !~ '^[0-9]{4,8}$' then
    perform public.raise_error('VALIDATION', 'Mã PIN gồm 4 đến 8 chữ số');
  end if;
  update public.profiles set pos_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
   where id = auth.uid();
end $$;

-- Quan ly nhap PIN tai quay de duyet giam gia vuot han muc. Thanh cong: cap ma duyet dung 1 lan trong 5 phut.
-- That bai: ghi lan sai (khong raise de ban ghi khong bi rollback). Sai 3 lan trong 1 phut -> khoa 1 phut.
create table public.discount_approvals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  requested_by uuid not null references public.profiles(id),
  approved_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default now() + interval '5 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.request_discount_approval(p_store_id uuid, p_username text, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_fail integer;
  v_mgr public.profiles;
  v_id uuid;
begin
  perform public.assert_role('sadmin','admin','staff');
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  select count(*) into v_fail from public.pin_attempts
   where user_id = auth.uid() and not success and created_at > now() - interval '1 minute';
  if v_fail >= 3 then
    return jsonb_build_object('ok', false, 'error', 'Nhập sai PIN 3 lần. Thử lại sau 1 phút.');
  end if;
  select p.* into v_mgr from public.profiles p
   where p.username = lower(trim(p_username)) and p.is_active and p.pos_pin_hash is not null
     and (p.role = 'sadmin' or (p.role = 'admin' and exists (
          select 1 from public.user_stores us where us.user_id = p.id and us.store_id = p_store_id)));
  if v_mgr.id is null or v_mgr.pos_pin_hash <> extensions.crypt(coalesce(p_pin, ''), v_mgr.pos_pin_hash) then
    insert into public.pin_attempts(user_id, success) values (auth.uid(), false);
    return jsonb_build_object('ok', false, 'error',
      case when v_fail >= 2 then 'Sai PIN. Đã khóa 1 phút.' else 'Tên quản lý hoặc PIN không đúng' end);
  end if;
  insert into public.pin_attempts(user_id, success) values (auth.uid(), true);
  insert into public.discount_approvals(store_id, requested_by, approved_by)
  values (p_store_id, auth.uid(), v_mgr.id) returning id into v_id;
  return jsonb_build_object('ok', true, 'approval_id', v_id, 'approved_by_name', v_mgr.full_name);
end $$;

------------------------------------------------------------
-- Ham noi bo: ca
------------------------------------------------------------
create or replace function public._shift_cash(p_shift_id uuid, p_kind public.cash_kind, p_amount bigint,
  p_reason text, p_ref_type text, p_ref_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p_amount, 0) <= 0 then return; end if;
  if not exists (select 1 from public.shifts where id = p_shift_id and status = 'open') then
    perform public.raise_error('SHIFT_NOT_OPEN', 'Ca không ở trạng thái đang mở');
  end if;
  insert into public.shift_cash_movements(shift_id, kind, amount, reason, ref_type, ref_id)
  values (p_shift_id, p_kind, p_amount, p_reason, p_ref_type, p_ref_id);
end $$;

-- Ca dang mo cua nguoi dung hien tai tai cua hang
create or replace function public._my_open_shift(p_store_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.shifts where store_id = p_store_id and user_id = auth.uid() and status = 'open'
$$;

-- Tien mat ky vong (SPEC 7.8). Hoan tra tien mat (P1) chua co nen = 0.
create or replace function public.shift_expected_cash(p_shift_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select s.opening_cash
    + coalesce((select sum(sp.amount) from public.sale_payments sp join public.sales x on x.id = sp.sale_id
                where x.shift_id = s.id and x.status in ('completed','partially_refunded','refunded')
                  and sp.method = 'cash'), 0)
    + coalesce((select sum(amount) from public.shift_cash_movements where shift_id = s.id and kind = 'income'), 0)
    - coalesce((select sum(amount) from public.shift_cash_movements where shift_id = s.id and kind = 'expense'), 0)
  from public.shifts s where s.id = p_shift_id
$$;

create or replace function public.open_shift(p_store_id uuid, p_opening_cash bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text;
begin
  perform public.assert_role('sadmin','admin','staff');
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if coalesce(p_opening_cash, -1) < 0 then
    perform public.raise_error('VALIDATION', 'Nhập tiền mặt đầu ca (không âm)');
  end if;
  if public._my_open_shift(p_store_id) is not null then
    perform public.raise_error('INVALID_STATE', 'Bạn đang có một ca chưa chốt tại cửa hàng này');
  end if;
  v_code := public.next_doc_code('CA', public._store_code(p_store_id));
  insert into public.shifts(code, store_id, user_id, opening_cash)
  values (v_code, p_store_id, auth.uid(), p_opening_cash) returning id into v_id;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- Chot ca (F7.3). Chu ca hoac quan ly cua hang ("dong thay").
create or replace function public.close_shift(p_shift_id uuid, p_counted_cash bigint, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.shifts;
  v_expected bigint;
  v_diff bigint;
  v_threshold bigint;
  v_status public.shift_status;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into s from public.shifts where id = p_shift_id for update;
  if s.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy ca'); end if;
  if not (s.user_id = auth.uid() or public.is_store_manager(s.store_id)) then
    perform public.raise_error('FORBIDDEN', 'Chỉ người mở ca hoặc quản lý mới chốt được ca');
  end if;
  if s.status <> 'open' then perform public.raise_error('INVALID_STATE', 'Ca đã được chốt'); end if;
  if coalesce(p_counted_cash, -1) < 0 then perform public.raise_error('VALIDATION', 'Nhập tiền mặt thực đếm'); end if;

  v_expected := public.shift_expected_cash(s.id);
  v_diff := p_counted_cash - v_expected;
  if v_diff <> 0 and nullif(trim(p_note), '') is null then
    perform public.raise_error('VALIDATION', 'Tiền lệch: bắt buộc ghi chú lý do');
  end if;
  v_threshold := coalesce((public.get_setting('shift.diff_alert_amount', s.store_id))::text::bigint, 50000);
  v_status := case when abs(v_diff) > v_threshold then 'flagged' else 'closed' end;

  update public.shifts set closed_at = now(), expected_cash = v_expected, counted_cash = p_counted_cash,
    cash_diff = v_diff, status = v_status, close_note = nullif(trim(p_note), ''), closed_by = auth.uid()
   where id = s.id;
  return jsonb_build_object('expected_cash', v_expected, 'cash_diff', v_diff, 'status', v_status);
end $$;

create or replace function public.approve_shift(p_shift_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shifts;
begin
  select * into s from public.shifts where id = p_shift_id for update;
  if s.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy ca'); end if;
  if not public.is_store_manager(s.store_id) then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới duyệt được ca');
  end if;
  if s.status not in ('closed','flagged') then
    perform public.raise_error('INVALID_STATE', 'Chỉ duyệt được ca đã chốt');
  end if;
  update public.shifts set status = 'approved', approved_by = auth.uid(), approved_at = now(),
    review_note = coalesce(nullif(trim(p_note), ''), review_note)
   where id = s.id;
end $$;

-- Quan ly sua so tien dem sau khi chot (ghi audit va ly do)
create or replace function public.adjust_shift_count(p_shift_id uuid, p_counted_cash bigint, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shifts;
begin
  select * into s from public.shifts where id = p_shift_id for update;
  if s.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy ca'); end if;
  if not public.is_store_manager(s.store_id) then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới sửa được số đếm');
  end if;
  if s.status = 'open' then perform public.raise_error('INVALID_STATE', 'Ca chưa chốt'); end if;
  if nullif(trim(p_reason), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do sửa'); end if;
  if coalesce(p_counted_cash, -1) < 0 then perform public.raise_error('VALIDATION', 'Số tiền không hợp lệ'); end if;
  update public.shifts set counted_cash = p_counted_cash, cash_diff = p_counted_cash - expected_cash,
    review_note = trim(p_reason)
   where id = s.id;
  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, before, after)
  values (auth.uid(), 'shift.adjust_count', 'shifts', s.id, s.store_id,
          jsonb_build_object('counted_cash', s.counted_cash),
          jsonb_build_object('counted_cash', p_counted_cash, 'reason', trim(p_reason)));
end $$;

------------------------------------------------------------
-- Ghi nhan ban hang (dung chung cho POS va don online giao thanh cong)
-- p: {store_id, shift_id, channel, order_id, note, idempotency_key, discount_amount,
--     items:[{product_id, qty, discount_amount}], payments:[{method, amount, reference}],
--     approval_id (ma duyet giam gia cua quan ly)}
------------------------------------------------------------
create or replace function public._post_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_channel public.sale_channel := coalesce(p ->> 'channel', 'pos')::public.sale_channel;
  v_sale_id uuid := gen_random_uuid();
  v_code text;
  v_today date := public._today();
  it jsonb;
  v_items jsonb := '[]'::jsonb;
  v_prod public.products;
  inv public.inventory;
  lot record;
  v_qty numeric;
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
  -- gop dong trung san pham, sap xep theo product_id de khoa theo thu tu co dinh (tranh deadlock)
  select coalesce(jsonb_agg(x order by x ->> 'product_id'), '[]'::jsonb) into v_items from (
    select jsonb_build_object('product_id', e ->> 'product_id',
             'qty', sum((e ->> 'qty')::numeric),
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
    if v_prod.status <> 'active' then
      perform public.raise_error('VALIDATION', format('%s đã ngừng bán', v_prod.name));
    end if;
    if v_qty is null or v_qty <= 0 then
      perform public.raise_error('VALIDATION', format('%s: số lượng phải lớn hơn 0', v_prod.name));
    end if;

    inv := public._lock_inventory(v_store, v_prod.id);
    if inv.qty_available < v_qty then
      perform public.raise_error('INSUFFICIENT_STOCK',
        format('%s: chỉ còn %s', v_prod.name, greatest(inv.qty_available, 0)::float8));
    end if;
    if v_prod.expiry_level = 'product' and v_prod.expiry_date < v_today then
      perform public.raise_error('EXPIRED_LOT', format('%s: hàng đã hết hạn', v_prod.name));
    end if;

    -- FEFO: lo con han het han som nhat truoc, lo khong co han xep cuoi
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
    if v_line_disc < 0 or v_line_disc > round(v_qty * v_prod.sell_price) then
      perform public.raise_error('VALIDATION', format('%s: giảm giá dòng không hợp lệ', v_prod.name));
    end if;
    v_line_total := round(v_qty * v_prod.sell_price) - v_line_disc;
    insert into public.sale_items(sale_id, line_no, product_id, goods_type, qty, unit_price, discount_amount,
      line_total, unit_cost, cogs, lot_allocations)
    values (v_sale_id, v_line, v_prod.id, v_prod.goods_type, v_qty, v_prod.sell_price, v_line_disc,
      v_line_total, inv.avg_cost, round(v_qty * inv.avg_cost), v_allocs);
    v_subtotal := v_subtotal + v_line_total;
    v_line_disc_total := v_line_disc_total + v_line_disc;
    v_cogs_total := v_cogs_total + round(v_qty * inv.avg_cost);
  end loop;

  -- Gioi han giam gia thu cong cua nhan vien (SPEC 7.5): (dong + don) <= subtotal (sau giam dong) x %
  if v_order_disc > v_subtotal then perform public.raise_error('VALIDATION', 'Giảm giá lớn hơn tiền hàng'); end if;
  if public.auth_role() = 'staff' and (v_line_disc_total + v_order_disc) > 0 then
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
  -- subtotal luu tien hang TRUOC giam gia; discount_amount = giam dong + giam don (SPEC 7.6: doanh thu gop - giam gia)

  if v_approver is not null then
    insert into public.audit_logs(user_id, action, entity, entity_id, store_id, after)
    values (auth.uid(), 'sale.discount_override', 'sales', v_sale_id, v_store,
            jsonb_build_object('approved_by', v_approver, 'discount', v_line_disc_total + v_order_disc));
  end if;

  return jsonb_build_object('id', v_sale_id, 'code', v_code, 'total', v_total);
end $$;

-- F1.3: thanh toan tai quay. Idempotent theo idempotency_key.
create or replace function public.complete_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_existing public.sales;
  v_shift uuid;
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
  r := public._post_sale(p || jsonb_build_object('shift_id', v_shift, 'channel', 'pos', 'order_id', null));
  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, after)
  values (auth.uid(), 'sale.complete', 'sales', (r ->> 'id')::uuid, v_store, r);
  return r;
end $$;

-- F1.4: huy giao dich. Nhan vien: chi giao dich trong ca dang mo cua minh. Quan ly: moi luc.
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
    if s.shift_id is null or not exists (select 1 from public.shifts sh where sh.id = s.shift_id
                                         and sh.user_id = auth.uid() and sh.status = 'open') then
      perform public.raise_error('FORBIDDEN', 'Nhân viên chỉ hủy được giao dịch trong ca đang mở của mình');
    end if;
  end if;
  if nullif(trim(p_reason), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do hủy'); end if;

  -- hoan ton ve dung lo da phan bo, theo thu tu san pham
  for it in select * from public.sale_items where sale_id = s.id order by product_id loop
    for a in select * from jsonb_array_elements(it.lot_allocations) loop
      perform public._apply_movement(s.store_id, it.product_id, (a ->> 'lot_id')::uuid, 'sale_return',
        (a ->> 'qty')::numeric, it.unit_cost, 'sale', s.id, 'Hủy giao dịch ' || s.code);
    end loop;
  end loop;
  update public.sales set status = 'cancelled', cancel_reason = trim(p_reason), cancelled_by = auth.uid(),
    cancelled_at = now()
   where id = s.id;
end $$;

------------------------------------------------------------
-- Tom tat ca (F7.3, F7.4)
------------------------------------------------------------
create or replace function public.shift_summary(p_shift_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.shifts; r jsonb;
begin
  select * into s from public.shifts where id = p_shift_id;
  if s.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy ca'); end if;
  if not (s.user_id = auth.uid() or (public.auth_role() in ('sadmin','admin','accountant') and public.can_access_store(s.store_id))) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem ca này');
  end if;
  select jsonb_build_object(
    'sales_count', (select count(*) from public.sales where shift_id = s.id and status = 'completed'),
    'cancelled_count', (select count(*) from public.sales where shift_id = s.id and status = 'cancelled'),
    'revenue', (select coalesce(sum(total), 0) from public.sales where shift_id = s.id and status = 'completed'),
    'by_method', (select coalesce(jsonb_object_agg(method, amt), '{}'::jsonb) from (
        select sp.method, sum(sp.amount) amt from public.sale_payments sp join public.sales x on x.id = sp.sale_id
        where x.shift_id = s.id and x.status = 'completed' group by sp.method) q),
    'cash_in', (select coalesce(sum(amount), 0) from public.shift_cash_movements where shift_id = s.id and kind = 'income'),
    'cash_out', (select coalesce(sum(amount), 0) from public.shift_cash_movements where shift_id = s.id and kind = 'expense'),
    'expected_cash', public.shift_expected_cash(s.id)
  ) into r;
  return r;
end $$;

------------------------------------------------------------
-- Tra tien NCC bang tien mat trong ca khi xac nhan phieu nhap (F4.3): thay ham cu, them tham so
------------------------------------------------------------
drop function public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date);

create or replace function public.confirm_purchase_receipt(
  p_receipt_id uuid, p_paid_amount bigint default 0, p_payment_method public.payment_method default null,
  p_due_date date default null, p_record_in_shift boolean default false)
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
  if p_record_in_shift and p_paid_amount > 0 and p_payment_method = 'cash' then
    v_shift := public._my_open_shift(r.store_id);
    if v_shift is null then
      perform public.raise_error('SHIFT_NOT_OPEN', 'Bạn chưa mở ca để ghi tiền mặt chi ra');
    end if;
  end if;

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

  for it in select * from public.purchase_receipt_items where receipt_id = r.id order by line_no loop
    perform public._receive_stock(r.store_id, it.product_id, it.qty, it.landed_unit_cost,
      coalesce(it.lot_no, r.code), it.expiry_date, 'purchase', 'purchase_receipt', r.id, it.id);
    update public.products p set cost_price_ref = i.avg_cost
      from public.inventory i
     where p.id = it.product_id and i.store_id = r.store_id and i.product_id = it.product_id;
  end loop;

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
    insert into public.supplier_payments(code, supplier_id, store_id, payment_date, amount, method, receipt_id, note, shift_id)
    values (public.next_doc_code('TT', public._store_code(r.store_id)), r.supplier_id, r.store_id,
            r.receipt_date, p_paid_amount, p_payment_method, r.id, 'Thanh toán khi nhập hàng ' || r.code, v_shift)
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
-- RLS
------------------------------------------------------------
alter table public.shifts enable row level security;
alter table public.shift_cash_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.pin_attempts enable row level security;

-- ca: nhan vien xem ca cua minh; quan ly, ke toan xem ca cua cua hang
create policy shifts_select on public.shifts for select to authenticated
  using (user_id = (select auth.uid())
         or ((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(store_id))));
create policy shift_cash_movements_select on public.shift_cash_movements for select to authenticated
  using (exists (select 1 from public.shifts s where s.id = shift_id and (s.user_id = (select auth.uid())
         or ((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(s.store_id))))));

create policy sales_select on public.sales for select to authenticated
  using ((select public.can_access_store(store_id)));
create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id and (select public.can_access_store(s.store_id))));
create policy sale_payments_select on public.sale_payments for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id and (select public.can_access_store(s.store_id))));
-- pin_attempts, discount_approvals: khong co policy (chi qua ham)
alter table public.discount_approvals enable row level security;

-- Cot gia von (sales.cogs_total, sale_items.unit_cost/cogs) khong doc truc tiep duoc qua API;
-- bao cao gia von di qua ham SECURITY DEFINER co kiem tra vai tro.
revoke select on public.sales from anon, authenticated;
grant select (id, code, store_id, shift_id, channel, order_id, member_id, status, subtotal, discount_amount,
  loyalty_points_redeemed, loyalty_amount, total, points_earned, discount_approved_by, cancel_reason, cancelled_by,
  cancelled_at, completed_at, note, idempotency_key, created_at, created_by)
  on public.sales to authenticated;
revoke select on public.sale_items from anon, authenticated;
grant select (id, sale_id, line_no, product_id, goods_type, qty, unit_price, discount_amount, line_total, lot_allocations)
  on public.sale_items to authenticated;

create trigger shifts_updated_at before update on public.shifts
  for each row execute function public.set_updated_at();
create trigger audit_shifts after insert or update or delete on public.shifts
  for each row execute function public.audit_row_change();
create trigger audit_sales after update or delete on public.sales
  for each row execute function public.audit_row_change();

------------------------------------------------------------
-- Quyen thuc thi
------------------------------------------------------------
revoke execute on function public.set_my_pin(text) from public, anon;
revoke execute on function public.request_discount_approval(uuid, text, text) from public, anon;
grant execute on function public.request_discount_approval(uuid, text, text) to authenticated;
revoke execute on function public._shift_cash(uuid, public.cash_kind, bigint, text, text, uuid) from public, anon, authenticated;
revoke execute on function public._my_open_shift(uuid) from public, anon;
revoke execute on function public.shift_expected_cash(uuid) from public, anon;
revoke execute on function public.open_shift(uuid, bigint) from public, anon;
revoke execute on function public.close_shift(uuid, bigint, text) from public, anon;
revoke execute on function public.approve_shift(uuid, text) from public, anon;
revoke execute on function public.adjust_shift_count(uuid, bigint, text) from public, anon;
revoke execute on function public._post_sale(jsonb) from public, anon, authenticated;
revoke execute on function public.complete_sale(jsonb) from public, anon;
revoke execute on function public.cancel_sale(uuid, text) from public, anon;
revoke execute on function public.shift_summary(uuid) from public, anon;
revoke execute on function public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date, boolean) from public, anon;

grant execute on function public.set_my_pin(text) to authenticated;
grant execute on function public._my_open_shift(uuid) to authenticated;
grant execute on function public.shift_expected_cash(uuid) to authenticated;
grant execute on function public.open_shift(uuid, bigint) to authenticated;
grant execute on function public.close_shift(uuid, bigint, text) to authenticated;
grant execute on function public.approve_shift(uuid, text) to authenticated;
grant execute on function public.adjust_shift_count(uuid, bigint, text) to authenticated;
grant execute on function public.complete_sale(jsonb) to authenticated;
grant execute on function public.cancel_sale(uuid, text) to authenticated;
grant execute on function public.shift_summary(uuid) to authenticated;
grant execute on function public.confirm_purchase_receipt(uuid, bigint, public.payment_method, date, boolean) to authenticated;

-- Ma bam PIN khong doc duoc qua API
revoke select on public.profiles from anon, authenticated;
grant select (id, username, full_name, phone, role, is_active, default_store_id, extra_permissions,
  created_at, updated_at, created_by) on public.profiles to authenticated;

create or replace function public.my_pin_is_set()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select pos_pin_hash is not null from public.profiles where id = auth.uid()), false)
$$;
revoke execute on function public.my_pin_is_set() from public, anon;
grant execute on function public.my_pin_is_set() to authenticated;
