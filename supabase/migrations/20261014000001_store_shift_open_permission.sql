-- Mot ca cho mot ket (khach chot 03/10/2026). Truoc day moi nguoi mot ca rieng nen cung mot ket
-- bi dem trong hai ca mo song song (ca cua Giang treo tu 30/09, giao dich tien mat vao nham ca).
-- 1. Moi cua hang chi co mot ca dang mo. Ai ban tai quay trong luc ca mo thi giao dich vao ca do.
-- 2. Chi nguoi duoc cap quyen rieng extra_permissions.open_shift (hoac sadmin) moi mo ca.
-- 3. Nhan vien cua cua hang xem duoc ca dang mo (de ban va xem tong ca).

drop index public.shifts_one_open_per_user_uq;
create unique index shifts_one_open_per_store_uq on public.shifts(store_id) where status = 'open';

-- Giu ten ham cu de cac RPC dang goi (ban hang, thu chi, tra NCC tien mat) dung ca cua cua hang
create or replace function public._my_open_shift(p_store_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.shifts where store_id = p_store_id and status = 'open'
$$;

create or replace function public.open_shift(p_store_id uuid, p_opening_cash bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_open public.shifts;
begin
  perform public.assert_role('sadmin','admin','staff');
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền với cửa hàng này');
  end if;
  if not (public.auth_role() = 'sadmin' or public.auth_has_perm('open_shift')) then
    perform public.raise_error('FORBIDDEN', 'Bạn chưa được cấp quyền mở ca');
  end if;
  if coalesce(p_opening_cash, -1) < 0 then
    perform public.raise_error('VALIDATION', 'Nhập tiền mặt đầu ca (không âm)');
  end if;
  select * into v_open from public.shifts where store_id = p_store_id and status = 'open';
  if v_open.id is not null then
    perform public.raise_error('INVALID_STATE', format('Cửa hàng đang có ca %s chưa chốt', v_open.code));
  end if;
  v_code := public.next_doc_code('CA', public._store_code(p_store_id));
  insert into public.shifts(code, store_id, user_id, opening_cash)
  values (v_code, p_store_id, auth.uid(), p_opening_cash) returning id into v_id;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- Nhan vien huy duoc giao dich do minh ban trong ca dang mo
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

create or replace function public.shift_summary(p_shift_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.shifts; r jsonb;
begin
  select * into s from public.shifts where id = p_shift_id;
  if s.id is null then perform public.raise_error('NOT_FOUND', 'Không tìm thấy ca'); end if;
  if not (s.user_id = auth.uid()
          or (s.status = 'open' and public.can_access_store(s.store_id))
          or (public.auth_role() in ('sadmin','admin','accountant') and public.can_access_store(s.store_id))) then
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

drop policy shifts_select on public.shifts;
create policy shifts_select on public.shifts for select to authenticated
  using (user_id = (select auth.uid())
         or (status = 'open' and (select public.can_access_store(store_id)))
         or ((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(store_id))));
drop policy shift_cash_movements_select on public.shift_cash_movements;
create policy shift_cash_movements_select on public.shift_cash_movements for select to authenticated
  using (exists (select 1 from public.shifts s where s.id = shift_id and (s.user_id = (select auth.uid())
         or (s.status = 'open' and (select public.can_access_store(s.store_id)))
         or ((select public.auth_role()) in ('sadmin','admin','accountant') and (select public.can_access_store(s.store_id))))));

revoke execute on function public._my_open_shift(uuid) from public, anon;
revoke execute on function public.open_shift(uuid, bigint) from public, anon;
revoke execute on function public.cancel_sale(uuid, text) from public, anon;
revoke execute on function public.shift_summary(uuid) from public, anon;
grant execute on function public._my_open_shift(uuid) to authenticated;
grant execute on function public.open_shift(uuid, bigint) to authenticated;
grant execute on function public.cancel_sale(uuid, text) to authenticated;
grant execute on function public.shift_summary(uuid) to authenticated;
