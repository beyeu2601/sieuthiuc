-- Sprint 0 - cua hang, nguoi dung, phan quyen, cau hinh, ma chung tu, audit
-- Nguon: SPEC muc 4, 5, 6.2, 6.3, 6.11, 7.10, 11.
-- Khac SPEC (ghi trong docs/HE-THONG.md):
--   * Quyen doc tu bang profiles/user_stores qua ham SECURITY DEFINER thay vi custom JWT claims,
--     de doi quyen co hieu luc ngay, khong can Auth Hook.
--   * Dang nhap bang username; email noi bo <username>@sieuthiuc.local.
--   * RPC bao loi bang RAISE EXCEPTION, ma loi (FORBIDDEN, VALIDATION...) nam o truong hint.

------------------------------------------------------------
-- Bang
------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{2,10}$'),
  name text not null,
  address text,
  phone text,
  tax_code text,
  invoice_header text,
  invoice_footer text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,32}$'),
  full_name text not null,
  phone text,
  role public.app_role not null,
  is_active boolean not null default true,
  default_store_id uuid references public.stores(id),
  extra_permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid
);

create table public.user_stores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  primary key (user_id, store_id)
);
create index user_stores_store_idx on public.user_stores(store_id);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  store_id uuid references public.stores(id),
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint settings_key_store_uq unique nulls not distinct (key, store_id)
);

create table public.document_sequences (
  prefix text not null,
  store_code text not null,
  day date not null,
  seq integer not null,
  primary key (prefix, store_code, day)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  store_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity, entity_id);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- Ham phan quyen (SECURITY DEFINER de doc profiles ma khong vuong RLS)
------------------------------------------------------------
create or replace function public.auth_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.auth_store_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(us.store_id), '{}'::uuid[])
  from public.user_stores us
  join public.profiles p on p.id = us.user_id and p.is_active
  where us.user_id = auth.uid()
$$;

-- sadmin: moi cua hang; vai tro khac: chi cua hang duoc gan
create or replace function public.can_access_store(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.auth_role() = 'sadmin' or sid = any(public.auth_store_ids()), false)
$$;

-- quan ly cua hang: sadmin, hoac admin cua cua hang do
create or replace function public.is_store_manager(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.auth_role() = 'sadmin'
    or (public.auth_role() = 'admin' and sid = any(public.auth_store_ids())), false)
$$;

create or replace function public.auth_has_perm(perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (p.extra_permissions ->> perm)::boolean from public.profiles p
      where p.id = auth.uid() and p.is_active), false)
$$;

create or replace function public.raise_error(code text, msg text)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using message = msg, hint = code, errcode = 'P0001';
end $$;

create or replace function public.assert_role(variadic roles public.app_role[])
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if public.auth_role() is null or not (public.auth_role() = any(roles)) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này');
  end if;
end $$;

------------------------------------------------------------
-- Chong mat sadmin cuoi cung
------------------------------------------------------------
create or replace function public.protect_last_sadmin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'sadmin' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'sadmin' or not new.is_active)
     and not exists (select 1 from public.profiles p
                     where p.role = 'sadmin' and p.is_active and p.id <> old.id) then
    perform public.raise_error('INVALID_STATE', 'Không thể hạ quyền hoặc khóa sadmin cuối cùng');
  end if;
  return coalesce(new, old);
end $$;

create trigger profiles_protect_last_sadmin before update or delete on public.profiles
  for each row execute function public.protect_last_sadmin();

------------------------------------------------------------
-- Cau hinh
------------------------------------------------------------
create or replace function public.get_setting(p_key text, p_store_id uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.value from public.settings s where s.key = p_key and s.store_id = p_store_id),
    (select s.value from public.settings s where s.key = p_key and s.store_id is null))
$$;

