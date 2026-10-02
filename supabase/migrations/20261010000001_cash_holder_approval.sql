-- Thu chi do nguoi giu tai khoan duyet.
-- Moi nhan su xin chi / bao thu (kind income); nguoi giu tai khoan cua khoan do duyet. Nguoi giu tu xin thi tu duyet.
-- Tai khoan chua co nguoi giu: quan ly cua hang (sadmin/admin) duyet. Sua/xoa khoan da duyet cung can duyet.

alter table public.money_accounts add column if not exists holder_id uuid references public.profiles(id);

alter table public.cash_transactions
  add column if not exists pending_action text check (pending_action in ('edit','delete')),
  add column if not exists pending_data jsonb,
  add column if not exists pending_reason text,
  add column if not exists pending_by uuid references public.profiles(id),
  add column if not exists pending_at timestamptz;

drop trigger if exists audit_money_accounts on public.money_accounts;
create trigger audit_money_accounts after insert or update or delete on public.money_accounts
  for each row execute function public.audit_row_change();

-- Nguoi giu tai khoan thay duoc cac khoan cua tai khoan minh de duyet
drop policy if exists cash_transactions_select on public.cash_transactions;
create policy cash_transactions_select on public.cash_transactions for select to authenticated
  using (((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(store_id)))
         or created_by = (select auth.uid())
         or (account_id in (select m.id from public.money_accounts m where m.holder_id = (select auth.uid()))
             and (select public.can_access_store(store_id))));

------------------------------------------------------------
-- Quyen duyet
------------------------------------------------------------
create or replace function public._can_approve_cash(p_account_id uuid, p_store_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.can_access_store(p_store_id) and (
    case when (select m.holder_id from public.money_accounts m where m.id = p_account_id) is not null
         then (select m.holder_id from public.money_accounts m where m.id = p_account_id) = auth.uid()
         else public.is_store_manager(p_store_id) end), false)
$$;

