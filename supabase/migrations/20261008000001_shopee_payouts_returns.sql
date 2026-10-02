-- Doi soat tien Shopee va hoan hang don online (khach yeu cau 02/10/2026).
-- Shopee tra tien theo dot vao tai khoan ngan hang, gop nhieu don va da tru phi san.
-- record_platform_payout: tick cac don Shopee da giao chua nhan tien, nhap so tien thuc nhan va tai khoan.
--   Tien ban cua cac don gan vao tai khoan (sale_payments.account_id); chenh lech (tong don - thuc nhan - quang cao)
--   ghi khoan chi "Phí sàn Shopee"; quang cao tu nap ghi khoan chi "Quảng cáo Shopee"; neu Shopee tra nhieu hon
--   thi phan du ghi khoan thu "Thu khác". So du tai khoan = so tien thuc nhan.
-- cancel_platform_payout: huy dot doi soat nhap sai, tra cac don ve cho Shopee tra.
-- return_order: don da giao chua nhan tien -> hoan hang, huy giao dich ban (bo doanh thu), cho quan ly kiem hang.
-- review_order_return: quan ly duyet nhap lai kho (tra ve dung lo da xuat) hoac khong nhap (hang hong).

------------------------------------------------------------
-- Bang va cot
------------------------------------------------------------
create table public.platform_payouts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid not null references public.stores(id),
  channel public.sale_channel not null check (channel <> 'pos'),
  account_id uuid not null references public.money_accounts(id),
  received_on date not null,
  orders_total bigint not null,
  amount_received bigint not null check (amount_received >= 0),
  ads_amount bigint not null default 0 check (ads_amount >= 0),
  fee_amount bigint not null,
  order_count integer not null,
  note text,
  status text not null default 'active' check (status in ('active','cancelled')),
  cancel_reason text,
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index platform_payouts_store_idx on public.platform_payouts(store_id, received_on desc);

alter table public.orders
  add column payout_id uuid references public.platform_payouts(id),
  add column return_reason text,
  add column return_status text check (return_status in ('pending_check','restocked','discarded')),
  add column return_checked_by uuid references public.profiles(id),
  add column return_checked_at timestamptz,
  add column return_check_note text;
create index orders_payout_idx on public.orders(payout_id);

alter table public.cash_transactions add column payout_id uuid references public.platform_payouts(id);

insert into public.expense_categories(name, kind) values
  ('Phí sàn Shopee','expense'), ('Quảng cáo Shopee','expense')
on conflict do nothing;

alter table public.platform_payouts enable row level security;
create policy platform_payouts_select on public.platform_payouts for select to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(store_id)));

create trigger audit_platform_payouts after insert or update or delete on public.platform_payouts
  for each row execute function public.audit_row_change();