create or replace function public.set_setting(p_key text, p_store_id uuid, p_value jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_store_id is null then
    perform public.assert_role('sadmin');
  elsif not public.is_store_manager(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền sửa cấu hình cửa hàng này');
  end if;
  insert into public.settings(key, store_id, value, updated_by, updated_at)
  values (p_key, p_store_id, p_value, auth.uid(), now())
  on conflict on constraint settings_key_store_uq
  do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
end $$;

------------------------------------------------------------
-- Ma chung tu {PREFIX}-{STORE_CODE}-{YYMMDD}-{seq}
------------------------------------------------------------
create or replace function public.next_doc_code(p_prefix text, p_store_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_seq integer;
begin
  insert into public.document_sequences(prefix, store_code, day, seq)
  values (p_prefix, p_store_code, v_day, 1)
  on conflict (prefix, store_code, day)
  do update set seq = public.document_sequences.seq + 1
  returning seq into v_seq;
  return format('%s-%s-%s-%s', p_prefix, p_store_code, to_char(v_day, 'YYMMDD'), lpad(v_seq::text, 4, '0'));
end $$;

------------------------------------------------------------
-- Audit: trigger generic
------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_after  jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_row    jsonb := coalesce(v_after, v_before);
begin
  if tg_op = 'UPDATE' and v_before = v_after then
    return new;
  end if;
  insert into public.audit_logs(user_id, action, entity, entity_id, store_id, before, after)
  values (auth.uid(), lower(tg_op), tg_table_name,
          case when v_row ? 'id' then (v_row ->> 'id')::uuid end,
          case when v_row ? 'store_id' then (v_row ->> 'store_id')::uuid end,
          v_before, v_after);
  return coalesce(new, old);
end $$;

create trigger audit_stores after insert or update or delete on public.stores
  for each row execute function public.audit_row_change();
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();
create trigger audit_user_stores after insert or update or delete on public.user_stores
  for each row execute function public.audit_row_change();
create trigger audit_settings after insert or update or delete on public.settings
  for each row execute function public.audit_row_change();

------------------------------------------------------------
-- RLS
------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.user_stores enable row level security;
alter table public.settings enable row level security;
alter table public.document_sequences enable row level security;
alter table public.audit_logs enable row level security;

create policy stores_select on public.stores for select to authenticated
  using ((select public.can_access_store(id)));
create policy stores_write on public.stores for all to authenticated
  using ((select public.auth_role()) = 'sadmin')
  with check ((select public.auth_role()) = 'sadmin');

-- ho so: ban than; sadmin xem tat ca; admin xem nguoi cung cua hang
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.auth_role()) = 'sadmin'
    or ((select public.auth_role()) = 'admin' and exists (
          select 1 from public.user_stores us
          where us.user_id = profiles.id and us.store_id = any((select public.auth_store_ids()))))
  );
-- tao / sua nguoi dung qua server (service role) sau khi kiem tra quyen; sadmin sua truc tiep
create policy profiles_write on public.profiles for all to authenticated
  using ((select public.auth_role()) = 'sadmin')
  with check ((select public.auth_role()) = 'sadmin');

create policy user_stores_select on public.user_stores for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_store_manager(store_id)));
create policy user_stores_write on public.user_stores for all to authenticated
  using ((select public.auth_role()) = 'sadmin')
  with check ((select public.auth_role()) = 'sadmin');

-- settings: doc chung + cua hang minh; ghi qua set_setting()
create policy settings_select on public.settings for select to authenticated
  using (store_id is null or (select public.can_access_store(store_id)));

-- document_sequences: khong co policy => chi truy cap qua ham SECURITY DEFINER

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (
    (select public.auth_role()) = 'sadmin'
    or ((select public.auth_role()) in ('admin','accountant')
        and store_id is not null and (select public.can_access_store(store_id)))
  );

------------------------------------------------------------
-- Quyen thuc thi ham
------------------------------------------------------------
revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.auth_store_ids() from public, anon;
revoke execute on function public.can_access_store(uuid) from public, anon;
revoke execute on function public.is_store_manager(uuid) from public, anon;
revoke execute on function public.auth_has_perm(text) from public, anon;
revoke execute on function public.raise_error(text, text) from public, anon;
revoke execute on function public.assert_role(public.app_role[]) from public, anon;
revoke execute on function public.get_setting(text, uuid) from public, anon;
revoke execute on function public.set_setting(text, uuid, jsonb) from public, anon;
revoke execute on function public.next_doc_code(text, text) from public, anon, authenticated;
revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.protect_last_sadmin() from public, anon, authenticated;

grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_store_ids() to authenticated;
grant execute on function public.can_access_store(uuid) to authenticated;
grant execute on function public.is_store_manager(uuid) to authenticated;
grant execute on function public.auth_has_perm(text) to authenticated;
grant execute on function public.raise_error(text, text) to authenticated;
grant execute on function public.assert_role(public.app_role[]) to authenticated;
grant execute on function public.get_setting(text, uuid) to authenticated;
grant execute on function public.set_setting(text, uuid, jsonb) to authenticated;
