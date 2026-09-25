-- Sprint 1 - san pham, barcode, gia, nha cung cap, hang thanh vien, cua hang
-- Nguon: SPEC 6.4, 6.5 (suppliers), 6.10 (member_tiers), 7.4, 8.3 (F3.1-F3.4), 8.5 (F5.1), 8.9.

create extension if not exists unaccent with schema extensions;

------------------------------------------------------------
-- Tim kiem khong dau
------------------------------------------------------------
create or replace function public.search_text(t text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;

drop index if exists public.products_name_trgm_idx;
alter table public.products
  add column search_key text generated always as (public.search_text(name || ' ' || sku)) stored;
create index products_search_trgm_idx on public.products using gin (search_key extensions.gin_trgm_ops);

------------------------------------------------------------
-- Nhan vien khong doc truc tiep bang co gia von (products, inventory, lo, bien dong).
-- Nhan vien lay du lieu qua RPC catalog_search / product_lookup (chi cot an toan).
------------------------------------------------------------
drop policy products_select on public.products;
create policy products_select on public.products for select to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant'));

drop policy inventory_select on public.inventory;
create policy inventory_select on public.inventory for select to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant')
         and (select public.can_access_store(store_id)));

drop policy stock_lots_select on public.stock_lots;
create policy stock_lots_select on public.stock_lots for select to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant')
         and (select public.can_access_store(store_id)));

drop policy stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant')
         and (select public.can_access_store(store_id)));

drop policy categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using ((select public.auth_role()) is not null);

create policy product_barcodes_delete on public.product_barcodes for delete to authenticated
  using ((select public.auth_role()) in ('sadmin','admin'));