------------------------------------------------------------
-- Ghi dot tien Shopee tra
-- p: {store_id, channel, account_id, received_on, amount_received, ads_amount, note, order_ids:[uuid]}
------------------------------------------------------------
create or replace function public.record_platform_payout(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_channel public.sale_channel := coalesce(p ->> 'channel', 'shopee')::public.sale_channel;
  v_account uuid := nullif(p ->> 'account_id', '')::uuid;
  v_received bigint := (p ->> 'amount_received')::bigint;
  v_ads bigint := coalesce((p ->> 'ads_amount')::bigint, 0);
  v_on date := coalesce((p ->> 'received_on')::date, public._today());
  v_ids uuid[];
  v_found integer;
  v_total bigint;
  v_fee bigint;
  v_id uuid := gen_random_uuid();
  v_code text;
  v_store_code text;
begin
  perform public.assert_role('sadmin','admin','accountant');
  if not public.can_access_store(v_store) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if v_account is null then perform public.raise_error('VALIDATION', 'Chọn tài khoản nhận tiền'); end if;
  perform public._check_money_account(v_account);
  if v_received is null or v_received < 0 then perform public.raise_error('VALIDATION', 'Nhập số tiền thực nhận'); end if;
  if v_ads < 0 then perform public.raise_error('VALIDATION', 'Tiền quảng cáo không hợp lệ'); end if;

  select coalesce(array_agg(distinct x::uuid), '{}') into v_ids
  from jsonb_array_elements_text(coalesce(p -> 'order_ids', '[]'::jsonb)) x;
  if cardinality(v_ids) = 0 then perform public.raise_error('VALIDATION', 'Chọn ít nhất một đơn'); end if;

  -- khoa cac don, chi nhan don da giao, dung kenh, chua doi soat
  perform 1 from public.orders where id = any(v_ids) order by id for update;
  select count(*), coalesce(sum(s.total), 0) into v_found, v_total
  from public.orders o join public.sales s on s.id = o.sale_id
  where o.id = any(v_ids) and o.store_id = v_store and o.channel = v_channel
    and o.status = 'delivered' and o.payout_id is null and s.status = 'completed';
  if v_found <> cardinality(v_ids) then
    perform public.raise_error('INVALID_STATE', 'Có đơn không hợp lệ hoặc đã được đối soát. Tải lại danh sách rồi chọn lại.');
  end if;
  v_fee := v_total - v_received - v_ads;

  v_store_code := public._store_code(v_store);
  v_code := public.next_doc_code('DS', v_store_code);
  insert into public.platform_payouts(id, code, store_id, channel, account_id, received_on, orders_total,
    amount_received, ads_amount, fee_amount, order_count, note)
  values (v_id, v_code, v_store, v_channel, v_account, v_on, v_total, v_received, v_ads, v_fee,
    v_found, nullif(trim(p ->> 'note'), ''));

  update public.orders set payout_id = v_id where id = any(v_ids);
  update public.sale_payments sp set account_id = v_account
   from public.orders o where o.id = any(v_ids) and sp.sale_id = o.sale_id;

  if v_fee > 0 then
    insert into public.cash_transactions(code, store_id, kind, category_id, occurred_on, description, amount, method,
      counterparty, doc_no, payment_status, paid_on, account_id, payout_id)
    values (public.next_doc_code('TC', v_store_code), v_store, 'expense',
      (select id from public.expense_categories where name = 'Phí sàn Shopee' and kind = 'expense'),
      v_on, format('Phí sàn Shopee đợt %s (%s đơn)', v_code, v_found), v_fee, 'transfer',
      'Shopee', v_code, 'paid', v_on, v_account, v_id);
  elsif v_fee < 0 then
    insert into public.cash_transactions(code, store_id, kind, category_id, occurred_on, description, amount, method,
      counterparty, doc_no, payment_status, paid_on, account_id, payout_id)
    values (public.next_doc_code('TC', v_store_code), v_store, 'income',
      (select id from public.expense_categories where name = 'Thu khác' and kind = 'income'),
      v_on, format('Shopee trả cao hơn tổng đơn, đợt %s', v_code), -v_fee, 'transfer',
      'Shopee', v_code, 'paid', v_on, v_account, v_id);
  end if;
  if v_ads > 0 then
    insert into public.cash_transactions(code, store_id, kind, category_id, occurred_on, description, amount, method,
      counterparty, doc_no, payment_status, paid_on, account_id, payout_id)
    values (public.next_doc_code('TC', v_store_code), v_store, 'expense',
      (select id from public.expense_categories where name = 'Quảng cáo Shopee' and kind = 'expense'),
      v_on, format('Quảng cáo Shopee trừ vào đợt %s', v_code), v_ads, 'transfer',
      'Shopee', v_code, 'paid', v_on, v_account, v_id);
  end if;

  return jsonb_build_object('id', v_id, 'code', v_code, 'orders_total', v_total, 'fee_amount', v_fee);
end $$;

------------------------------------------------------------
-- Huy dot doi soat nhap sai (sadmin/admin)
------------------------------------------------------------
create or replace function public.cancel_platform_payout(p_payout_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.platform_payouts;
begin
  select * into r from public.platform_payouts where id = p_payout_id for update;
  if r.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy đợt đối soát'); end if;
  if not public.is_store_manager(r.store_id) then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới hủy được đợt đối soát');
  end if;
  if r.status <> 'active' then perform public.raise_error('INVALID_STATE', 'Đợt đối soát đã hủy'); end if;
  if nullif(trim(p_reason), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do hủy'); end if;

  update public.sale_payments sp set account_id = null
   from public.orders o where o.payout_id = r.id and sp.sale_id = o.sale_id;
  update public.orders set payout_id = null where payout_id = r.id;
  delete from public.cash_transactions where payout_id = r.id;
  update public.platform_payouts set status = 'cancelled', cancel_reason = trim(p_reason),
    cancelled_by = auth.uid(), cancelled_at = now()
   where id = r.id;
end $$;

------------------------------------------------------------
-- Hoan hang don da giao (chua nhan tien tu san)
------------------------------------------------------------
create or replace function public.return_order(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  perform public.assert_role('sadmin','admin','staff');
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy đơn'); end if;
  if not public.can_access_store(o.store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if o.status <> 'delivered' then perform public.raise_error('INVALID_STATE', 'Chỉ hoàn hàng được đơn đã giao'); end if;
  if o.payout_id is not null then
    perform public.raise_error('INVALID_STATE', 'Đơn đã đối soát nhận tiền. Hủy đợt đối soát trước khi hoàn hàng.');
  end if;
  if nullif(trim(p_reason), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do hoàn hàng'); end if;

  -- bo doanh thu va gia von; hang chua vao kho cho toi khi quan ly kiem
  update public.sales set status = 'cancelled', cancel_reason = 'Hoàn hàng: ' || trim(p_reason),
    cancelled_by = auth.uid(), cancelled_at = now()
   where id = o.sale_id and status = 'completed';
  update public.orders set status = 'returned', return_reason = trim(p_reason), return_status = 'pending_check'
   where id = o.id;
  perform public._order_log(o.id, o.status, 'returned', p_reason);
end $$;

create or replace function public.review_order_return(p_order_id uuid, p_restock boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  it record;
  a jsonb;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy đơn'); end if;
  if not public.is_store_manager(o.store_id) then
    perform public.raise_error('FORBIDDEN', 'Chỉ quản lý cửa hàng mới duyệt hàng hoàn');
  end if;
  if o.status <> 'returned' or o.return_status is distinct from 'pending_check' then
    perform public.raise_error('INVALID_STATE', 'Đơn không ở trạng thái chờ kiểm hàng hoàn');
  end if;
  if not p_restock and nullif(trim(p_note), '') is null then
    perform public.raise_error('VALIDATION', 'Nhập lý do không nhập lại kho');
  end if;

  if p_restock then
    -- tra ve dung lo da xuat khi giao, theo thu tu san pham
    for it in select si.* from public.sale_items si where si.sale_id = o.sale_id order by si.product_id loop
      for a in select * from jsonb_array_elements(it.lot_allocations) loop
        perform public._apply_movement(o.store_id, it.product_id, (a ->> 'lot_id')::uuid, 'sale_return',
          (a ->> 'qty')::numeric, it.unit_cost, 'order', o.id, 'Nhập lại hàng hoàn đơn ' || o.code);
      end loop;
    end loop;
  end if;
  update public.orders set return_status = case when p_restock then 'restocked' else 'discarded' end,
    return_checked_by = auth.uid(), return_checked_at = now(), return_check_note = nullif(trim(p_note), '')
   where id = o.id;
end $$;

revoke execute on function public.record_platform_payout(jsonb) from public, anon;
revoke execute on function public.cancel_platform_payout(uuid, text) from public, anon;
revoke execute on function public.return_order(uuid, text) from public, anon;
revoke execute on function public.review_order_return(uuid, boolean, text) from public, anon;
grant execute on function public.record_platform_payout(jsonb) to authenticated;
grant execute on function public.cancel_platform_payout(uuid, text) to authenticated;
grant execute on function public.return_order(uuid, text) to authenticated;
grant execute on function public.review_order_return(uuid, boolean, text) to authenticated;