-- Kiem tra noi dung sua; tra ve gia tri da chuan hoa
create or replace function public._check_cash_edit(t public.cash_transactions, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cat public.expense_categories;
  v_amount bigint := coalesce((p ->> 'amount')::bigint, t.amount);
  v_desc text := coalesce(nullif(trim(p ->> 'description'), ''), t.description);
  v_acc uuid := case when p ? 'account_id' then nullif(p ->> 'account_id', '')::uuid else t.account_id end;
begin
  select * into v_cat from public.expense_categories
   where id = coalesce(nullif(p ->> 'category_id', '')::uuid, t.category_id) and is_active;
  if v_cat.id is null or v_cat.kind <> t.kind then perform public.raise_error('VALIDATION', 'Chọn nhóm thu chi phù hợp'); end if;
  if v_amount <= 0 then perform public.raise_error('VALIDATION', 'Số tiền phải lớn hơn 0'); end if;
  perform public._check_money_account(v_acc);
  return jsonb_build_object(
    'category_id', v_cat.id,
    'occurred_on', coalesce((p ->> 'occurred_on')::date, t.occurred_on),
    'description', v_desc,
    'amount', v_amount,
    'method', coalesce(p ->> 'method', t.method::text),
    'counterparty', case when p ? 'counterparty' then nullif(trim(p ->> 'counterparty'), '') else t.counterparty end,
    'doc_no', case when p ? 'doc_no' then nullif(trim(p ->> 'doc_no'), '') else t.doc_no end,
    'note', case when p ? 'note' then nullif(trim(p ->> 'note'), '') else t.note end,
    'account_id', v_acc);
end $$;

-- Khoan gan ca da chot khong sua/xoa duoc (tien ca da doi chieu)
create or replace function public._check_cash_shift_open(t public.cash_transactions)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if t.shift_id is not null and not exists (select 1 from public.shifts where id = t.shift_id and status = 'open') then
    perform public.raise_error('INVALID_STATE', 'Khoản này thuộc ca đã chốt nên không sửa hoặc xóa được');
  end if;
end $$;

create or replace function public._apply_cash_change(t public.cash_transactions, p_action text, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._check_cash_shift_open(t);
  if t.shift_id is not null then
    delete from public.shift_cash_movements where ref_type = 'cash_transaction' and ref_id = t.id;
  end if;
  if p_action = 'delete' then
    delete from public.cash_transactions where id = t.id;
    return;
  end if;
  v := public._check_cash_edit(t, p);
  update public.cash_transactions set
    category_id = (v ->> 'category_id')::uuid,
    occurred_on = (v ->> 'occurred_on')::date,
    description = v ->> 'description',
    amount = (v ->> 'amount')::bigint,
    method = (v ->> 'method')::public.payment_method,
    counterparty = v ->> 'counterparty',
    doc_no = v ->> 'doc_no',
    note = v ->> 'note',
    account_id = nullif(v ->> 'account_id', '')::uuid,
    pending_action = null, pending_data = null, pending_reason = null, pending_by = null, pending_at = null,
    reject_reason = null
   where id = t.id;
  if t.shift_id is not null and (v ->> 'method') = 'cash' then
    perform public._shift_cash(t.shift_id, t.kind, (v ->> 'amount')::bigint, v ->> 'description', 'cash_transaction', t.id);
  end if;
end $$;

------------------------------------------------------------
-- Tao khoan thu chi: moi nhan su xin, nguoi giu tai khoan duyet
------------------------------------------------------------
create or replace function public.create_cash_transaction(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := (p ->> 'store_id')::uuid;
  v_kind public.cash_kind := (p ->> 'kind')::public.cash_kind;
  v_amount bigint := (p ->> 'amount')::bigint;
  v_role public.app_role := public.auth_role();
  v_account uuid := nullif(p ->> 'account_id', '')::uuid;
  v_method public.payment_method := (p ->> 'method')::public.payment_method;
  v_pay text := case when v_role = 'staff' then 'paid' else coalesce(p ->> 'payment_status', 'paid') end;
  v_shift uuid;
  v_status public.approval_status;
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
  perform public._check_money_account(v_account);

  if v_method = 'cash' then
    if v_role = 'staff' then
      v_shift := public._my_open_shift(v_store);
    elsif coalesce((p ->> 'record_in_shift')::boolean, false) then
      v_shift := public._my_open_shift(v_store);
      if v_shift is null then perform public.raise_error('SHIFT_NOT_OPEN', 'Bạn chưa mở ca'); end if;
    end if;
  end if;

  v_status := case when public._can_approve_cash(v_account, v_store) then 'approved' else 'pending' end;
  v_code := public.next_doc_code('TC', public._store_code(v_store));
  insert into public.cash_transactions(code, store_id, kind, category_id, occurred_on, description, amount, method,
    counterparty, doc_no, note, payment_status, paid_on, shift_id, approval_status, approved_by, approved_at, account_id)
  values (v_code, v_store, v_kind, v_cat.id, coalesce((p ->> 'occurred_on')::date, public._today()),
    trim(p ->> 'description'), v_amount, v_method,
    nullif(trim(p ->> 'counterparty'), ''), nullif(trim(p ->> 'doc_no'), ''), nullif(trim(p ->> 'note'), ''),
    case when v_shift is not null then 'paid' else v_pay end,
    case when v_pay = 'paid' or v_shift is not null
         then coalesce((p ->> 'occurred_on')::date, public._today()) end,
    v_shift, v_status,
    case when v_status = 'approved' then auth.uid() end, case when v_status = 'approved' then now() end,
    v_account)
  returning id into v_id;

  if v_shift is not null and v_status = 'approved' then
    perform public._shift_cash(v_shift, v_kind, v_amount, trim(p ->> 'description'), 'cash_transaction', v_id);
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code, 'approval_status', v_status);
end $$;

------------------------------------------------------------
-- Duyet / tu choi: khoan moi hoac yeu cau sua/xoa
------------------------------------------------------------
create or replace function public.review_cash_transaction(p_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.cash_transactions;
begin
  select * into t from public.cash_transactions where id = p_id for update;
  if t.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy khoản thu chi'); end if;
  if not public._can_approve_cash(t.account_id, t.store_id) then
    perform public.raise_error('FORBIDDEN', 'Chỉ người giữ tài khoản mới duyệt được');
  end if;
  if t.pending_action is null and t.approval_status <> 'pending' then
    perform public.raise_error('INVALID_STATE', 'Khoản này đã được xử lý');
  end if;
  if not p_approve and nullif(trim(p_reason), '') is null then
    perform public.raise_error('VALIDATION', 'Nhập lý do từ chối');
  end if;

  if t.pending_action is not null then
    if p_approve then
      perform public._apply_cash_change(t, t.pending_action, t.pending_data);
    else
      update public.cash_transactions set
        reject_reason = 'Từ chối ' || case t.pending_action when 'edit' then 'sửa' else 'xóa' end || ': ' || trim(p_reason),
        pending_action = null, pending_data = null, pending_reason = null, pending_by = null, pending_at = null
       where id = t.id;
    end if;
    return;
  end if;

  update public.cash_transactions set approval_status = case when p_approve then 'approved'::public.approval_status else 'rejected'::public.approval_status end,
    approved_by = auth.uid(), approved_at = now(), reject_reason = case when p_approve then null else trim(p_reason) end
   where id = t.id;
  if p_approve and t.shift_id is not null and t.method = 'cash'
     and exists (select 1 from public.shifts where id = t.shift_id and status = 'open') then
    perform public._shift_cash(t.shift_id, t.kind, t.amount, t.description, 'cash_transaction', t.id);
  end if;
end $$;

------------------------------------------------------------
-- Xin sua / xoa khoan da duyet (nguoi tao hoac quan ly cua hang)
------------------------------------------------------------
create or replace function public.request_cash_change(p_id uuid, p_action text, p jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.cash_transactions; v jsonb;
begin
  perform public.assert_role('sadmin','admin','accountant','staff');
  if p_action not in ('edit','delete') then perform public.raise_error('VALIDATION', 'Yêu cầu không hợp lệ'); end if;
  select * into t from public.cash_transactions where id = p_id for update;
  if t.id is null or not public.can_access_store(t.store_id) then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy khoản thu chi');
  end if;
  if not (t.created_by = auth.uid() or public.is_store_manager(t.store_id)) then
    perform public.raise_error('FORBIDDEN', 'Chỉ người tạo hoặc quản lý cửa hàng mới xin sửa hoặc xóa được');
  end if;
  if t.approval_status <> 'approved' then
    perform public.raise_error('INVALID_STATE', 'Chỉ sửa hoặc xóa được khoản đã duyệt');
  end if;
  if t.payout_id is not null then
    perform public.raise_error('INVALID_STATE', 'Khoản này sinh từ đối soát Shopee, hủy ở đợt đối soát');
  end if;
  if t.pending_action is not null then
    perform public.raise_error('INVALID_STATE', 'Khoản này đang có yêu cầu chờ duyệt');
  end if;
  if nullif(trim(p_reason), '') is null then perform public.raise_error('VALIDATION', 'Nhập lý do'); end if;
  perform public._check_cash_shift_open(t);
  v := case when p_action = 'edit' then public._check_cash_edit(t, p) end;

  if public._can_approve_cash(t.account_id, t.store_id) then
    perform public._apply_cash_change(t, p_action, v);
    return jsonb_build_object('applied', true);
  end if;
  update public.cash_transactions set pending_action = p_action, pending_data = v, pending_reason = trim(p_reason),
    pending_by = auth.uid(), pending_at = now(), reject_reason = null
   where id = t.id;
  return jsonb_build_object('applied', false);
end $$;

------------------------------------------------------------
-- Nguoi giu tai khoan (sadmin/admin chon)
------------------------------------------------------------
create or replace function public.set_money_account_holder(p_account_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_role('sadmin','admin');
  if not exists (select 1 from public.money_accounts where id = p_account_id) then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy tài khoản');
  end if;
  if p_user_id is not null and not exists (select 1 from public.profiles where id = p_user_id and is_active) then
    perform public.raise_error('VALIDATION', 'Người giữ tài khoản không hợp lệ');
  end if;
  update public.money_accounts set holder_id = p_user_id where id = p_account_id;
end $$;

-- Danh sach tai khoan kem nguoi giu va so du (so du chi hien cho quan ly, ke toan, nguoi giu)
create or replace function public.money_accounts_overview()
returns table(id uuid, name text, kind text, holder_id uuid, holder_name text, balance bigint)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, a.kind, a.holder_id, p.full_name,
    case when public.auth_role() in ('sadmin','admin','accountant') or a.holder_id = auth.uid()
         then (select b.balance from public.money_account_balances() b where b.id = a.id) end
  from public.money_accounts a
  left join public.profiles p on p.id = a.holder_id
  where a.is_active
  order by a.sort_order, a.name;
$$;

-- So tai khoan: thu ban hang, thu chi da duyet va da tra, tra NCC, kem so du sau moi dong
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
  ), r as (
    select e.d, e.t, e.src, e.c, e.ds, e.amt,
           (a.opening_balance + sum(e.amt) over (order by e.d, e.t, e.c rows unbounded preceding))::bigint as bal
      from e
  )
  select r.d, r.t, r.src, r.c, r.ds, r.amt, r.bal from r
   where (p_from is null or r.d >= p_from) and (p_to is null or r.d <= p_to)
   order by r.d desc, r.t desc, r.c desc;
end $$;

revoke execute on function public._can_approve_cash(uuid, uuid) from public, anon;
revoke execute on function public._check_cash_edit(public.cash_transactions, jsonb) from public, anon, authenticated;
revoke execute on function public._check_cash_shift_open(public.cash_transactions) from public, anon, authenticated;
revoke execute on function public._apply_cash_change(public.cash_transactions, text, jsonb) from public, anon, authenticated;
revoke execute on function public.request_cash_change(uuid, text, jsonb, text) from public, anon;
revoke execute on function public.set_money_account_holder(uuid, uuid) from public, anon;
revoke execute on function public.money_accounts_overview() from public, anon;
revoke execute on function public.money_account_ledger(uuid, date, date) from public, anon;
grant execute on function public._can_approve_cash(uuid, uuid) to authenticated;
grant execute on function public.request_cash_change(uuid, text, jsonb, text) to authenticated;
grant execute on function public.set_money_account_holder(uuid, uuid) to authenticated;
grant execute on function public.money_accounts_overview() to authenticated;
grant execute on function public.money_account_ledger(uuid, date, date) to authenticated;