-- store_overview chay voi quyen nguoi goi; nhan vien khong doc inventory nen dung ban SECURITY DEFINER
create or replace function public.store_overview(p_store_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem cửa hàng này');
  end if;
  select jsonb_build_object(
    'active_products', (select count(*) from public.products p where p.status = 'active'),
    'skus_in_stock', count(*) filter (where i.qty_on_hand > 0),
    'total_qty', coalesce(sum(i.qty_on_hand), 0),
    'stock_value', case when public.auth_role() in ('sadmin','admin','accountant')
                        then coalesce(sum(i.qty_on_hand * i.avg_cost), 0) end)
  into r
  from public.inventory i
  where i.store_id = p_store_id;
  return r;
end $$;

------------------------------------------------------------
-- Gia ban theo % Benefit (SPEC 7.4)
------------------------------------------------------------
create or replace function public.round_to(v numeric, unit bigint)
returns bigint language sql immutable set search_path = '' as $$
  select case when unit is null or unit <= 0 then round(v)::bigint
              else (round(v / unit) * unit)::bigint end
$$;

create or replace function public.benefit_price(p_cost bigint, p_pct numeric)
returns bigint language sql stable security definer set search_path = '' as $$
  select case when p_cost is null or p_cost <= 0 or p_pct is null then null
              else public.round_to(p_cost * (1 + p_pct / 100),
                                   coalesce((public.get_setting('pricing.rounding_unit'))::text::bigint, 1000)) end
$$;

create or replace function public.product_benefit_pct(p_product_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(p.benefit_pct, c.benefit_pct)
  from public.products p left join public.categories c on c.id = p.category_id
  where p.id = p_product_id
$$;

-- Khi chu dong doi phuong thuc / % benefit / nhom hang: tinh lai gia ban ngay.
-- Khi gia von tham chieu doi (sau nhap hang): khong tu doi, chi goi y (price_suggestions).
create or replace function public.products_apply_benefit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pct numeric; v_price bigint;
begin
  if new.pricing_method = 'benefit' and (
       tg_op = 'INSERT'
       or new.pricing_method is distinct from old.pricing_method
       or new.benefit_pct is distinct from old.benefit_pct
       or new.category_id is distinct from old.category_id) then
    v_pct := coalesce(new.benefit_pct, (select c.benefit_pct from public.categories c where c.id = new.category_id));
    v_price := public.benefit_price(new.cost_price_ref, v_pct);
    if v_price is not null then
      new.sell_price := v_price;
    end if;
  end if;
  return new;
end $$;

create trigger products_apply_benefit_trg before insert or update on public.products
  for each row execute function public.products_apply_benefit();

create or replace function public.price_suggestions()
returns table (product_id uuid, sku text, name text, goods_type public.goods_type, cost_price_ref bigint,
               benefit_pct numeric, current_price bigint, suggested_price bigint)
language sql stable security invoker set search_path = '' as $$
  select * from (
    select p.id, p.sku, p.name, p.goods_type, p.cost_price_ref,
           coalesce(p.benefit_pct, c.benefit_pct) as pct,
           p.sell_price,
           public.benefit_price(p.cost_price_ref, coalesce(p.benefit_pct, c.benefit_pct)) as suggested
    from public.products p left join public.categories c on c.id = p.category_id
    where p.pricing_method = 'benefit' and p.status = 'active'
  ) x
  where x.suggested is not null and x.suggested <> x.sell_price
  order by x.name
$$;

create or replace function public.apply_price_suggestions(p_product_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  perform public.assert_role('sadmin','admin');
  update public.products p
     set sell_price = s.suggested_price
    from public.price_suggestions() s
   where s.product_id = p.id and p.id = any(p_product_ids);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

------------------------------------------------------------
-- Barcode (SPEC 8.3 F3.2, 13.1)
------------------------------------------------------------
create or replace function public.ean13_check_digit(p12 text)
returns integer language sql immutable set search_path = '' as $$
  select (10 - (sum(substr(p12, i, 1)::int * case when i % 2 = 0 then 3 else 1 end) % 10)) % 10
  from generate_series(1, 12) i
$$;

create or replace function public.add_product_barcode(
  p_product_id uuid, p_barcode text, p_type public.barcode_type default 'ean',
  p_pack_qty numeric default 1, p_is_primary boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_code text := upper(trim(p_barcode));
  v_other text;
begin
  perform public.assert_role('sadmin','admin','staff');
  if v_code is null or v_code !~ '^[0-9A-Z-]{4,32}$' then
    perform public.raise_error('VALIDATION', 'Mã vạch không hợp lệ');
  end if;
  if coalesce(p_pack_qty, 0) <= 0 then
    perform public.raise_error('VALIDATION', 'Số lượng quy đổi phải lớn hơn 0');
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy sản phẩm');
  end if;
  select p.name into v_other from public.product_barcodes b join public.products p on p.id = b.product_id
   where b.barcode = v_code;
  if v_other is not null then
    perform public.raise_error('VALIDATION', 'Mã vạch đã gán cho sản phẩm: ' || v_other);
  end if;

  if p_is_primary then
    update public.product_barcodes set is_primary = false where product_id = p_product_id and is_primary;
  end if;
  insert into public.product_barcodes(product_id, barcode, type, pack_qty, is_primary)
  values (p_product_id, v_code, p_type, p_pack_qty,
          p_is_primary or not exists (select 1 from public.product_barcodes
                                       where product_id = p_product_id and is_primary))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.generate_internal_barcode(p_product_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_sku text; v_p12 text; v_code text;
begin
  perform public.assert_role('sadmin','admin');
  select sku into v_sku from public.products where id = p_product_id;
  if v_sku is null then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy sản phẩm');
  end if;
  v_p12 := '2' || lpad(right(regexp_replace(v_sku, '\D', '', 'g'), 11), 11, '0');
  v_code := v_p12 || public.ean13_check_digit(v_p12)::text;
  if exists (select 1 from public.product_barcodes where barcode = v_code and product_id = p_product_id) then
    return v_code;
  end if;
  perform public.add_product_barcode(p_product_id, v_code, 'internal', 1, false);
  return v_code;
end $$;

create or replace function public.set_primary_barcode(p_barcode_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_product uuid;
begin
  perform public.assert_role('sadmin','admin');
  select product_id into v_product from public.product_barcodes where id = p_barcode_id;
  if v_product is null then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy mã vạch');
  end if;
  update public.product_barcodes set is_primary = (id = p_barcode_id) where product_id = v_product;
end $$;

------------------------------------------------------------
-- Tra cuu san pham cho moi vai tro (chi cot an toan cho nhan vien)
------------------------------------------------------------
create or replace function public.catalog_search(
  p_store_id uuid, p_q text default null, p_limit integer default 30, p_include_inactive boolean default false)
returns table (product_id uuid, sku text, name text, unit text, goods_type public.goods_type,
               sell_price bigint, status public.product_status, expiry_level public.expiry_level,
               barcode text, pack_qty numeric, barcodes text[],
               qty_on_hand numeric, qty_reserved numeric, qty_available numeric, nearest_expiry date)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_norm text := public.search_text(v_q);
  v_hit_product uuid;
  v_hit_pack numeric;
begin
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem cửa hàng này');
  end if;

  -- khop dung ma vach (ke ca ma loc) truoc
  if v_q is not null then
    select b.product_id, b.pack_qty into v_hit_product, v_hit_pack
      from public.product_barcodes b where b.barcode = upper(v_q);
  end if;

  return query
  select p.id, p.sku, p.name, p.unit, p.goods_type, p.sell_price, p.status, p.expiry_level,
         case when p.id = v_hit_product then upper(v_q)
              else (select b.barcode from public.product_barcodes b where b.product_id = p.id and b.is_primary) end,
         case when p.id = v_hit_product then v_hit_pack else 1::numeric end,
         array(select b.barcode from public.product_barcodes b where b.product_id = p.id order by b.is_primary desc, b.barcode),
         coalesce(i.qty_on_hand, 0), coalesce(i.qty_reserved, 0), coalesce(i.qty_available, 0),
         (select min(l.expiry_date) from public.stock_lots l
           where l.store_id = p_store_id and l.product_id = p.id and l.qty_on_hand > 0
             and (l.expiry_date is null or l.expiry_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date))
  from public.products p
  left join public.inventory i on i.store_id = p_store_id and i.product_id = p.id
  where (p_include_inactive or p.status = 'active')
    and (v_q is null
         or p.id = v_hit_product
         or upper(p.sku) = upper(v_q)
         or p.search_key like '%' || v_norm || '%')
  order by (p.id = v_hit_product) desc nulls last, p.name
  limit greatest(1, least(coalesce(p_limit, 30), 200));
end $$;

------------------------------------------------------------
-- Nha cung cap (SPEC 6.5, F5.1)
------------------------------------------------------------
create sequence public.supplier_code_seq;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('NCC-' || lpad(nextval('public.supplier_code_seq')::text, 4, '0')),
  name text not null check (length(trim(name)) > 0),
  contact_name text,
  phone text,
  email text,
  address text,
  tax_code text,
  bank_name text,
  bank_account text,
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 365),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid default auth.uid()
);
alter table public.suppliers
  add column search_key text generated always as (public.search_text(name || ' ' || code || ' ' || coalesce(phone, ''))) stored;
create index suppliers_search_trgm_idx on public.suppliers using gin (search_key extensions.gin_trgm_ops);

create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();
create trigger audit_suppliers after insert or update or delete on public.suppliers
  for each row execute function public.audit_row_change();

alter table public.suppliers enable row level security;
create policy suppliers_select on public.suppliers for select to authenticated
  using ((select public.auth_role()) is not null);
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check ((select public.auth_role()) in ('sadmin','admin','accountant'));
create policy suppliers_update on public.suppliers for update to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant'))
  with check ((select public.auth_role()) in ('sadmin','admin','accountant'));

------------------------------------------------------------
-- Hang thanh vien (SPEC 6.10, Phu luc A). Admin chinh duoc (quyet dinh cua khach).
------------------------------------------------------------
create table public.member_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rank integer not null unique check (rank >= 0),
  min_total_spent bigint not null default 0 check (min_total_spent >= 0),
  earn_multiplier numeric(4,2) not null default 1 check (earn_multiplier > 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create trigger member_tiers_updated_at before update on public.member_tiers
  for each row execute function public.set_updated_at();
create trigger audit_member_tiers after insert or update or delete on public.member_tiers
  for each row execute function public.audit_row_change();

alter table public.member_tiers enable row level security;
create policy member_tiers_select on public.member_tiers for select to authenticated
  using ((select public.auth_role()) is not null);
create policy member_tiers_write on public.member_tiers for all to authenticated
  using ((select public.auth_role()) in ('sadmin','admin'))
  with check ((select public.auth_role()) in ('sadmin','admin'));

insert into public.member_tiers(name, rank, min_total_spent, earn_multiplier, discount_pct) values
  ('Thành viên', 0, 0, 1, 0),
  ('Bạc', 1, 5000000, 1, 0),
  ('Vàng', 2, 20000000, 1.5, 2),
  ('Kim cương', 3, 50000000, 2, 5)
on conflict (name) do nothing;

------------------------------------------------------------
-- Thong tin cua hang: admin sua cua hang minh; doi ma chi sadmin
------------------------------------------------------------
create or replace function public.update_store(p_store_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_manager(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền sửa cửa hàng này');
  end if;
  if nullif(trim(p ->> 'name'), '') is null then
    perform public.raise_error('VALIDATION', 'Tên cửa hàng bắt buộc');
  end if;
  update public.stores set
    name = trim(p ->> 'name'),
    address = nullif(trim(p ->> 'address'), ''),
    phone = nullif(trim(p ->> 'phone'), ''),
    tax_code = nullif(trim(p ->> 'tax_code'), ''),
    invoice_header = nullif(p ->> 'invoice_header', ''),
    invoice_footer = nullif(p ->> 'invoice_footer', '')
  where id = p_store_id;
end $$;

------------------------------------------------------------
-- Import danh muc san pham tu Excel (F3.1). Tat ca hoac khong.
-- p_items: [{row, name, unit, goods_type, sell_price, category, brand, barcode, min_stock, note}]
------------------------------------------------------------
create or replace function public.import_products(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  v_row text;
  v_cat uuid;
  v_brand uuid;
  v_pid uuid;
  v_count integer := 0;
begin
  perform public.assert_role('sadmin','admin');
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform public.raise_error('VALIDATION', 'File không có dòng dữ liệu');
  end if;
  if jsonb_array_length(p_items) > 5000 then
    perform public.raise_error('VALIDATION', 'Tối đa 5.000 dòng mỗi lần import');
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_row := coalesce(it ->> 'row', '?');
    if nullif(trim(it ->> 'name'), '') is null or nullif(trim(it ->> 'unit'), '') is null then
      perform public.raise_error('VALIDATION', format('Dòng %s: thiếu tên hoặc đơn vị tính', v_row));
    end if;
    if (it ->> 'goods_type') not in ('cont','air') then
      perform public.raise_error('VALIDATION', format('Dòng %s: loại hàng phải là cont hoặc air', v_row));
    end if;

    v_cat := null; v_brand := null;
    if nullif(trim(it ->> 'category'), '') is not null then
      insert into public.categories(name) values (trim(it ->> 'category'))
      on conflict (name) do update set name = excluded.name returning id into v_cat;
    end if;
    if nullif(trim(it ->> 'brand'), '') is not null then
      insert into public.brands(name) values (trim(it ->> 'brand'))
      on conflict (name) do update set name = excluded.name returning id into v_brand;
    end if;

    begin
      insert into public.products(name, unit, goods_type, sell_price, category_id, brand_id, min_stock, note)
      values (trim(it ->> 'name'), trim(it ->> 'unit'), (it ->> 'goods_type')::public.goods_type,
              coalesce((it ->> 'sell_price')::bigint, 0), v_cat, v_brand,
              (it ->> 'min_stock')::numeric, nullif(trim(it ->> 'note'), ''))
      returning id into v_pid;
    exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
      perform public.raise_error('VALIDATION', format('Dòng %s: dữ liệu không hợp lệ (%s)', v_row, sqlerrm));
    end;

    if nullif(trim(it ->> 'barcode'), '') is not null then
      begin
        perform public.add_product_barcode(v_pid, it ->> 'barcode', 'ean', 1, true);
      exception when others then
        perform public.raise_error('VALIDATION', format('Dòng %s: %s', v_row, sqlerrm));
      end;
    end if;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('products', v_count);
end $$;

------------------------------------------------------------
-- Quyen thuc thi
------------------------------------------------------------
revoke execute on function public.search_text(text) from public, anon;
revoke execute on function public.round_to(numeric, bigint) from public, anon;
revoke execute on function public.benefit_price(bigint, numeric) from public, anon;
revoke execute on function public.product_benefit_pct(uuid) from public, anon;
revoke execute on function public.products_apply_benefit() from public, anon, authenticated;
revoke execute on function public.price_suggestions() from public, anon;
revoke execute on function public.apply_price_suggestions(uuid[]) from public, anon;
revoke execute on function public.ean13_check_digit(text) from public, anon;
revoke execute on function public.add_product_barcode(uuid, text, public.barcode_type, numeric, boolean) from public, anon;
revoke execute on function public.generate_internal_barcode(uuid) from public, anon;
revoke execute on function public.set_primary_barcode(uuid) from public, anon;
revoke execute on function public.catalog_search(uuid, text, integer, boolean) from public, anon;
revoke execute on function public.update_store(uuid, jsonb) from public, anon;
revoke execute on function public.import_products(jsonb) from public, anon;
revoke execute on function public.store_overview(uuid) from public, anon;

grant execute on function public.search_text(text) to authenticated;
grant execute on function public.round_to(numeric, bigint) to authenticated;
grant execute on function public.benefit_price(bigint, numeric) to authenticated;
grant execute on function public.product_benefit_pct(uuid) to authenticated;
grant execute on function public.price_suggestions() to authenticated;
grant execute on function public.apply_price_suggestions(uuid[]) to authenticated;
grant execute on function public.ean13_check_digit(text) to authenticated;
grant execute on function public.add_product_barcode(uuid, text, public.barcode_type, numeric, boolean) to authenticated;
grant execute on function public.generate_internal_barcode(uuid) to authenticated;
grant execute on function public.set_primary_barcode(uuid) to authenticated;
grant execute on function public.catalog_search(uuid, text, integer, boolean) to authenticated;
grant execute on function public.update_store(uuid, jsonb) to authenticated;
grant execute on function public.import_products(jsonb) to authenticated;
grant execute on function public.store_overview(uuid) to authenticated;

-- Cho phep hien ten nguoi doi gia
alter table public.price_history
  add constraint price_history_changed_by_fkey foreign key (changed_by) references public.profiles(id);
