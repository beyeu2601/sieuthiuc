-- Sprint 0 - san pham, barcode, lich su gia
-- Nguon: SPEC muc 6.4, 7.4, 8.3.
-- Khac SPEC: products.goods_type NOT NULL; moi san pham thuoc dung 1 loai hang (cont / air),
-- cung mot mat hang nhap theo 2 kenh duoc tao thanh 2 ma san pham (quyet dinh cua khach 25/09/2026).
-- product_store_prices (P1) chua tao.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  benefit_pct numeric(6,2) check (benefit_pct between 0 and 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid
);

create sequence public.product_sku_seq;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique default ('SP-' || lpad(nextval('public.product_sku_seq')::text, 6, '0')),
  name text not null check (length(trim(name)) > 0),
  category_id uuid references public.categories(id),
  brand_id uuid references public.brands(id),
  goods_type public.goods_type not null,
  unit text not null,
  sell_price bigint not null default 0 check (sell_price >= 0),
  pricing_method public.pricing_method not null default 'manual',
  benefit_pct numeric(6,2) check (benefit_pct between 0 and 1000),
  cost_price_ref bigint not null default 0 check (cost_price_ref >= 0),
  expiry_level public.expiry_level not null default 'lot',
  expiry_date date,
  min_stock numeric(12,3) check (min_stock >= 0),
  max_stock numeric(12,3) check (max_stock >= 0),
  status public.product_status not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid,
  constraint products_expiry_product_ck check (expiry_level <> 'product' or expiry_date is not null)
);
create index products_name_trgm_idx on public.products using gin (lower(name) extensions.gin_trgm_ops);
create index products_category_idx on public.products(category_id);
create index products_status_idx on public.products(status);

create table public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  barcode text not null unique check (barcode ~ '^[0-9A-Za-z-]{4,32}$'),
  type public.barcode_type not null default 'ean',
  pack_qty numeric(12,3) not null default 1 check (pack_qty > 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index product_barcodes_product_idx on public.product_barcodes(product_id);
create unique index product_barcodes_one_primary_uq on public.product_barcodes(product_id) where is_primary;

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  store_id uuid references public.stores(id),
  field text not null check (field in ('sell_price','benefit_pct','pricing_method')),
  old_value text,
  new_value text,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  reason text
);
create index price_history_product_idx on public.price_history(product_id, changed_at desc);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Ghi lich su gia khi doi sell_price / benefit_pct / pricing_method (SPEC 7.4)
create or replace function public.products_price_history()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  f text;
  v_old text;
  v_new text;
begin
  new.updated_by := auth.uid();
  foreach f in array array['sell_price','benefit_pct','pricing_method'] loop
    v_old := to_jsonb(old) ->> f;
    v_new := to_jsonb(new) ->> f;
    if v_old is distinct from v_new then
      update public.price_history set effective_to = now()
        where product_id = new.id and field = f and store_id is null and effective_to is null;
      insert into public.price_history(product_id, field, old_value, new_value, changed_by)
      values (new.id, f, v_old, v_new, auth.uid());
    end if;
  end loop;
  return new;
end $$;

create trigger products_price_history_trg before update on public.products
  for each row execute function public.products_price_history();

create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.audit_row_change();
create trigger audit_brands after insert or update or delete on public.brands
  for each row execute function public.audit_row_change();
create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.audit_row_change();
create trigger audit_product_barcodes after insert or update or delete on public.product_barcodes
  for each row execute function public.audit_row_change();

-- RLS: danh muc dung chung toan he thong; doc: moi nguoi dung dang nhap; ghi: sadmin, admin.
-- Khong xoa cung san pham (chuyen inactive).
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.price_history enable row level security;

create policy categories_select on public.categories for select to authenticated
  using ((select public.auth_role()) is not null);
create policy categories_insert on public.categories for insert to authenticated
  with check ((select public.auth_role()) in ('sadmin','admin'));
create policy categories_update on public.categories for update to authenticated
  using ((select public.auth_role()) in ('sadmin','admin'))
  with check ((select public.auth_role()) in ('sadmin','admin'));

create policy brands_select on public.brands for select to authenticated
  using ((select public.auth_role()) is not null);
create policy brands_insert on public.brands for insert to authenticated
  with check ((select public.auth_role()) in ('sadmin','admin'));
create policy brands_update on public.brands for update to authenticated
  using ((select public.auth_role()) in ('sadmin','admin'))
  with check ((select public.auth_role()) in ('sadmin','admin'));

create policy products_select on public.products for select to authenticated
  using ((select public.auth_role()) is not null);
create policy products_insert on public.products for insert to authenticated
  with check ((select public.auth_role()) in ('sadmin','admin'));
create policy products_update on public.products for update to authenticated
  using ((select public.auth_role()) in ('sadmin','admin'))
  with check ((select public.auth_role()) in ('sadmin','admin'));

create policy product_barcodes_select on public.product_barcodes for select to authenticated
  using ((select public.auth_role()) is not null);
create policy product_barcodes_insert on public.product_barcodes for insert to authenticated
  with check ((select public.auth_role()) in ('sadmin','admin'));
create policy product_barcodes_update on public.product_barcodes for update to authenticated
  using ((select public.auth_role()) in ('sadmin','admin'))
  with check ((select public.auth_role()) in ('sadmin','admin'));

create policy price_history_select on public.price_history for select to authenticated
  using ((select public.auth_role()) in ('sadmin','admin','accountant'));

revoke execute on function public.products_price_history() from public, anon, authenticated;
